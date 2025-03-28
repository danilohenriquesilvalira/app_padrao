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
  ActivityIndicator,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    role: 'user',
    isActive: true,
    fullName: '',
    phone: ''
  });
  
  // Track if fields have been modified
  const [modified, setModified] = useState({
    username: false,
    email: false,
    role: false,
    isActive: false,
    fullName: false,
    phone: false
  });
  
  const [roles, setRoles] = useState([
    { id: 1, name: 'admin', description: 'Administrador' },
    { id: 2, name: 'manager', description: 'Gerente' },
    { id: 3, name: 'user', description: 'Usuário' }
  ]);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const loadingAnim = useRef(new Animated.Value(1)).current;

  const { userId } = route.params;

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
    
    loadUser();
    loadRoles();
  }, []);

  // Animate loading state
  useEffect(() => {
    if (!initialLoad) {
      Animated.timing(loadingAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [initialLoad]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/users/${userId}`);
      
      if (response.data.user) {
        setUser(response.data.user);
        
        // Ensure proper boolean handling for isActive
        if (typeof response.data.user.isActive === 'string') {
          setUser(prev => ({
            ...prev,
            isActive: response.data.user.isActive === 'true'
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário', error);
      Alert.alert('Erro', 'Falha ao carregar dados do usuário. Tente novamente.');
      navigation.goBack();
    } finally {
      setLoading(false);
      setInitialLoad(false);
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

  const handleFieldChange = (field: string, value: any) => {
    setUser(prev => ({ ...prev, [field]: value }));
    setModified(prev => ({ ...prev, [field]: true }));
  };

  const handleUpdateUser = async () => {
    try {
      setSaving(true);
      await api.put(`/api/admin/users/${userId}`, user);
      
      // Update success feedback
      Alert.alert('Sucesso', 'Usuário atualizado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      Alert.alert('Erro', 'Falha ao atualizar usuário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscardChanges = () => {
    // Check if any changes were made
    if (Object.values(modified).some(val => val)) {
      Alert.alert(
        'Descartar alterações',
        'Você tem alterações não salvas. Deseja realmente sair?',
        [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() }
        ],
        { cancelable: true }
      );
    } else {
      navigation.goBack();
    }
  };

  // Get role badge color based on role
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

  // Get role description
  const getRoleDescription = (roleName: string) => {
    const role = roles.find(r => r.name === roleName);
    return role ? role.description : roleName;
  };

  // Custom Role Picker to fix touch issues
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
          onValueChange={value => handleFieldChange('role', value)}
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

  // Loading screen while fetching data
  if (initialLoad) {
    return (
      <Animated.View 
        style={[
          styles.loadingContainer, 
          { 
            backgroundColor: isDarkMode ? theme.background : '#F5F5F5',
            opacity: loadingAnim 
          }
        ]}
      >
        <View style={[
          styles.loadingCard, 
          { 
            backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
            borderColor: isDarkMode ? theme.border : '#DDDDDD'
          }
        ]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Carregando dados do usuário...
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={[
          styles.container, 
          { backgroundColor: isDarkMode ? theme.background : '#F5F5F5' }
        ]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled" // Importante: Isso evita que o teclado seja fechado quando tocar fora do input
      >
        <StatusBar 
          backgroundColor={theme.primary}
          barStyle="light-content" 
        />
        
        <Animated.View 
          style={[
            styles.headerCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : '#DDDDDD',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.userAvatarContainer}>
            <View 
              style={[
                styles.userAvatar,
                { backgroundColor: getRoleBadgeColor(user.role) }
              ]}
            >
              <Text style={styles.userInitial}>
                {user.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.userStatus}>
              <View 
                style={[
                  styles.statusIndicator,
                  { backgroundColor: user.isActive ? '#4CAF50' : '#9E9E9E' }
                ]}
              />
              <Text style={[
                styles.statusText,
                { color: user.isActive ? '#4CAF50' : '#9E9E9E' }
              ]}>
                {user.isActive ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Editar Usuário
          </Text>
          <Text style={[
            styles.headerSubtitle,
            { color: isDarkMode ? theme.textLight : '#555555' }
          ]}>
            ID: {userId} - Criado em {new Date().toLocaleDateString()}
          </Text>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.formCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : '#DDDDDD',
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
            onChangeText={text => handleFieldChange('username', text)}
            success={modified.username}
            rightComponent={
              modified.username ? 
                <Feather name="check-circle" size={18} color={theme.success} /> : 
                undefined
            }
            autoCapitalize="none"
          />
          
          <Input
            icon="mail"
            label="Email"
            keyboardType="email-address"
            value={user.email}
            onChangeText={text => handleFieldChange('email', text)}
            success={modified.email}
            rightComponent={
              modified.email ? 
                <Feather name="check-circle" size={18} color={theme.success} /> : 
                undefined
            }
            autoCapitalize="none"
          />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.formCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : '#DDDDDD',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="info" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Informações Adicionais
            </Text>
          </View>
          
          <Input
            icon="user"
            label="Nome completo"
            value={user.fullName}
            onChangeText={text => handleFieldChange('fullName', text)}
            success={modified.fullName}
            rightComponent={
              modified.fullName ? 
                <Feather name="check-circle" size={18} color={theme.success} /> : 
                undefined
            }
          />
          
          <Input
            icon="phone"
            label="Telefone"
            keyboardType="phone-pad"
            value={user.phone}
            onChangeText={text => handleFieldChange('phone', text)}
            success={modified.phone}
            rightComponent={
              modified.phone ? 
                <Feather name="check-circle" size={18} color={theme.success} /> : 
                undefined
            }
          />
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.formCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : '#DDDDDD',
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
          
          {/* Componente Picker corrigido */}
          <RolePicker />
          
          <View style={styles.roleBadgePreview}>
            <Text style={[
              styles.previewLabel,
              { color: isDarkMode ? theme.textLight : '#555555' }
            ]}>
              Função atual:
            </Text>
            <View style={[
              styles.roleBadge,
              { backgroundColor: getRoleBadgeColor(user.role) }
            ]}>
              <Text style={styles.roleBadgeText}>
                {getRoleDescription(user.role)}
              </Text>
            </View>
            {modified.role && (
              <Feather 
                name="check-circle" 
                size={16} 
                color={theme.success} 
                style={styles.modifiedIcon} 
              />
            )}
          </View>
          
          <View style={[
            styles.switchContainer,
            { 
              borderColor: isDarkMode ? theme.border : '#CCCCCC',
              backgroundColor: isDarkMode ? theme.surfaceVariant : '#F9FAFB' 
            }
          ]}>
            <View>
              <Text style={[
                styles.switchLabel,
                { color: theme.text }
              ]}>
                Status da conta:
              </Text>
              <Text style={[
                styles.switchDescription,
                { color: isDarkMode ? theme.textLight : '#555555' }
              ]}>
                {user.isActive 
                  ? "Usuário pode fazer login no sistema" 
                  : "Conta desativada, login bloqueado"}
              </Text>
            </View>
            <View style={styles.switchWithBadge}>
              <Switch
                value={user.isActive}
                onValueChange={value => handleFieldChange('isActive', value)}
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
              {modified.isActive && (
                <Feather 
                  name="check-circle" 
                  size={16} 
                  color={theme.success} 
                  style={styles.modifiedIcon} 
                />
              )}
            </View>
          </View>
        </Animated.View>
        
        <Animated.View 
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
        >
          <View style={styles.buttonsContainer}>
            <Button 
              title="Cancelar" 
              variant="outline"
              onPress={confirmDiscardChanges}
              disabled={saving}
              icon={<Feather name="x" size={18} color={theme.primary} style={{ marginRight: 8 }} />}
            />
            
            <Button 
              title="Salvar Alterações" 
              onPress={handleUpdateUser} 
              loading={saving}
              disabled={!Object.values(modified).some(val => val)}
              icon={<Feather name="save" size={18} color="#fff" style={{ marginRight: 8 }} />}
            />
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '90%',
    borderWidth: 1,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
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
  userAvatarContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
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
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
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
    marginBottom: 8,
    borderWidth: 1,
  },
  switchWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    maxWidth: '80%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modifiedIcon: {
    marginLeft: 8,
  },
  footer: {
    height: 20,
  },
});