import { useAppStore } from '../stores/appStore';

export default function PhonePreview() {
  const { currentFrame } = useAppStore();

  return (
    <div className="phone-frame">
      <div className="phone-screen">
        {currentFrame ? (
          <img
            src={`data:image/jpeg;base64,${currentFrame.id}`} // Note: Real implementation would fetch frame data
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