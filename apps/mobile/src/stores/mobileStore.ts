import { create } from 'zustand';
import type { Session, ErrorResponse } from '@sync-reader/shared';

interface MobileAppState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  connectionError: string | null;

  // Session state
  session: Session | null;
  sessionError: string | null;

  // Screen capture state
  isCapturing: boolean;
  captureEnabled: boolean;
  lastCaptureTime: number;
  captureCount: number;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setSession: (session: Session | null) => void;
  setSessionError: (error: string | null) => void;
  setIsCapturing: (capturing: boolean) => void;
  setCaptureEnabled: (enabled: boolean) => void;
  setLastCaptureTime: (time: number) => void;
  incrementCaptureCount: () => void;
  reset: () => void;
}

const initialState = {
  connected: false,
  connecting: false,
  connectionError: null,
  session: null,
  sessionError: null,
  isCapturing: false,
  captureEnabled: false,
  lastCaptureTime: 0,
  captureCount: 0,
};

export const useMobileStore = create<MobileAppState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  
  setConnecting: (connecting) => set({ connecting }),
  
  setConnectionError: (connectionError) => set({ connectionError }),
  
  setSession: (session) => set({ session }),
  
  setSessionError: (sessionError) => set({ sessionError }),
  
  setIsCapturing: (isCapturing) => set({ isCapturing }),
  
  setCaptureEnabled: (captureEnabled) => set({ captureEnabled }),
  
  setLastCaptureTime: (lastCaptureTime) => set({ lastCaptureTime }),
  
  incrementCaptureCount: () => {
    set((state) => ({
      captureCount: state.captureCount + 1
    }));
  },
  
  reset: () => set(initialState),
}));