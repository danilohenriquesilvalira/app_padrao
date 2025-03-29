// src/services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // Se houver um avatar_url na resposta, mas for um caminho relativo,
  // garante que estamos usando o caminho correto
  if (response.data && response.data.profile && response.data.profile.avatar_url) {
    // Não modifica URLs que já começam com http
    if (!response.data.profile.avatar_url.startsWith('http')) {
      // Se o avatar_url ainda usar o caminho antigo, atualiza para o novo formato
      if (response.data.profile.avatar_url.startsWith('/avatars/')) {
        response.data.profile.avatar_url = response.data.profile.avatar_url.replace('/avatars/', '/avatar/');
      }
    }
  }
  return response;
});

export default api;