import { useAppStore } from '../stores/appStore';
import PhonePreview from './PhonePreview';
import ChatPanel from './ChatPanel';

export default function MainInterface() {
  const { session } = useAppStore();

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
        </div>
        
        <ChatPanel />
      </div>
    </div>
  );
}