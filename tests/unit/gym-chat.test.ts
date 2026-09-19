import { describe, it, expect, beforeEach } from 'vitest';
import { gymChatService } from '@/services/gym-chat.service';
import { platform } from '@/platform';

describe('Phase G4: Gym Chat Unit Suite', () => {
  const CONNECTION_ID = 'mock-conn-1';

  beforeEach(() => {
    platform.storage.clear();
    gymChatService.clearRateLimits();
  });

  describe('1. Message Validation & Sending', () => {
    it('rejects sending empty or whitespace-only messages', async () => {
      await expect(gymChatService.sendMessage(CONNECTION_ID, '   ')).rejects.toThrow(
        'Message content cannot be empty'
      );
      await expect(gymChatService.sendMessage(CONNECTION_ID, '')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('rejects sending messages exceeding 2000 characters', async () => {
      const longMessage = 'A'.repeat(2001);
      await expect(gymChatService.sendMessage(CONNECTION_ID, longMessage)).rejects.toThrow(
        'Message exceeds 2000 character limit'
      );
    });

    it('successfully sends a valid message and trims whitespace', async () => {
      const msg = await gymChatService.sendMessage(CONNECTION_ID, '  See you at 6pm today!  ');
      expect(msg).toBeDefined();
      expect(msg.content).toBe('See you at 6pm today!');
      expect(msg.connectionId).toBe(CONNECTION_ID);
      expect(msg.id).toBeDefined();
      expect(msg.createdAt).toBeDefined();
    });

    it('enforces client-side rate limiting of 30 messages in 60 seconds', async () => {
      // Send 30 messages in rapid succession
      for (let i = 0; i < 30; i++) {
        await gymChatService.sendMessage(CONNECTION_ID, `Message ${i}`);
      }

      // 31st message must be rejected by rate limiter
      await expect(gymChatService.sendMessage(CONNECTION_ID, 'Message 31')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('2. Message Retrieval & Pagination', () => {
    it('returns empty array when no messages exist', async () => {
      const messages = await gymChatService.getMessages(CONNECTION_ID);
      expect(messages).toEqual([]);
    });

    it('returns messages for a specific connection in order', async () => {
      platform.storage.clear();
      // Fresh service instance
      const { GymChatService } = await import('@/services/gym-chat.service');
      const chatService = new GymChatService();

      await chatService.sendMessage(CONNECTION_ID, 'First message');
      await chatService.sendMessage(CONNECTION_ID, 'Second message');

      const messages = await chatService.getMessages(CONNECTION_ID);
      expect(messages.length).toBe(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
    });

    it('respects pagination limit', async () => {
      const { GymChatService } = await import('@/services/gym-chat.service');
      const chatService = new GymChatService();

      for (let i = 1; i <= 5; i++) {
        await chatService.sendMessage(CONNECTION_ID, `Msg ${i}`);
      }

      const paginated = await chatService.getMessages(CONNECTION_ID, 3);
      expect(paginated.length).toBe(3);
      expect(paginated[paginated.length - 1].content).toBe('Msg 5');
    });
  });

  describe('3. Read Status & Modifications', () => {
    it('marks unread messages as read', async () => {
      const { GymChatService } = await import('@/services/gym-chat.service');
      const chatService = new GymChatService();

      await chatService.sendMessage(CONNECTION_ID, 'Unread message');
      const count = await chatService.markAsRead(CONNECTION_ID);
      expect(count).toBeGreaterThanOrEqual(1);

      const messages = await chatService.getMessages(CONNECTION_ID);
      expect(messages[0].readAt).toBeDefined();
    });

    it('allows editing an existing message', async () => {
      const { GymChatService } = await import('@/services/gym-chat.service');
      const chatService = new GymChatService();

      const msg = await chatService.sendMessage(CONNECTION_ID, 'Original text');
      const edited = await chatService.editMessage(msg.id, 'Corrected text');
      expect(edited.content).toBe('Corrected text');
      expect(edited.editedAt).toBeDefined();
    });

    it('rejects editing a message with empty content', async () => {
      await expect(gymChatService.editMessage('msg-1', '   ')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('soft-deletes an existing message', async () => {
      const success = await gymChatService.deleteMessage('msg-1');
      expect(success).toBe(true);
    });
  });
});
