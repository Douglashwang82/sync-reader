import { useAppStore } from '../stores/appStore';
import { wsService } from '../services/WebSocketService';

export default function PhonePreview() {
  const { currentFrame } = useAppStore();

  return (
    <div className="phone-frame">
      <div className="phone-screen">
        {currentFrame ? (
          <img
            src={wsService.getFrameUrl(currentFrame.id)}
            alt="Phone screen capture"
            className="frame-image"
            onError={(e) => {
              // Handle image loading error
              console.error('Failed to load frame:', e);
            }}
          />
        ) : (
          <div className="no-frame">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📱</div>
              <div>Waiting for screen capture...</div>
              <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.7 }}>
                Make sure screen capture is enabled on your mobile device
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}