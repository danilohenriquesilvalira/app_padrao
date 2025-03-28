// src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Animated, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../services/api';

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

export interface Theme {
  id: number;
  name: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  accent_color: string;
  is_default: boolean;
  description?: string;
}

export type ThemeContextData = {
  theme: ThemeColors;
  currentThemeName: string;
  isDarkMode: boolean;
  availableThemes: Theme[];
  changeTheme: (themeName: string, saveToServer?: boolean) => Promise<void>;
  fetchThemes: () => Promise<void>;
  isChangingTheme: boolean;
  fadeAnim: Animated.Value;
  toggleDarkMode: () => Promise<void>;
  useSystemTheme: boolean;
  setUseSystemTheme: (value: boolean) => Promise<void>;
};

// Modern theme palette with better color contrast and aesthetics
const modernThemes: Theme[] = [
  {
    id: 1,
    name: 'blue',
    description: 'Azul Moderno',
    primary_color: '#2563EB', // Vibrant blue
    secondary_color: '#3B82F6',
    text_color: '#1F2937',
    background_color: '#FFFFFF',
    accent_color: '#F59E0B',
    is_default: true
  },
  {
    id: 2,
    name: 'dark',
    description: 'Escuro Elegante',
    primary_color: '#6366F1', // Indigo
    secondary_color: '#8B5CF6', // Purple
    text_color: '#F9FAFB',
    background_color: '#111827',
    accent_color: '#F43F5E', // Rose
    is_default: false
  },
  {
    id: 3,
    name: 'green',
    description: 'Verde Natureza',
    primary_color: '#059669', // Emerald
    secondary_color: '#10B981',
    text_color: '#1F2937',
    background_color: '#F9FAFB',
    accent_color: '#F59E0B', // Amber
    is_default: false
  },
  {
    id: 4,
    name: 'purple',
    description: 'Roxo Elegante',
    primary_color: '#7C3AED', // Violet
    secondary_color: '#8B5CF6',
    text_color: '#1F2937',
    background_color: '#F9FAFB',
    accent_color: '#EC4899', // Pink
    is_default: false
  },
  {
    id: 5,
    name: 'sunset',
    description: 'Pôr do Sol',
    primary_color: '#DB2777', // Pink
    secondary_color: '#EC4899',
    text_color: '#1F2937',
    background_color: '#F9FAFB',
    accent_color: '#F59E0B', // Amber
    is_default: false
  },
  {
    id: 6,
    name: 'midnight',
    description: 'Meia-noite',
    primary_color: '#4F46E5', // Indigo
    secondary_color: '#6366F1',
    text_color: '#F9FAFB',
    background_color: '#0F172A', // Slate
    accent_color: '#14B8A6', // Teal
    is_default: false
  },
  {
    id: 7,
    name: 'autumn',
    description: 'Outono',
    primary_color: '#B45309', // Amber
    secondary_color: '#D97706',
    text_color: '#1F2937',
    background_color: '#F9FAFB',
    accent_color: '#7C3AED', // Violet
    is_default: false
  },
  {
    id: 8,
    name: 'ocean',
    description: 'Oceano',
    primary_color: '#0369A1', // Sky
    secondary_color: '#0284C7',
    text_color: '#F9FAFB',
    background_color: '#082F49', // Deep Ocean
    accent_color: '#06B6D4', // Cyan
    is_default: false
  }
];

// Default light theme
const defaultLightColors: ThemeColors = {
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

// Default dark theme
const defaultDarkColors: ThemeColors = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  secondary: '#8B5CF6',
  secondaryDark: '#7C3AED',
  secondaryLight: '#A78BFA',
  
  text: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textLight: '#D1D5DB',
  background: '#111827',
  
  accent: '#F43F5E',
  card: '#1F2937',
  border: '#374151',
  divider: '#374151',
  
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  surface: '#1F2937',
  surfaceVariant: '#374151',
  disabled: '#6B7280',
  placeholder: '#9CA3AF',
  
  elevation1: '#1F2937',
  elevation2: '#374151',
  elevation3: '#4B5563',
  transparent: 'transparent'
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { signed, user } = useAuth();
  const [theme, setTheme] = useState<ThemeColors>(defaultLightColors);
  const [currentThemeName, setCurrentThemeName] = useState<string>('blue');
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(modernThemes);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isChangingTheme, setIsChangingTheme] = useState<boolean>(false);
  const [useSystemTheme, setUseSystemTheme] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const systemColorScheme = useColorScheme();

  // Function to convert a theme from the backend into a full color palette
  const themeToColors = (theme: Theme, forceDark: boolean = false): ThemeColors => {
    const isDark = forceDark || 
                  theme.name === 'dark' || 
                  theme.name === 'midnight' || 
                  theme.name === 'ocean' ||
                  theme.background_color.toLowerCase() === '#111827' ||
                  theme.background_color.toLowerCase().startsWith('#0');
    
    // Derive a richer color palette from the basic theme colors
    if (isDark) {
      return {
        primary: theme.primary_color,
        primaryDark: adjustColor(theme.primary_color, -15),
        primaryLight: adjustColor(theme.primary_color, 15),
        secondary: theme.secondary_color,
        secondaryDark: adjustColor(theme.secondary_color, -15),
        secondaryLight: adjustColor(theme.secondary_color, 15),
        
        text: '#F9FAFB',
        textSecondary: '#E5E7EB',
        textLight: '#D1D5DB',
        background: theme.background_color,
        
        accent: theme.accent_color,
        card: '#1F2937',
        border: '#374151',
        divider: '#374151',
        
        error: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
        info: '#3B82F6',
        
        surface: '#1F2937',
        surfaceVariant: '#374151',
        disabled: '#6B7280',
        placeholder: '#9CA3AF',
        
        elevation1: '#1F2937',
        elevation2: '#374151',
        elevation3: '#4B5563',
        transparent: 'transparent'
      };
    } else {
      return {
        primary: theme.primary_color,
        primaryDark: adjustColor(theme.primary_color, -15),
        primaryLight: adjustColor(theme.primary_color, 15),
        secondary: theme.secondary_color,
        secondaryDark: adjustColor(theme.secondary_color, -15),
        secondaryLight: adjustColor(theme.secondary_color, 15),
        
        text: theme.text_color,
        textSecondary: '#4B5563',
        textLight: '#9CA3AF',
        background: theme.background_color,
        
        accent: theme.accent_color,
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
    }
  };

  // Function to adjust color brightness (positive value lightens, negative darkens)
  const adjustColor = (hex: string, percent: number): string => {
    // Remove # if present
    hex = hex.replace(/^\s*#|\s*$/g, '');

    // Convert 3 digit hex to 6 digit
    if(hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Adjust values
    const adjustValue = (value: number): number => {
      return Math.max(0, Math.min(255, Math.round(value * (1 + percent / 100))));
    };

    // Convert back to hex
    const rr = adjustValue(r).toString(16).padStart(2, '0');
    const gg = adjustValue(g).toString(16).padStart(2, '0');
    const bb = adjustValue(b).toString(16).padStart(2, '0');

    return `#${rr}${gg}${bb}`;
  };

  // Check for system theme and load stored theme on startup
  useEffect(() => {
    async function loadStoredThemePrefs() {
      try {
        const storedThemeName = await AsyncStorage.getItem('@App:theme');
        const storedUseSystem = await AsyncStorage.getItem('@App:useSystemTheme');
        
        if (storedUseSystem !== null) {
          const useSystem = storedUseSystem === 'true';
          setUseSystemTheme(useSystem);
          
          if (useSystem && systemColorScheme) {
            // Apply system theme preference
            setIsDarkMode(systemColorScheme === 'dark');
            applyThemeColors(storedThemeName || 'blue', systemColorScheme === 'dark');
          } else if (storedThemeName) {
            // Apply stored theme
            applyThemeColors(storedThemeName);
          }
        } else if (storedThemeName) {
          // Legacy: just apply stored theme
          applyThemeColors(storedThemeName);
        }
      } catch (error) {
        console.error('Error loading theme preferences:', error);
      }
    }

    loadStoredThemePrefs();
  }, [systemColorScheme]);

  // When user logs in, fetch themes and try to load user theme
  useEffect(() => {
    if (signed) {
      fetchThemes();
      if (user?.id) {
        loadUserTheme();
      }
    }
  }, [signed, user?.id]);

  // Apply theme colors without animation or saving
  const applyThemeColors = (themeName: string, forceDark: boolean = false) => {
    // Find the theme by name
    const selectedTheme = availableThemes.find(t => t.name === themeName) || 
                          modernThemes.find(t => t.name === themeName);
    
    if (selectedTheme) {
      // Handle the case where description might be undefined
      const themeWithDefaults = {
        ...selectedTheme,
        description: selectedTheme.description || selectedTheme.name // Provide default if undefined
      };
      
      // Convert theme to colors
      const newColors = themeToColors(themeWithDefaults, forceDark);
      setTheme(newColors);
      setCurrentThemeName(themeName);
      
      // Set dark mode based on theme or force parameter
      const isDark = forceDark || 
                     themeName === 'dark' || 
                     themeName === 'midnight' || 
                     themeName === 'ocean' ||
                     selectedTheme.background_color.toLowerCase() === '#111827' ||
                     selectedTheme.background_color.toLowerCase().startsWith('#0');
      
      setIsDarkMode(isDark);
    }
  };

  // Load user theme from backend
  const loadUserTheme = async () => {
    try {
      const response = await api.get('/api/profile');
      if (response.data?.profile?.theme) {
        if (!useSystemTheme) {
          // Only use the user theme if not using system theme
          changeTheme(response.data.profile.theme, false);
        } else {
          // Just store the theme name for reference
          setCurrentThemeName(response.data.profile.theme);
        }
      }
    } catch (error) {
      console.error('Error loading user theme:', error);
    }
  };

  // Function to fetch available themes
  const fetchThemes = async () => {
    try {
      const response = await api.get('/api/themes');
      if (response.data && response.data.themes && response.data.themes.length > 0) {
        // Merge with our modern themes, preserving ours as defaults
        const mergedThemes = [...modernThemes];
        
        // Add server themes that don't exist in our modern themes
        response.data.themes.forEach((serverTheme: Theme) => {
          const exists = mergedThemes.some(t => t.name === serverTheme.name);
          if (!exists) {
            mergedThemes.push(serverTheme);
          }
        });
        
        setAvailableThemes(mergedThemes);
      }
    } catch (error) {
      console.error('Error fetching themes:', error);
    }
  };

  // Function to animate theme changes
  const animateThemeChange = (callback: () => void) => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Execute theme change
      callback();
      
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsChangingTheme(false);
      });
    });
  };

  // Change theme with animation and optional server saving
  const changeTheme = async (themeName: string, saveToServer = true) => {
    try {
      setIsChangingTheme(true);
      
      // Animate the transition
      animateThemeChange(() => {
        applyThemeColors(themeName);
      });
      
      // Save theme locally
      await AsyncStorage.setItem('@App:theme', themeName);
      
      // Set to not use system theme since user explicitly changed theme
      if (saveToServer) {
        setUseSystemTheme(false);
        await AsyncStorage.setItem('@App:useSystemTheme', 'false');
      }
      
      // Save to server if requested and user is signed in
      if (signed && saveToServer) {
        await api.put('/api/profile', { theme: themeName });
      }
    } catch (error) {
      console.error('Error changing theme:', error);
      setIsChangingTheme(false);
    }
  };

  // Toggle between light and dark versions of current theme
  const toggleDarkMode = async () => {
    try {
      setIsChangingTheme(true);
      
      // Animate the transition
      animateThemeChange(() => {
        // Toggle dark mode
        const newIsDark = !isDarkMode;
        setIsDarkMode(newIsDark);
        
        // Apply the current theme with forced dark/light
        const selectedTheme = availableThemes.find(t => t.name === currentThemeName) || 
                              modernThemes.find(t => t.name === currentThemeName);
        
        if (selectedTheme) {
          const newColors = themeToColors(selectedTheme, newIsDark);
          setTheme(newColors);
        }
      });
      
      // Set to not use system theme
      setUseSystemTheme(false);
      await AsyncStorage.setItem('@App:useSystemTheme', 'false');
      
    } catch (error) {
      console.error('Error toggling dark mode:', error);
      setIsChangingTheme(false);
    }
  };

  // Function to toggle system theme usage
  const setSystemThemeUsage = async (value: boolean) => {
    try {
      setUseSystemTheme(value);
      await AsyncStorage.setItem('@App:useSystemTheme', value.toString());
      
      if (value && systemColorScheme) {
        // Apply system preference immediately
        applyThemeColors(currentThemeName, systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error setting system theme usage:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      currentThemeName, 
      isDarkMode, 
      availableThemes, 
      changeTheme,
      fetchThemes,
      isChangingTheme,
      fadeAnim,
      toggleDarkMode,
      useSystemTheme,
      setUseSystemTheme: setSystemThemeUsage
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