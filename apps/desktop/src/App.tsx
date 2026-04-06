import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { wsService } from './services/WebSocketService';
import SessionSetup from './components/SessionSetup';
import MainInterface from './components/MainInterface';

function App() {
  const { session, connected, setConnected, setSession, setSessionError, setFrames, addMessage, appendAIToken, clearAIResponse, setIsAIResponding } = useAppStore();

  useEffect(() => {
    // Initialize WebSocket connection
    const socket = wsService.connect();
    
    // Set up event listeners
    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    wsService.onSessionStatus((sessionData) => {
      setSession(sessionData);
      setSessionError(null);
    });

    wsService.onFrameUpdate((frames) => {
      setFrames(frames);
    });

    wsService.onAIToken((token) => {
      appendAIToken(token);
    });

    wsService.onAIDone((message) => {
      addMessage(message);
      clearAIResponse();
      setIsAIResponding(false);
    });

    wsService.onAIError((error) => {
      console.error('AI Error:', error);
      setIsAIResponding(false);
      clearAIResponse();
      // You could add an error message to the chat here
    });

    // Cleanup on unmount
    return () => {
      wsService.removeAllListeners();
      wsService.disconnect();
    };
  }, []);

  if (!connected) {
    return (
      <div className="session-setup">
        <div className="setup-card">
          <h1>Sync Reader</h1>
          <p>Connecting to server...</p>
        </div>
      </div>
    );
  }

  if (!session || session.status === 'unpaired') {
    return <SessionSetup />;
  }

  return <MainInterface />;
}

export default App;