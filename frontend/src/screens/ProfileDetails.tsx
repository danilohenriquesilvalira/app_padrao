// src/screens/ProfileDetails.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';

interface Theme {
  id: number;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  accentColor: string;
  isDefault: boolean;
}

interface Profile {
  bio: string;
  avatarUrl: string | null;
  theme: string;
  fontSize: string;
  language: string;
  department?: string;
}

export default function ProfileDetails() {
  const { user, updateProfile } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    bio: '',
    avatarUrl: null,
    theme: 'default',
    fontSize: 'medium',
    language: 'pt_BR'
  });
  const [themes, setThemes] = useState<Theme[]>([]);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    bio: ''
  });

  useEffect(() => {
    loadProfile();
    loadThemes();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/profile');
      
      if (response.data.profile) {
        setProfile(response.data.profile);
        setForm(prev => ({
          ...prev,
          bio: response.data.profile.bio || ''
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThemes = async () => {
    try {
      const response = await api.get('/api/themes');
      if (response.data.themes) {
        setThemes(response.data.themes);
      }
    } catch (error) {
      console.error('Erro ao carregar temas:', error);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      
      // Atualizar informações básicas do usuário
      await updateProfile({
        fullName: form.fullName,
        phone: form.phone
      });
      
      // Atualizar perfil estendido
      await api.put('/api/profile', {
        bio: form.bio,
        theme: profile.theme,
        fontSize: profile.fontSize,
        language: profile.language
      });
      
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setImageLoading(true);
    
    try {
      // Criar form data para upload
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      // @ts-ignore - Necessário para formData com React Native
      formData.append('avatar', {
        uri,
        name: filename,
        type
      });
      
      const response = await api.post('/api/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.avatar_url) {
        setProfile(prev => ({
          ...prev,
          avatarUrl: response.data.avatar_url
        }));
        
        Alert.alert('Sucesso', 'Foto de perfil atualizada');
      }
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto de perfil');
    } finally {
      setImageLoading(false);
    }
  };

  const handleChangeTheme = async (themeName: string) => {
    try {
      setProfile(prev => ({
        ...prev,
        theme: themeName
      }));
      
      await AsyncStorage.setItem('@App:theme', themeName);
      
      // Atualiza no servidor
      await api.put('/api/profile', {
        theme: themeName
      });
    } catch (error) {
      console.error('Erro ao alterar tema:', error);
    }
  };

  if (loading && !profile.theme) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handlePickImage}
          disabled={imageLoading}
        >
          {imageLoading ? (
            <ActivityIndicator size="small" color="#fff" style={styles.avatarLoading} />
          ) : (
            <>
              {profile.avatarUrl ? (
                <Image 
                  source={{ uri: `${api.defaults.baseURL}${profile.avatarUrl}` }} 
                  style={styles.avatar} 
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Feather name="user" size={40} color="#fff" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            </>
          )}
        </TouchableOpacity>
        
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações Pessoais</Text>
        
        <Input
          placeholder="Nome Completo"
          value={form.fullName}
          onChangeText={(text) => setForm({...form, fullName: text})}
        />
        
        <Input
          placeholder="Telefone"
          value={form.phone}
          onChangeText={(text) => setForm({...form, phone: text})}
          keyboardType="phone-pad"
        />
        
        <Input
          placeholder="Bio"
          value={form.bio}
          onChangeText={(text) => setForm({...form, bio: text})}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.bioInput}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Temas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themesContainer}>
          {themes.map((theme) => (
            <TouchableOpacity
              key={theme.id}
              style={[
                styles.themeItem,
                { backgroundColor: theme.primaryColor },
                profile.theme === theme.name && styles.selectedTheme
              ]}
              onPress={() => handleChangeTheme(theme.name)}
            >
              <Text style={styles.themeText}>{theme.name}</Text>
              {profile.theme === theme.name && (
                <Feather name="check" size={16} color="#fff" style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferências</Text>
        <TouchableOpacity 
          style={styles.preferencesButton}
          onPress={() => navigation.navigate('Preferences' as never)}
        >
          <Text style={styles.preferencesButtonText}>Gerenciar preferências</Text>
          <Feather name="chevron-right" size={20} color="#4285F4" />
        </TouchableOpacity>
      </View>
      
      <Button 
        title="Salvar Alterações" 
        onPress={handleUpdateProfile} 
        loading={loading}
      />
      
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4285F4',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  roleBadge: {
    backgroundColor: '#4285F4',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    marginVertical: 10,
    borderRadius: 8,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  themesContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  themeItem: {
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedTheme: {
    borderWidth: 2,
    borderColor: '#000',
  },
  themeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  checkIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  preferencesButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  preferencesButtonText: {
    fontSize: 16,
    color: '#333',
  },
  footer: {
    height: 40,
  },
});