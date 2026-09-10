import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CoachResponse } from '@/types/ai.types';
import { validateUserMessage } from '@/utils/validation';

export const aiService = {
  async askGuruJi(message: string): Promise<CoachResponse> {
    const validation = validateUserMessage(message);
    if (!validation.isValid) {
      return {
        message: validation.error || 'Please enter a valid fitness question.',
      };
    }

    if (!isSupabaseConfigured) {
      // Local preview simulation
      const lower = message.toLowerCase();
      if (lower.includes('workout') || lower.includes('aaj')) {
        return {
          message: 'Namaste! Aaj aapka focus proper warm-up aur controlled reps par hona chahiye. Har set me eccentric phase ko 2 second control karein.',
          suggestedAction: 'view_workout',
          disclaimer: 'Operating in guidance mode.',
        };
      }
      if (lower.includes('protein') || lower.includes('diet') || lower.includes('food')) {
        return {
          message: 'Nutrition me consistency sabse zaroori hai! Paneer, Dal, Soya chunks, aur Eggs ke through apna daily protein target hit karein.',
          suggestedAction: 'check_nutrition',
          disclaimer: 'Nutritional estimates are for reference.',
        };
      }
      return {
        message: `Guru Ji guidance: "${validation.sanitized}" — Consistency is the secret. Har din 1% behtar banne par focus karein!`,
        suggestedAction: 'view_workout',
        disclaimer: 'AI Coach guidance mode.',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('guru-ji-coach', {
        body: { message: validation.sanitized },
      });

      if (error || !data) {
        throw error || new Error('No response from coach');
      }

      return data as CoachResponse;
    } catch {
      // Graceful fallback if edge function fails or times out
      return {
        message: 'Guru Ji is briefly reviewing workout notes. Your tracking, streak, and PRs remain 100% operational! Focus on your workout today.',
        suggestedAction: 'view_workout',
        disclaimer: 'AI service temporarily unavailable. Core platform is operational.',
      };
    }
  },
};
