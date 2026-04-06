import Redis from 'ioredis';
import { SessionManager } from '../session/SessionManager';
import { ContextSelector } from '../llm/ContextSelector';
import { OpenAIAdapter } from '../llm/providers/OpenAIAdapter';
import { AnthropicAdapter } from '../llm/providers/AnthropicAdapter';
import { LLMOrchestrator } from '../llm/LLMOrchestrator';
import type { Frame, MultimodalRequest } from '../types';

describe('Backend Integration Tests', () => {
  let redisClient: Redis;
  let sessionManager: SessionManager;
  let contextSelector: ContextSelector;
  let llmOrchestrator: LLMOrchestrator;

  beforeEach(() => {
    // Create mocked Redis client
    redisClient = new Redis();
    
    // Initialize components
    sessionManager = new SessionManager(redisClient);
    contextSelector = new ContextSelector();
    
    // Initialize LLM providers
    const openaiAdapter = new OpenAIAdapter('test-api-key');
    const anthropicAdapter = new AnthropicAdapter('test-api-key');
    
    llmOrchestrator = new LLMOrchestrator([openaiAdapter, anthropicAdapter], contextSelector);
  });

  afterEach(async () => {
    await redisClient.quit();
  });

  describe('Session Lifecycle', () => {
    it('should create a session with pairing code', async () => {
      const result = await sessionManager.createSession();
      
      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('pairingCode');
      expect(result.pairingCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(result.sessionId).toContain('session_');
    });

    it('should join a session with valid pairing code', async () => {
      // Mock Redis to return session data
      const mockSessionId = 'test-session-123';
      (redisClient.get as jest.Mock).mockResolvedValueOnce(mockSessionId);
      (redisClient.hgetall as jest.Mock).mockResolvedValueOnce({
        pairingCode: 'TEST01',
        status: 'waiting',
        mobileSocketId: null,
        desktopSocketId: null,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      });

      const sessionId = await sessionManager.joinSession('TEST01');
      expect(sessionId).toBe(mockSessionId);
    });

    it('should store and retrieve frames', async () => {
      const sessionId = 'test-session';
      const frame: Frame = {
        id: 'frame-1',
        sessionId,
        timestamp: new Date(),
        jpegData: Buffer.from('fake-jpeg-data'),
        metadata: { width: 800, height: 600 }
      };

      // Mock Redis responses for frame storage
      (redisClient.zrange as jest.Mock).mockResolvedValueOnce([]);
      
      await sessionManager.storeFrame(frame);
      
      // Verify Redis operations were called
      expect(redisClient.pipeline).toHaveBeenCalled();
    });
  });

  describe('Context Selection', () => {
    it('should select relevant frames for questions', async () => {
      const frames: Frame[] = [
        {
          id: 'frame-1',
          sessionId: 'test-session',
          timestamp: new Date(Date.now() - 1000),
          jpegData: Buffer.from('fake-jpeg-data-1')
        },
        {
          id: 'frame-2', 
          sessionId: 'test-session',
          timestamp: new Date(),
          jpegData: Buffer.from('fake-jpeg-data-2')
        }
      ];

      const selected = await contextSelector.selectRelevantFrames(frames, 'What is on the screen?');
      
      expect(selected).toBeInstanceOf(Array);
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(frames.length);
    });

    it('should return all frames if fewer than minimum required', async () => {
      const frames: Frame[] = [
        {
          id: 'frame-1',
          sessionId: 'test-session', 
          timestamp: new Date(),
          jpegData: Buffer.from('fake-jpeg-data-1')
        }
      ];

      const selected = await contextSelector.selectRelevantFrames(frames, 'Test question');
      expect(selected).toEqual(frames);
    });
  });

  describe('LLM Orchestration', () => {
    it('should process questions with frame context', async () => {
      const request: MultimodalRequest = {
        question: 'What do you see in these images?',
        frames: [
          {
            id: 'frame-1',
            sessionId: 'test-session',
            timestamp: new Date(),
            jpegData: Buffer.from('fake-jpeg-data')
          }
        ],
        sessionId: 'test-session',
        questionId: 'question-1'
      };

      const tokens = [];
      for await (const token of llmOrchestrator.processQuestion(request)) {
        tokens.push(token);
      }

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.type === 'token')).toBe(true);
      expect(tokens.some(t => t.type === 'done')).toBe(true);
    });

    it('should provide cost estimates', async () => {
      const openaiAdapter = new OpenAIAdapter('test-key');
      const request: MultimodalRequest = {
        question: 'Test question',
        frames: [
          {
            id: 'frame-1',
            sessionId: 'test-session',
            timestamp: new Date(),
            jpegData: Buffer.from('fake-jpeg-data')
          }
        ],
        sessionId: 'test-session',
        questionId: 'question-1'
      };

      const estimate = await openaiAdapter.estimateCost(request);
      
      expect(estimate).toHaveProperty('inputTokens');
      expect(estimate).toHaveProperty('outputTokens');
      expect(estimate).toHaveProperty('totalCost');
      expect(estimate).toHaveProperty('provider');
      expect(estimate.provider).toBe('openai');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pairing codes', async () => {
      // Mock Redis to return null for invalid pairing code
      (redisClient.get as jest.Mock).mockResolvedValueOnce(null);

      await expect(sessionManager.joinSession('INVALID')).rejects.toThrow('Invalid pairing code');
    });

    it('should normalize provider errors correctly', () => {
      const openaiAdapter = new OpenAIAdapter('test-key');
      
      // Test rate limit error
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      
      const normalized = openaiAdapter.normalizeError(rateLimitError);
      
      expect(normalized.type).toBe('RATE_LIMIT');
      expect(normalized.provider).toBe('openai');
    });
  });
});