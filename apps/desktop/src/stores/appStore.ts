import { create } from 'zustand';
import type { Session, FrameMetadata, ChatMessage, ErrorResponse } from '@sync-reader/shared';

interface AppState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  connectionError: string | null;

  // Session state
  session: Session | null;
  sessionError: string | null;
  joinCode: string;

  // Frame state
  frames: FrameMetadata[];
  currentFrame: FrameMetadata | null;

  // Chat state
  messages: ChatMessage[];
  currentMessage: string;
  isAIResponding: boolean;
  aiResponse: string;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setSessionError: (error: string | null) => void;
  setJoinCode: (code: string) => void;
  setFrames: (frames: FrameMetadata[]) => void;
  setCurrentFrame: (frame: FrameMetadata | null) => void;
  addMessage: (message: ChatMessage) => void;
  setCurrentMessage: (message: string) => void;
  setIsAIResponding: (responding: boolean) => void;
  setAIResponse: (response: string) => void;
  appendAIToken: (token: string) => void;
  clearAIResponse: () => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  connecting: false,
  connectionError: null,
  session: null,
  sessionError: null,
  joinCode: '',
  frames: [],
  currentFrame: null,
  messages: [],
  currentMessage: '',
  isAIResponding: false,
  aiResponse: '',
};

export const useAppStore = create<AppState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  
  setConnecting: (connecting) => set({ connecting }),
  
  setConnectionError: (connectionError) => set({ connectionError }),
  
  setSession: (session) => set({ session }),
  
  setSessionError: (sessionError) => set({ sessionError }),
  
  setJoinCode: (joinCode) => set({ joinCode: joinCode.toUpperCase() }),
  
  setFrames: (frames) => {
    set({ frames });
    // Auto-select the latest frame
    const latest = frames[frames.length - 1];
    if (latest && (!get().currentFrame || latest.timestamp > get().currentFrame!.timestamp)) {
      set({ currentFrame: latest });
    }
  },
  
  setCurrentFrame: (currentFrame) => set({ currentFrame }),
  
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message]
    }));
  },
  
  setCurrentMessage: (currentMessage) => set({ currentMessage }),
  
  setIsAIResponding: (isAIResponding) => set({ isAIResponding }),
  
  setAIResponse: (aiResponse) => set({ aiResponse }),
  
  appendAIToken: (token) => {
    set((state) => ({
      aiResponse: state.aiResponse + token
    }));
  },
  
  clearAIResponse: () => set({ aiResponse: '' }),
  
  reset: () => set(initialState),
}));