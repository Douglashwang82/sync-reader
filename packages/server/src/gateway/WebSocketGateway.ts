import { Server as SocketIOServer, Socket } from 'socket.io';
import type { 
  SessionCreateEvent, 
  SessionJoinEvent, 
  FrameBinaryEvent, 
  ChatQuestionEvent,
  Frame
} from '../types/index.js';
import type { SessionManager } from '../session/SessionManager.js';
import type { LLMOrchestrator } from '../llm/LLMOrchestrator.js';
import { SessionError } from '../types/index.js';

export class WebSocketGateway {
  constructor(
    private io: SocketIOServer,
    private sessionManager: SessionManager,
    private llmOrchestrator: LLMOrchestrator
  ) {
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Mobile client events
      socket.on('session_create', this.handleSessionCreate.bind(this, socket));
      socket.on('frame_binary', this.handleFrameBinary.bind(this, socket));
      
      // Desktop client events
      socket.on('session_join', this.handleSessionJoin.bind(this, socket));
      socket.on('chat_question', this.handleChatQuestion.bind(this, socket));
      
      // Common events
      socket.on('session_end', this.handleSessionEnd.bind(this, socket));
      socket.on('disconnect', this.handleDisconnect.bind(this, socket));

      // Error handling
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
      });
    });
  }

  /**
   * Handle mobile client creating a new session
   */
  private async handleSessionCreate(socket: Socket): Promise<void> {
    try {
      const { sessionId, pairingCode } = await this.sessionManager.createSession();
      
      // Set socket ID for mobile client
      await this.sessionManager.setSocketId(sessionId, socket.id, 'mobile');
      
      // Join socket to session room
      await socket.join(sessionId);
      
      // Store session info on socket
      socket.data = { sessionId, clientType: 'mobile' };
      
      // Emit success event
      const event: SessionCreateEvent = { sessionId, pairingCode };
      socket.emit('session_created', event);
      
      console.log(`📱 Mobile created session: ${sessionId} (${pairingCode})`);
      
    } catch (error) {
      console.error('❌ Session create error:', error);
      socket.emit('session_error', { 
        message: 'Failed to create session',
        code: 'CREATE_FAILED'
      });
    }
  }

  /**
   * Handle desktop client joining a session
   */
  private async handleSessionJoin(socket: Socket, data: SessionJoinEvent): Promise<void> {
    try {
      if (!data.pairingCode) {
        throw new SessionError('Pairing code required', 'MISSING_CODE');
      }

      const sessionId = await this.sessionManager.joinSession(data.pairingCode);
      
      // Set socket ID for desktop client
      await this.sessionManager.setSocketId(sessionId, socket.id, 'desktop');
      
      // Join socket to session room
      await socket.join(sessionId);
      
      // Store session info on socket
      socket.data = { sessionId, clientType: 'desktop' };
      
      // Emit success to desktop
      socket.emit('session_paired', { sessionId });
      
      // Notify mobile client that desktop has joined
      socket.to(sessionId).emit('session_paired', { sessionId });
      
      console.log(`💻 Desktop joined session: ${sessionId}`);
      
    } catch (error) {
      console.error('❌ Session join error:', error);
      
      if (error instanceof SessionError) {
        socket.emit('session_error', { 
          message: error.message,
          code: error.code
        });
      } else {
        socket.emit('session_error', { 
          message: 'Failed to join session',
          code: 'JOIN_FAILED'
        });
      }
    }
  }

  /**
   * Handle mobile client sending frame data
   */
  private async handleFrameBinary(socket: Socket, data: FrameBinaryEvent): Promise<void> {
    try {
      const { sessionId, clientType } = socket.data;
      
      if (!sessionId || clientType !== 'mobile') {
        throw new Error('Unauthorized frame upload - mobile session required');
      }

      if (!data.jpegData || !Buffer.isBuffer(data.jpegData)) {
        throw new Error('Invalid frame data - JPEG buffer required');
      }

      // Validate session is still active
      const isActive = await this.sessionManager.isSessionActive(sessionId);
      if (!isActive) {
        throw new Error('Session no longer active');
      }

      // Create frame object
      const frame: Frame = {
        id: data.frameId || `frame_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        jpegData: data.jpegData,
        metadata: data.metadata
      };

      // Store frame in session
      await this.sessionManager.storeFrame(frame);
      
      // Notify desktop clients about new frame
      socket.to(sessionId).emit('frame_update', {
        frameId: frame.id,
        timestamp: frame.timestamp.getTime(),
        metadata: frame.metadata
      });
      
      console.log(`📸 Frame stored: ${frame.id} for session ${sessionId}`);
      
    } catch (error) {
      console.error('❌ Frame binary error:', error);
      socket.emit('frame_error', { 
        message: 'Failed to process frame',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handle desktop client asking a question
   */
  private async handleChatQuestion(socket: Socket, data: ChatQuestionEvent): Promise<void> {
    try {
      const { sessionId, clientType } = socket.data;
      
      if (!sessionId || clientType !== 'desktop') {
        throw new Error('Unauthorized chat - desktop session required');
      }

      if (!data.question || typeof data.question !== 'string') {
        throw new Error('Invalid question data');
      }

      // Validate session is still active
      const isActive = await this.sessionManager.isSessionActive(sessionId);
      if (!isActive) {
        throw new Error('Session no longer active');
      }

      // Get recent frames for context
      const frames = await this.sessionManager.getRecentFrames(sessionId);
      
      if (frames.length === 0) {
        socket.emit('ai_error', {
          questionId: data.questionId,
          message: 'No frames available for analysis. Please ensure the mobile app is capturing screens.',
          code: 'NO_FRAMES'
        });
        return;
      }

      // Store user message
      await this.sessionManager.storeChatMessage({
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        type: 'user',
        content: data.question,
        timestamp: new Date()
      });

      // Process with LLM
      console.log(`🤖 Processing question for session ${sessionId}: "${data.question.substring(0, 50)}..."`);
      
      const stream = this.llmOrchestrator.processQuestion({
        question: data.question,
        frames,
        sessionId,
        questionId: data.questionId
      });

      let responseContent = '';
      let usedFrames: string[] = [];
      
      // Stream tokens to client
      for await (const token of stream) {
        socket.emit('ai_token', token);
        
        if (token.type === 'token' && token.content) {
          responseContent += token.content;
        }
        
        if (token.type === 'done') {
          // Store assistant response
          await this.sessionManager.storeChatMessage({
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            sessionId,
            type: 'assistant',
            content: responseContent,
            timestamp: new Date(),
            frames: usedFrames
          });
          
          console.log(`✅ Question answered for session ${sessionId}`);
        }
        
        if (token.type === 'error') {
          console.error(`❌ LLM error for session ${sessionId}:`, token.error);
        }
      }
      
    } catch (error) {
      console.error('❌ Chat question error:', error);
      socket.emit('ai_error', { 
        questionId: data.questionId,
        message: 'Failed to process question',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'PROCESSING_FAILED'
      });
    }
  }

  /**
   * Handle session end
   */
  private async handleSessionEnd(socket: Socket): Promise<void> {
    try {
      const { sessionId } = socket.data;
      
      if (!sessionId) {
        return; // No active session
      }

      await this.sessionManager.endSession(sessionId);
      
      // Notify all clients in the session
      this.io.to(sessionId).emit('session_ended', { sessionId });
      
      // Remove all clients from the room
      const sockets = await this.io.in(sessionId).fetchSockets();
      for (const sock of sockets) {
        await sock.leave(sessionId);
        sock.data = {};
      }
      
      console.log(`🔚 Session ended: ${sessionId}`);
      
    } catch (error) {
      console.error('❌ Session end error:', error);
      socket.emit('session_error', { 
        message: 'Failed to end session properly',
        code: 'END_FAILED'
      });
    }
  }

  /**
   * Handle client disconnection
   */
  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const { sessionId, clientType } = socket.data;
      
      if (!sessionId) {
        console.log(`🔌 Client disconnected: ${socket.id} (no session)`);
        return;
      }

      console.log(`🔌 Client disconnected: ${socket.id} (${clientType}, session: ${sessionId})`);
      
      // Check if this was the only client in the session
      const socketsInRoom = await this.io.in(sessionId).fetchSockets();
      const otherSockets = socketsInRoom.filter(s => s.id !== socket.id);
      
      if (otherSockets.length === 0) {
        // No other clients, end the session
        await this.sessionManager.endSession(sessionId);
        console.log(`🔚 Session auto-ended due to all clients disconnecting: ${sessionId}`);
      } else {
        // Notify remaining clients
        socket.to(sessionId).emit('client_disconnected', { 
          clientType,
          sessionId 
        });
      }
      
    } catch (error) {
      console.error('❌ Disconnect handling error:', error);
    }
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.io.engine.clientsCount,
      rooms: this.io.sockets.adapter.rooms.size
    };
  }
}