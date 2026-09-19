import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Gym,
  GymMembership,
  GymMembershipStatus,
  GymCheckin,
  GymVerificationMethod,
  GymAttendanceSession,
  GymCheckoutMethod,
  GymAttendanceStreak,
  GymAnnouncement,
  GymReward,
  GymRewardRedemption,
} from '@/types/gym.types';
import { logger } from '@/lib/logger';
import { platform } from '@/platform';
import { getTodayRangeIST } from '@/utils/date';

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
      const nowIso = new Date().toISOString();
      const mockSession: GymAttendanceSession = {
        id: `mock-att-${Date.now()}`,
        gymId,
        userId,
        checkInAt: nowIso,
        checkOutAt: null,
        durationSeconds: null,
        verificationMethod,
        checkoutMethod: null,
        status: 'active',
        createdAt: nowIso,
      };
      platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(mockSession));

      // Update mock attendance streak
      this.updateMockGymAttendanceStreak(gymId, userId, nowIso);

      return { success: true, session: mockSession };
    }

    try {
      // 1. Try authoritative stored procedure record_verified_gym_checkin
      const { data: rpcData, error: rpcErr } = await supabase.rpc('record_verified_gym_checkin', {
        p_gym_id: gymId,
        p_verification_method: verificationMethod,
      });

      if (!rpcErr && rpcData?.success) {
        const created: GymAttendanceSession = {
          id: rpcData.session_id,
          gymId,
          userId,
          checkInAt: rpcData.check_in_at || new Date().toISOString(),
          checkOutAt: null,
          durationSeconds: null,
          verificationMethod,
          checkoutMethod: null,
          status: 'active',
          createdAt: rpcData.check_in_at || new Date().toISOString(),
        };
        platform.storage.setItem(`active_attendance_${userId}`, JSON.stringify(created));
        return { success: true, session: created };
      }

      if (rpcErr && (rpcErr.message.includes('Active attendance session already in progress') || rpcErr.message.includes('already in progress'))) {
        return { success: false, error: "You're already checked in." };
      }
      if (rpcErr && rpcErr.message.includes('Active membership required')) {
        return { success: false, error: 'Active membership required for check-in' };
      }

      // 2. Direct insert fallback if RPC is unavailable in current migration state
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
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`attendance_sessions_${gymId}`);
      if (raw && typeof raw === 'string') {
        try {
          const list: GymAttendanceSession[] = JSON.parse(raw);
          return list.filter(s => s.status === 'active' && s.gymId === gymId);
        } catch { return []; }
      }
      return [];
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
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('gym_id', gymId)
        .eq('status', 'active')
        .order('check_in_at', { ascending: false });

      if (error || !data) return [];

      return data.map((row: any) => {
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
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
          userProfile: prof
            ? {
                displayName: prof.display_name || 'Athlete',
                avatarUrl: prof.avatar_url,
              }
            : undefined,
        };
      });
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
      const raw = platform.storage.getItem(`gym_members_${gymId}`);
      if (raw && typeof raw === 'string') {
        try {
          const list: GymMembership[] = JSON.parse(raw);
          return list.filter(m => m.status === 'active').length;
        } catch { return 0; }
      }
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
    const { startIso, endIso } = getTodayRangeIST();

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`attendance_sessions_${gymId}`);
      if (raw && typeof raw === 'string') {
        try {
          const list: GymAttendanceSession[] = JSON.parse(raw);
          const startMs = new Date(startIso).getTime();
          const endMs = new Date(endIso).getTime();
          return list.filter(s => {
            const checkInMs = new Date(s.checkInAt).getTime();
            return checkInMs >= startMs && checkInMs < endMs;
          }).length;
        } catch { return 0; }
      }
      return 0;
    }
    try {
      const { count, error } = await supabase
        .from('gym_attendance_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', gymId)
        .gte('check_in_at', startIso)
        .lt('check_in_at', endIso);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  // ── 5. Facility Operations & Owner Sync (Phase C7) ───────────────────────────

  /**
   * Fetches paginated completed gym attendance history for an owned facility.
   * Scoped to gym_id at the database level.
   */
  async fetchGymAttendanceHistory(
    gymId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      startDateIso?: string;
      endDateIso?: string;
    } = {}
  ): Promise<{ sessions: GymAttendanceSession[]; totalCount: number }> {
    const limit = Math.max(1, Math.min(options.limit || 20, 100));
    const offset = Math.max(0, options.offset || 0);

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`attendance_sessions_${gymId}`);
      let list: GymAttendanceSession[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      let completed = list.filter(s => s.status === 'completed');
      if (options.startDateIso) {
        const startMs = new Date(options.startDateIso).getTime();
        completed = completed.filter(s => new Date(s.checkInAt).getTime() >= startMs);
      }
      if (options.endDateIso) {
        const endMs = new Date(options.endDateIso).getTime();
        completed = completed.filter(s => new Date(s.checkInAt).getTime() <= endMs);
      }
      if (options.search) {
        const q = options.search.toLowerCase();
        completed = completed.filter(s =>
          s.userProfile?.displayName?.toLowerCase().includes(q)
        );
      }
      completed.sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime());
      return {
        sessions: completed.slice(offset, offset + limit),
        totalCount: completed.length,
      };
    }

    try {
      let query = supabase
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
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('gym_id', gymId)
        .eq('status', 'completed');

      if (options.startDateIso) {
        query = query.gte('check_in_at', options.startDateIso);
      }
      if (options.endDateIso) {
        query = query.lte('check_in_at', options.endDateIso);
      }

      query = query.order('check_in_at', { ascending: false });

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (error || !data) {
        logger.error('GymRepository: Error fetching gym attendance history', { error });
        return { sessions: [], totalCount: 0 };
      }

      let mapped: GymAttendanceSession[] = data.map((row: any) => {
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
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
          userProfile: prof
            ? {
                displayName: prof.display_name || 'Athlete',
                avatarUrl: prof.avatar_url,
              }
            : undefined,
        };
      });

      if (options.search) {
        const q = options.search.toLowerCase();
        mapped = mapped.filter(s =>
          s.userProfile?.displayName?.toLowerCase().includes(q)
        );
      }

      return {
        sessions: mapped,
        totalCount: count || mapped.length,
      };
    } catch (err: unknown) {
      logger.error('GymRepository: Exception fetching gym attendance history', { err });
      return { sessions: [], totalCount: 0 };
    }
  }

  /**
   * Fetches member counts breakdown for a facility: active, pending, inactive/frozen, total.
   */
  async fetchGymMemberCounts(gymId: string): Promise<{
    active: number;
    pending: number;
    inactive: number;
    total: number;
  }> {
    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`gym_members_${gymId}`);
      let list: GymMembership[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      const active = list.filter(m => m.status === 'active').length;
      const pending = list.filter(m => m.status === 'pending').length;
      const inactive = list.filter(m => m.status === 'inactive' || m.status === 'frozen').length;
      return { active, pending, inactive, total: list.length };
    }

    try {
      const [activeRes, pendingRes, inactiveRes, totalRes] = await Promise.all([
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('status', 'active'),
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('status', 'pending'),
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .in('status', ['inactive', 'frozen']),
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId),
      ]);

      return {
        active: activeRes.count || 0,
        pending: pendingRes.count || 0,
        inactive: inactiveRes.count || 0,
        total: totalRes.count || 0,
      };
    } catch {
      return { active: 0, pending: 0, inactive: 0, total: 0 };
    }
  }

  /**
   * Fetches gym members with joined profile details, status filtering, and pagination.
   */
  async fetchGymMembers(
    gymId: string,
    options: {
      status?: GymMembershipStatus | 'all';
      limit?: number;
      offset?: number;
      search?: string;
    } = {}
  ): Promise<{ members: GymMembership[]; totalCount: number }> {
    const limit = Math.max(1, Math.min(options.limit || 20, 100));
    const offset = Math.max(0, options.offset || 0);

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`gym_members_${gymId}`);
      let list: GymMembership[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      let filtered = list;
      if (options.status && options.status !== 'all') {
        filtered = filtered.filter(m => m.status === options.status);
      }
      if (options.search) {
        const q = options.search.toLowerCase();
        filtered = filtered.filter(m =>
          m.userProfile?.displayName?.toLowerCase().includes(q) ||
          m.membershipType.toLowerCase().includes(q)
        );
      }
      const totalCount = filtered.length;
      return {
        members: filtered.slice(offset, offset + limit),
        totalCount,
      };
    }

    try {
      let query = supabase
        .from('gym_memberships')
        .select(`
          id,
          gym_id,
          user_id,
          status,
          membership_type,
          joined_at,
          expires_at,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('gym_id', gymId);

      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      query = query.order('joined_at', { ascending: false });

      const { data, count, error } = await query.range(offset, offset + limit - 1);

      if (error || !data) {
        logger.error('GymRepository: Error fetching gym members', { error });
        return { members: [], totalCount: 0 };
      }

      let mapped: GymMembership[] = data.map((row: any) => {
        const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        return {
          id: row.id,
          gymId: row.gym_id,
          userId: row.user_id,
          status: row.status,
          membershipType: row.membership_type,
          joinedAt: row.joined_at,
          expiresAt: row.expires_at,
          userProfile: prof
            ? {
                displayName: prof.display_name || 'Athlete',
                avatarUrl: prof.avatar_url,
              }
            : undefined,
        };
      });

      if (options.search) {
        const q = options.search.toLowerCase();
        mapped = mapped.filter(m =>
          m.userProfile?.displayName?.toLowerCase().includes(q) ||
          m.membershipType.toLowerCase().includes(q)
        );
      }

      return {
        members: mapped,
        totalCount: count || mapped.length,
      };
    } catch (err: unknown) {
      logger.error('GymRepository: Exception fetching gym members', { err });
      return { members: [], totalCount: 0 };
    }
  }

  /**
   * Updates membership status authoritatively using database RPC or local storage fallback.
   * State transitions strictly enforced:
   * pending -> active | active -> frozen | frozen -> active | active/frozen -> inactive
   */
  async updateMembershipStatus(
    membershipId: string,
    gymId: string,
    targetStatus: GymMembershipStatus,
    _callerOwnerId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!membershipId || !gymId) {
      return { success: false, error: 'Membership ID and Gym ID required' };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(membershipId)) {
      const raw = platform.storage.getItem(`gym_members_${gymId}`);
      let list: GymMembership[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      const idx = list.findIndex(m => m.id === membershipId);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          status: targetStatus,
          joinedAt: targetStatus === 'active' && !list[idx].joinedAt ? new Date().toISOString() : list[idx].joinedAt,
        };
        platform.storage.setItem(`gym_members_${gymId}`, JSON.stringify(list));
      }
      return { success: true };
    }

    try {
      const { error } = await supabase.rpc('update_gym_membership_status', {
        p_membership_id: membershipId,
        p_target_status: targetStatus,
      });

      if (error) {
        logger.error('GymRepository: Error updating membership status via RPC', { error });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update membership status';
      logger.error('GymRepository: Exception updating membership status', { err });
      return { success: false, error: msg };
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

  // ── Phase G1: Gym Attendance Streaks ──────────────────────────────────────

  updateMockGymAttendanceStreak(
    gymId: string,
    userId: string,
    visitIsoString: string,
    timezone: string = 'Asia/Kolkata'
  ): GymAttendanceStreak {
    let visitDate = visitIsoString.split('T')[0];
    try {
      const d = new Date(visitIsoString);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      visitDate = formatter.format(d);
    } catch {
      visitDate = visitIsoString.split('T')[0];
    }
    const key = `gym_attendance_streak_${userId}_${gymId}`;
    const raw = platform.storage.getItem(key);
    let streak: GymAttendanceStreak;

    if (raw && typeof raw === 'string') {
      try {
        const existing = JSON.parse(raw);
        if (existing.lastVisitDate === visitDate) {
          // Idempotent same-day visit: no change
          return existing;
        }

        const prevDate = new Date(existing.lastVisitDate);
        const currDate = new Date(visitDate);
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        let currentStreak = 1;
        if (diffDays === 1) {
          currentStreak = existing.currentStreak + 1;
        }

        streak = {
          ...existing,
          currentStreak,
          longestStreak: Math.max(existing.longestStreak, currentStreak),
          lastVisitDate: visitDate,
          totalVisitDays: (existing.totalVisitDays || 1) + 1,
          updatedAt: visitIsoString,
        };
      } catch {
        streak = {
          id: `strk-${Date.now()}`,
          userId,
          gymId,
          currentStreak: 1,
          longestStreak: 1,
          lastVisitDate: visitDate,
          totalVisitDays: 1,
          createdAt: visitIsoString,
          updatedAt: visitIsoString,
        };
      }
    } else {
      streak = {
        id: `strk-${Date.now()}`,
        userId,
        gymId,
        currentStreak: 1,
        longestStreak: 1,
        lastVisitDate: visitDate,
        totalVisitDays: 1,
        createdAt: visitIsoString,
        updatedAt: visitIsoString,
      };
    }

    platform.storage.setItem(key, JSON.stringify(streak));
    return streak;
  }

  async getGymAttendanceStreak(gymId: string, userId: string): Promise<GymAttendanceStreak | null> {
    if (!gymId || !userId) return null;

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`gym_attendance_streak_${userId}_${gymId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('gym_attendance_streaks')
        .select('*')
        .eq('gym_id', gymId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        gymId: data.gym_id,
        currentStreak: data.current_streak,
        longestStreak: data.longest_streak,
        lastVisitDate: data.last_visit_date,
        totalVisitDays: data.total_visit_days,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      logger.error('GymRepository: Error fetching gym streak', { err });
      return null;
    }
  }

  // ── Phase G1: Facility Announcements ──────────────────────────────────────

  async fetchGymAnnouncements(gymId: string, isOwner: boolean = false): Promise<GymAnnouncement[]> {
    if (!gymId) return [];

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`gym_announcements_${gymId}`);
      let list: GymAnnouncement[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }

      if (!isOwner) {
        const now = new Date().toISOString();
        list = list.filter(a => a.status === 'published' && (!a.expiresAt || a.expiresAt > now));
      }

      return list.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    try {
      let query = supabase
        .from('gym_announcements')
        .select('*')
        .eq('gym_id', gymId);

      if (!isOwner) {
        query = query
          .eq('status', 'published')
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      }

      query = query
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error || !data) {
        logger.error('GymRepository: Error fetching announcements', { error });
        return [];
      }

      return data.map(row => ({
        id: row.id,
        gymId: row.gym_id,
        title: row.title,
        content: row.content,
        priority: row.priority,
        isPinned: row.is_pinned,
        status: row.status,
        expiresAt: row.expires_at,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      logger.error('GymRepository: Exception fetching announcements', { err });
      return [];
    }
  }

  async createGymAnnouncement(
    announcement: Omit<GymAnnouncement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; announcement?: GymAnnouncement; error?: string }> {
    if (!announcement.gymId || !announcement.title || !announcement.content) {
      return { success: false, error: 'Missing required announcement fields' };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(announcement.gymId)) {
      const now = new Date().toISOString();
      const created: GymAnnouncement = {
        ...announcement,
        id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const raw = platform.storage.getItem(`gym_announcements_${announcement.gymId}`);
      let list: GymAnnouncement[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      list.unshift(created);
      platform.storage.setItem(`gym_announcements_${announcement.gymId}`, JSON.stringify(list));
      return { success: true, announcement: created };
    }

    try {
      const { data, error } = await supabase
        .from('gym_announcements')
        .insert({
          gym_id: announcement.gymId,
          title: announcement.title,
          content: announcement.content,
          priority: announcement.priority || 'normal',
          is_pinned: announcement.isPinned || false,
          status: announcement.status || 'published',
          expires_at: announcement.expiresAt || null,
          created_by: announcement.createdBy,
        })
        .select('*')
        .single();

      if (error) {
        logger.error('GymRepository: Error creating announcement', { error });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        announcement: {
          id: data.id,
          gymId: data.gym_id,
          title: data.title,
          content: data.content,
          priority: data.priority,
          isPinned: data.is_pinned,
          status: data.status,
          expiresAt: data.expires_at,
          createdBy: data.created_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create announcement';
      return { success: false, error: msg };
    }
  }

  async updateGymAnnouncement(
    id: string,
    updates: Partial<GymAnnouncement>
  ): Promise<{ success: boolean; announcement?: GymAnnouncement; error?: string }> {
    if (!id) return { success: false, error: 'Announcement ID required' };

    if (!isSupabaseConfigured || !UUID_REGEX.test(id)) {
      if (updates.gymId) {
        const raw = platform.storage.getItem(`gym_announcements_${updates.gymId}`);
        if (raw && typeof raw === 'string') {
          try {
            const list: GymAnnouncement[] = JSON.parse(raw);
            const idx = list.findIndex(a => a.id === id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
              platform.storage.setItem(`gym_announcements_${updates.gymId}`, JSON.stringify(list));
              return { success: true, announcement: list[idx] };
            }
          } catch { /* ignore */ }
        }
      }
      return { success: true };
    }

    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.isPinned !== undefined) payload.is_pinned = updates.isPinned;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.expiresAt !== undefined) payload.expires_at = updates.expiresAt;

      const { data, error } = await supabase
        .from('gym_announcements')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        logger.error('GymRepository: Error updating announcement', { error });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        announcement: {
          id: data.id,
          gymId: data.gym_id,
          title: data.title,
          content: data.content,
          priority: data.priority,
          isPinned: data.is_pinned,
          status: data.status,
          expiresAt: data.expires_at,
          createdBy: data.created_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update announcement';
      return { success: false, error: msg };
    }
  }

  async deleteGymAnnouncement(id: string, gymId?: string): Promise<{ success: boolean; error?: string }> {
    if (!id) return { success: false, error: 'Announcement ID required' };

    if (!isSupabaseConfigured || !UUID_REGEX.test(id)) {
      if (gymId) {
        const raw = platform.storage.getItem(`gym_announcements_${gymId}`);
        if (raw && typeof raw === 'string') {
          try {
            const list: GymAnnouncement[] = JSON.parse(raw);
            const filtered = list.filter(a => a.id !== id);
            platform.storage.setItem(`gym_announcements_${gymId}`, JSON.stringify(filtered));
          } catch { /* ignore */ }
        }
      }
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('gym_announcements')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('GymRepository: Error deleting announcement', { error });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete announcement';
      return { success: false, error: msg };
    }
  }

  // ── Phase G1: Gym Rewards & Milestone Perks ───────────────────────────────

  async fetchGymRewards(gymId: string): Promise<GymReward[]> {
    if (!gymId) return [];

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`gym_rewards_${gymId}`);
      let list: GymReward[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      return list.sort((a, b) => a.requiredVisits - b.requiredVisits);
    }

    try {
      const { data, error } = await supabase
        .from('gym_rewards')
        .select('*')
        .eq('gym_id', gymId)
        .order('required_visits', { ascending: true });

      if (error || !data) {
        logger.error('GymRepository: Error fetching rewards', { error });
        return [];
      }

      return data.map(r => ({
        id: r.id,
        gymId: r.gym_id,
        title: r.title,
        description: r.description,
        requiredVisits: r.required_visits,
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err) {
      logger.error('GymRepository: Exception fetching rewards', { err });
      return [];
    }
  }

  async createGymReward(
    reward: Omit<GymReward, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; reward?: GymReward; error?: string }> {
    if (!reward.gymId || !reward.title || !reward.requiredVisits) {
      return { success: false, error: 'Missing required reward fields' };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(reward.gymId)) {
      const now = new Date().toISOString();
      const created: GymReward = {
        ...reward,
        id: `rew-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const raw = platform.storage.getItem(`gym_rewards_${reward.gymId}`);
      let list: GymReward[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      list.push(created);
      platform.storage.setItem(`gym_rewards_${reward.gymId}`, JSON.stringify(list));
      platform.storage.setItem(`gym_reward_lookup_${created.id}`, JSON.stringify(created));
      return { success: true, reward: created };
    }

    try {
      const { data, error } = await supabase
        .from('gym_rewards')
        .insert({
          gym_id: reward.gymId,
          title: reward.title,
          description: reward.description || null,
          required_visits: reward.requiredVisits,
          is_active: reward.isActive !== false,
        })
        .select('*')
        .single();

      if (error) {
        logger.error('GymRepository: Error creating reward', { error });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        reward: {
          id: data.id,
          gymId: data.gym_id,
          title: data.title,
          description: data.description,
          requiredVisits: data.required_visits,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create reward';
      return { success: false, error: msg };
    }
  }

  async updateGymReward(
    id: string,
    updates: Partial<GymReward>
  ): Promise<{ success: boolean; reward?: GymReward; error?: string }> {
    if (!id) return { success: false, error: 'Reward ID required' };

    if (!isSupabaseConfigured || !UUID_REGEX.test(id)) {
      if (updates.gymId) {
        const raw = platform.storage.getItem(`gym_rewards_${updates.gymId}`);
        if (raw && typeof raw === 'string') {
          try {
            const list: GymReward[] = JSON.parse(raw);
            const idx = list.findIndex(r => r.id === id);
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
              platform.storage.setItem(`gym_rewards_${updates.gymId}`, JSON.stringify(list));
              return { success: true, reward: list[idx] };
            }
          } catch { /* ignore */ }
        }
      }
      return { success: true };
    }

    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description;
      if (updates.requiredVisits !== undefined) payload.required_visits = updates.requiredVisits;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;

      const { data, error } = await supabase
        .from('gym_rewards')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        logger.error('GymRepository: Error updating reward', { error });
        return { success: false, error: error.message };
      }

      return {
        success: true,
        reward: {
          id: data.id,
          gymId: data.gym_id,
          title: data.title,
          description: data.description,
          requiredVisits: data.required_visits,
          isActive: data.is_active,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update reward';
      return { success: false, error: msg };
    }
  }

  async deleteGymReward(id: string, gymId?: string): Promise<{ success: boolean; error?: string }> {
    if (!id) return { success: false, error: 'Reward ID required' };

    if (!isSupabaseConfigured || !UUID_REGEX.test(id)) {
      // 1. Guard against deleting rewards with historical redemptions
      try {
        let hasRedemptions = false;
        if (gymId) {
          const ownerReds = await this.fetchOwnerRedemptions(gymId);
          if (ownerReds.some(r => r.rewardId === id)) {
            hasRedemptions = true;
          }
        }
        // Also check global storage keys if in mock mode
        if (!hasRedemptions && typeof localStorage !== 'undefined') {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('member_redemptions_') || k.startsWith('gym_redemption_lookup_'))) {
              const val = localStorage.getItem(k);
              if (val && val.includes(id)) {
                hasRedemptions = true;
                break;
              }
            }
          }
        }

        if (hasRedemptions) {
          return {
            success: false,
            error: 'Cannot delete reward with claimed or redeemed history. Deactivate the reward instead.',
          };
        }
      } catch { /* ignore */ }

      if (gymId) {
        const raw = platform.storage.getItem(`gym_rewards_${gymId}`);
        if (raw && typeof raw === 'string') {
          try {
            const list: GymReward[] = JSON.parse(raw);
            const filtered = list.filter(r => r.id !== id);
            platform.storage.setItem(`gym_rewards_${gymId}`, JSON.stringify(filtered));
          } catch { /* ignore */ }
        }
      }
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('gym_rewards')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '23503' || error.message?.includes('violates foreign key constraint') || error.message?.includes('gym_reward_redemptions')) {
          return {
            success: false,
            error: 'Cannot delete reward with claimed or redeemed history. Deactivate the reward instead.',
          };
        }
        logger.error('GymRepository: Error deleting reward', { error });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete reward';
      return { success: false, error: msg };
    }
  }

  async claimGymReward(
    rewardId: string,
    userId: string,
    gymId?: string
  ): Promise<{ success: boolean; redemption?: GymRewardRedemption; error?: string }> {
    if (!rewardId || !userId) {
      return { success: false, error: 'Reward ID and User ID required' };
    }

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      // Mock claim validation
      let resolvedGymId = gymId;
      if (!resolvedGymId) {
        const lookupRaw = platform.storage.getItem(`gym_reward_lookup_${rewardId}`);
        if (lookupRaw && typeof lookupRaw === 'string') {
          try {
            const parsed = JSON.parse(lookupRaw);
            if (parsed?.gymId) resolvedGymId = parsed.gymId;
          } catch { /* ignore */ }
        }
      }
      if (!resolvedGymId) resolvedGymId = 'mock-gym-1';

      const code = 'FB-REW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const redemption: GymRewardRedemption = {
        id: `red-${Date.now()}`,
        rewardId,
        gymId: resolvedGymId,
        userId,
        status: 'claimed',
        redemptionCode: code,
        claimedAt: new Date().toISOString(),
      };

      const key = `member_redemptions_${userId}`;
      const raw = platform.storage.getItem(key);
      let list: GymRewardRedemption[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      list.push(redemption);
      platform.storage.setItem(key, JSON.stringify(list));
      platform.storage.setItem(`gym_redemption_lookup_${redemption.id}`, JSON.stringify(redemption));

      const ownerKey = `owner_redemptions_${resolvedGymId}`;
      const ownerRaw = platform.storage.getItem(ownerKey);
      let ownerList: GymRewardRedemption[] = [];
      if (ownerRaw && typeof ownerRaw === 'string') {
        try { ownerList = JSON.parse(ownerRaw); } catch { ownerList = []; }
      }
      ownerList.push(redemption);
      platform.storage.setItem(ownerKey, JSON.stringify(ownerList));

      return { success: true, redemption };
    }

    try {
      const { data, error } = await supabase.rpc('claim_gym_reward', {
        p_reward_id: rewardId,
      });

      if (error) {
        logger.error('GymRepository: Error claiming reward via RPC', { error });
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to claim reward' };
      }

      const r = data.redemption;
      return {
        success: true,
        redemption: {
          id: r.id,
          rewardId: r.reward_id,
          gymId: r.gym_id,
          userId: r.user_id,
          status: r.status,
          redemptionCode: r.redemption_code,
          claimedAt: r.claimed_at,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Exception claiming reward';
      return { success: false, error: msg };
    }
  }

  async fetchMemberRedemptions(userId: string, gymId?: string): Promise<GymRewardRedemption[]> {
    if (!userId) return [];

    if (!isSupabaseConfigured || !UUID_REGEX.test(userId)) {
      const raw = platform.storage.getItem(`member_redemptions_${userId}`);
      let list: GymRewardRedemption[] = [];
      if (raw && typeof raw === 'string') {
        try { list = JSON.parse(raw); } catch { list = []; }
      }
      if (gymId) list = list.filter(r => r.gymId === gymId);
      return list;
    }

    try {
      let query = supabase
        .from('gym_reward_redemptions')
        .select('*, gym_rewards(*)')
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false });

      if (gymId) {
        query = query.eq('gym_id', gymId);
      }

      const { data, error } = await query;
      if (error || !data) {
        logger.error('GymRepository: Error fetching redemptions', { error });
        return [];
      }

      return data.map(r => ({
        id: r.id,
        rewardId: r.reward_id,
        gymId: r.gym_id,
        userId: r.user_id,
        status: r.status,
        redemptionCode: r.redemption_code,
        claimedAt: r.claimed_at,
        redeemedAt: r.redeemed_at,
        reward: r.gym_rewards
          ? {
              id: r.gym_rewards.id,
              gymId: r.gym_rewards.gym_id,
              title: r.gym_rewards.title,
              description: r.gym_rewards.description,
              requiredVisits: r.gym_rewards.required_visits,
              isActive: r.gym_rewards.is_active,
            }
          : undefined,
      }));
    } catch (err) {
      logger.error('GymRepository: Exception fetching member redemptions', { err });
      return [];
    }
  }

  async fetchOwnerRedemptions(gymId: string): Promise<GymRewardRedemption[]> {
    if (!gymId) return [];

    if (!isSupabaseConfigured || !UUID_REGEX.test(gymId)) {
      const raw = platform.storage.getItem(`owner_redemptions_${gymId}`);
      if (raw && typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { /* ignore */ }
      }
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('gym_reward_redemptions')
        .select('*, gym_rewards(*)')
        .eq('gym_id', gymId)
        .order('claimed_at', { ascending: false });

      if (error || !data) {
        logger.error('GymRepository: Error fetching owner redemptions', { error });
        return [];
      }

      return data.map(r => ({
        id: r.id,
        rewardId: r.reward_id,
        gymId: r.gym_id,
        userId: r.user_id,
        status: r.status,
        redemptionCode: r.redemption_code,
        claimedAt: r.claimed_at,
        redeemedAt: r.redeemed_at,
        reward: r.gym_rewards
          ? {
              id: r.gym_rewards.id,
              gymId: r.gym_rewards.gym_id,
              title: r.gym_rewards.title,
              description: r.gym_rewards.description,
              requiredVisits: r.gym_rewards.required_visits,
              isActive: r.gym_rewards.is_active,
            }
          : undefined,
      }));
    } catch (err) {
      logger.error('GymRepository: Exception fetching owner redemptions', { err });
      return [];
    }
  }

  async redeemGymReward(redemptionId: string): Promise<{ success: boolean; error?: string }> {
    if (!redemptionId) return { success: false, error: 'Redemption ID required' };

    if (!isSupabaseConfigured || !UUID_REGEX.test(redemptionId)) {
      const redRaw = platform.storage.getItem(`gym_redemption_lookup_${redemptionId}`);
      if (redRaw && typeof redRaw === 'string') {
        try {
          const parsed: GymRewardRedemption = JSON.parse(redRaw);
          parsed.status = 'redeemed';
          parsed.redeemedAt = new Date().toISOString();
          platform.storage.setItem(`gym_redemption_lookup_${redemptionId}`, JSON.stringify(parsed));

          const memberKey = `member_redemptions_${parsed.userId}`;
          const memListRaw = platform.storage.getItem(memberKey);
          if (memListRaw && typeof memListRaw === 'string') {
            const list: GymRewardRedemption[] = JSON.parse(memListRaw);
            const idx = list.findIndex(r => r.id === redemptionId);
            if (idx >= 0) {
              list[idx] = parsed;
              platform.storage.setItem(memberKey, JSON.stringify(list));
            }
          }

          if (parsed.gymId) {
            const ownerKey = `owner_redemptions_${parsed.gymId}`;
            const ownerRaw = platform.storage.getItem(ownerKey);
            if (ownerRaw && typeof ownerRaw === 'string') {
              const oList: GymRewardRedemption[] = JSON.parse(ownerRaw);
              const oIdx = oList.findIndex(r => r.id === redemptionId);
              if (oIdx >= 0) {
                oList[oIdx] = parsed;
                platform.storage.setItem(ownerKey, JSON.stringify(oList));
              }
            }
          }
        } catch { /* ignore */ }
      }
      return { success: true };
    }

    try {
      const { data, error } = await supabase.rpc('redeem_gym_reward', {
        p_redemption_id: redemptionId,
      });

      if (error) {
        logger.error('GymRepository: Error redeeming reward via RPC', { error });
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Redemption failed' };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Exception redeeming reward';
      return { success: false, error: msg };
    }
  }
}

export const gymRepository = new GymRepository();
