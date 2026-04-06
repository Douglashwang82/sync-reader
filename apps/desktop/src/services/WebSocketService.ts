import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Session,
  FrameMetadata,
  ChatMessage,
  ErrorResponse
} from '@sync-reader/shared';

class WebSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Use environment variable or default to localhost:3002
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'ws://localhost:3002';
    
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      upgrade: false,
      autoConnect: true,
    });

    this.setupEventListeners();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        return;
      }
      
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.handleReconnection();
    });
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Session management
  joinSession(code: string) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('session_join', code);
  }

  endSession() {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('session_end');
  }

  // Chat functionality
  sendQuestion(message: string) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('chat_question', message);
  }

  // Event listeners
  onSessionStatus(callback: (session: Session) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('session_status', callback);
  }

  onFrameUpdate(callback: (frames: FrameMetadata[]) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('frame_update', callback);
  }

  onAIToken(callback: (token: string) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('ai_token', callback);
  }

  onAIDone(callback: (message: ChatMessage) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('ai_done', callback);
  }

  onAIError(callback: (error: ErrorResponse) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('ai_error', callback);
  }

  // Clean up listeners
  removeAllListeners() {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  get connected() {
    return this.socket?.connected ?? false;
  }
}

export const wsService = new WebSocketService();