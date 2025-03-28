// src/screens/Admin/CreateUser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Text, 
  Switch,
  Animated,
  StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function CreateUser({ navigation }: any) {
  const { theme } = useTheme();
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

  // Get role badge color - cores mais vibrantes
  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return '#D32F2F'; // Vermelho mais vivo
      case 'manager':
        return '#FF9800'; // Laranja mais vibrante
      case 'editor':
        return '#5C6BC0'; // Índigo vibrante
      default:
        return '#2E7D32'; // Verde mais vibrante
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <StatusBar 
        backgroundColor="#2563EB"
        barStyle="light-content" 
      />
      
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Feather name="user-plus" size={40} color="#2563EB" />
        </View>
        <Text style={styles.headerTitle}>Adicionar Novo Usuário</Text>
        <Text style={styles.headerSubtitle}>
          Preencha os campos abaixo para criar um novo usuário.
          Os campos marcados com * são obrigatórios.
        </Text>
      </View>
      
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather name="user" size={20} color="#2563EB" />
          <Text style={styles.sectionTitle}>
            Informações Básicas
          </Text>
        </View>
        
        <Input
          icon="user"
          label="Nome de usuário *"
          value={user.username}
          onChangeText={text => setUser({...user, username: text})}
          error={validationErrors.username}
          required
        />
        
        <Input
          icon="mail"
          label="Email *"
          keyboardType="email-address"
          value={user.email}
          onChangeText={text => setUser({...user, email: text})}
          error={validationErrors.email}
          required
        />
        
        <Input
          icon="lock"
          label="Senha *"
          secureTextEntry
          value={user.password}
          onChangeText={text => setUser({...user, password: text})}
          error={validationErrors.password}
          helperText="Mínimo de 6 caracteres"
          required
        />
        
        <Input
          icon="check"
          label="Confirmar Senha *"
          secureTextEntry
          value={user.confirmPassword}
          onChangeText={text => setUser({...user, confirmPassword: text})}
          error={validationErrors.confirmPassword}
          required
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
      </View>
      
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather name="settings" size={20} color="#2563EB" />
          <Text style={styles.sectionTitle}>
            Configurações de Conta
          </Text>
        </View>
        
        <Text style={styles.fieldLabel}>Função:</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={user.role}
            onValueChange={value => setUser({...user, role: value})}
            style={styles.picker}
            dropdownIconColor={'#000000'}
          >
            {roles.map(role => (
              <Picker.Item 
                key={role.id} 
                label={role.description} 
                value={role.name}
                color={'#000000'}
              />
            ))}
          </Picker>
        </View>
        
        <View style={styles.roleBadgePreview}>
          <Text style={styles.previewLabel}>
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
            <Text style={styles.switchLabel}>Status da conta:</Text>
            <Text style={styles.switchDescription}>
              Quando desativada, a conta não poderá fazer login
            </Text>
          </View>
          <Switch
            value={user.isActive}
            onValueChange={value => setUser({...user, isActive: value})}
            trackColor={{ 
              false: '#d1d1d1', 
              true: 'rgba(46, 125, 50, 0.5)' 
            }}
            thumbColor={
              user.isActive 
                ? '#2E7D32'
                : '#f4f3f4'
            }
          />
        </View>
      </View>
      
      <View style={styles.buttonsContainer}>
        <Button 
          title="Cancelar" 
          variant="outline"
          onPress={() => navigation.goBack()}
          disabled={loading}
          icon={<Feather name="x" size={18} color="#2563EB" style={{ marginRight: 8 }} />}
        />
        
        <Button 
          title="Criar Usuário" 
          onPress={handleCreateUser} 
          loading={loading}
          icon={<Feather name="user-plus" size={18} color="#fff" style={{ marginRight: 8 }} />}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
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
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#AAAAAA',
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    color: '#333333',
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
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#AAAAAA',
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
    color: '#000000',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    color: '#000000',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
    borderColor: '#AAAAAA',
  },
  picker: {
    height: 50,
    color: '#000000',
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
    color: '#333333',
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
    borderWidth: 1,
    backgroundColor: '#F5F5F5',
    borderColor: '#AAAAAA',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#000000',
  },
  switchDescription: {
    fontSize: 12,
    maxWidth: '80%',
    color: '#333333',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
});