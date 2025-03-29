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
  StatusBar,
  Modal,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';

// Obter dimensões da tela para melhor responsividade
const { width, height } = Dimensions.get('window');

interface Profile {
  bio: string;
  avatar_url: string | null;
  font_size: string;
  language: string;
  department?: string;
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    bio: '',
    avatar_url: null,
    font_size: 'medium',
    language: 'pt_BR'
  });
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    bio: ''
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Animações
  const contentAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(1)).current;

  // Efeito para animar a entrada do conteúdo
  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Efeito para animar o ícone de sucesso
  useEffect(() => {
    if (saveSuccess) {
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(() => setSaveSuccess(false));
    }
  }, [saveSuccess]);

  // Quando o usuário muda no contexto, atualiza o estado local
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
      // Atualizar informações básicas do usuário
      await updateProfile({
        full_name: form.fullName,
        phone: form.phone
      });
      
      // Atualizar perfil estendido
      await api.put('/api/profile', {
        bio: form.bio,
        font_size: profile.font_size || 'medium',
        language: profile.language || 'pt_BR'
      });
      
      // Mostrar animação de sucesso em vez de alerta
      setSaveSuccess(true);
      
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', 'Falha ao atualizar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Animar o avatar quando tocar nele
  const handleAvatarPress = () => {
    Animated.sequence([
      Animated.timing(avatarScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(avatarScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(() => {
      setShowAvatarOptions(true);
    });
  };

  const handlePickImage = async () => {
    setShowAvatarOptions(false);
    
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

  const handleTakePhoto = async () => {
    setShowAvatarOptions(false);
    
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar sua câmera');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  // Implementação melhorada para remover avatar
  const handleRemoveAvatar = async () => {
    setShowAvatarOptions(false);
    
    if (!profile.avatar_url) {
      Alert.alert('Informação', 'Você não possui uma foto de perfil para remover.');
      return;
    }
    
    Alert.alert(
      "Remover avatar",
      "Tem certeza que deseja remover sua foto de perfil?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Remover", 
          style: "destructive",
          onPress: async () => {
            try {
              setImageLoading(true);
              
              // Chamada para o endpoint específico de remoção de avatar
              await api.delete('/api/profile/avatar');
              
              // Atualizar o estado local
              setProfile(prev => ({
                ...prev,
                avatar_url: null
              }));
              
              // Mostrar notificação de sucesso
              setSaveSuccess(true);
              
            } catch (error) {
              console.error('Erro ao remover avatar:', error);
              Alert.alert('Erro', 'Não foi possível remover a foto de perfil');
            } finally {
              setImageLoading(false);
            }
          }
        }
      ]
    );
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
        
        // Mostrar animação de sucesso em vez de alerta
        setSaveSuccess(true);
      }
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto de perfil');
    } finally {
      setImageLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Avatar modal options
  const renderAvatarOptions = () => {
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={showAvatarOptions}
        onRequestClose={() => setShowAvatarOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarOptions(false)}
        >
          <BlurView 
            intensity={isDarkMode ? 40 : 20} 
            style={StyleSheet.absoluteFill} 
            tint={isDarkMode ? "dark" : "light"}
          />
          
          <View style={[
            styles.avatarOptionsContainer,
            { backgroundColor: isDarkMode ? theme.surface : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.avatarOptionsTitle,
              { color: theme.text }
            ]}>
              Foto de Perfil
            </Text>
            
            <TouchableOpacity 
              style={[
                styles.avatarOption,
                { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
              ]}
              onPress={handlePickImage}
            >
              <Feather name="image" size={24} color={theme.primary} />
              <Text style={[styles.avatarOptionText, { color: theme.text }]}>
                Escolher da galeria
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.avatarOption,
                { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
              ]}
              onPress={handleTakePhoto}
            >
              <Feather name="camera" size={24} color={theme.primary} />
              <Text style={[styles.avatarOptionText, { color: theme.text }]}>
                Tirar foto
              </Text>
            </TouchableOpacity>
            
            {profile.avatar_url && (
              <TouchableOpacity 
                style={styles.avatarOption}
                onPress={handleRemoveAvatar}
              >
                <Feather name="trash-2" size={24} color={theme.error} />
                <Text style={[styles.avatarOptionText, { color: theme.error }]}>
                  Remover foto
                </Text>
              </TouchableOpacity>
            )}
            
            <Button
              title="Cancelar"
              onPress={() => setShowAvatarOptions(false)}
              variant="outline"
              style={styles.cancelButton}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar
        backgroundColor={isDarkMode ? theme.background : theme.primary}
        barStyle="light-content"
      />
      
      {/* Animação de sucesso flutuante */}
      {saveSuccess && (
        <Animated.View 
          style={[
            styles.successToast,
            {
              backgroundColor: theme.success,
              opacity: successAnim,
              transform: [{ 
                translateY: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <Feather name="check-circle" size={20} color="#fff" />
          <Text style={styles.successToastText}>
            Alterações salvas com sucesso
          </Text>
        </Animated.View>
      )}
      
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
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: avatarScale }] }
          ]}
        >
          <TouchableOpacity
            style={styles.avatarTouchable}
            onPress={handleAvatarPress}
            disabled={imageLoading}
            activeOpacity={0.8}
          >
            {imageLoading ? (
              <View style={[
                styles.avatarLoadingContainer,
                { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }
              ]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
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
                    onError={(e) => {
                      console.log("Erro ao carregar avatar:", profile.avatar_url, e.nativeEvent.error);
                      setProfile(prev => ({ ...prev, avatar_url: null }));
                    }}
                  />
                ) : (
                  <View style={[
                    styles.avatarPlaceholder, 
                    { 
                      backgroundColor: isDarkMode ? 
                        `${theme.primary}80` : 
                        `${theme.primary}30`,
                      borderColor: theme.primary,
                      borderWidth: 2  
                    }
                  ]}>
                    <Text style={[
                      styles.avatarInitials,
                      { color: theme.primary }
                    ]}>
                      {user?.username?.substring(0, 2).toUpperCase() || 'U'}
                    </Text>
                  </View>
                )}
                
                <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
                  <Feather name="edit-2" size={14} color="#fff" />
                </View>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
        
        <Text style={[styles.username, { color: theme.text }]}>
          {user?.username || 'Usuário'}
        </Text>
        <Text style={[
          styles.email, 
          { color: isDarkMode ? theme.textLight : theme.textSecondary }
        ]}>
          {user?.email || 'email@exemplo.com'}
        </Text>
        
        <View style={styles.badgeContainer}>
          <View style={[
            styles.roleBadge, 
            { 
              backgroundColor: isDarkMode ? 
                `${theme.primary}30` : 
                `${theme.primary}15`,
              borderColor: theme.primary,
              borderWidth: 1
            }
          ]}>
            <Text style={[
              styles.roleText, 
              { color: theme.primary }
            ]}>
              {user?.role || 'user'}
            </Text>
          </View>
          
          {user?.isActive && (
            <View style={[
              styles.statusBadge,
              {
                backgroundColor: isDarkMode ? 
                  'rgba(46, 125, 50, 0.2)' : 
                  'rgba(46, 125, 50, 0.1)',
                borderColor: '#2E7D32',
                borderWidth: 1
              }
            ]}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Ativo</Text>
            </View>
          )}
        </View>
      </Animated.View>
      
      {/* Seção de informações pessoais */}
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
          onChangeText={(text) => setForm(prev => ({ ...prev, fullName: text }))}
          helperText="Como você gostaria de ser chamado"
        />
        
        <Input
          icon="phone"
          label="Telefone"
          placeholder="Seu número de telefone"
          value={form.phone}
          onChangeText={(text) => setForm(prev => ({ ...prev, phone: text }))}
          keyboardType="phone-pad"
          helperText="Opcional, para contato"
        />
        
        <Input
          icon="file-text"
          label="Biografia"
          placeholder="Conte um pouco sobre você"
          value={form.bio}
          onChangeText={(text) => setForm(prev => ({ ...prev, bio: text }))}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.bioInput}
          helperText="Uma breve descrição sobre você"
        />
      </Animated.View>
      
      {/* Seção de informações de conta (somente leitura) */}
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
          <Feather name="info" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Informações da Conta
          </Text>
        </View>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabelContainer}>
              <Feather name="at-sign" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <Text style={[
                styles.infoLabel, 
                { color: isDarkMode ? theme.textLight : theme.textSecondary }
              ]}>
                Nome de Usuário
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {user?.username || 'Não definido'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoLabelContainer}>
              <Feather name="mail" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <Text style={[
                styles.infoLabel, 
                { color: isDarkMode ? theme.textLight : theme.textSecondary }
              ]}>
                Email
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {user?.email || 'Não definido'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <View style={styles.infoLabelContainer}>
              <Feather name="shield" size={16} color={theme.textSecondary} style={styles.infoIcon} />
              <Text style={[
                styles.infoLabel, 
                { color: isDarkMode ? theme.textLight : theme.textSecondary }
              ]}>
                Função
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.text }]}>
              {user?.role || 'user'}
            </Text>
          </View>
        </View>
      </Animated.View>
      
      {/* Seção de preferências */}
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
            { 
              backgroundColor: isDarkMode ? 
                theme.surfaceVariant : 
                `${theme.primary}08`
            }
          ]}
          onPress={() => navigation.navigate('Preferences' as never)}
          activeOpacity={0.7}
        >
          <View style={styles.prefButtonContent}>
            <Feather name="sliders" size={20} color={theme.primary} style={styles.prefIcon} />
            <View style={styles.prefTextContainer}>
              <Text style={[
                styles.preferencesButtonText, 
                { color: theme.text }
              ]}>
                Gerenciar preferências
              </Text>
              <Text style={[
                styles.preferencesButtonSubtext,
                { color: isDarkMode ? theme.textLight : theme.textSecondary }
              ]}>
                Tema, idioma, notificações e privacidade
              </Text>
            </View>
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
          elevation={true}
          full={true}
        />
      </Animated.View>
      
      {/* Modal de opções de avatar */}
      {renderAvatarOptions()}
      
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarTouchable: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'relative',
    overflow: 'hidden',
    // Sombra
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    marginBottom: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  roleText: {
    fontWeight: '600',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
    marginRight: 6,
  },
  statusText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  bioInput: {
    height: 120,
    paddingTop: 12,
  },
  infoCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    maxWidth: '50%',
    textAlign: 'right',
  },
  preferencesButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  prefButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefTextContainer: {
    marginLeft: 12,
  },
  prefIcon: {
    marginLeft: 4,
  },
  preferencesButtonText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  preferencesButtonSubtext: {
    fontSize: 12,
  },
  footer: {
    height: 40,
  },
  successToast: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  successToastText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avatarOptionsContainer: {
    width: '90%',
    maxWidth: 350,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  avatarOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  avatarOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  cancelButton: {
    marginTop: 20,
  },
});