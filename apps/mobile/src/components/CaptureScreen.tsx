import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { ViewShot } from 'react-native-view-shot';
import { useMobileStore } from '../stores/mobileStore';
import { mobileWsService } from '../services/MobileWebSocketService';
import { screenCaptureService } from '../services/ScreenCaptureService';

const CaptureScreen: React.FC = () => {
  const { 
    sessionState,
    sessionCode,
    isCapturing,
    setSessionState,
    setIsCapturing,
    resetSession
  } = useMobileStore();

  const viewShotRef = useRef<ViewShot>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastCaptureTime, setLastCaptureTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set the ViewShot reference for the capture service
    screenCaptureService.setViewShotRef(viewShotRef);

    // Start capturing if session is paired
    if (sessionState === 'paired' && !isCapturing) {
      startCapturing();
    }

    return () => {
      stopCapturing();
    };
  }, [sessionState]);

  const startCapturing = () => {
    if (!mobileWsService.connected) {
      Alert.alert('Not Connected', 'Connection to server lost');
      return;
    }

    try {
      setIsCapturing(true);
      setSessionState('capturing');

      screenCaptureService.startPeriodicCapture((frameBuffer) => {
        // Send frame to server
        mobileWsService.sendFrame(frameBuffer);
        
        // Update UI
        setCaptureCount(prev => prev + 1);
        setLastCaptureTime(new Date());
      });

      // Resume capture on WebSocket
      mobileWsService.resumeCapture();

    } catch (error) {
      console.error('Failed to start capture:', error);
      Alert.alert('Capture Error', 'Failed to start screen capture');
      setIsCapturing(false);
    }
  };

  const stopCapturing = () => {
    screenCaptureService.stopPeriodicCapture();
    mobileWsService.pauseCapture();
    setIsCapturing(false);
  };

  const handlePauseResume = () => {
    if (isCapturing) {
      stopCapturing();
    } else {
      startCapturing();
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: () => {
            stopCapturing();
            mobileWsService.endSession();
            resetSession();
          },
        },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ViewShot ref={viewShotRef} style={styles.captureArea}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Session Info */}
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionTitle}>Session Active</Text>
            <Text style={styles.sessionCode}>Code: {sessionCode}</Text>
          </View>

          {/* Capture Status */}
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Capture Status</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>State:</Text>
              <Text style={[
                styles.statusValue,
                { color: isCapturing ? '#34C759' : '#FF9500' }
              ]}>
                {isCapturing ? 'Active' : 'Paused'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Frames sent:</Text>
              <Text style={styles.statusValue}>{captureCount}</Text>
            </View>
            {lastCaptureTime && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Last capture:</Text>
                <Text style={styles.statusValue}>
                  {formatTime(lastCaptureTime)}
                </Text>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>How it works</Text>
            <Text style={styles.instructionsText}>
              • Your screen is being captured every 3 seconds
            </Text>
            <Text style={styles.instructionsText}>
              • Frames are sent to your desktop for AI analysis
            </Text>
            <Text style={styles.instructionsText}>
              • Use your desktop to ask questions about what you're reading
            </Text>
            <Text style={styles.instructionsText}>
              • All data is automatically deleted when the session ends
            </Text>
          </View>

          {/* Demo Content for Capture */}
          <View style={styles.demoContent}>
            <Text style={styles.demoTitle}>Sample Reading Content</Text>
            <Text style={styles.demoText}>
              This is sample text that would typically be from an article, book, 
              or document you're reading on your mobile device. The AI can analyze 
              this content and help answer questions about it from your desktop.
            </Text>
            <Text style={styles.demoText}>
              For example, you might be reading a technical article, a research paper, 
              or an e-book, and want to ask questions about specific concepts or 
              get clarification on complex topics.
            </Text>
          </View>
        </ScrollView>
      </ViewShot>

      {/* Control Panel */}
      <View style={styles.controlPanel}>
        <TouchableOpacity 
          style={[
            styles.controlButton, 
            styles.pauseButton,
            { backgroundColor: isCapturing ? '#FF9500' : '#34C759' }
          ]}
          onPress={handlePauseResume}
        >
          <Text style={styles.controlButtonText}>
            {isCapturing ? 'Pause Capture' : 'Resume Capture'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.controlButton, styles.endButton]}
          onPress={handleEndSession}
        >
          <Text style={styles.controlButtonText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  captureArea: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100, // Space for control panel
  },
  sessionInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  sessionCode: {
    fontSize: 14,
    color: '#666666',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  instructionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
    lineHeight: 20,
  },
  demoContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  demoText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
    marginBottom: 12,
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e7',
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  endButton: {
    backgroundColor: '#FF3B30',
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CaptureScreen;