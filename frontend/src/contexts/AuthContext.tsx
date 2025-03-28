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
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [permissionsRetryCount, setPermissionsRetryCount] = useState(0);

  const isAdmin = !!user && user.role === 'admin';

  // Funções para lidar com erros de rede
  const isNetworkError = (error: any) => {
    return !error.response && error.message === 'Network Error';
  };

  // Melhorada função de carregamento de permissões com retry e tratamento de erros
  const loadPermissions = async (retryCount = 0) => {
    try {
      const response = await api.get('/api/permissions');
      if (response.data && Array.isArray(response.data.permissions)) {
        setPermissions(response.data.permissions);
      } else {
        // Se a resposta não conter permissões em formato esperado
        console.warn('Resposta de permissões em formato inesperado:', response.data);
        setPermissions([]);
      }
      setPermissionsLoaded(true);
    } catch (error: any) {
      console.error('Erro ao carregar permissões:', error);
      
      // Se for um erro de rede e ainda não excedeu o número máximo de tentativas
      if (isNetworkError(error) && retryCount < 3) {
        console.log(`Tentando carregar permissões novamente (${retryCount + 1}/3)...`);
        
        // Aguarde um tempo proporcional ao número de tentativas antes de tentar novamente
        const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff: 1s, 2s, 4s
        
        setTimeout(() => {
          loadPermissions(retryCount + 1);
        }, retryDelay);
      } else {
        // Após tentativas falhas ou outros erros, assume um conjunto vazio de permissões
        setPermissions([]);
        setPermissionsLoaded(true);
      }
    }
  };

  useEffect(() => {
    async function loadStorageData() {
      try {
        const storedUser = await AsyncStorage.getItem('@App:user');
        const storedToken = await AsyncStorage.getItem('@App:token');

        if (storedUser && storedToken) {
          api.defaults.headers.Authorization = `Bearer ${storedToken}`;
          // Converter o usuário armazenado para o formato correto
          const parsedUser = JSON.parse(storedUser);
          setUser(convertUserData(parsedUser));
          
          // Carregar permissões se o usuário estiver autenticado
          loadPermissions();
        } else {
          // Se não há usuário armazenado, definir permissões como um array vazio
          setPermissions([]);
          setPermissionsLoaded(true);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do storage:', error);
        // Garantir que loading seja definido como false mesmo em caso de erro
        setPermissions([]);
        setPermissionsLoaded(true);
      } finally {
        setLoading(false);
      }
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
    // Se o usuário é admin, sempre tem permissão
    if (isAdmin) return true;
    
    // Se as permissões foram carregadas, verificar se a permissão existe
    if (permissionsLoaded) {
      return permissions.includes(permissionCode);
    } 
    
    // Se as permissões ainda não foram carregadas, retornar true por padrão
    // Isso permite que o usuário continue usando o app enquanto as permissões são carregadas
    return true;
  }

  async function signOut() {
    await AsyncStorage.removeItem('@App:user');
    await AsyncStorage.removeItem('@App:token');
    setUser(null);
    setPermissions([]);
    setPermissionsLoaded(false);
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