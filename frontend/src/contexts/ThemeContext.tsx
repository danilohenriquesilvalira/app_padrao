// src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../services/api';

export interface ThemeColors {
  primary: string;
  secondary: string;
  text: string;
  background: string;
  accent: string;
  card: string;
  border: string;
  error: string;
  success: string;
  surface: string;
  surfaceVariant: string;
  disabled: string;
  placeholder: string;
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
}

export type ThemeContextData = {
  theme: ThemeColors;
  currentThemeName: string;
  isDarkMode: boolean;
  availableThemes: Theme[];
  changeTheme: (themeName: string) => Promise<void>;
  fetchThemes: () => Promise<void>;
  isChangingTheme: boolean;
  fadeAnim: Animated.Value;
};

// Temas padrão com descrições
const defaultThemes = [
  {
    id: 1,
    name: 'default',
    primary_color: '#4285F4',
    secondary_color: '#34A853',
    text_color: '#202124',
    background_color: '#FFFFFF',
    accent_color: '#FBBC05',
    is_default: true
  },
  {
    id: 2,
    name: 'dark',
    primary_color: '#BB86FC',
    secondary_color: '#03DAC6',
    text_color: '#FFFFFF',
    background_color: '#121212',
    accent_color: '#CF6679',
    is_default: false
  },
  {
    id: 3,
    name: 'blue',
    primary_color: '#1976D2',
    secondary_color: '#64B5F6',
    text_color: '#212121',
    background_color: '#F5F5F5',
    accent_color: '#FF4081',
    is_default: false
  },
  {
    id: 4,
    name: 'nature',
    primary_color: '#388E3C',
    secondary_color: '#8BC34A',
    text_color: '#212121',
    background_color: '#F1F8E9',
    accent_color: '#FF9800',
    is_default: false
  },
  {
    id: 5,
    name: 'sunset',
    primary_color: '#E64A19',
    secondary_color: '#FF5722',
    text_color: '#212121',
    background_color: '#FBE9E7',
    accent_color: '#FFC107',
    is_default: false
  },
  {
    id: 6,
    name: 'midnight',
    primary_color: '#303F9F',
    secondary_color: '#3F51B5',
    text_color: '#FFFFFF',
    background_color: '#0A1929',
    accent_color: '#00BCD4',
    is_default: false
  }
];

// Tema padrão (caso nenhum tema seja encontrado)
const defaultColors: ThemeColors = {
  primary: '#4285F4',
  secondary: '#34A853',
  text: '#202124',
  background: '#FFFFFF',
  accent: '#FBBC05',
  card: '#FFFFFF',
  border: '#E1E1E1',
  error: '#F44336',
  success: '#4CAF50',
  surface: '#F5F5F5',
  surfaceVariant: '#EEEEEE',
  disabled: '#BDBDBD',
  placeholder: '#9E9E9E'
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const { signed, user } = useAuth();
  const [theme, setTheme] = useState<ThemeColors>(defaultColors);
  const [currentThemeName, setCurrentThemeName] = useState<string>('default');
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(defaultThemes);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isChangingTheme, setIsChangingTheme] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Função para converter um tema do backend em cores para o app
  const themeToColors = (theme: Theme): ThemeColors => {
    const isDark = theme.name === 'dark' || 
                  theme.name === 'midnight' || 
                  theme.background_color.toLowerCase() === '#121212' ||
                  theme.background_color.toLowerCase().startsWith('#0');
    
    return {
      primary: theme.primary_color,
      secondary: theme.secondary_color,
      text: theme.text_color,
      background: theme.background_color,
      accent: theme.accent_color,
      card: isDark ? '#1E1E1E' : '#FFFFFF',
      border: isDark ? '#333333' : '#E1E1E1',
      error: '#F44336',
      success: '#4CAF50',
      surface: isDark ? '#242424' : '#F5F5F5',
      surfaceVariant: isDark ? '#2C2C2C' : '#EEEEEE',
      disabled: isDark ? '#666666' : '#BDBDBD',
      placeholder: isDark ? '#888888' : '#9E9E9E'
    };
  };

  // Carregar tema armazenado localmente
  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const storedThemeName = await AsyncStorage.getItem('@App:theme');
        if (storedThemeName) {
          changeTheme(storedThemeName, false); // false para não salvar novamente no servidor
        }
      } catch (error) {
        console.error('Erro ao carregar tema:', error);
      }
    }

    loadStoredTheme();
  }, []);

  // Quando o usuário faz login, buscar temas disponíveis e tentar carregar o tema do usuário
  useEffect(() => {
    if (signed) {
      fetchThemes();
      if (user?.id) {
        loadUserTheme();
      }
    }
  }, [signed, user?.id]);

  // Carregar tema do usuário do backend
  const loadUserTheme = async () => {
    try {
      const response = await api.get('/api/profile');
      if (response.data?.profile?.theme) {
        // Usar o tema do perfil do usuário
        changeTheme(response.data.profile.theme, false);
      }
    } catch (error) {
      console.error('Erro ao carregar tema do usuário:', error);
    }
  };

  // Função para buscar temas disponíveis
  const fetchThemes = async () => {
    try {
      const response = await api.get('/api/themes');
      if (response.data && response.data.themes && response.data.themes.length > 0) {
        setAvailableThemes(response.data.themes);
      }
    } catch (error) {
      console.error('Erro ao carregar temas:', error);
      // Manter os temas padrão em caso de erro
    }
  };

  // Função para animar a transição de temas
  const animateThemeChange = (callback: () => void) => {
    // Fade out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Executar a mudança de tema
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

  // Função para mudar o tema com animação e salvamento no servidor se necessário
  const changeTheme = async (themeName: string, saveToServer = true) => {
    try {
      setIsChangingTheme(true);
      
      // Animar a transição
      animateThemeChange(() => {
        // Procurar o tema pelo nome
        const selectedTheme = availableThemes.find(t => t.name === themeName) || defaultThemes.find(t => t.name === themeName);
        
        if (selectedTheme) {
          // Converter tema para cores
          const newColors = themeToColors(selectedTheme);
          setTheme(newColors);
          setCurrentThemeName(themeName);
          setIsDarkMode(
            themeName === 'dark' || 
            themeName === 'midnight' || 
            selectedTheme.background_color.toLowerCase() === '#121212' ||
            selectedTheme.background_color.toLowerCase().startsWith('#0')
          );
        }
      });
      
      // Salvar tema localmente
      await AsyncStorage.setItem('@App:theme', themeName);
      
      // Se estiver autenticado e for solicitado, salvar tema no servidor
      if (signed && saveToServer) {
        await api.put('/api/profile', { theme: themeName });
      }
    } catch (error) {
      console.error('Erro ao alterar tema:', error);
      setIsChangingTheme(false);
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
      fadeAnim
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