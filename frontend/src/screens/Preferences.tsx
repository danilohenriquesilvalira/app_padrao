// src/screens/Preferences.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  SafeAreaView,
  Animated,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import api from '../services/api';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface PrivacySettings {
  showEmail: boolean;
  showOnlineStatus: boolean;
  allowDataCollection: boolean;
}

export default function Preferences() {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const { theme, isDarkMode } = useTheme(); // Removido toggleTheme que não existe no tipo
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false,
    } as NotificationPreferences,
    language: 'pt_BR',
    originalLanguage: 'pt_BR', // Para rastrear se houve mudança
  });
  
  // Estados para os modais
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [privacySettingsModal, setPrivacySettingsModal] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  
  // Estados para alteração de senha
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Estados para configurações de privacidade
  const [privacySettings, setPrivacySettings] = useState({
    showEmail: true,
    showOnlineStatus: true,
    allowDataCollection: true,
  });

  // Estados para exclusão de conta
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  
  // Animações
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Opções de idioma atualizadas
  const languages = [
    { label: 'Português (Brasil)', value: 'pt_BR' },
    { label: 'Português (Portugal)', value: 'pt_PT' },
    { label: 'English', value: 'en_US' },
    { label: 'Español', value: 'es_ES' },
  ];
  
  // Iniciar animação ao montar o componente
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start();
    
    loadPreferences();
    loadPrivacySettings();
  }, []);
  
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/profile');
      
      if (response.data.profile) {
        const profile = response.data.profile;
        setPreferences({
          notifications: profile.notification_preferences || {
            email: true,
            push: true,
            sms: false,
          },
          language: profile.language || 'pt_BR',
          originalLanguage: profile.language || 'pt_BR', // Para rastrear mudanças
        });
      }
    } catch (error) {
      console.error('Erro ao carregar preferências:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrivacySettings = async () => {
    try {
      // Simular carregamento das configurações de privacidade
      // No futuro, isso seria uma chamada de API real
      setTimeout(() => {
        setPrivacySettings({
          showEmail: true,
          showOnlineStatus: true,
          allowDataCollection: true,
        });
      }, 500);
    } catch (error) {
      console.error('Erro ao carregar configurações de privacidade:', error);
    }
  };
  
  const handleToggleNotification = (type: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }));
  };
  
  const handleLanguageChange = (value: string) => {
    setPreferences(prev => ({
      ...prev,
      language: value
    }));
  };
  
  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      
      await api.put('/api/profile', {
        language: preferences.language,
        notification_preferences: preferences.notifications
      });
      
      // Atualizar o valor original após salvar
      setPreferences(prev => ({
        ...prev,
        originalLanguage: prev.language
      }));
      
      Alert.alert('Sucesso', 'Preferências salvas com sucesso!');
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      Alert.alert('Erro', 'Não foi possível salvar as preferências');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    // Validação dos campos
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Erro', 'A nova senha e a confirmação não conferem');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      setLoading(true);
      
      await api.put('/api/profile/password', {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword
      });
      
      Alert.alert('Sucesso', 'Senha alterada com sucesso');
      setChangePasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', 'Não foi possível alterar a senha. Verifique se a senha atual está correta.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacySettings = async () => {
    try {
      setLoading(true);
      
      // Simular salvamento das configurações de privacidade
      // No futuro, isso seria uma chamada de API real
      setTimeout(() => {
        Alert.alert('Sucesso', 'Configurações de privacidade salvas com sucesso');
        setPrivacySettingsModal(false);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Erro ao salvar configurações de privacidade:', error);
      Alert.alert('Erro', 'Não foi possível salvar as configurações de privacidade');
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmDeleteText !== 'EXCLUIR') {
      Alert.alert('Erro', 'Digite "EXCLUIR" para confirmar');
      return;
    }

    try {
      setLoading(true);
      
      await api.delete('/api/profile');
      
      Alert.alert('Conta excluída', 'Sua conta foi excluída com sucesso', [
        {
          text: 'OK',
          onPress: () => {
            setDeleteAccountModal(false);
            signOut();
          }
        }
      ]);
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      Alert.alert('Erro', 'Não foi possível excluir a conta');
    } finally {
      setLoading(false);
    }
  };

  // Função para renderizar o seletor de idioma
  const renderLanguagePicker = () => {
    return (
      <View style={[
        styles.pickerContainer, 
        { 
          backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9',
          borderColor: isDarkMode ? theme.border : '#e0e0e0',
        }
      ]}>
        <Picker
          selectedValue={preferences.language}
          onValueChange={handleLanguageChange}
          style={[styles.picker, { color: theme.text }]}
          dropdownIconColor={theme.primary}
          mode="dropdown"
        >
          {languages.map(language => (
            <Picker.Item 
              key={language.value} 
              label={language.label} 
              value={language.value} 
              color={isDarkMode ? '#fff' : undefined}
            />
          ))}
        </Picker>
      </View>
    );
  };

  // Verificar se houve mudanças nas preferências
  const hasChanges = () => {
    return (
      JSON.stringify(preferences.notifications) !== JSON.stringify({
        email: true,
        push: true,
        sms: false
      }) ||
      preferences.language !== preferences.originalLanguage
    );
  };
  
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar
        backgroundColor={isDarkMode ? theme.background : theme.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
      />
      
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho */}
        <Animated.View 
          style={[
            styles.headerContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Preferências do Aplicativo
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Personalize sua experiência conforme suas necessidades
          </Text>
        </Animated.View>
        
        {/* Seção de Notificações */}
        <Animated.View 
          style={[
            styles.section, 
            { 
              backgroundColor: theme.surface,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="bell" size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Notificações</Text>
          </View>
          
          <View style={[
            styles.optionRow, 
            { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}>
            <View style={styles.optionInfo}>
              <Feather name="mail" size={20} color={theme.primary} style={styles.optionIcon} />
              <View>
                <Text style={[styles.optionText, { color: theme.text }]}>
                  Receber por email
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Enviar notificações para seu email
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.notifications.email}
              onValueChange={() => handleToggleNotification('email')}
              trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
              thumbColor={preferences.notifications.email ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
            />
          </View>
          
          <View style={[
            styles.optionRow, 
            { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
          ]}>
            <View style={styles.optionInfo}>
              <Feather name="bell" size={20} color={theme.primary} style={styles.optionIcon} />
              <View>
                <Text style={[styles.optionText, { color: theme.text }]}>
                  Notificações push
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Receber alertas no dispositivo
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.notifications.push}
              onValueChange={() => handleToggleNotification('push')}
              trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
              thumbColor={preferences.notifications.push ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
            />
          </View>
          
          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <Feather name="smartphone" size={20} color={theme.primary} style={styles.optionIcon} />
              <View>
                <Text style={[styles.optionText, { color: theme.text }]}>
                  Receber SMS
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Alertas via mensagem de texto
                </Text>
              </View>
            </View>
            <Switch
              value={preferences.notifications.sms}
              onValueChange={() => handleToggleNotification('sms')}
              trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
              thumbColor={preferences.notifications.sms ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
            />
          </View>
        </Animated.View>
        
        {/* Seção de Idioma */}
        <Animated.View 
          style={[
            styles.section, 
            { 
              backgroundColor: theme.surface,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="globe" size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Idioma</Text>
          </View>
          
          <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>
            Selecione o idioma do aplicativo:
          </Text>
          
          {renderLanguagePicker()}
          
          <View style={[
            styles.languageInfo, 
            { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f8ff' }
          ]}>
            <Feather name="info" size={16} color={theme.info} style={{ marginRight: 8 }} />
            <Text style={[styles.languageInfoText, { color: theme.text }]}>
              A alteração do idioma será aplicada após salvar as preferências.
            </Text>
          </View>
        </Animated.View>
        
        {/* Seção de Privacidade */}
        <Animated.View 
          style={[
            styles.section, 
            { 
              backgroundColor: theme.surface,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="shield" size={22} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Privacidade</Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.privacyOption, 
              { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}
            onPress={() => setChangePasswordModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.optionInfo}>
              <Feather name="lock" size={20} color={theme.primary} style={styles.optionIcon} />
              <View>
                <Text style={[styles.optionText, { color: theme.text }]}>
                  Alterar senha
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Atualize sua senha de acesso
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.privacyOption, 
              { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}
            onPress={() => setPrivacySettingsModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.optionInfo}>
              <Feather name="shield" size={20} color={theme.primary} style={styles.optionIcon} />
              <View>
                <Text style={[styles.optionText, { color: theme.text }]}>
                  Configurações de privacidade
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Controle quem vê suas informações
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.privacyOption}
            onPress={() => setDeleteAccountModal(true)}
            activeOpacity={0.7}
          >
            <View style={styles.optionInfo}>
              <Feather name="trash-2" size={20} color={theme.error} style={styles.optionIcon} />
              <View>
                <Text style={{ color: theme.error, fontSize: 16, fontWeight: '500' }}>
                  Excluir conta
                </Text>
                <Text style={[styles.optionSubtext, { color: theme.textSecondary }]}>
                  Remover permanentemente sua conta
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
          </TouchableOpacity>
        </Animated.View>
        
        {/* Botão Salvar Alterações */}
        <View style={styles.buttonContainer}>
          <Button 
            title="Salvar Preferências" 
            onPress={handleSavePreferences} 
            loading={loading}
            icon={<Feather name="save" size={18} color="#FFF" />}
            full={true}
            disabled={!hasChanges()}
          />
        </View>
      </ScrollView>
      
      {/* Modal para alterar senha */}
      <Modal
        visible={changePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setChangePasswordModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.surface,
              borderColor: isDarkMode ? theme.border : '#ddd',
            }
          ]}>
            <View style={styles.modalHeader}>
              <Feather name="lock" size={24} color={theme.primary} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Alterar Senha</Text>
            </View>
            
            <Input
              icon="lock"
              placeholder="Senha atual"
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={(text) => setPasswordForm({...passwordForm, currentPassword: text})}
            />
            
            <Input
              icon="key"
              placeholder="Nova senha"
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={(text) => setPasswordForm({...passwordForm, newPassword: text})}
              helperText="Mínimo de 6 caracteres"
            />
            
            <Input
              icon="check"
              placeholder="Confirmar nova senha"
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={(text) => setPasswordForm({...passwordForm, confirmPassword: text})}
            />
            
            <View style={styles.modalButtons}>
              <Button 
                title="Cancelar" 
                variant="outline"
                onPress={() => {
                  setChangePasswordModal(false);
                  setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                  });
                }} 
              />
              <Button 
                title="Alterar" 
                onPress={handleChangePassword} 
                loading={loading}
                icon={<Feather name="check" size={18} color="#FFF" />}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para configurações de privacidade */}
      <Modal
        visible={privacySettingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPrivacySettingsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.surface,
              borderColor: isDarkMode ? theme.border : '#ddd',
            }
          ]}>
            <View style={styles.modalHeader}>
              <Feather name="shield" size={24} color={theme.primary} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Configurações de Privacidade</Text>
            </View>
            
            <View style={[
              styles.optionRow, 
              { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}>
              <Text style={[styles.optionText, { color: theme.text }]}>
                Exibir meu email para outros usuários
              </Text>
              <Switch
                value={privacySettings.showEmail}
                onValueChange={(value) => setPrivacySettings({...privacySettings, showEmail: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={privacySettings.showEmail ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
            </View>
            
            <View style={[
              styles.optionRow, 
              { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}>
              <Text style={[styles.optionText, { color: theme.text }]}>
                Mostrar status online
              </Text>
              <Switch
                value={privacySettings.showOnlineStatus}
                onValueChange={(value) => setPrivacySettings({...privacySettings, showOnlineStatus: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={privacySettings.showOnlineStatus ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
            </View>
            
            <View style={[
              styles.optionRow, 
              { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }
            ]}>
              <Text style={[styles.optionText, { color: theme.text }]}>
                Permitir coleta de dados para melhorias
              </Text>
              <Switch
                value={privacySettings.allowDataCollection}
                onValueChange={(value) => setPrivacySettings({...privacySettings, allowDataCollection: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={privacySettings.allowDataCollection ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <Button 
                title="Cancelar" 
                variant="outline"
                onPress={() => setPrivacySettingsModal(false)} 
              />
              <Button 
                title="Salvar" 
                onPress={handleSavePrivacySettings} 
                loading={loading}
                icon={<Feather name="check" size={18} color="#FFF" />}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para excluir conta */}
      <Modal
        visible={deleteAccountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDeleteAccountModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: theme.surface,
              borderColor: isDarkMode ? theme.border : '#ddd',
            }
          ]}>
            <View style={styles.modalHeaderDanger}>
              <Feather name="alert-triangle" size={24} color={theme.error} />
              <Text style={[styles.modalTitle, { color: theme.error }]}>Excluir Conta</Text>
            </View>
            
            <Text style={[styles.deleteWarningText, { color: theme.error }]}>
              Atenção: Esta ação é irreversível e excluirá permanentemente sua conta e todos os dados associados.
            </Text>
            
            <Text style={[styles.deleteConfirmText, { color: theme.text }]}>
              Digite "EXCLUIR" para confirmar:
            </Text>
            
            <TextInput
              style={[
                styles.deleteConfirmInput,
                { 
                  borderColor: theme.border,
                  backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
                  color: theme.text
                }
              ]}
              value={confirmDeleteText}
              onChangeText={setConfirmDeleteText}
              placeholder="Digite EXCLUIR"
              placeholderTextColor={theme.placeholder}
              autoCapitalize="characters"
            />
            
            <View style={styles.modalButtons}>
              <Button 
                title="Cancelar" 
                variant="outline"
                onPress={() => {
                  setDeleteAccountModal(false);
                  setConfirmDeleteText('');
                }} 
              />
              <Button 
                title="Excluir Conta" 
                onPress={handleDeleteAccount} 
                loading={loading}
                variant="error"
                icon={<Feather name="trash-2" size={18} color="#FFF" />}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  headerContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  section: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  pickerLabel: {
    marginBottom: 8,
    fontSize: 15,
    paddingLeft: 4,
  },
  pickerContainer: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  picker: {
    height: 50,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  languageInfoText: {
    fontSize: 14,
    flex: 1,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  modalHeaderDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  deleteWarningText: {
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  deleteConfirmText: {
    marginBottom: 10,
    textAlign: 'center',
  },
  deleteConfirmInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: 16,
  },
});