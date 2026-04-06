export interface SessionData {
  sessionId: string;
  pairingCode: string;
  status: 'waiting' | 'paired' | 'ended';
  mobileSocketId: string | null;
  desktopSocketId: string | null;
  createdAt: Date;
  lastActivity: Date;
}

export interface Frame {
  id: string;
  sessionId: string;
  timestamp: Date;
  jpegData: Buffer;
  metadata?: {
    width?: number;
    height?: number;
    captureMethod?: string;
    quality?: number;
  };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  frames?: string[]; // Frame IDs used for context
}

// WebSocket Events
export interface SessionCreateEvent {
  sessionId: string;
  pairingCode: string;
}

export interface SessionJoinEvent {
  pairingCode: string;
}

export interface FrameBinaryEvent {
  sessionId: string;
  frameId: string;
  jpegData: Buffer;
  timestamp: number;
  metadata?: Frame['metadata'];
}

export interface ChatQuestionEvent {
  sessionId: string;
  questionId: string;
  question: string;
}

// LLM Types
export interface MultimodalRequest {
  question: string;
  frames: Frame[];
  sessionId: string;
  questionId: string;
}

export interface TokenEvent {
  type: 'token' | 'done' | 'error';
  questionId: string;
  content?: string;
  error?: string;
  provider?: string;
  cost?: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  provider: string;
}

export interface LLMError {
  type: 'RATE_LIMIT' | 'TRANSIENT_UPSTREAM' | 'PERMANENT' | 'VALIDATION';
  message: string;
  retryAfter?: number;
  provider: string;
}

export interface LLMAdapter {
  providerName(): string;
  streamMultimodal(request: MultimodalRequest): AsyncGenerator<TokenEvent>;
  estimateCost(request: MultimodalRequest): Promise<CostEstimate>;
  normalizeError(error: unknown): LLMError;
}

// Redis Data Structures
export interface RedisSessionData {
  pairingCode: string;
  status: 'waiting' | 'paired' | 'ended';
  mobileSocketId: string | null;
  desktopSocketId: string | null;
  createdAt: string;
  lastActivity: string;
}

export interface RedisFrame {
  id: string;
  sessionId: string;
  timestamp: string;
  jpegData: string; // Base64 encoded
  metadata?: string; // JSON stringified
}

export interface RedisMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  frames?: string; // JSON stringified array of frame IDs
}

// Configuration
export interface ServerConfig {
  port: number;
  redisUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  sessionSecret: string;
}

// Error Types
export class SessionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export class LLMProviderError extends Error {
  constructor(
    message: string, 
    public provider: string,
    public type: LLMError['type']
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}