// src/screens/Preferences.tsx
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import api from '../services/api';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export default function Preferences() {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState({
    notifications: {
      email: true,
      push: true,
      sms: false,
    } as NotificationPreferences,
    fontSize: 'medium',
    language: 'pt_BR',
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
  
  // Opções de tamanho de fonte
  const fontSizes = [
    { label: 'Pequeno', value: 'small' },
    { label: 'Médio', value: 'medium' },
    { label: 'Grande', value: 'large' },
    { label: 'Extra grande', value: 'xlarge' },
  ];
  
  // Opções de idioma
  const languages = [
    { label: 'Português (Brasil)', value: 'pt_BR' },
    { label: 'English', value: 'en_US' },
    { label: 'Español', value: 'es_ES' },
  ];
  
  useEffect(() => {
    loadPreferences();
    loadPrivacySettings();
  }, []);
  
  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/profile');
      
      if (response.data.profile) {
        setPreferences({
          notifications: response.data.profile.notification_preferences || {
            email: true,
            push: true,
            sms: false,
          },
          fontSize: response.data.profile.font_size || 'medium',
          language: response.data.profile.language || 'pt_BR',
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
  
  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      
      await api.put('/api/profile', {
        font_size: preferences.fontSize,
        language: preferences.language,
        notification_preferences: preferences.notifications
      });
      
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
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="bell" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Notificações</Text>
        </View>
        
        <View style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <View style={styles.optionInfo}>
            <Feather name="mail" size={20} color={theme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: theme.text }]}>Receber por email</Text>
          </View>
          <Switch
            value={preferences.notifications.email}
            onValueChange={() => handleToggleNotification('email')}
            trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
            thumbColor={preferences.notifications.email ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
          />
        </View>
        
        <View style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <View style={styles.optionInfo}>
            <Feather name="bell" size={20} color={theme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: theme.text }]}>Notificações push</Text>
          </View>
          <Switch
            value={preferences.notifications.push}
            onValueChange={() => handleToggleNotification('push')}
            trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
            thumbColor={preferences.notifications.push ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
          />
        </View>
        
        <View style={[styles.optionRow, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}>
          <View style={styles.optionInfo}>
            <Feather name="smartphone" size={20} color={theme.primary} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: theme.text }]}>Receber SMS</Text>
          </View>
          <Switch
            value={preferences.notifications.sms}
            onValueChange={() => handleToggleNotification('sms')}
            trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
            thumbColor={preferences.notifications.sms ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="type" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Tamanho da Fonte</Text>
        </View>
        
        <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9' }]}>
          <Picker
            selectedValue={preferences.fontSize}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, fontSize: value }))}
            style={[styles.picker, { color: theme.text }]}
            dropdownIconColor={theme.text}
          >
            {fontSizes.map(size => (
              <Picker.Item key={size.value} label={size.label} value={size.value} color={isDarkMode ? '#fff' : undefined} />
            ))}
          </Picker>
        </View>

        <View style={[styles.fontPreview, { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9' }]}>
          <Text style={[styles.fontPreviewTitle, { color: theme.text }]}>Prévia do tamanho:</Text>
          <Text style={[
            styles.fontPreviewText,
            { color: theme.text },
            preferences.fontSize === 'small' && { fontSize: 14 },
            preferences.fontSize === 'medium' && { fontSize: 16 },
            preferences.fontSize === 'large' && { fontSize: 18 },
            preferences.fontSize === 'xlarge' && { fontSize: 20 },
          ]}>
            Este é um exemplo de texto com o tamanho selecionado.
          </Text>
        </View>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="globe" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Idioma</Text>
        </View>
        
        <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9' }]}>
          <Picker
            selectedValue={preferences.language}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, language: value }))}
            style={[styles.picker, { color: theme.text }]}
            dropdownIconColor={theme.text}
          >
            {languages.map(lang => (
              <Picker.Item key={lang.value} label={lang.label} value={lang.value} color={isDarkMode ? '#fff' : undefined} />
            ))}
          </Picker>
        </View>
      </View>
      
      <View style={[styles.section, { backgroundColor: theme.surface }]}>
        <View style={styles.sectionHeader}>
          <Feather name="shield" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Privacidade</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.privacyOption, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}
          onPress={() => setChangePasswordModal(true)}
        >
          <Feather name="lock" size={20} color={theme.primary} style={styles.optionIcon} />
          <Text style={[styles.optionText, { color: theme.text }]}>Alterar senha</Text>
          <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.privacyOption, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}
          onPress={() => setPrivacySettingsModal(true)}
        >
          <Feather name="shield" size={20} color={theme.primary} style={styles.optionIcon} />
          <Text style={[styles.optionText, { color: theme.text }]}>Configurações de privacidade</Text>
          <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.privacyOption, { borderBottomColor: isDarkMode ? '#333' : '#f0f0f0' }]}
          onPress={() => setDeleteAccountModal(true)}
        >
          <Feather name="trash-2" size={20} color={theme.error} style={styles.optionIcon} />
          <Text style={{ color: theme.error, fontSize: 16 }}>Excluir conta</Text>
          <Feather name="chevron-right" size={20} color={isDarkMode ? '#888' : '#999'} />
        </TouchableOpacity>
      </View>
      
      <Button 
        title="Salvar Preferências" 
        onPress={handleSavePreferences} 
        loading={loading}
        icon={<Feather name="save" size={18} color="#FFF" />}
      />
      
      <View style={styles.footer} />

      {/* Modal para alterar senha */}
      <Modal
        visible={changePasswordModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
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
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
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
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
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
                icon={<Feather name="trash-2" size={18} color="#FFF" />}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  optionIcon: {
    marginRight: 10,
  },
  optionText: {
    fontSize: 16,
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  fontPreview: {
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  fontPreviewTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14,
  },
  fontPreviewText: {
    letterSpacing: 0.3,
    lineHeight: 22,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  footer: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  },
});