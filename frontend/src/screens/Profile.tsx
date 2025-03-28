// src/screens/Profile.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
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

export default function Profile() {
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

  // Animação para entrada dos elementos
  const contentAnim = useRef(new Animated.Value(0)).current;

  // Efeito para animar a entrada do conteúdo
  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Quando o usuário muda no contexto, atualiza o estado local para refletir as novas informações
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        fullName: user.fullName || '',
        phone: user.phone || ''
      }));
    }
  }, [user]);

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
        // Atualiza também o campo bio do form
        setForm(prev => ({
          ...prev,
          bio: response.data.profile.bio || ''
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
      // Atualizar informações básicas do usuário: envia o campo "full_name" (snake_case) para o backend
      await updateProfile({
        full_name: form.fullName,
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
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      // @ts-ignore
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
      <StatusBar
        backgroundColor={isDarkMode ? theme.background : theme.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
      />
      
      {/* Header com animação */}
      <Animated.View style={[
        styles.header, 
        { 
          backgroundColor: theme.surface,
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 0]
          })}]
        }
      ]}>
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
      </Animated.View>
      
      {/* Seção de informações resumidas com animação */}
      <Animated.View style={[
        styles.infoSection, 
        { 
          backgroundColor: theme.surface,
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [20, 0]
          })}]
        }
      ]}>
        <View style={styles.sectionHeader}>
          <Feather name="info" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Resumo do Perfil
          </Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.infoLabel, { color: isDarkMode ? '#BBB' : '#666' }]}>Nome de Usuário:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user?.username || 'Não definido'}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.infoLabel, { color: isDarkMode ? '#BBB' : '#666' }]}>Email:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user?.email || 'Não definido'}</Text>
        </View>
        
        <View style={[styles.infoItem, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <Text style={[styles.infoLabel, { color: isDarkMode ? '#BBB' : '#666' }]}>Nome Completo:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user?.fullName || 'Não definido'}</Text>
        </View>
        
        <View style={styles.infoItem}>
          <Text style={[styles.infoLabel, { color: isDarkMode ? '#BBB' : '#666' }]}>Função:</Text>
          <Text style={[styles.infoValue, { color: theme.text }]}>{user?.role || 'user'}</Text>
        </View>
      </Animated.View>
      
      {/* Seção de informações pessoais com animação */}
      <Animated.View style={[
        styles.section, 
        { 
          backgroundColor: theme.surface,
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [40, 0]
          })}]
        }
      ]}>
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
          onChangeText={(text) => setForm({ ...form, fullName: text })}
          helperText="Como você gostaria de ser chamado"
        />
        <Input
          icon="phone"
          label="Telefone"
          placeholder="Seu número de telefone"
          value={form.phone}
          onChangeText={(text) => setForm({ ...form, phone: text })}
          keyboardType="phone-pad"
          helperText="Opcional, para contato"
        />
        <Input
          icon="file-text"
          label="Biografia"
          placeholder="Conte um pouco sobre você"
          value={form.bio}
          onChangeText={(text) => setForm({ ...form, bio: text })}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.bioInput}
          helperText="Uma breve descrição sobre você"
        />
      </Animated.View>

      {/* Seção de temas com animação */}
      <Animated.View style={[
        styles.section, 
        { 
          backgroundColor: theme.surface,
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [60, 0]
          })}]
        }
      ]}>
        <View style={styles.sectionHeader}>
          <Feather name="droplet" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Temas
          </Text>
        </View>
        <Text style={[styles.themesDescription, { color: isDarkMode ? '#BBB' : '#666' }]}>
          Escolha um tema para personalizar a aparência do aplicativo
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themeScroll}
        >
          {availableThemes.map((themeOption) => (
            <TouchableOpacity
              key={`theme-${themeOption.id}`} // Usando uma chave única com prefixo
              style={[
                styles.themeCard,
                {
                  backgroundColor: themeOption.background_color,
                  borderColor:
                    currentThemeName === themeOption.name ? themeOption.accent_color : 'transparent',
                }
              ]}
              onPress={() => handleChangeTheme(themeOption.name)}
            >
              <View style={styles.themePreviewContainer}>
                {/* Cabeçalho simulado */}
                <View style={[styles.previewHeader, { backgroundColor: themeOption.primary_color }]}>
                  <View style={styles.previewStatusBar} />
                </View>
                
                {/* Conteúdo simulado */}
                <View style={styles.previewContent}>
                  <View style={[styles.previewCard, { 
                    backgroundColor: themeOption.name === 'dark' ? '#1E1E1E' : '#FFFFFF',
                    shadowColor: themeOption.text_color
                  }]}>
                    <View style={styles.previewCardContent}>
                      <View style={[styles.previewText, { backgroundColor: themeOption.secondary_color }]} />
                      <View style={[styles.previewText, { width: '70%', backgroundColor: themeOption.secondary_color }]} />
                    </View>
                  </View>
                  
                  <View style={[styles.previewButton, { backgroundColor: themeOption.primary_color }]} />
                </View>
              </View>
              
              <View style={[
                styles.themeInfoContainer, 
                { backgroundColor: themeOption.name === 'dark' || themeOption.name === 'midnight' || themeOption.name === 'ocean' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)' }
              ]}>
                <Text style={[
                  styles.themeName, 
                  { 
                    color: themeOption.name === 'dark' || themeOption.name === 'midnight' || themeOption.name === 'ocean' ? '#fff' : themeOption.text_color 
                  }
                ]}>
                  {themeOption.description || themeOption.name.charAt(0).toUpperCase() + themeOption.name.slice(1)}
                </Text>
                
                {currentThemeName === themeOption.name && (
                  <View style={[styles.selectedBadge, { backgroundColor: themeOption.accent_color }]}>
                    <Feather name="check" size={16} color="#FFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.hintContainer}>
          <Feather name="info" size={14} color={theme.primary} style={styles.hintIcon} />
          <Text style={[styles.hintText, { color: isDarkMode ? '#BBB' : '#666' }]}>
            Deslize para ver mais temas
          </Text>
        </View>
      </Animated.View>
      
      {/* Seção de preferências com animação */}
      <Animated.View style={[
        styles.section, 
        { 
          backgroundColor: theme.surface,
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [80, 0]
          })}]
        }
      ]}>
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
      </Animated.View>
      
      {/* Botão salvar com animação */}
      <Animated.View style={{
        opacity: contentAnim,
        transform: [{ translateY: contentAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [100, 0]
        })}]
      }}>
        <Button
          title="Salvar Alterações"
          onPress={handleUpdateProfile}
          loading={loading}
          icon={<Feather name="save" size={18} color="#FFF" />}
        />
      </Animated.View>
      
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
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
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
  // Estilos para seção de informações
  infoSection: {
    padding: 15,
    marginVertical: 10,
    borderRadius: 16,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: 'normal',
    maxWidth: '60%',
    textAlign: 'right',
  },
  section: {
    padding: 15,
    marginVertical: 10,
    borderRadius: 16,
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
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  themesDescription: {
    fontSize: 14,
    marginBottom: 15,
  },
  // Novos estilos para o carrossel de temas
  themeScroll: {
    paddingHorizontal: 5,
    paddingBottom: 10,
  },
  themeCard: {
    width: 160,
    height: 200,
    marginRight: 15,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  themePreviewContainer: {
    flex: 1,
    overflow: 'hidden',
    padding: 10,
  },
  previewHeader: {
    height: 40,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  previewStatusBar: {
    height: 4,
    width: '70%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewCard: {
    height: 60,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  previewCardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: '100%',
  },
  previewText: {
    height: 6,
    width: '90%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
  },
  previewButton: {
    height: 24,
    width: '50%',
    borderRadius: 12,
    alignSelf: 'center',
  },
  themeInfoContainer: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  themeName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  hintIcon: {
    marginRight: 6,
  },
  hintText: {
    fontSize: 12,
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