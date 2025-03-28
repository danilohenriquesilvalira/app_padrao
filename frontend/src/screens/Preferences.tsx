// src/screens/Preferences.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

import api from '../services/api';
import Button from '../components/Button';

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
}

export default function Preferences() {
  const navigation = useNavigation();
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
      
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notificações</Text>
        
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Feather name="mail" size={20} color="#4285F4" style={styles.optionIcon} />
            <Text style={styles.optionText}>Receber por email</Text>
          </View>
          <Switch
            value={preferences.notifications.email}
            onValueChange={() => handleToggleNotification('email')}
            trackColor={{ false: '#d1d1d1', true: '#a1c9fa' }}
            thumbColor={preferences.notifications.email ? '#4285F4' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Feather name="bell" size={20} color="#4285F4" style={styles.optionIcon} />
            <Text style={styles.optionText}>Notificações push</Text>
          </View>
          <Switch
            value={preferences.notifications.push}
            onValueChange={() => handleToggleNotification('push')}
            trackColor={{ false: '#d1d1d1', true: '#a1c9fa' }}
            thumbColor={preferences.notifications.push ? '#4285F4' : '#f4f3f4'}
          />
        </View>
        
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Feather name="smartphone" size={20} color="#4285F4" style={styles.optionIcon} />
            <Text style={styles.optionText}>Receber SMS</Text>
          </View>
          <Switch
            value={preferences.notifications.sms}
            onValueChange={() => handleToggleNotification('sms')}
            trackColor={{ false: '#d1d1d1', true: '#a1c9fa' }}
            thumbColor={preferences.notifications.sms ? '#4285F4' : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tamanho da Fonte</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.fontSize}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, fontSize: value }))}
            style={styles.picker}
          >
            {fontSizes.map(size => (
              <Picker.Item key={size.value} label={size.label} value={size.value} />
            ))}
          </Picker>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Idioma</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={preferences.language}
            onValueChange={(value) => setPreferences(prev => ({ ...prev, language: value }))}
            style={styles.picker}
          >
            {languages.map(lang => (
              <Picker.Item key={lang.value} label={lang.label} value={lang.value} />
            ))}
          </Picker>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacidade</Text>
        
        <TouchableOpacity style={styles.privacyOption}>
          <Feather name="lock" size={20} color="#4285F4" style={styles.optionIcon} />
          <Text style={styles.optionText}>Alterar senha</Text>
          <Feather name="chevron-right" size={20} color="#999" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.privacyOption}>
          <Feather name="shield" size={20} color="#4285F4" style={styles.optionIcon} />
          <Text style={styles.optionText}>Configurações de privacidade</Text>
          <Feather name="chevron-right" size={20} color="#999" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.privacyOption}>
          <Feather name="trash-2" size={20} color="#F44336" style={styles.optionIcon} />
          <Text style={[styles.optionText, { color: '#F44336' }]}>Excluir conta</Text>
          <Feather name="chevron-right" size={20} color="#999" />
        </TouchableOpacity>
      </View>
      
      <Button 
        title="Salvar Preferências" 
        onPress={handleSavePreferences} 
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
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    color: '#333',
  },
  pickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
  },
  picker: {
    height: 50,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'space-between',
  },
  footer: {
    height: 40,
  },
});