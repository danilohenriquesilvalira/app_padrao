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
  StatusBar,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const { width } = Dimensions.get('window');

export default function CreateUser({ navigation }: any) {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formStep, setFormStep] = useState(1); // Track form steps
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
  const slideFormAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
    
    loadRoles();
  }, []);

  // Animation for form step transitions
  useEffect(() => {
    Animated.sequence([
      Animated.timing(slideFormAnim, {
        toValue: -width,
        duration: 0,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideFormAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [formStep]);

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

  const validateBasicInfo = () => {
    let isValid = true;
    const errors = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      phone: ''
    };
    
    // Validate username
    if (!user.username) {
      errors.username = 'Nome de usuário é obrigatório';
      isValid = false;
    } else if (user.username.length < 3) {
      errors.username = 'Nome de usuário deve ter pelo menos 3 caracteres';
      isValid = false;
    }
    
    // Validate email
    if (!user.email) {
      errors.email = 'Email é obrigatório';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(user.email)) {
      errors.email = 'Email inválido';
      isValid = false;
    }
    
    // Validate password
    if (!user.password) {
      errors.password = 'Senha é obrigatória';
      isValid = false;
    } else if (user.password.length < 6) {
      errors.password = 'A senha deve ter pelo menos 6 caracteres';
      isValid = false;
    }
    
    // Validate password confirmation
    if (!user.confirmPassword) {
      errors.confirmPassword = 'Confirmação de senha é obrigatória';
      isValid = false;
    } else if (user.password !== user.confirmPassword) {
      errors.confirmPassword = 'As senhas não conferem';
      isValid = false;
    }
    
    setValidationErrors(errors);
    return isValid;
  };

  const validateAdditionalInfo = () => {
    let isValid = true;
    const errors = {...validationErrors};
    
    // Optional: Validate phone if provided
    if (user.phone && !/^[0-9()-+\s]*$/.test(user.phone)) {
      errors.phone = 'Formato de telefone inválido';
      isValid = false;
    } else {
      errors.phone = '';
    }
    
    setValidationErrors(errors);
    return isValid;
  };

  const handleNextStep = () => {
    if (formStep === 1 && validateBasicInfo()) {
      setFormStep(2);
    } else if (formStep === 2 && validateAdditionalInfo()) {
      handleCreateUser();
    }
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      
      // Converte os dados de camelCase para snake_case para o backend
      const userData = {
        username: user.username,
        email: user.email,
        password: user.password,
        role: user.role,
        is_active: user.isActive,
        full_name: user.fullName,
        phone: user.phone
      };
      
      // Remove a confirmação de senha antes de enviar para a API
      // (isso já é feito ao usar o objeto userData)
      
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
        return '#D32F2F';
      case 'manager':
        return '#FF9800';
      case 'editor':
        return '#5C6BC0';
      default:
        return '#2E7D32';
    }
  };

  // Calculate password strength
  const getPasswordStrength = () => {
    if (!user.password) return 0;
    
    let strength = 0;
    // Length check
    if (user.password.length >= 8) strength += 25;
    else if (user.password.length >= 6) strength += 15;
    
    // Contains number
    if (/\d/.test(user.password)) strength += 25;
    
    // Contains uppercase
    if (/[A-Z]/.test(user.password)) strength += 25;
    
    // Contains special character
    if (/[^A-Za-z0-9]/.test(user.password)) strength += 25;
    
    return Math.min(100, strength);
  };

  const getPasswordStrengthLabel = () => {
    const strength = getPasswordStrength();
    if (strength >= 80) return { label: 'Forte', color: '#2E7D32' };
    if (strength >= 50) return { label: 'Média', color: '#FF9800' };
    return { label: 'Fraca', color: '#D32F2F' };
  };

  // Password strength indicator
  const PasswordStrengthIndicator = () => {
    const strength = getPasswordStrength();
    const strengthInfo = getPasswordStrengthLabel();
    
    return (
      <View style={styles.passwordStrengthContainer}>
        <View style={styles.strengthBarContainer}>
          <View 
            style={[
              styles.strengthBar, 
              { 
                width: `${strength}%`,
                backgroundColor: strengthInfo.color 
              }
            ]} 
          />
        </View>
        <Text style={[styles.strengthLabel, { color: strengthInfo.color }]}>
          {strengthInfo.label}
        </Text>
      </View>
    );
  };

  // Step indicators
  const StepIndicator = () => {
    return (
      <View style={styles.stepIndicatorContainer}>
        <View style={styles.stepLine} />
        <View style={styles.stepsContainer}>
          <View 
            style={[
              styles.stepCircle, 
              formStep >= 1 ? styles.activeStep : null
            ]}
          >
            <Text style={[
              styles.stepNumber,
              formStep >= 1 ? styles.activeStepText : null
            ]}>1</Text>
          </View>
          <View 
            style={[
              styles.stepCircle, 
              formStep >= 2 ? styles.activeStep : null
            ]}
          >
            <Text style={[
              styles.stepNumber,
              formStep >= 2 ? styles.activeStepText : null
            ]}>2</Text>
          </View>
        </View>
      </View>
    );
  };

  // Custom Role Picker component to fix touch issues
  const RolePicker = () => {
    return (
      <View style={[
        styles.pickerContainer,
        { 
          borderColor: isDarkMode ? theme.border : '#CCCCCC',
          backgroundColor: isDarkMode ? theme.surfaceVariant : '#F5F5F5',
        }
      ]}>
        <Picker
          selectedValue={user.role}
          onValueChange={value => setUser({...user, role: value})}
          style={[
            styles.picker,
            { color: isDarkMode ? theme.text : '#000000' }
          ]}
          dropdownIconColor={isDarkMode ? theme.text : '#000000'}
          mode="dropdown"
        >
          {roles.map(role => (
            <Picker.Item 
              key={role.id} 
              label={role.description} 
              value={role.name}
              color={isDarkMode ? '#fff' : '#000'}
            />
          ))}
        </Picker>
      </View>
    );
  };

  // Render first step form
  const renderBasicInfoForm = () => {
    return (
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather name="user" size={20} color={theme.primary} />
          <Text style={styles.sectionTitle}>
            Informações de Conta
          </Text>
        </View>
        
        <Input
          icon="user"
          label="Nome de usuário *"
          value={user.username}
          onChangeText={text => setUser({...user, username: text})}
          error={validationErrors.username}
          required
          autoCapitalize="none"
        />
        
        <Input
          icon="mail"
          label="Email *"
          keyboardType="email-address"
          value={user.email}
          onChangeText={text => setUser({...user, email: text})}
          error={validationErrors.email}
          required
          autoCapitalize="none"
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
        
        {user.password && <PasswordStrengthIndicator />}
        
        <Input
          icon="check"
          label="Confirmar Senha *"
          secureTextEntry
          value={user.confirmPassword}
          onChangeText={text => setUser({...user, confirmPassword: text})}
          error={validationErrors.confirmPassword}
          required
        />
        
        <Button 
          title="Continuar" 
          onPress={handleNextStep}
          full
          icon={<Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />}
          iconPosition="right"
        />
      </View>
    );
  };

  // Render second step form
  const renderAdditionalInfoForm = () => {
    return (
      <View style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Feather name="user-plus" size={20} color={theme.primary} />
          <Text style={styles.sectionTitle}>
            Informações Adicionais
          </Text>
        </View>
        
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
        
        <View style={styles.roleSection}>
          <Text style={styles.fieldLabel}>Função do usuário:</Text>
          
          {/* Custom Picker Component */}
          <RolePicker />
          
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
        </View>
        
        <View style={styles.switchContainer}>
          <View>
            <Text style={styles.switchLabel}>Status da conta:</Text>
            <Text style={styles.switchDescription}>
              {user.isActive 
                ? "Usuário poderá fazer login no sistema" 
                : "Conta desativada, login bloqueado"}
            </Text>
          </View>
          <Switch
            value={user.isActive}
            onValueChange={value => setUser({...user, isActive: value})}
            trackColor={{ 
              false: isDarkMode ? '#555' : '#d1d1d1', 
              true: 'rgba(46, 125, 50, 0.5)' 
            }}
            thumbColor={
              user.isActive 
                ? '#2E7D32'
                : isDarkMode ? '#888' : '#f4f3f4'
            }
          />
        </View>
        
        <View style={styles.buttonsContainer}>
          <Button 
            title="Voltar" 
            variant="outline"
            onPress={() => setFormStep(1)}
            icon={<Feather name="arrow-left" size={18} color={theme.primary} style={{ marginRight: 8 }} />}
          />
          
          <Button 
            title="Criar Usuário" 
            onPress={handleNextStep} 
            loading={loading}
            icon={<Feather name="user-plus" size={18} color="#fff" style={{ marginRight: 8 }} />}
          />
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: isDarkMode ? theme.background : '#F5F5F5' }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" // Importante: Impede que o scroll feche o teclado
      >
        <StatusBar 
          backgroundColor={theme.primary}
          barStyle="light-content" 
        />
        
        <Animated.View style={[
          styles.headerCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
            borderColor: isDarkMode ? theme.border : '#DDDDDD',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={[
            styles.headerIcon,
            { backgroundColor: `${theme.primary}20` }
          ]}>
            <Feather name="user-plus" size={40} color={theme.primary} />
          </View>
          <Text style={[
            styles.headerTitle,
            { color: theme.text }
          ]}>
            Adicionar Novo Usuário
          </Text>
          <Text style={[
            styles.headerSubtitle,
            { color: isDarkMode ? theme.textLight : '#555555' }
          ]}>
            Preencha as informações para criar um novo usuário no sistema
          </Text>
          
          {/* Step indicator */}
          <StepIndicator />
        </Animated.View>
        
        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateX: slideFormAnim }]
        }}>
          {formStep === 1 ? renderBasicInfoForm() : renderAdditionalInfoForm()}
        </Animated.View>
        
        <View style={styles.footer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  headerCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  formCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#DDDDDD',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#000000',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#000000',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    zIndex: 999, // Importante para garantir que o picker fique por cima de outros elementos
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
    marginRight: 10,
    color: '#555555',
  },
  roleBadge: {
    paddingHorizontal: 12,
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
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    borderWidth: 1,
    backgroundColor: '#F9FAFB',
    borderColor: '#DDDDDD',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
    color: '#000000',
  },
  switchDescription: {
    fontSize: 13,
    maxWidth: '80%',
    color: '#555555',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  passwordStrengthContainer: {
    marginTop: -8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  strengthBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    flex: 1,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  stepIndicatorContainer: {
    width: '80%',
    marginTop: 20,
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    top: '50%',
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: '#E0E0E0',
    zIndex: 1,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CCCCCC',
  },
  activeStep: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#999999',
  },
  activeStepText: {
    color: '#2563EB',
  },
  roleSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  footer: {
    height: 20,
  },
});