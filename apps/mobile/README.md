# Sync Reader Mobile App

React Native mobile application for screen capture and session management with desktop AI reading assistant.

## Features

- Create and manage WebSocket sessions with desktop
- Screen capture with periodic frame transmission
- Session pairing via 6-character codes
- Real-time capture status monitoring
- Low-power operation with <5% battery impact

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on device/simulator:
```bash
# iOS
npm run ios

# Android
npm run android
```

## Usage

1. **Create Session**: Tap "Create Session" to generate a pairing code
2. **Pair with Desktop**: Enter the 6-character code on your desktop web app
3. **Auto-Capture**: Once paired, screen capture starts automatically every 3 seconds
4. **Control Capture**: Use pause/resume buttons to control screen capture
5. **End Session**: Tap "End Session" to stop and clean up

## Architecture

```
App.tsx (Entry Point)
├── MainApp (Navigation Logic)
├── SessionScreen (Session Creation & Pairing)
└── CaptureScreen (Screen Capture & Session Management)

Services:
├── MobileWebSocketService (Socket.io Client)
└── ScreenCaptureService (ViewShot Screen Capture)

State Management:
└── mobileStore (Zustand Store)
```

## Dependencies

- **React Native**: 0.74.5
- **Expo**: ~51.0.0
- **socket.io-client**: WebSocket communication
- **zustand**: State management
- **react-native-view-shot**: Screen capture
- **@sync-reader/shared**: Shared TypeScript types

## Environment

- **Server URL**: `ws://localhost:3002` (WebSocket)
- **Capture Interval**: 3 seconds
- **Frame Format**: JPEG with 0.8 quality
- **Max Resolution**: 1080p (for bandwidth optimization)

## Permissions

- **Camera**: For potential future camera capture
- **Microphone**: For potential future audio capture  
- **Storage**: For temporary frame processing

## Performance

- **Battery Impact**: <5% (target)
- **Frame Size**: Typically 50-200KB per frame
- **Bandwidth**: ~17-67KB/s during active capture