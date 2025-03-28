// src/contexts/ThemeContext.tsx
import React, { createContext, useContext } from 'react';

export interface ThemeColors {
  // Main colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  
  // Text and background
  text: string;
  textSecondary: string;
  textLight: string;
  background: string;
  
  // UI elements
  accent: string;
  card: string;
  border: string;
  divider: string;
  
  // Status colors
  error: string;
  success: string;
  warning: string;
  info: string;
  
  // Component specific
  surface: string;
  surfaceVariant: string;
  disabled: string;
  placeholder: string;
  
  // Additional
  elevation1: string;
  elevation2: string;
  elevation3: string;
  transparent: string;
}

export type ThemeContextData = {
  theme: ThemeColors;
  isDarkMode: boolean;
};

// Tema padrão fixo baseado no tema "blue" original
const defaultColors: ThemeColors = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#60A5FA',
  secondary: '#3B82F6',
  secondaryDark: '#2563EB',
  secondaryLight: '#93C5FD',
  
  text: '#1F2937',
  textSecondary: '#4B5563',
  textLight: '#9CA3AF',
  background: '#FFFFFF',
  
  accent: '#F59E0B',
  card: '#FFFFFF',
  border: '#E5E7EB',
  divider: '#E5E7EB',
  
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  surface: '#F9FAFB',
  surfaceVariant: '#F3F4F6',
  disabled: '#D1D5DB',
  placeholder: '#9CA3AF',
  
  elevation1: '#FFFFFF',
  elevation2: '#F9FAFB',
  elevation3: '#F3F4F6',
  transparent: 'transparent'
};

const ThemeContext = createContext<ThemeContextData>({
  theme: defaultColors,
  isDarkMode: false
});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  // Fornecer o tema fixo sem qualquer lógica de mudança
  const theme = defaultColors;
  const isDarkMode = false;

  return (
    <ThemeContext.Provider value={{ 
      theme,
      isDarkMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}