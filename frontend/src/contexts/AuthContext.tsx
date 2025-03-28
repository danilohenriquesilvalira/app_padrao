// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  fullName: string;
  phone: string;
  isActive: boolean;
};

type AuthContextData = {
  signed: boolean;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  register: (username: string, email: string, password: string) => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Função para converter dados da API (snake_case) para o formato do frontend (camelCase)
function convertUserData(apiUser: any): User {
  return {
    id: apiUser.id,
    username: apiUser.username,
    email: apiUser.email,
    role: apiUser.role,
    fullName: apiUser.full_name || '', // Aqui está a conversão de full_name para fullName
    phone: apiUser.phone || '',
    isActive: apiUser.is_active
  };
}

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const isAdmin = !!user && user.role === 'admin';

  const loadPermissions = async () => {
    try {
      const response = await api.get('/api/permissions');
      if (response.data.permissions) {
        setPermissions(response.data.permissions);
      }
    } catch (error) {
      console.error('Erro ao carregar permissões', error);
    }
  };

  useEffect(() => {
    async function loadStorageData() {
      const storedUser = await AsyncStorage.getItem('@App:user');
      const storedToken = await AsyncStorage.getItem('@App:token');

      if (storedUser && storedToken) {
        api.defaults.headers.Authorization = `Bearer ${storedToken}`;
        // Converter o usuário armazenado para o formato correto
        const parsedUser = JSON.parse(storedUser);
        setUser(convertUserData(parsedUser));
        loadPermissions();
      }
      
      setLoading(false);
    }

    loadStorageData();
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const response = await api.post('/login', { email, password });
      
      // Converter o usuário recebido da API para o formato esperado pelo frontend
      const convertedUser = convertUserData(response.data.user);
      setUser(convertedUser);
      
      // Armazenar os dados originais da API (para não perder informações)
      await AsyncStorage.setItem('@App:user', JSON.stringify(response.data.user));
      await AsyncStorage.setItem('@App:token', response.data.token);
      
      api.defaults.headers.Authorization = `Bearer ${response.data.token}`;
      loadPermissions();
    } catch (error) {
      throw error;
    }
  }

  async function register(username: string, email: string, password: string) {
    try {
      await api.post('/register', { username, email, password });
    } catch (error) {
      throw error;
    }
  }

  async function updateProfile(data: any) {
    try {
      const response = await api.put('/api/profile', data);
      
      // Se há um usuário logado, atualizar o estado
      if (user) {
        // Converter o usuário recebido para o formato correto
        const updatedUser = { ...user, ...convertUserData(response.data.user) };
        setUser(updatedUser);
        
        // Atualizar o armazenamento
        const storedUser = await AsyncStorage.getItem('@App:user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          // Mesclar os dados atualizados com os existentes
          const mergedUser = { ...parsedUser, ...response.data.user };
          await AsyncStorage.setItem('@App:user', JSON.stringify(mergedUser));
        }
      }
    } catch (error) {
      throw error;
    }
  }

  function hasPermission(permissionCode: string) {
    if (isAdmin) return true;
    return permissions.includes(permissionCode);
  }

  async function signOut() {
    await AsyncStorage.removeItem('@App:user');
    await AsyncStorage.removeItem('@App:token');
    setUser(null);
    setPermissions([]);
  }

  return (
    <AuthContext.Provider value={{ 
      signed: !!user, 
      user, 
      loading, 
      isAdmin,
      hasPermission,
      signIn, 
      signOut, 
      register,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}