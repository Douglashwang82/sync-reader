import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { wsService } from '../services/WebSocketService';
import { isValidSessionCode } from '@sync-reader/shared';

export default function SessionSetup() {
  const { joinCode, sessionError, setJoinCode, setSessionError } = useAppStore();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinSession = async () => {
    if (!isValidSessionCode(joinCode)) {
      setSessionError('Please enter a valid 6-character code');
      return;
    }

    setIsJoining(true);
    setSessionError(null);

    try {
      wsService.joinSession(joinCode);
      // The response will be handled by the WebSocket listeners in App.tsx
    } catch (error) {
      setSessionError('Failed to join session. Please try again.');
      console.error('Join session error:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isJoining) {
      handleJoinSession();
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 6) {
      setJoinCode(value);
      if (sessionError) {
        setSessionError(null);
      }
    }
  };

  return (
    <div className="session-setup">
      <div className="setup-card">
        <h1>Sync Reader</h1>
        <p>Enter the 6-character code from your mobile device</p>
        
        <input
          type="text"
          className="code-input"
          value={joinCode}
          onChange={handleCodeChange}
          onKeyPress={handleKeyPress}
          placeholder="ABCD12"
          maxLength={6}
          disabled={isJoining}
          autoFocus
        />
        
        <button
          className="join-button"
          onClick={handleJoinSession}
          disabled={isJoining || joinCode.length !== 6}
        >
          {isJoining ? 'Joining...' : 'Join Session'}
        </button>
        
        {sessionError && (
          <div className="error">{sessionError}</div>
        )}
        
        <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
          <p>Instructions:</p>
          <ol style={{ textAlign: 'left', marginTop: '10px' }}>
            <li>Open the Sync Reader mobile app</li>
            <li>Start a new session</li>
            <li>Enter the 6-character code shown on your phone</li>
          </ol>
        </div>
      </div>
    </div>
  );
}