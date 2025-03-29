// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interface para tipar corretamente o usuário
interface UserWithAvatar {
  avatar_url?: string;
  [key: string]: any; // Para outras propriedades que o usuário possa ter
}

const api = axios.create({
  baseURL: 'http://100.77.52.45:8080'  // IP do notebook
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@App:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Adicionar um interceptor de resposta para tratar URLs de avatar
api.interceptors.response.use(response => {
  // Se for uma resposta da API de perfil
  if (response.data && response.data.profile) {
    // Tratar o avatar_url no objeto profile
    if (response.data.profile.avatar_url) {
      // Não modifica URLs que já começam com http
      if (!response.data.profile.avatar_url.startsWith('http')) {
        // Para garantir que estamos usando o novo caminho
        if (response.data.profile.avatar_url.startsWith('/avatars/')) {
          // Converter caminhos antigos para o novo formato
          response.data.profile.avatar_url = response.data.profile.avatar_url.replace('/avatars/', '/avatar/');
        }
      }
    }
  }
  
  // Se for uma resposta com um usuário individual
  if (response.data && response.data.user && response.data.user.avatar_url) {
    // Aplicar a mesma lógica ao avatar_url do usuário
    if (!response.data.user.avatar_url.startsWith('http') && 
        response.data.user.avatar_url.startsWith('/avatars/')) {
      response.data.user.avatar_url = response.data.user.avatar_url.replace('/avatars/', '/avatar/');
    }
  }
  
  // Se for uma lista de usuários
  if (response.data && Array.isArray(response.data.users)) {
    // Percorrer todos os usuários e ajustar o avatar_url
    response.data.users.forEach((user: UserWithAvatar) => {
      if (user.avatar_url && !user.avatar_url.startsWith('http') && 
          user.avatar_url.startsWith('/avatars/')) {
        user.avatar_url = user.avatar_url.replace('/avatars/', '/avatar/');
      }
    });
  }
  
  return response;
});

export default api;