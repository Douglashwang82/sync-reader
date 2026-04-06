import { useAppStore } from '../stores/appStore';
import { wsService } from '../services/WebSocketService';
import PhonePreview from './PhonePreview';
import ChatPanel from './ChatPanel';

export default function MainInterface() {
  const { session, reset } = useAppStore();

  const handleEndSession = () => {
    wsService.endSession();
    reset();
  };

  return (
    <div className="app-container">
      <div className="phone-preview">
        <PhonePreview />
      </div>

      <div className="chat-panel">
        <div className="chat-header">
          <h2>Sync Reader</h2>
          <div className="session-status">
            Session: {session?.code} • {session?.mobileConnected ? 'Mobile Connected' : 'Waiting for Mobile'}
          </div>
          <button className="end-session-button" onClick={handleEndSession}>
            End Session
          </button>
        </div>

        <ChatPanel />
      </div>
    </div>
  );
}