// src/screens/Admin/EditUser.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  Switch, 
  Text, 
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Feather } from '@expo/vector-icons';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function EditUser({ route, navigation }: any) {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    role: 'user',
    isActive: true,
    fullName: '',
    phone: ''
  });
  const [originalUser, setOriginalUser] = useState({
    username: '',
    email: '',
    role: 'user',
    isActive: true,
    fullName: '',
    phone: ''
  });
  const [validationErrors, setValidationErrors] = useState({
    username: '',
    email: '',
    fullName: '',
    phone: ''
  });
  const [roles, setRoles] = useState([
    { id: 1, name: 'admin', description: 'Administrador' },
    { id: 2, name: 'manager', description: 'Gerente' },
    { id: 3, name: 'user', description: 'Usuário' }
  ]);

  const { userId } = route.params;
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Start fade-in animation
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
    
    loadUser();
    loadRoles();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/users/${userId}`);
      const userData = response.data.user;
      setUser(userData);
      setOriginalUser(userData);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      Alert.alert('Erro', 'Falha ao carregar dados do usuário. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

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
    
    // Optional: Validate phone if provided
    if (user.phone && !/^[0-9()-+\s]*$/.test(user.phone)) {
      setValidationErrors(prev => ({...prev, phone: 'Formato de telefone inválido'}));
      isValid = false;
    }
    
    return isValid;
  };

  const handleUpdateUser = async () => {
    // Validate fields before submitting
    if (!validateFields()) {
      return;
    }
    
    try {
      setSavingChanges(true);
      await api.put(`/api/admin/users/${userId}`, user);
      
      // Show success message
      Alert.alert('Sucesso', 'Usuário atualizado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      Alert.alert('Erro', 'Falha ao atualizar usuário. Tente novamente mais tarde.');
    } finally {
      setSavingChanges(false);
    }
  };

  // Check if any field has been changed
  const hasChanges = () => {
    return (
      user.username !== originalUser.username ||
      user.email !== originalUser.email ||
      user.role !== originalUser.role ||
      user.isActive !== originalUser.isActive ||
      user.fullName !== originalUser.fullName ||
      user.phone !== originalUser.phone
    );
  };

  // Reset all changes
  const resetChanges = () => {
    setUser({...originalUser});
    setValidationErrors({
      username: '',
      email: '',
      fullName: '',
      phone: ''
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar 
          backgroundColor={isDarkMode ? theme.background : theme.primary} 
          barStyle={isDarkMode ? "light-content" : "light-content"} 
        />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando dados do usuário...
        </Text>
      </View>
    );
  }

  // Get role badge color
  const getRoleBadgeColor = (roleName: string) => {
    switch (roleName) {
      case 'admin':
        return theme.error;
      case 'manager':
        return theme.warning;
      case 'editor':
        return theme.accent;
      default:
        return theme.success;
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <StatusBar 
        backgroundColor={isDarkMode ? theme.background : theme.primary} 
        barStyle={isDarkMode ? "light-content" : "light-content"} 
      />
      
      <Animated.View 
        style={[
          styles.headerCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : theme.card,
            borderColor: theme.border,
            shadowColor: theme.text,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.avatar, { backgroundColor: getRoleBadgeColor(user.role) }]}>
            <Text style={styles.avatarText}>{user.username?.charAt(0)?.toUpperCase()}</Text>
          </View>
          
          <View style={styles.headerInfo}>
            <Text style={[styles.headerUsername, { color: theme.text }]}>{user.username}</Text>
            <Text style={[styles.headerEmail, { color: theme.textSecondary }]}>{user.email}</Text>
            
            <View style={styles.badgeContainer}>
              <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user.role) }]}>
                <Text style={styles.roleBadgeText}>{user.role}</Text>
              </View>
              
              <View style={[
                styles.statusBadge, 
                { 
                  backgroundColor: user.isActive ? `${theme.success}20` : `${theme.textLight}20`,
                  borderColor: user.isActive ? theme.success : theme.textLight
                }
              ]}>
                <Text style={[
                  styles.statusBadgeText, 
                  { color: user.isActive ? theme.success : theme.textLight }
                ]}>
                  {user.isActive ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.formCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : theme.card,
            borderColor: theme.border,
            shadowColor: theme.text,
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
          label="Nome de usuário"
          value={user.username}
          onChangeText={text => setUser({...user, username: text})}
          error={validationErrors.username}
        />
        
        <Input
          icon="mail"
          label="Email"
          keyboardType="email-address"
          value={user.email}
          onChangeText={text => setUser({...user, email: text})}
          error={validationErrors.email}
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
            backgroundColor: isDarkMode ? theme.surface : theme.card,
            borderColor: theme.border,
            shadowColor: theme.text,
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
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.elevation2,
            borderColor: theme.border
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
        
        <View style={[
          styles.switchContainer, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.elevation2,
            borderColor: theme.border
          }
        ]}>
          <View>
            <Text style={[styles.switchLabel, { color: theme.text }]}>Status da conta:</Text>
            <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
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
          onPress={() => hasChanges() ? resetChanges() : navigation.goBack()}
          disabled={savingChanges}
          icon={<Feather name="x" size={18} color={theme.primary} style={{ marginRight: 8 }} />}
        />
        
        <Button 
          title="Salvar" 
          onPress={handleUpdateUser} 
          loading={savingChanges}
          disabled={!hasChanges() || savingChanges}
          icon={<Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />}
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
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
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
    marginBottom: 16,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    maxWidth: '90%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
});