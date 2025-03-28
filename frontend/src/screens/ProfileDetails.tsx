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
  ActivityIndicator,
  Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';

interface Profile {
  bio: string;
  avatar_url: string | null;
  theme: string;
  font_size: string;
  language: string;
  department?: string;
}

const windowWidth = Dimensions.get('window').width;

export default function ProfileDetails() {
  const { user, updateProfile } = useAuth();
  const { 
    theme, 
    currentThemeName, 
    availableThemes, 
    changeTheme, 
    isDarkMode 
  } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    bio: '',
    avatar_url: null,
    theme: currentThemeName,
    font_size: 'medium',
    language: 'pt_BR'
  });
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    bio: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/profile');
      
      if (response.data.profile) {
        setProfile({
          bio: response.data.profile.bio || '',
          avatar_url: response.data.profile.avatar_url || null,
          theme: response.data.profile.theme || currentThemeName,
          font_size: response.data.profile.font_size || 'medium',
          language: response.data.profile.language || 'pt_BR',
          department: response.data.profile.department || ''
        });
        
        setForm(prev => ({
          ...prev,
          bio: response.data.profile.bio || '',
          fullName: user?.fullName || '',
          phone: user?.phone || ''
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      Alert.alert(
        'Erro', 
        'Não foi possível carregar seu perfil. Tente novamente mais tarde.'
      );
    } finally {
      setLoading(false);
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
        theme: profile.theme || currentThemeName,
        font_size: profile.font_size || 'medium',
        language: profile.language || 'pt_BR'
      });
      
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', 'Falha ao atualizar perfil. Tente novamente.');
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
          avatar_url: response.data.avatar_url
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
      
      // Usar o context de tema para mudar o tema globalmente
      await changeTheme(themeName);
    } catch (error) {
      console.error('Erro ao alterar tema:', error);
      Alert.alert('Erro', 'Não foi possível alterar o tema');
    }
  };

  if (loading && !profile.theme) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.surface }]}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handlePickImage}
          disabled={imageLoading}
        >
          {imageLoading ? (
            <ActivityIndicator size="small" color="#fff" style={styles.avatarLoading} />
          ) : (
            <>
              {profile.avatar_url ? (
                <Image 
                  source={{ 
                    uri: profile.avatar_url.startsWith('http') 
                      ? profile.avatar_url 
                      : `${api.defaults.baseURL}${profile.avatar_url}` 
                  }} 
                  style={styles.avatar}
                  onError={() => {
                    setProfile(prev => ({ ...prev, avatar_url: null }));
                  }}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                  <Feather name="user" size={40} color="#fff" />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            </>
          )}
        </TouchableOpacity>
        
        <Text style={[styles.username, { color: theme.text }]}>
          {user?.username || 'Usuário'}
        </Text>
        <Text style={[styles.email, { color: isDarkMode ? '#BBB' : '#666' }]}>
          {user?.email || 'email@exemplo.com'}
        </Text>
        <View style={[styles.roleBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.roleText}>{user?.role || 'user'}</Text>
        </View>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="user" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Informações Pessoais
          </Text>
        </View>
        
        <Input
          icon="user"
          label="Nome Completo"
          placeholder="Seu nome completo"
          value={form.fullName}
          onChangeText={(text) => setForm({...form, fullName: text})}
          helperText="Como você gostaria de ser chamado"
        />
        
        <Input
          icon="phone"
          label="Telefone"
          placeholder="Seu número de telefone"
          value={form.phone}
          onChangeText={(text) => setForm({...form, phone: text})}
          keyboardType="phone-pad"
          helperText="Opcional, para contato"
        />
        
        <Input
          icon="file-text"
          label="Biografia"
          placeholder="Conte um pouco sobre você"
          value={form.bio}
          onChangeText={(text) => setForm({...form, bio: text})}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.bioInput}
          helperText="Uma breve descrição sobre você"
        />
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="droplet" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Temas
          </Text>
        </View>
        
        <Text style={[styles.themesDescription, { color: isDarkMode ? '#BBB' : '#666' }]}>
          Escolha um tema para personalizar a aparência do aplicativo
        </Text>
        
        <View style={styles.themeGrid}>
          {availableThemes.map((themeOption) => (
            <TouchableOpacity
              key={themeOption.id}
              style={[
                styles.themeItem,
                { 
                  backgroundColor: themeOption.background_color,
                  borderColor: currentThemeName === themeOption.name 
                    ? themeOption.accent_color 
                    : 'transparent',
                  width: (windowWidth - 60) / 2,
                }
              ]}
              onPress={() => handleChangeTheme(themeOption.name)}
            >
              <View 
                style={[
                  styles.themeColorPreview, 
                  { backgroundColor: themeOption.primary_color }
                ]} 
              />
              <Text 
                style={[
                  styles.themeText, 
                  { color: themeOption.text_color }
                ]}
              >
                {themeOption.name}
              </Text>
              {currentThemeName === themeOption.name && (
                <View style={styles.themeSelectedIndicator}>
                  <Feather 
                    name="check-circle" 
                    size={20} 
                    color={themeOption.primary_color} 
                  />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Preferências
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[
            styles.preferencesButton,
            { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9' }
          ]}
          onPress={() => navigation.navigate('Preferences' as never)}
        >
          <View style={styles.prefButtonContent}>
            <Feather name="sliders" size={20} color={theme.primary} style={styles.prefIcon} />
            <Text style={[styles.preferencesButtonText, { color: theme.text }]}>
              Gerenciar preferências
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      
      <Button 
        title="Salvar Alterações" 
        onPress={handleUpdateProfile} 
        loading={loading}
        icon={<Feather name="save" size={18} color="#FFF" />}
      />
      
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 15,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
    marginBottom: 10,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  roleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    padding: 15,
    marginVertical: 10,
    borderRadius: 12,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  themesDescription: {
    fontSize: 14,
    marginBottom: 15,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  themesContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 10,
  },
  themeItem: {
    padding: 12,
    borderRadius: 12,
    height: 100,
    marginBottom: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  themeColorPreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  themeText: {
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  themeSelectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  themePreview: {
    marginTop: 10,
    marginBottom: 5,
  },
  themePreviewTitle: {
    fontSize: 14,
    marginBottom: 10,
  },
  themePreviewContent: {
    alignItems: 'center',
  },
  preferencesButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  prefButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefIcon: {
    marginRight: 10,
  },
  preferencesButtonText: {
    fontSize: 16,
  },
  footer: {
    height: 40,
  },
});