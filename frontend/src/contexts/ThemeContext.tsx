// src/contexts/ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
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
};

// Temas padrão que sempre estarão disponíveis
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
    primary_color: '#333333',
    secondary_color: '#555555',
    text_color: '#FFFFFF',
    background_color: '#121212',
    accent_color: '#BB86FC',
    is_default: false
  },
  {
    id: 3,
    name: 'blue',
    primary_color: '#3498db',
    secondary_color: '#2980b9',
    text_color: '#333333',
    background_color: '#ecf0f1',
    accent_color: '#e74c3c',
    is_default: false
  },
  {
    id: 4,
    name: 'green',
    primary_color: '#2ecc71',
    secondary_color: '#27ae60',
    text_color: '#333333',
    background_color: '#ecf0f1',
    accent_color: '#e67e22',
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
  const { signed } = useAuth();
  const [theme, setTheme] = useState<ThemeColors>(defaultColors);
  const [currentThemeName, setCurrentThemeName] = useState<string>('default');
  const [availableThemes, setAvailableThemes] = useState<Theme[]>(defaultThemes);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Função para converter um tema do backend em cores para o app
  const themeToColors = (theme: Theme): ThemeColors => {
    const isDark = theme.name === 'dark' || theme.background_color.toLowerCase() === '#121212';
    
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
          changeTheme(storedThemeName);
        }
      } catch (error) {
        console.error('Erro ao carregar tema:', error);
      }
    }

    loadStoredTheme();
  }, []);

  // Quando o usuário faz login, buscar temas disponíveis
  useEffect(() => {
    if (signed) {
      fetchThemes();
    }
  }, [signed]);

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

  // Função para mudar o tema
  const changeTheme = async (themeName: string) => {
    try {
      // Procurar o tema pelo nome
      const selectedTheme = availableThemes.find(t => t.name === themeName);
      
      if (selectedTheme) {
        // Converter tema para cores
        const newColors = themeToColors(selectedTheme);
        setTheme(newColors);
        setCurrentThemeName(themeName);
        setIsDarkMode(themeName === 'dark' || selectedTheme.background_color.toLowerCase() === '#121212');
        
        // Salvar tema localmente
        await AsyncStorage.setItem('@App:theme', themeName);
        
        // Se estiver autenticado, salvar tema no servidor
        if (signed) {
          await api.put('/api/profile', { theme: themeName });
        }
      }
    } catch (error) {
      console.error('Erro ao alterar tema:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      currentThemeName, 
      isDarkMode, 
      availableThemes, 
      changeTheme,
      fetchThemes
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