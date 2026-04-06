import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Alert } from 'react-native';
import { useMobileStore } from '../stores/mobileStore';
import SessionScreen from './SessionScreen';
import CaptureScreen from './CaptureScreen';
import { mobileWsService } from '../services/MobileWebSocketService';

const MainApp: React.FC = () => {
  const { 
    connectionState, 
    sessionState, 
    setConnectionState, 
    setSessionState,
    setSessionCode,
    resetSession
  } = useMobileStore();

  useEffect(() => {
    // Connect to WebSocket server on app start
    connectToServer();

    // Cleanup on unmount
    return () => {
      mobileWsService.disconnect();
    };
  }, []);

  const connectToServer = () => {
    try {
      setConnectionState('connecting');
      
      const socket = mobileWsService.connect();
      
      // Set up event listeners
      socket.on('connect', () => {
        setConnectionState('connected');
      });

      socket.on('disconnect', () => {
        setConnectionState('disconnected');
        setSessionState('idle');
      });

      socket.on('connect_error', () => {
        setConnectionState('error');
        Alert.alert(
          'Connection Error',
          'Failed to connect to server. Please check your network connection and try again.'
        );
      });

      // Session event listeners
      mobileWsService.onSessionPaired(() => {
        setSessionState('paired');
      });

      mobileWsService.onSessionError((error) => {
        Alert.alert('Session Error', error.message);
        resetSession();
      });

    } catch (error) {
      setConnectionState('error');
      console.error('Failed to connect:', error);
      Alert.alert(
        'Connection Error',
        'Failed to initialize connection to server.'
      );
    }
  };

  const handleRetryConnection = () => {
    connectToServer();
  };

  const renderCurrentScreen = () => {
    if (connectionState === 'disconnected' || connectionState === 'error') {
      return (
        <SessionScreen 
          onRetryConnection={handleRetryConnection}
        />
      );
    }

    switch (sessionState) {
      case 'idle':
      case 'creating':
      case 'waiting_for_pair':
        return <SessionScreen />;
      
      case 'paired':
      case 'capturing':
        return <CaptureScreen />;
      
      default:
        return <SessionScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {renderCurrentScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default MainApp;