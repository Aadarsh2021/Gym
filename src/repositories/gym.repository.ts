import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Gym,
  GymMembership,
  GymMembershipStatus,
  GymCheckin,
  GymVerificationMethod,
  GymAttendanceSession,
  GymCheckoutMethod,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GymRepository {
  // ── 1. Gym Discovery & Directory ──────────────────────────────────────────
  async fetchAllGyms(): Promise<Gym[]> {
    if (!isSupabaseConfigured) {
      const stored = platform.storage.getItem('cached_all_gyms');
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .order('name', { ascending: true });

      if (error || !data || data.length === 0) {
        const stored = platform.storage.getItem('cached_all_gyms');
        if (stored && typeof stored === 'string') {
          try { return JSON.parse(stored); } catch { /* ignore */ }
        }
        return [];
      }

      const mapped: Gym[] = data.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        ownerId: g.owner_id,
        address: g.address,
        city: g.city,
        state: g.state || undefined,
        pincode: g.pincode || undefined,
        contactNumber: g.contact_number || undefined,
        email: g.email || undefined,
        description: g.description || undefined,
        openingTime: g.opening_time || undefined,
        closingTime: g.closing_time || undefined,
        weeklySchedule: g.weekly_schedule || undefined,
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        radiusMeters: g.radius_meters || 200,
        qrCodeHash: g.qr_code_hash,
        logoUrl: g.logo_url || undefined,
        coverImageUrl: g.cover_image_url || undefined,
        createdAt: g.created_at,
      }));

      platform.storage.setItem('cached_all_gyms', JSON.stringify(mapped));
      return mapped;
    } catch (err) {
      logger.error('GymRepository: Error fetching gyms', { err });
      const stored = platform.storage.getItem('cached_all_gyms');
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }
  }

  async searchGyms(query: string, city?: string): Promise<Gym[]> {
    const all = await this.fetchAllGyms();
    if (!query.trim() && !city?.trim()) return all;
    const q = query.toLowerCase().trim();
    const c = city?.toLowerCase().trim();
    return all.filter(g => {
      const matchName =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.slug.toLowerCase().includes(q) ||
        g.address.toLowerCase().includes(q) ||
        Boolean(g.description && g.description.toLowerCase().includes(q));
      const matchCity = !c || g.city.toLowerCase().includes(c);
      return matchName && matchCity;
    });
  }

  private mapGymRow(data: any): Gym {
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      ownerId: data.owner_id,
      address: data.address,
      city: data.city,
      state: data.state || undefined,
      pincode: data.pincode || undefined,
      contactNumber: data.contact_number || undefined,
      email: data.email || undefined,
      description: data.description || undefined,
      openingTime: data.opening_time || undefined,
      closingTime: data.closing_time || undefined,
      weeklySchedule: data.weekly_schedule || undefined,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      radiusMeters: data.radius_meters || 200,
      qrCodeHash: data.qr_code_hash,
      logoUrl: data.logo_url || undefined,
      coverImageUrl: data.cover_image_url || undefined,
      createdAt: data.created_at,
    };
  }

  async fetchGymById(gymId: string): Promise<Gym | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const stored = platform.storage.getItem('cached_all_gyms');
      if (stored && typeof stored === 'string') {
        try {
          const parsed = JSON.parse(stored) as Gym[];
          const match = parsed.find(g => g.id === gymId);
          if (match) return match;
        } catch { /* ignore */ }
      }
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('id', gymId)
        .maybeSingle();

      if (error || !data) return null;
      return this.mapGymRow(data);
    } catch {
      return null;
    }
  }

  async resolveGymByQr(qrCodeHash: string): Promise<Gym | null> {
    if (!qrCodeHash || typeof qrCodeHash !== 'string') return null;
    const cleanHash = qrCodeHash.trim();
    if (!cleanHash) return null;

    if (!isSupabaseConfigured) {
      const stored = platform.storage.getItem('cached_all_gyms');
      if (stored && typeof stored === 'string') {
        try {
          const list: Gym[] = JSON.parse(stored);
          const match = list.find(g => g.qrCodeHash === cleanHash);
          if (match) return match;
        } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('qr_code_hash', cleanHash)
        .maybeSingle();

      if (error || !data) {
        const stored = platform.storage.getItem('cached_all_gyms');
        if (stored && typeof stored === 'string') {
          try {
            const list: Gym[] = JSON.parse(stored);
            const match = list.find(g => g.qrCodeHash === cleanHash);
            if (match) return match;
          } catch { /* ignore */ }
        }
        return null;
      }

      return this.mapGymRow(data);
    } catch {
      return null;
    }
  }

  async fetchOwnerGyms(ownerId: string): Promise<Gym[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(ownerId)) {
      const stored = platform.storage.getItem(`owner_gyms_${ownerId}`);
      if (stored && typeof stored === 'string') {
        try { return JSON.parse(stored); } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('gyms')
        .select('*')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      const mapped = data.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        ownerId: g.owner_id,
        address: g.address,
        city: g.city,
        state: g.state || undefined,
        pincode: g.pincode || undefined,
        contactNumber: g.contact_number || undefined,
        email: g.email || undefined,
        description: g.description || undefined,
        openingTime: g.opening_time || undefined,
        closingTime: g.closing_time || undefined,
        weeklySchedule: g.weekly_schedule || undefined,
        latitude: Number(g.latitude),
        longitude: Number(g.longitude),
        radiusMeters: g.radius_meters || 200,
        qrCodeHash: g.qr_code_hash,
        logoUrl: g.logo_url || undefined,
        coverImageUrl: g.cover_image_url || undefined,
        createdAt: g.created_at,
      }));

      platform.storage.setItem(`owner_gyms_${ownerId}`, JSON.stringify(mapped));
      return mapped;
    } catch (err) {
      logger.error('GymRepository: Error fetching owner gyms', { err });
      return [];
    }
  }

  async generateUniqueSlug(baseName: string): Promise<string> {
    const raw = baseName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'gym';

    let candidate = raw;
    let counter = 1;

    while (true) {
      if (!isSupabaseConfigured) {
        return candidate;
      }
      try {
        const { data } = await supabase
          .from('gyms')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle();

        if (!data) {
          return candidate;
        }
        counter++;
        candidate = `${raw}-${counter}`;
      } catch {
        return candidate;
      }
    }
  }

  async createGym(
    gymData: Omit<Gym, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; gym?: Gym; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymData.ownerId)) {
      const mockGym: Gym = {
        ...gymData,
        id: 'gym-' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date().toISOString(),
      };
      const existing = await this.fetchOwnerGyms(gymData.ownerId);
      existing.unshift(mockGym);
      platform.storage.setItem(`owner_gyms_${gymData.ownerId}`, JSON.stringify(existing));

      const allStored = platform.storage.getItem('cached_all_gyms');
      let allList: Gym[] = [];
      if (allStored && typeof allStored === 'string') {
        try { allList = JSON.parse(allStored); } catch { /* ignore */ }
      }
      if (!allList.some(g => g.id === mockGym.id)) {
        allList.unshift(mockGym);
        platform.storage.setItem('cached_all_gyms', JSON.stringify(allList));
      }

      return { success: true, gym: mockGym };
    }

    try {
      const { data, error } = await supabase
        .from('gyms')
        .insert({
          name: gymData.name,
          slug: gymData.slug,
          owner_id: gymData.ownerId,
          address: gymData.address,
          city: gymData.city,
          state: gymData.state,
          pincode: gymData.pincode,
          contact_number: gymData.contactNumber,
          email: gymData.email,
          description: gymData.description,
          opening_time: gymData.openingTime,
          closing_time: gymData.closingTime,
          weekly_schedule: gymData.weeklySchedule,
          latitude: gymData.latitude,
          longitude: gymData.longitude,
          radius_meters: gymData.radiusMeters || 200,
          qr_code_hash: gymData.qrCodeHash,
          logo_url: gymData.logoUrl,
          cover_image_url: gymData.coverImageUrl,
        })
        .select('*')
        .single();

      if (error || !data) {
        logger.error('GymRepository: Error creating gym', { error });
        return { success: false, error: error?.message || 'Failed to create gym' };
      }

      const created: Gym = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.owner_id,
        address: data.address,
        city: data.city,
        state: data.state || undefined,
        pincode: data.pincode || undefined,
        contactNumber: data.contact_number || undefined,
        email: data.email || undefined,
        description: data.description || undefined,
        openingTime: data.opening_time || undefined,
        closingTime: data.closing_time || undefined,
        weeklySchedule: data.weekly_schedule || undefined,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radius_meters || 200,
        qrCodeHash: data.qr_code_hash,
        logoUrl: data.logo_url || undefined,
        coverImageUrl: data.cover_image_url || undefined,
        createdAt: data.created_at,
      };

      const existing = await this.fetchOwnerGyms(gymData.ownerId);
      existing.unshift(created);
      platform.storage.setItem(`owner_gyms_${gymData.ownerId}`, JSON.stringify(existing));

      const allStored = platform.storage.getItem('cached_all_gyms');
      let allList: Gym[] = [];
      if (allStored && typeof allStored === 'string') {
        try { allList = JSON.parse(allStored); } catch { /* ignore */ }
      }
      if (!allList.some(g => g.id === created.id)) {
        allList.unshift(created);
        platform.storage.setItem('cached_all_gyms', JSON.stringify(allList));
      }

      return { success: true, gym: created };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gym creation failed';
      return { success: false, error: msg };
    }
  }

  // ── 2. Member Memberships ──────────────────────────────────────────────────
  private mapMembershipRow(m: any): GymMembership {
    return {
      id: m.id,
      gymId: m.gym_id,
      userId: m.user_id,
      status: m.status,
      membershipType: m.membership_type,
      joinedAt: m.joined_at,
      expiresAt: m.expires_at,
      gym: m.gyms
        ? {
            id: m.gyms.id,
            name: m.gyms.name,
            slug: m.gyms.slug,
            ownerId: m.gyms.owner_id,
            address: m.gyms.address,
            city: m.gyms.city,
            state: m.gyms.state || undefined,
            pincode: m.gyms.pincode || undefined,
            contactNumber: m.gyms.contact_number || undefined,
            email: m.gyms.email || undefined,
            description: m.gyms.description || undefined,
            openingTime: m.gyms.opening_time || undefined,
            closingTime: m.gyms.closing_time || undefined,
            latitude: Number(m.gyms.latitude),
            longitude: Number(m.gyms.longitude),
            radiusMeters: m.gyms.radius_meters || 200,
            qrCodeHash: m.gyms.qr_code_hash,
          }
        : undefined,
    };
  }

  private saveMembershipToStorage(userId: string, membership: GymMembership): void {
    const raw = platform.storage.getItem(`user_memberships_${userId}`);
    let list: GymMembership[] = [];
    if (raw && typeof raw === 'string') {
      try { list = JSON.parse(raw); } catch { list = []; }
    }
    const idx = list.findIndex(m => m.gymId === membership.gymId);
    if (idx >= 0) {
      list[idx] = membership;
    } else {
      list.push(membership);
    }
    platform.storage.setItem(`user_memberships_${userId}`, JSON.stringify(list));
  }

  async getMyGymMembership(gymId: string, userId: string): Promise<GymMembership | null> {
    if (!gymId || !userId) return null;
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId) || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`user_memberships_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const list: GymMembership[] = JSON.parse(raw);
          const found = list.find(m => m.gymId === gymId && m.userId === userId);
          if (found) return found;
        } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('*, gyms(*)')
        .eq('gym_id', gymId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        const raw = platform.storage.getItem(`user_memberships_${userId}`);
        if (raw && typeof raw === 'string') {
          try {
            const list: GymMembership[] = JSON.parse(raw);
            const found = list.find(m => m.gymId === gymId && m.userId === userId);
            if (found) return found;
          } catch { /* ignore */ }
        }
        return null;
      }

      return this.mapMembershipRow(data);
    } catch {
      return null;
    }
  }

  async getMyGymMemberships(userId: string): Promise<GymMembership[]> {
    if (!userId) return [];
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`user_memberships_${userId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('gym_memberships')
        .select('*, gyms(*)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (error || !data || data.length === 0) {
        const raw = platform.storage.getItem(`user_memberships_${userId}`);
        if (raw && typeof raw === 'string') {
          try { return JSON.parse(raw); } catch { /* ignore */ }
        }
        return [];
      }

      const mapped = data.map(m => this.mapMembershipRow(m));
      platform.storage.setItem(`user_memberships_${userId}`, JSON.stringify(mapped));
      return mapped;
    } catch (err) {
      logger.error('GymRepository: Error fetching all user memberships', { err });
      const raw = platform.storage.getItem(`user_memberships_${userId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return [];
    }
  }

  async getMembershipStatus(gymId: string, userId: string): Promise<GymMembershipStatus | 'none'> {
    const membership = await this.getMyGymMembership(gymId, userId);
    return membership ? membership.status : 'none';
  }

  async requestGymMembership(
    gymId: string,
    userId: string,
    membershipType: string = 'monthly'
  ): Promise<{ success: boolean; membership?: GymMembership; error?: string; status?: GymMembershipStatus | 'none' }> {
    if (!gymId || !userId) {
      return { success: false, error: 'Invalid gym or user ID', status: 'none' };
    }

    // 1. Check existing membership to prevent duplicate rows & handle states
    const existing = await this.getMyGymMembership(gymId, userId);
    if (existing) {
      if (existing.status === 'active') {
        return {
          success: false,
          error: 'You are already an active member of this gym.',
          membership: existing,
          status: 'active',
        };
      }
      if (existing.status === 'pending') {
        return {
          success: false,
          error: 'A membership request for this gym is already pending approval.',
          membership: existing,
          status: 'pending',
        };
      }
      if (existing.status === 'frozen') {
        return {
          success: false,
          error: 'Your membership is currently frozen. Please contact gym administration.',
          membership: existing,
          status: 'frozen',
        };
      }
      if (existing.status === 'inactive') {
        // Reactivate inactive record by transitioning back to pending
        if (!isSupabaseConfigured || !UUID_REGEX.test(userId) || !UUID_REGEX.test(gymId)) {
          const updated: GymMembership = {
            ...existing,
            status: 'pending',
            membershipType,
            joinedAt: new Date().toISOString(),
            expiresAt: null,
          };
          this.saveMembershipToStorage(userId, updated);
          return { success: true, membership: updated, status: 'pending' };
        }

        try {
          const { data, error } = await supabase
            .from('gym_memberships')
            .update({
              status: 'pending',
              membership_type: membershipType,
              joined_at: new Date().toISOString(),
              expires_at: null,
            })
            .eq('id', existing.id)
            .eq('user_id', userId)
            .select('*, gyms(*)')
            .single();

          if (error) {
            logger.error('GymRepository: Error reactivating membership', { error });
            return { success: false, error: error.message, status: existing.status };
          }

          const mapped = this.mapMembershipRow(data);
          this.saveMembershipToStorage(userId, mapped);
          return { success: true, membership: mapped, status: 'pending' };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Reactivation failed';
          return { success: false, error: msg, status: existing.status };
        }
      }
    }

    // 2. New membership request -> status = 'pending'
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId) || !UUID_REGEX.test(gymId)) {
      const created: GymMembership = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        gymId,
        userId,
        status: 'pending',
        membershipType,
        joinedAt: new Date().toISOString(),
        expiresAt: null,
      };
      this.saveMembershipToStorage(userId, created);
      return { success: true, membership: created, status: 'pending' };
    }

    try {
      const { data, error } = await supabase
        .from('gym_memberships')
        .insert({
          gym_id: gymId,
          user_id: userId,
          status: 'pending',
          membership_type: membershipType,
          joined_at: new Date().toISOString(),
        })
        .select('*, gyms(*)')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_gym_user_membership')) {
          const recheck = await this.getMyGymMembership(gymId, userId);
          return {
            success: false,
            error: 'Membership record already exists for this facility.',
            membership: recheck || undefined,
            status: recheck?.status || 'pending',
          };
        }
        logger.error('GymRepository: Error requesting gym membership', { error });
        return { success: false, error: error.message, status: 'none' };
      }

      const mapped = this.mapMembershipRow(data);
      this.saveMembershipToStorage(userId, mapped);
      return { success: true, membership: mapped, status: 'pending' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Membership request failed';
      return { success: false, error: msg, status: 'none' };
    }
  }

  async fetchUserMemberships(userId: string): Promise<GymMembership[]> {
    const all = await this.getMyGymMemberships(userId);
    return all.filter(m => m.status === 'active');
  }

  // ── 3. Gym Attendance Sessions (Check-in -> Active Session -> Check-out) ───
  async startAttendanceSession(
    gymId: string,
    userId: string,
    verificationMethod: GymVerificationMethod
  ): Promise<{ success: boolean; session?: GymAttendanceSession; error?: string }> {
    // 1. Check for existing active session
    const existingActive = await this.getActiveAttendanceSession(userId);
    if (existingActive) {
      return { success: false, error: "You're already checked in." };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const mockSession: GymAttendanceSession = {
        id: `mock-att-${Date.now()}`,
        gymId,
        userId,
        checkInAt: new Date().toISOString(),
        checkOutAt: null,
        durationSeconds: null,
        verificationMethod,
        checkoutMethod: null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(mockSession));
      return { success: true, session: mockSession };
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .insert({
          gym_id: gymId,
          user_id: userId,
          verification_method: verificationMethod,
          status: 'active',
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('uq_user_single_active_attendance')) {
          return { success: false, error: "You're already checked in." };
        }
        logger.error('GymRepository: Error starting attendance session', { error });
        return { success: false, error: error.message };
      }

      const created: GymAttendanceSession = {
        id: data.id,
        gymId: data.gym_id,
        userId: data.user_id,
        checkInAt: data.check_in_at,
        checkOutAt: data.check_out_at,
        durationSeconds: data.duration_seconds,
        verificationMethod: data.verification_method,
        checkoutMethod: data.checkout_method,
        status: data.status,
        createdAt: data.created_at,
      };

      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(created));
      return { success: true, session: created };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start gym visit session';
      return { success: false, error: msg };
    }
  }

  async getActiveAttendanceSession(userId: string, gymId?: string): Promise<GymAttendanceSession | null> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`active_attendance_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.status === 'active') {
            if (!gymId || parsed.gymId === gymId) return parsed;
          }
        } catch { /* ignore */ }
      }
      return null;
    }

    try {
      let query = supabase
        .from('gym_attendance_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('check_in_at', { ascending: false })
        .limit(1);

      if (gymId) {
        query = query.eq('gym_id', gymId);
      }

      const { data, error } = await query.maybeSingle();
      if (error || !data) {
        platform.storage.removeItem(`active_attendance_${userId}`);
        return null;
      }

      const session: GymAttendanceSession = {
        id: data.id,
        gymId: data.gym_id,
        userId: data.user_id,
        checkInAt: data.check_in_at,
        checkOutAt: data.check_out_at,
        durationSeconds: data.duration_seconds,
        verificationMethod: data.verification_method,
        checkoutMethod: data.checkout_method,
        status: data.status,
        createdAt: data.created_at,
      };

      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(session));
      return session;
    } catch {
      return null;
    }
  }

  async checkoutAttendanceSession(
    sessionId: string,
    userId: string,
    checkoutMethod: GymCheckoutMethod = 'manual_button'
  ): Promise<{ success: boolean; session?: GymAttendanceSession; error?: string }> {
    const now = new Date().toISOString();

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`active_attendance_${userId}`);
      if (raw && typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (sessionId && parsed.id !== sessionId) {
            return { success: false, error: 'Attendance session ID mismatch' };
          }
          const checkInTime = new Date(parsed.checkInAt).getTime();
          const checkOutTime = new Date(now).getTime();
          const durationSeconds = Math.max(0, Math.floor((checkOutTime - checkInTime) / 1000));

          const completed: GymAttendanceSession = {
            ...parsed,
            checkOutAt: now,
            checkoutMethod,
            status: 'completed',
            durationSeconds,
          };
          platform.storage.removeItem(`active_attendance_${userId}`);

          // Append to fallback history
          const histRaw = platform.storage.getItem(`attendance_history_${userId}`);
          let histList: any[] = [];
          if (histRaw && typeof histRaw === 'string') {
            try { histList = JSON.parse(histRaw); } catch { histList = []; }
          }
          histList.unshift(completed);
          platform.storage.setItem(`attendance_history_${userId}`, JSON.stringify(histList));

          return { success: true, session: completed };
        } catch { /* ignore */ }
      }
      return { success: false, error: 'No active attendance session found' };
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .update({
          check_out_at: now,
          checkout_method: checkoutMethod,
          status: 'completed',
        })
        .eq('id', sessionId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .select('*')
        .maybeSingle();

      if (error) {
        logger.error('GymRepository: Error checking out attendance session', { error });
        return { success: false, error: error.message || 'Checkout failed' };
      }

      if (!data) {
        // Concurrency / Idempotency handling:
        // If the session was already transitioned to completed by a concurrent or prior request,
        // retrieve the session to return a deterministic completed result instead of failing.
        const { data: existingSession } = await supabase
          .from('gym_attendance_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingSession && existingSession.status === 'completed') {
          platform.storage.removeItem(`active_attendance_${userId}`);
          return {
            success: true,
            session: {
              id: existingSession.id,
              gymId: existingSession.gym_id,
              userId: existingSession.user_id,
              checkInAt: existingSession.check_in_at,
              checkOutAt: existingSession.check_out_at,
              durationSeconds: existingSession.duration_seconds,
              verificationMethod: existingSession.verification_method,
              checkoutMethod: existingSession.checkout_method,
              status: existingSession.status,
              createdAt: existingSession.created_at,
            },
          };
        }

        return { success: false, error: 'No active attendance session found to check out' };
      }

      platform.storage.removeItem(`active_attendance_${userId}`);

      return {
        success: true,
        session: {
          id: data.id,
          gymId: data.gym_id,
          userId: data.user_id,
          checkInAt: data.check_in_at,
          checkOutAt: data.check_out_at,
          durationSeconds: data.duration_seconds,
          verificationMethod: data.verification_method,
          checkoutMethod: data.checkout_method,
          status: data.status,
          createdAt: data.created_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      return { success: false, error: msg };
    }
  }

  async fetchGymActiveAttendance(gymId: string): Promise<GymAttendanceSession[]> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) return [];
    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .select(`
          *,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `)
        .eq('gym_id', gymId)
        .eq('status', 'active')
        .order('check_in_at', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        gymId: row.gym_id,
        userId: row.user_id,
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
        durationSeconds: row.duration_seconds,
        verificationMethod: row.verification_method,
        checkoutMethod: row.checkout_method,
        status: row.status,
        createdAt: row.created_at,
        userProfile: row.profiles
          ? {
              displayName: row.profiles.display_name || 'Athlete',
              avatarUrl: row.profiles.avatar_url,
            }
          : undefined,
      }));
    } catch (err) {
      logger.error('GymRepository: Error fetching active gym attendance', { err });
      return [];
    }
  }

  // ── 4. Completed Attendance History, Visit Details & Summary (Phase C6) ─────

  /**
   * Fetches paginated completed gym attendance history for the authenticated user, newest first.
   * Joins gyms table to resolve authoritative facility name and location.
   */
  async getAttendanceHistory(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ sessions: (GymAttendanceSession & { gym?: Gym })[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(options.limit || 20, 100));
    const offset = Math.max(0, options.offset || 0);

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`attendance_history_${userId}`);
      let list: (GymAttendanceSession & { gym?: Gym })[] = [];
      if (stored && typeof stored === 'string') {
        try {
          list = JSON.parse(stored);
        } catch {
          list = [];
        }
      }
      const completedOnly = list.filter(s => s.status === 'completed');
      completedOnly.sort(
        (a, b) =>
          new Date(b.checkOutAt || b.checkInAt).getTime() -
          new Date(a.checkOutAt || a.checkInAt).getTime()
      );
      const sliced = completedOnly.slice(offset, offset + limit);
      const hasMore = offset + limit < completedOnly.length;
      return { sessions: sliced, hasMore };
    }

    try {
      // Fetch limit + 1 to reliably determine hasMore without an extra count query
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .select(`
          id,
          gym_id,
          user_id,
          check_in_at,
          check_out_at,
          duration_seconds,
          verification_method,
          checkout_method,
          status,
          created_at,
          gyms (
            id,
            name,
            slug,
            owner_id,
            address,
            city,
            state,
            pincode,
            contact_number,
            email,
            latitude,
            longitude,
            radius_meters,
            qr_code_hash
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('check_out_at', { ascending: false })
        .range(offset, offset + limit);

      if (error || !data) {
        logger.error('GymRepository: Error fetching attendance history', { error });
        return { sessions: [], hasMore: false };
      }

      const hasMore = data.length > limit;
      const rows = hasMore ? data.slice(0, limit) : data;

      const mapped: (GymAttendanceSession & { gym?: Gym })[] = rows.map((row: any) => ({
        id: row.id,
        gymId: row.gym_id,
        userId: row.user_id,
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
        durationSeconds: row.duration_seconds,
        verificationMethod: row.verification_method,
        checkoutMethod: row.checkout_method,
        status: row.status,
        createdAt: row.created_at,
        gym: row.gyms
          ? {
              id: row.gyms.id,
              name: row.gyms.name,
              slug: row.gyms.slug,
              ownerId: row.gyms.owner_id,
              address: row.gyms.address,
              city: row.gyms.city,
              state: row.gyms.state || undefined,
              pincode: row.gyms.pincode || undefined,
              contactNumber: row.gyms.contact_number || undefined,
              email: row.gyms.email || undefined,
              latitude: Number(row.gyms.latitude),
              longitude: Number(row.gyms.longitude),
              radiusMeters: row.gyms.radius_meters || 200,
              qrCodeHash: row.gyms.qr_code_hash,
            }
          : undefined,
      }));

      return { sessions: mapped, hasMore };
    } catch (err) {
      logger.error('GymRepository: Unexpected error in getAttendanceHistory', { err });
      return { sessions: [], hasMore: false };
    }
  }

  /**
   * Fetches an authoritative single completed attendance session with full facility metadata.
   * Strictly enforces that the session belongs to the requesting user.
   */
  async getAttendanceSessionById(
    sessionId: string,
    userId: string
  ): Promise<(GymAttendanceSession & { gym?: Gym }) | null> {
    if (!sessionId || !userId) return null;

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId) || !UUID_REGEX.test(sessionId)) {
      const stored = platform.storage.getItem(`attendance_history_${userId}`);
      if (stored && typeof stored === 'string') {
        try {
          const list: (GymAttendanceSession & { gym?: Gym })[] = JSON.parse(stored);
          const found = list.find(s => s.id === sessionId && s.userId === userId);
          if (found) return found;
        } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_sessions')
        .select(`
          id,
          gym_id,
          user_id,
          check_in_at,
          check_out_at,
          duration_seconds,
          verification_method,
          checkout_method,
          status,
          created_at,
          gyms (
            id,
            name,
            slug,
            owner_id,
            address,
            city,
            state,
            pincode,
            contact_number,
            email,
            description,
            opening_time,
            closing_time,
            latitude,
            longitude,
            radius_meters,
            qr_code_hash
          )
        `)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const gymRaw = Array.isArray(data.gyms) ? (data.gyms as any[])[0] : (data.gyms as any);

      return {
        id: data.id,
        gymId: data.gym_id,
        userId: data.user_id,
        checkInAt: data.check_in_at,
        checkOutAt: data.check_out_at,
        durationSeconds: data.duration_seconds,
        verificationMethod: data.verification_method,
        checkoutMethod: data.checkout_method,
        status: data.status,
        createdAt: data.created_at,
        gym: gymRaw
          ? {
              id: gymRaw.id,
              name: gymRaw.name,
              slug: gymRaw.slug,
              ownerId: gymRaw.owner_id,
              address: gymRaw.address,
              city: gymRaw.city,
              state: gymRaw.state || undefined,
              pincode: gymRaw.pincode || undefined,
              contactNumber: gymRaw.contact_number || undefined,
              email: gymRaw.email || undefined,
              description: gymRaw.description || undefined,
              openingTime: gymRaw.opening_time || undefined,
              closingTime: gymRaw.closing_time || undefined,
              latitude: Number(gymRaw.latitude),
              longitude: Number(gymRaw.longitude),
              radiusMeters: gymRaw.radius_meters || 200,
              qrCodeHash: gymRaw.qr_code_hash,
            }
          : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Computes authoritative attendance summary statistics:
   * total completed visits, total duration, average duration, and visits during the current month.
   * Only returns the aggregated metrics to avoid transporting unbounded tables to the client.
   */
  async getAttendanceSummary(
    userId: string,
    monthRange: { startIso: string; endIso: string }
  ): Promise<{
    totalVisits: number;
    totalDurationSeconds: number;
    averageDurationSeconds: number;
    currentMonthVisits: number;
  }> {
    const emptySummary = {
      totalVisits: 0,
      totalDurationSeconds: 0,
      averageDurationSeconds: 0,
      currentMonthVisits: 0,
    };

    if (!userId || userId === 'guest-user') return emptySummary;

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const stored = platform.storage.getItem(`attendance_history_${userId}`);
      if (!stored || typeof stored !== 'string') return emptySummary;
      try {
        const list: GymAttendanceSession[] = JSON.parse(stored);
        const completed = list.filter(s => s.status === 'completed');
        if (completed.length === 0) return emptySummary;

        const totalVisits = completed.length;
        const totalDurationSeconds = completed.reduce(
          (acc, s) => acc + (s.durationSeconds || 0),
          0
        );
        const averageDurationSeconds = Math.round(totalDurationSeconds / totalVisits);

        const startMs = new Date(monthRange.startIso).getTime();
        const endMs = new Date(monthRange.endIso).getTime();
        const currentMonthVisits = completed.filter(s => {
          const t = new Date(s.checkInAt).getTime();
          return t >= startMs && t < endMs;
        }).length;

        return {
          totalVisits,
          totalDurationSeconds,
          averageDurationSeconds,
          currentMonthVisits,
        };
      } catch {
        return emptySummary;
      }
    }

    try {
      // 1. Prefer database RPC for direct PostgreSQL aggregation
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_member_attendance_summary', {
          p_user_id: userId,
          p_month_start: monthRange.startIso,
          p_month_end: monthRange.endIso,
        });

      if (!rpcError && rpcData) {
        return {
          totalVisits: Number(rpcData.totalVisits || 0),
          totalDurationSeconds: Number(rpcData.totalDurationSeconds || 0),
          averageDurationSeconds: Number(rpcData.avgDurationSeconds || 0),
          currentMonthVisits: Number(rpcData.currentMonthVisits || 0),
        };
      }

      // 2. Fallback: minimal database aggregation query without transporting session records
      // Query selects only duration_seconds column of completed sessions
      const { data: allData, error: allError } = await supabase
        .from('gym_attendance_sessions')
        .select('duration_seconds')
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (allError || !allData) {
        logger.error('GymRepository: Error fetching lifetime attendance summary', { allError });
        return emptySummary;
      }

      const totalVisits = allData.length;
      if (totalVisits === 0) {
        return emptySummary;
      }

      const totalDurationSeconds = allData.reduce(
        (sum, row) => sum + (row.duration_seconds || 0),
        0
      );
      const averageDurationSeconds = Math.round(totalDurationSeconds / totalVisits);

      // 2. Fetch current month completed visits count using index boundary
      const { count: monthCount, error: monthError } = await supabase
        .from('gym_attendance_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('check_in_at', monthRange.startIso)
        .lt('check_in_at', monthRange.endIso);

      if (monthError) {
        logger.error('GymRepository: Error fetching month attendance count', { monthError });
      }

      return {
        totalVisits,
        totalDurationSeconds,
        averageDurationSeconds,
        currentMonthVisits: monthCount || 0,
      };
    } catch (err) {
      logger.error('GymRepository: Unexpected error in getAttendanceSummary', { err });
      return emptySummary;
    }
  }

  async updateGym(
    gymId: string,
    ownerId: string,
    updates: Partial<Gym>
  ): Promise<{ success: boolean; gym?: Gym; error?: string }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(ownerId)) {
      const existing = await this.fetchOwnerGyms(ownerId);
      const idx = existing.findIndex(g => g.id === gymId);
      if (idx === -1) {
        return { success: false, error: 'Gym not found or unauthorized' };
      }
      const updated: Gym = { ...existing[idx], ...updates };
      existing[idx] = updated;
      platform.storage.setItem(`owner_gyms_${ownerId}`, JSON.stringify(existing));
      return { success: true, gym: updated };
    }

    try {
      const dbPayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) dbPayload.name = updates.name.trim();
      if (updates.slug !== undefined) dbPayload.slug = updates.slug.trim();
      if (updates.address !== undefined) dbPayload.address = updates.address.trim();
      if (updates.city !== undefined) dbPayload.city = updates.city.trim();
      if (updates.state !== undefined) dbPayload.state = updates.state.trim() || null;
      if (updates.pincode !== undefined) dbPayload.pincode = updates.pincode.trim() || null;
      if (updates.contactNumber !== undefined) dbPayload.contact_number = updates.contactNumber.trim() || null;
      if (updates.email !== undefined) dbPayload.email = updates.email.trim() || null;
      if (updates.description !== undefined) dbPayload.description = updates.description.trim() || null;
      if (updates.openingTime !== undefined) dbPayload.opening_time = updates.openingTime;
      if (updates.closingTime !== undefined) dbPayload.closing_time = updates.closingTime;
      if (updates.weeklySchedule !== undefined) dbPayload.weekly_schedule = updates.weeklySchedule;
      if (updates.latitude !== undefined) dbPayload.latitude = updates.latitude;
      if (updates.longitude !== undefined) dbPayload.longitude = updates.longitude;
      if (updates.radiusMeters !== undefined) dbPayload.radius_meters = updates.radiusMeters;
      if (updates.logoUrl !== undefined) dbPayload.logo_url = updates.logoUrl.trim() || null;
      if (updates.coverImageUrl !== undefined) dbPayload.cover_image_url = updates.coverImageUrl.trim() || null;

      const { data, error } = await supabase
        .from('gyms')
        .update(dbPayload)
        .eq('id', gymId)
        .eq('owner_id', ownerId)
        .select('*')
        .single();

      if (error || !data) {
        logger.error('GymRepository: Error updating gym', { error });
        return { success: false, error: error?.message || 'Failed to update gym' };
      }

      const updatedGym: Gym = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.owner_id,
        address: data.address,
        city: data.city,
        state: data.state || undefined,
        pincode: data.pincode || undefined,
        contactNumber: data.contact_number || undefined,
        email: data.email || undefined,
        description: data.description || undefined,
        openingTime: data.opening_time || undefined,
        closingTime: data.closing_time || undefined,
        weeklySchedule: data.weekly_schedule || undefined,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        radiusMeters: data.radius_meters || 200,
        qrCodeHash: data.qr_code_hash,
        logoUrl: data.logo_url || undefined,
        coverImageUrl: data.cover_image_url || undefined,
        createdAt: data.created_at,
      };

      const existing = await this.fetchOwnerGyms(ownerId);
      const idx = existing.findIndex(g => g.id === gymId);
      if (idx !== -1) {
        existing[idx] = updatedGym;
      } else {
        existing.unshift(updatedGym);
      }
      platform.storage.setItem(`owner_gyms_${ownerId}`, JSON.stringify(existing));

      return { success: true, gym: updatedGym };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      return { success: false, error: msg };
    }
  }

  async fetchGymMemberCount(gymId: string): Promise<number> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      return 0;
    }
    try {
      const { count, error } = await supabase
        .from('gym_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .eq('status', 'active');

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  async fetchGymTodayCheckinsCount(gymId: string): Promise<number> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      return 0;
    }
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('gym_attendance_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('check_in_at', todayStart.toISOString());

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  // Backward compatibility alias for single check-in
  async recordCheckin(
    gymId: string,
    userId: string,
    verificationMethod: GymVerificationMethod
  ): Promise<{ success: boolean; checkin?: GymCheckin; error?: string }> {
    const res = await this.startAttendanceSession(gymId, userId, verificationMethod);
    if (!res.success) return { success: false, error: res.error };
    return {
      success: true,
      checkin: {
        id: res.session!.id,
        gymId: res.session!.gymId,
        userId: res.session!.userId,
        verificationMethod: res.session!.verificationMethod,
        checkedInAt: res.session!.checkInAt,
      },
    };
  }
}

export const gymRepository = new GymRepository();
