import { gymRepository } from '@/repositories/gym.repository';
import { GymChatMessage } from '@/types/gym.types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { RealtimeChannel } from '@supabase/supabase-js';

export class GymChatService {
  private activeSubscriptions = new Map<string, RealtimeChannel>();
  private lastSentTimestamps: number[] = [];

  clearRateLimits(): void {
    this.lastSentTimestamps = [];
  }

  /**
   * Fetch chat message history for a given connection
   */
  async getMessages(
    connectionId: string,
    limit = 50,
    beforeTimestamp?: string
  ): Promise<GymChatMessage[]> {
    if (!connectionId) return [];
    return gymRepository.fetchChatMessages(connectionId, limit, beforeTimestamp);
  }

  /**
   * Send a chat message to an accepted gym buddy connection
   * Client-side rate limiting check precedes server-authoritative check.
   */
  async sendMessage(connectionId: string, content: string): Promise<GymChatMessage> {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      throw new Error('Message content cannot be empty');
    }
    if (trimmed.length > 2000) {
      throw new Error('Message exceeds 2000 character limit');
    }

    // Client-side rate limiting: Max 30 messages in 60s
    const now = Date.now();
    this.lastSentTimestamps = this.lastSentTimestamps.filter(t => now - t < 60000);
    if (this.lastSentTimestamps.length >= 30) {
      throw new Error('Rate limit exceeded: Please wait before sending more messages');
    }

    const message = await gymRepository.sendChatMessage(connectionId, trimmed);
    this.lastSentTimestamps.push(now);
    return message;
  }

  async markAsRead(connectionId: string): Promise<number> {
    if (!connectionId) return 0;
    return gymRepository.markChatRead(connectionId);
  }

  /**
   * Alias for markAsRead
   */
  async markRead(connectionId: string): Promise<number> {
    return this.markAsRead(connectionId);
  }

  /**
   * Fetch unread message count for a participant
   */
  async getUnreadCount(connectionId: string, currentUserId: string): Promise<number> {
    if (!connectionId || !currentUserId) return 0;
    return gymRepository.fetchChatUnreadCount(connectionId, currentUserId);
  }

  /**
   * Edit content of an existing message (sender only)
   */
  async editMessage(messageId: string, newContent: string): Promise<GymChatMessage> {
    return gymRepository.editChatMessage(messageId, newContent);
  }

  /**
   * Soft-delete an existing message (sender only)
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    return gymRepository.deleteChatMessage(messageId);
  }

  /**
   * Subscribe to Supabase Realtime channel for live messages in a connection.
   * Supabase Realtime automatically respects RLS on Postgres publications.
   */
  subscribeToConnection(
    connectionId: string,
    onNewMessage: (message: GymChatMessage) => void
  ): () => void {
    if (!connectionId || !isSupabaseConfigured) {
      return () => {};
    }

    // Unsubscribe existing if already registered
    this.unsubscribeFromConnection(connectionId);

    try {
      const channel = supabase
        .channel(`gym-chat:${connectionId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'gym_chat_messages',
            filter: `connection_id=eq.${connectionId}`,
          },
          payload => {
            const row = payload.new as any;
            if (row && !row.deleted_at) {
              const msg: GymChatMessage = {
                id: row.id,
                connectionId: row.connection_id,
                senderId: row.sender_id,
                content: row.content,
                readAt: row.read_at,
                editedAt: row.edited_at,
                deletedAt: row.deleted_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              };
              onNewMessage(msg);
            }
          }
        )
        .subscribe(status => {
          logger.info(`GymChatService: Realtime subscription status for ${connectionId}: ${status}`);
        });

      this.activeSubscriptions.set(connectionId, channel);

      return () => {
        this.unsubscribeFromConnection(connectionId);
      };
    } catch (err) {
      logger.error('GymChatService: Error setting up Realtime subscription', { err });
      return () => {};
    }
  }

  /**
   * Unsubscribe from Realtime channel
   */
  unsubscribeFromConnection(connectionId: string): void {
    const existing = this.activeSubscriptions.get(connectionId);
    if (existing) {
      supabase.removeChannel(existing);
      this.activeSubscriptions.delete(connectionId);
    }
  }
}

export const gymChatService = new GymChatService();
