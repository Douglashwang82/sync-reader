import type { Redis } from 'ioredis';
import type { 
  SessionData, 
  Frame, 
  ChatMessage, 
  RedisSessionData, 
  RedisFrame, 
  RedisMessage 
} from '../types/index.js';
import { SessionError } from '../types/index.js';

export class SessionManager {
  private readonly MAX_FRAMES = 20;
  private readonly SESSION_TTL = 3600; // 1 hour in seconds
  
  constructor(private redisClient: Redis) {}

  /**
   * Generate a unique 6-character pairing code
   */
  private generatePairingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new session for mobile client
   */
  async createSession(): Promise<{ sessionId: string; pairingCode: string }> {
    const sessionId = this.generateSessionId();
    const pairingCode = this.generatePairingCode();
    
    // Check if pairing code already exists (unlikely but handle collision)
    const existing = await this.redisClient.get(`pairing:${pairingCode}`);
    if (existing) {
      // Recursively try again with new code
      return this.createSession();
    }
    
    const now = new Date().toISOString();
    const sessionData: RedisSessionData = {
      pairingCode,
      status: 'waiting',
      mobileSocketId: null,
      desktopSocketId: null,
      createdAt: now,
      lastActivity: now
    };

    // Store session data
    const pipeline = this.redisClient.pipeline();
    pipeline.hset(`session:${sessionId}:meta`, sessionData);
    pipeline.set(`pairing:${pairingCode}`, sessionId);
    pipeline.expire(`session:${sessionId}:meta`, this.SESSION_TTL);
    pipeline.expire(`pairing:${pairingCode}`, 300); // 5 minutes for pairing
    
    await pipeline.exec();
    
    console.log(`📱 Session created: ${sessionId} with code: ${pairingCode}`);
    return { sessionId, pairingCode };
  }

  /**
   * Join an existing session using pairing code
   */
  async joinSession(pairingCode: string): Promise<string> {
    // Get session ID from pairing code
    const sessionId = await this.redisClient.get(`pairing:${pairingCode}`);
    if (!sessionId) {
      throw new SessionError('Invalid pairing code', 'INVALID_CODE');
    }

    // Get session data
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new SessionError('Session not found', 'SESSION_NOT_FOUND');
    }

    if (session.status !== 'waiting') {
      throw new SessionError('Session already paired or ended', 'INVALID_STATUS');
    }

    // Update session status to paired
    await this.updateSessionStatus(sessionId, 'paired');
    
    console.log(`💻 Desktop joined session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: 'waiting' | 'paired' | 'ended'): Promise<void> {
    const now = new Date().toISOString();
    
    await this.redisClient.hset(`session:${sessionId}:meta`, {
      status,
      lastActivity: now
    });

    if (status === 'ended') {
      // Clean up session data when ended
      await this.cleanupSession(sessionId);
    }
  }

  /**
   * Set socket ID for mobile or desktop client
   */
  async setSocketId(sessionId: string, socketId: string, clientType: 'mobile' | 'desktop'): Promise<void> {
    const field = clientType === 'mobile' ? 'mobileSocketId' : 'desktopSocketId';
    const now = new Date().toISOString();
    
    await this.redisClient.hset(`session:${sessionId}:meta`, {
      [field]: socketId,
      lastActivity: now
    });
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redisClient.hgetall(`session:${sessionId}:meta`);
    if (!data || !data.pairingCode) {
      return null;
    }

    return {
      sessionId,
      pairingCode: data.pairingCode,
      status: data.status as 'waiting' | 'paired' | 'ended',
      mobileSocketId: data.mobileSocketId || null,
      desktopSocketId: data.desktopSocketId || null,
      createdAt: new Date(data.createdAt),
      lastActivity: new Date(data.lastActivity)
    };
  }

  /**
   * Store a frame in the session's rolling buffer
   */
  async storeFrame(frame: Frame): Promise<void> {
    const frameData: RedisFrame = {
      id: frame.id,
      sessionId: frame.sessionId,
      timestamp: frame.timestamp.toISOString(),
      jpegData: frame.jpegData.toString('base64'),
      metadata: frame.metadata ? JSON.stringify(frame.metadata) : undefined
    };

    // Add frame to sorted set (score is timestamp for ordering)
    const score = frame.timestamp.getTime();
    const pipeline = this.redisClient.pipeline();
    
    // Store frame data
    pipeline.hset(`session:${frame.sessionId}:frame:${frame.id}`, frameData);
    
    // Add to frames sorted set
    pipeline.zadd(`session:${frame.sessionId}:frames`, score, frame.id);
    
    // Remove old frames if we exceed the limit
    pipeline.zremrangebyrank(`session:${frame.sessionId}:frames`, 0, -this.MAX_FRAMES - 1);
    
    // Get list of frames to remove
    const framesToRemove = await this.redisClient.zrange(
      `session:${frame.sessionId}:frames`, 
      0, 
      -this.MAX_FRAMES - 1
    );
    
    // Remove old frame data
    for (const frameId of framesToRemove) {
      pipeline.del(`session:${frame.sessionId}:frame:${frameId}`);
    }
    
    // Update session activity
    pipeline.hset(`session:${frame.sessionId}:meta`, {
      lastActivity: frame.timestamp.toISOString()
    });

    await pipeline.exec();
  }

  /**
   * Get recent frames for a session
   */
  async getRecentFrames(sessionId: string, limit: number = this.MAX_FRAMES): Promise<Frame[]> {
    // Get frame IDs in reverse chronological order (newest first)
    const frameIds = await this.redisClient.zrevrange(
      `session:${sessionId}:frames`, 
      0, 
      limit - 1
    );

    if (frameIds.length === 0) {
      return [];
    }

    // Get frame data
    const frames: Frame[] = [];
    for (const frameId of frameIds) {
      const frameData = await this.redisClient.hgetall(`session:${sessionId}:frame:${frameId}`);
      if (frameData && frameData.jpegData) {
        frames.push({
          id: frameData.id,
          sessionId: frameData.sessionId,
          timestamp: new Date(frameData.timestamp),
          jpegData: Buffer.from(frameData.jpegData, 'base64'),
          metadata: frameData.metadata ? JSON.parse(frameData.metadata) : undefined
        });
      }
    }

    return frames;
  }

  /**
   * Store a chat message
   */
  async storeChatMessage(message: ChatMessage): Promise<void> {
    const messageData: RedisMessage = {
      id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      frames: message.frames ? JSON.stringify(message.frames) : undefined
    };

    const score = message.timestamp.getTime();
    const pipeline = this.redisClient.pipeline();
    
    // Store message data
    pipeline.hset(`session:${message.sessionId}:message:${message.id}`, messageData);
    
    // Add to messages sorted set
    pipeline.zadd(`session:${message.sessionId}:messages`, score, message.id);
    
    // Update session activity
    pipeline.hset(`session:${message.sessionId}:meta`, {
      lastActivity: message.timestamp.toISOString()
    });

    await pipeline.exec();
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    // Get message IDs in chronological order
    const messageIds = await this.redisClient.zrange(
      `session:${sessionId}:messages`, 
      -limit, 
      -1
    );

    const messages: ChatMessage[] = [];
    for (const messageId of messageIds) {
      const messageData = await this.redisClient.hgetall(`session:${sessionId}:message:${messageId}`);
      if (messageData && messageData.content) {
        messages.push({
          id: messageData.id,
          sessionId,
          type: messageData.type as 'user' | 'assistant',
          content: messageData.content,
          timestamp: new Date(messageData.timestamp),
          frames: messageData.frames ? JSON.parse(messageData.frames) : undefined
        });
      }
    }

    return messages;
  }

  /**
   * Clean up session data
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    
    // Get all frame IDs to clean up
    const frameIds = await this.redisClient.zrange(`session:${sessionId}:frames`, 0, -1);
    for (const frameId of frameIds) {
      pipeline.del(`session:${sessionId}:frame:${frameId}`);
    }
    
    // Get all message IDs to clean up
    const messageIds = await this.redisClient.zrange(`session:${sessionId}:messages`, 0, -1);
    for (const messageId of messageIds) {
      pipeline.del(`session:${sessionId}:message:${messageId}`);
    }
    
    // Clean up session keys
    pipeline.del(`session:${sessionId}:meta`);
    pipeline.del(`session:${sessionId}:frames`);
    pipeline.del(`session:${sessionId}:messages`);
    
    // Clean up pairing code
    const session = await this.getSession(sessionId);
    if (session) {
      pipeline.del(`pairing:${session.pairingCode}`);
    }

    await pipeline.exec();
    console.log(`🧹 Session cleaned up: ${sessionId}`);
  }

  /**
   * Check if session exists and is active
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null && session.status !== 'ended';
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'ended');
    console.log(`🔚 Session ended: ${sessionId}`);
  }
}