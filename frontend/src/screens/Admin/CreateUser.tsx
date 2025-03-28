// src/screens/Admin/CreateUser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Text, 
  Switch,
  Animated
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function CreateUser({ navigation }: any) {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    isActive: true,
    fullName: '',
    phone: ''
  });
  
  const [validationErrors, setValidationErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: ''
  });
  
  const [roles, setRoles] = useState([
    { id: 1, name: 'admin', description: 'Administrador' },
    { id: 2, name: 'manager', description: 'Gerente' },
    { id: 3, name: 'user', description: 'Usuário' }
  ]);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
    
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/admin/roles');
      if (response.data.roles) {
        setRoles(response.data.roles);
      }
    } catch (error) {
      console.error('Erro ao carregar funções:', error);
    }
  };

  const validateFields = () => {
    // Reset all validation errors
    setValidationErrors({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: ''
    });
    
    let isValid = true;
    
    // Validate username
    if (!user.username) {
      setValidationErrors(prev => ({...prev, username: 'Nome de usuário é obrigatório'}));
      isValid = false;
    } else if (user.username.length < 3) {
      setValidationErrors(prev => ({...prev, username: 'Nome de usuário deve ter pelo menos 3 caracteres'}));
      isValid = false;
    }
    
    // Validate email
    if (!user.email) {
      setValidationErrors(prev => ({...prev, email: 'Email é obrigatório'}));
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(user.email)) {
      setValidationErrors(prev => ({...prev, email: 'Email inválido'}));
      isValid = false;
    }
    
    // Validate password
    if (!user.password) {
      setValidationErrors(prev => ({...prev, password: 'Senha é obrigatória'}));
      isValid = false;
    } else if (user.password.length < 6) {
      setValidationErrors(prev => ({...prev, password: 'A senha deve ter pelo menos 6 caracteres'}));
      isValid = false;
    }
    
    // Validate password confirmation
    if (!user.confirmPassword) {
      setValidationErrors(prev => ({...prev, confirmPassword: 'Confirmação de senha é obrigatória'}));
      isValid = false;
    } else if (user.password !== user.confirmPassword) {
      setValidationErrors(prev => ({...prev, confirmPassword: 'As senhas não conferem'}));
      isValid = false;
    }
    
    // Optional: Validate phone if provided
    if (user.phone && !/^[0-9()-+\s]*$/.test(user.phone)) {
      setValidationErrors(prev => ({...prev, phone: 'Formato de telefone inválido'}));
      isValid = false;
    }
    
    return isValid;
  };

  const handleCreateUser = async () => {
    // Validate fields before submitting
    if (!validateFields()) {
      return;
    }
    
    try {
      setLoading(true);
      // Remove confirmPassword before sending to API
      const { confirmPassword, ...userData } = user;
      
      await api.post('/api/admin/users', userData);
      
      // Show success message
      Alert.alert('Sucesso', 'Usuário criado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      Alert.alert('Erro', 'Falha ao criar usuário. Verifique se o email ou nome de usuário já existem.');
    } finally {
      setLoading(false);
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return theme.error;
      case 'manager':
        return '#FF9800';
      default:
        return theme.success;
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <Animated.View 
        style={[
          styles.headerCard,
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerIcon}>
          <Feather name="user-plus" size={40} color={theme.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Adicionar Novo Usuário</Text>
        <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#BBB' : '#666' }]}>
          Preencha os campos abaixo para criar um novo usuário.
          Os campos marcados com * são obrigatórios.
        </Text>
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.formCard,
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.sectionHeader}>
          <Feather name="user" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Informações Básicas
          </Text>
        </View>
        
        <Input
          icon="user"
          label="Nome de usuário *"
          value={user.username}
          onChangeText={text => setUser({...user, username: text})}
          error={validationErrors.username}
        />
        
        <Input
          icon="mail"
          label="Email *"
          keyboardType="email-address"
          value={user.email}
          onChangeText={text => setUser({...user, email: text})}
          error={validationErrors.email}
        />
        
        <Input
          icon="lock"
          label="Senha *"
          secureTextEntry
          value={user.password}
          onChangeText={text => setUser({...user, password: text})}
          error={validationErrors.password}
          helperText="Mínimo de 6 caracteres"
        />
        
        <Input
          icon="check"
          label="Confirmar Senha *"
          secureTextEntry
          value={user.confirmPassword}
          onChangeText={text => setUser({...user, confirmPassword: text})}
          error={validationErrors.confirmPassword}
        />
        
        <Input
          icon="user"
          label="Nome completo"
          value={user.fullName}
          onChangeText={text => setUser({...user, fullName: text})}
          error={validationErrors.fullName}
          helperText="Nome que será exibido no perfil"
        />
        
        <Input
          icon="phone"
          label="Telefone"
          keyboardType="phone-pad"
          value={user.phone}
          onChangeText={text => setUser({...user, phone: text})}
          error={validationErrors.phone}
          helperText="Formato: (XX) XXXXX-XXXX"
        />
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.formCard,
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={20} color={theme.primary} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Configurações de Conta
          </Text>
        </View>
        
        <Text style={[styles.fieldLabel, { color: theme.text }]}>Função:</Text>
        <View style={[
          styles.pickerContainer, 
          { 
            backgroundColor: isDarkMode ? theme.surface : '#f9f9f9',
            borderColor: theme.border,
          }
        ]}>
          <Picker
            selectedValue={user.role}
            onValueChange={value => setUser({...user, role: value})}
            style={[styles.picker, { color: theme.text }]}
            dropdownIconColor={theme.text}
          >
            {roles.map(role => (
              <Picker.Item 
                key={role.id} 
                label={role.description} 
                value={role.name}
                color={isDarkMode ? '#fff' : undefined}
              />
            ))}
          </Picker>
        </View>
        
        <View style={styles.roleBadgePreview}>
          <Text style={[styles.previewLabel, { color: isDarkMode ? '#BBB' : '#666' }]}>
            Preview do badge:
          </Text>
          <View style={[
            styles.roleBadge,
            { backgroundColor: getRoleBadgeColor(user.role) }
          ]}>
            <Text style={styles.roleBadgeText}>{user.role}</Text>
          </View>
        </View>
        
        <View style={styles.switchContainer}>
          <View>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Status da conta:</Text>
            <Text style={[styles.switchDescription, { color: isDarkMode ? '#BBB' : '#666' }]}>
              Quando desativada, a conta não poderá fazer login
            </Text>
          </View>
          <Switch
            value={user.isActive}
            onValueChange={value => setUser({...user, isActive: value})}
            trackColor={{ 
              false: isDarkMode ? '#555' : '#d1d1d1', 
              true: `${theme.primary}80` 
            }}
            thumbColor={
              user.isActive 
                ? theme.primary 
                : isDarkMode ? '#888' : '#f4f3f4'
            }
          />
        </View>
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.buttonsContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <Button 
          title="Cancelar" 
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={loading}
          icon={<Feather name="x" size={18} color={theme.primary} style={{ marginRight: 8 }} />}
        />
        
        <Button 
          title="Criar Usuário" 
          onPress={handleCreateUser} 
          loading={loading}
          icon={<Feather name="user-plus" size={18} color="#fff" style={{ marginRight: 8 }} />}
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  roleBadgePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  previewLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    maxWidth: '80%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
});