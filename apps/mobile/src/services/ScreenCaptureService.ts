import { captureRef, ViewShot } from 'react-native-view-shot';
import { Alert, Platform, Dimensions } from 'react-native';
import { Buffer } from 'buffer';

export interface CaptureOptions {
  format: 'jpeg' | 'png';
  quality: number;
  result: 'base64' | 'data-uri';
}

class ScreenCaptureService {
  private isCapturing = false;
  private captureInterval: NodeJS.Timeout | null = null;
  private captureIntervalMs = 3000; // 3 seconds
  private viewShotRef: React.RefObject<ViewShot> | null = null;

  constructor() {
    this.requestPermissions();
  }

  private async requestPermissions() {
    if (Platform.OS === 'android') {
      try {
        // In a real app, you'd request SCREEN_CAPTURE permissions here
        // This is a simplified version for demo purposes
        console.log('Screen capture permissions requested');
      } catch (error) {
        console.error('Failed to request permissions:', error);
      }
    }
  }

  setViewShotRef(ref: React.RefObject<ViewShot>) {
    this.viewShotRef = ref;
  }

  async captureScreen(): Promise<Buffer | null> {
    if (!this.viewShotRef?.current) {
      console.warn('ViewShot reference not set');
      return null;
    }

    try {
      const options: CaptureOptions = {
        format: 'jpeg',
        quality: 0.8,
        result: 'base64'
      };

      const uri = await captureRef(this.viewShotRef.current, options);
      
      // Convert base64 to Buffer
      const base64Data = uri.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      return buffer;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      return null;
    }
  }

  startPeriodicCapture(onFrameCaptured: (frame: Buffer) => void) {
    if (this.isCapturing) {
      console.warn('Capture already in progress');
      return;
    }

    this.isCapturing = true;
    
    const captureLoop = async () => {
      if (!this.isCapturing) return;

      const frame = await this.captureScreen();
      if (frame) {
        onFrameCaptured(frame);
      }
      
      if (this.isCapturing) {
        this.captureInterval = setTimeout(captureLoop, this.captureIntervalMs);
      }
    };

    captureLoop();
  }

  stopPeriodicCapture() {
    this.isCapturing = false;
    
    if (this.captureInterval) {
      clearTimeout(this.captureInterval);
      this.captureInterval = null;
    }
  }

  pauseCapture() {
    if (this.captureInterval) {
      clearTimeout(this.captureInterval);
      this.captureInterval = null;
    }
    // Don't set isCapturing to false, so we can resume
  }

  resumeCapture(onFrameCaptured: (frame: Buffer) => void) {
    if (!this.isCapturing) return;
    
    const captureLoop = async () => {
      if (!this.isCapturing) return;

      const frame = await this.captureScreen();
      if (frame) {
        onFrameCaptured(frame);
      }
      
      if (this.isCapturing) {
        this.captureInterval = setTimeout(captureLoop, this.captureIntervalMs);
      }
    };

    captureLoop();
  }

  setCaptureInterval(intervalMs: number) {
    this.captureIntervalMs = intervalMs;
  }

  get isActive() {
    return this.isCapturing;
  }

  // Get optimal capture settings based on device capabilities
  getOptimalCaptureSettings() {
    const { width, height } = Dimensions.get('window');
    
    // Compress larger screens more aggressively
    const maxDimension = Math.max(width, height);
    let quality = 0.8;
    
    if (maxDimension > 1920) {
      quality = 0.6;
    } else if (maxDimension > 1080) {
      quality = 0.7;
    }

    return {
      format: 'jpeg' as const,
      quality,
      result: 'base64' as const,
      width: Math.min(width, 1080), // Cap at 1080p for bandwidth
      height: Math.min(height, 1080)
    };
  }
}

export const screenCaptureService = new ScreenCaptureService();