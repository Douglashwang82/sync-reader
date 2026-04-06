import 'react-native-gesture-handler';
import { Buffer } from 'buffer';

// Buffer polyfill for React Native
global.Buffer = Buffer;

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainApp from './src/components/MainApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <MainApp />
    </SafeAreaProvider>
  );
}