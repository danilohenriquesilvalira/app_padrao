// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import Navigation from './src/navigation';

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Navigation />
      </ThemeProvider>
    </AuthProvider>
  );
}