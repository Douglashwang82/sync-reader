import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Session,
  ErrorResponse
} from '@sync-reader/shared';

class MobileWebSocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io('ws://localhost:3002', {
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
  createSession() {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('session_create');
  }

  endSession() {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('session_end');
  }

  // Screen capture
  sendFrame(frameData: Buffer) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('frame_binary', frameData);
  }

  pauseCapture() {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('capture_pause');
  }

  resumeCapture() {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.emit('capture_resume');
  }

  // Event listeners
  onSessionPaired(callback: () => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('session_paired', callback);
  }

  onSessionError(callback: (error: ErrorResponse) => void) {
    if (!this.socket) throw new Error('Not connected to server');
    this.socket.on('session_error', callback);
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

export const mobileWsService = new MobileWebSocketService();