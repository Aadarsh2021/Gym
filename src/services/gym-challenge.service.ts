import { gymRepository } from '@/repositories/gym.repository';
import {
  GymChallenge,
  GymChallengeParticipant,
  GymChallengeLeaderboardEntry,
  GymChallengeType,
  GymChallengeScoringUnit,
  GymChallengeStatus,
} from '@/types/gym.types';

export class GymChallengeService {
  /**
   * Fetch challenges for a facility (filtered by status if specified)
   */
  async getChallenges(gymId: string, statusFilter?: string): Promise<GymChallenge[]> {
    if (!gymId) return [];
    return gymRepository.fetchGymChallenges(gymId, statusFilter);
  }

  /**
   * Fetch single challenge by ID
   */
  async getChallengeById(challengeId: string): Promise<GymChallenge | null> {
    if (!challengeId) return null;
    return gymRepository.fetchChallengeById(challengeId);
  }

  /**
   * Join a challenge as an active gym member
   */
  async joinChallenge(challengeId: string): Promise<GymChallengeParticipant> {
    if (!challengeId) {
      throw new Error('Challenge ID is required');
    }
    return gymRepository.joinGymChallenge(challengeId);
  }

  /**
   * Fetch current user's participation record in a challenge
   */
  async getMyParticipation(
    challengeId: string,
    userId: string
  ): Promise<GymChallengeParticipant | null> {
    if (!challengeId || !userId) return null;
    return gymRepository.fetchMyChallengeParticipation(challengeId, userId);
  }

  /**
   * Facility Owner: Create a new draft challenge
   */
  async createChallenge(challenge: {
    gymId: string;
    title: string;
    description?: string;
    challengeType: GymChallengeType;
    targetValue: number;
    scoringUnit: GymChallengeScoringUnit;
    startAt: string;
    endAt: string;
    rewardBadgeName?: string;
    rewardCoins?: number;
  }): Promise<GymChallenge> {
    if (!challenge.gymId) throw new Error('Gym ID is required');
    if (!challenge.title || challenge.title.trim().length < 3) {
      throw new Error('Title must be at least 3 characters');
    }
    if (new Date(challenge.endAt) <= new Date(challenge.startAt)) {
      throw new Error('End date must be after start date');
    }
    if (challenge.targetValue <= 0) {
      throw new Error('Target value must be greater than zero');
    }

    return gymRepository.createGymChallenge(challenge);
  }

  /**
   * Facility Owner: Publish a draft challenge
   */
  async publishChallenge(challengeId: string): Promise<GymChallenge> {
    if (!challengeId) throw new Error('Challenge ID is required');
    return gymRepository.publishGymChallenge(challengeId);
  }

  /**
   * Facility Owner: Transition challenge lifecycle status
   */
  async updateChallengeStatus(
    challengeId: string,
    targetStatus: GymChallengeStatus
  ): Promise<GymChallenge> {
    if (!challengeId) throw new Error('Challenge ID is required');
    return gymRepository.updateGymChallengeStatus(challengeId, targetStatus);
  }

  /**
   * Facility Owner: Delete an un-enrolled draft challenge
   */
  async deleteDraft(challengeId: string): Promise<boolean> {
    if (!challengeId) throw new Error('Challenge ID is required');
    return gymRepository.deleteGymChallengeDraft(challengeId);
  }

  /**
   * Synchronize authoritative member progress from attendance or workout logs
   */
  async syncProgress(
    challengeId: string,
    userId?: string
  ): Promise<{ currentScore: number; isCompleted: boolean }> {
    if (!challengeId) return { currentScore: 0, isCompleted: false };
    return gymRepository.syncMemberChallengeProgress(challengeId, userId);
  }

  /**
   * Fetch challenge-scoped, server-ranked leaderboard entries
   */
  async getLeaderboard(
    challengeId: string,
    limit = 20,
    offset = 0
  ): Promise<GymChallengeLeaderboardEntry[]> {
    if (!challengeId) return [];
    return gymRepository.fetchChallengeLeaderboard(challengeId, limit, offset);
  }
}

export const gymChallengeService = new GymChallengeService();
