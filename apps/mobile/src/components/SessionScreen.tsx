import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';
import { useMobileStore } from '../stores/mobileStore';
import { mobileWsService } from '../services/MobileWebSocketService';

interface SessionScreenProps {
  onRetryConnection?: () => void;
}

const SessionScreen: React.FC<SessionScreenProps> = ({ onRetryConnection }) => {
  const { 
    connectionState, 
    sessionState, 
    sessionCode,
    setSessionState,
    setSessionCode
  } = useMobileStore();

  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    // Listen for session creation success
    if (mobileWsService.connected) {
      const socket = mobileWsService.connect();
      
      socket.on('session_paired', () => {
        setSessionState('paired');
      });

      socket.on('session_error', (error) => {
        setIsCreatingSession(false);
        Alert.alert('Session Error', error.message);
      });
    }
  }, [setSessionState]);

  const handleCreateSession = async () => {
    if (!mobileWsService.connected) {
      Alert.alert('Not Connected', 'Please wait for connection to server...');
      return;
    }

    try {
      setIsCreatingSession(true);
      setSessionState('creating');
      
      // Create session on server
      mobileWsService.createSession();
      
      // Set temporary session code (will be updated by server)
      const tempCode = Math.random().toString(36).substr(2, 6).toUpperCase();
      setSessionCode(tempCode);
      setSessionState('waiting_for_pair');
      
      setIsCreatingSession(false);
    } catch (error) {
      setIsCreatingSession(false);
      console.error('Failed to create session:', error);
      Alert.alert('Error', 'Failed to create session. Please try again.');
    }
  };

  const renderConnectionStatus = () => {
    switch (connectionState) {
      case 'connecting':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.statusText}>Connecting to server...</Text>
          </View>
        );
      
      case 'disconnected':
      case 'error':
        return (
          <View style={styles.statusContainer}>
            <Text style={styles.errorText}>Connection lost</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={onRetryConnection}
            >
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
        );
      
      case 'connected':
        return null;
      
      default:
        return null;
    }
  };

  const renderSessionContent = () => {
    if (connectionState !== 'connected') {
      return null;
    }

    switch (sessionState) {
      case 'idle':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>Sync Reader</Text>
            <Text style={styles.subtitle}>
              Share your mobile screen with your desktop for AI-powered reading assistance
            </Text>
            
            <TouchableOpacity 
              style={[styles.createButton, isCreatingSession && styles.buttonDisabled]}
              onPress={handleCreateSession}
              disabled={isCreatingSession}
            >
              {isCreatingSession ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.createButtonText}>Create Session</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      
      case 'creating':
        return (
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.statusText}>Creating session...</Text>
          </View>
        );
      
      case 'waiting_for_pair':
        return (
          <View style={styles.content}>
            <Text style={styles.title}>Session Created</Text>
            <Text style={styles.subtitle}>
              Enter this code on your desktop to pair devices:
            </Text>
            
            <View style={styles.codeContainer}>
              <Text style={styles.sessionCode}>{sessionCode}</Text>
            </View>
            
            <Text style={styles.waitingText}>
              Waiting for desktop to connect...
            </Text>
            <ActivityIndicator size="large" color="#007AFF" />
            
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => {
                setSessionState('idle');
                setSessionCode('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderConnectionStatus()}
      {renderSessionContent()}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  codeContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginVertical: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionCode: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  waitingText: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SessionScreen;