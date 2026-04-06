// Core session types
export interface Session {
  id: string;
  code: string; // 6-character session code  
  status: SessionStatus;
  createdAt: number;
  lastActivity: number;
  mobileConnected: boolean;
  desktopConnected: boolean;
}

export type SessionStatus = 'unpaired' | 'paired' | 'active' | 'ended';

// Frame types
export interface Frame {
  id: string;
  sessionId: string;
  timestamp: number;
  data: Buffer; // JPEG binary data
  sequenceNumber: number;
}

export interface FrameMetadata {
  id: string;
  timestamp: number;
  sequenceNumber: number;
  size: number;
}

// Chat types  
export interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: number;
  type: 'user' | 'ai';
  frames?: string[]; // Frame IDs that were used for context
}

// WebSocket event contracts
export interface ClientToServerEvents {
  // Mobile events
  session_create: () => void;
  frame_binary: (data: Buffer) => void;
  capture_pause: () => void;
  capture_resume: () => void;
  
  // Desktop events
  session_join: (code: string) => void;
  chat_question: (message: string) => void;
  
  // Shared events
  session_end: () => void;
}

export interface ServerToClientEvents {
  // To Desktop
  session_status: (session: Session) => void;
  frame_update: (frames: FrameMetadata[]) => void;
  ai_token: (token: string) => void;
  ai_done: (message: ChatMessage) => void;
  ai_error: (error: ErrorResponse) => void;
  
  // To Mobile
  session_paired: () => void;
  session_error: (error: ErrorResponse) => void;
}

// Error types
export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
}

// LLM Provider types
export interface MultimodalRequest {
  sessionId: string;
  question: string;
  frames: Frame[];
  history: ChatMessage[];
}

export interface TokenEvent {
  type: 'token' | 'done' | 'error';
  content?: string;
  message?: ChatMessage;
  error?: ErrorResponse;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface LLMError {
  type: 'RATE_LIMIT' | 'TRANSIENT_UPSTREAM' | 'INVALID_REQUEST' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

// Constants
export const SESSION_CODE_LENGTH = 6;
export const MAX_FRAMES_PER_SESSION = 20;
export const SESSION_TTL_UNPAIRED = 5 * 60; // 5 minutes
export const FRAME_COMPRESSION_QUALITY = 0.8;
export const MAX_MESSAGE_LENGTH = 1000;
export const RATE_LIMIT_MESSAGES_PER_MINUTE = 100;
export const RATE_LIMIT_LLM_REQUESTS_PER_MINUTE = 20;