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
  Platform,
  Image
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
  const [avatarError, setAvatarError] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    role: 'user',
    isActive: true,
    fullName: '',
    phone: '',
    avatar_url: ''
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
  const avatarScale = useRef(new Animated.Value(1)).current;

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
        // Convertendo campos de snake_case para camelCase
        const userData = response.data.user;
        setUser({
          username: userData.username || '',
          email: userData.email || '',
          role: userData.role || 'user',
          isActive: typeof userData.is_active === 'boolean' ? userData.is_active : true,
          fullName: userData.full_name || '',
          phone: userData.phone || '',
          avatar_url: userData.avatar_url || ''
        });
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
      
      // Converte os campos de camelCase para snake_case antes de enviar
      const userDataToSend = {
        username: user.username,
        email: user.email,
        role: user.role,
        is_active: user.isActive,
        full_name: user.fullName,
        phone: user.phone
      };
      
      await api.put(`/api/admin/users/${userId}`, userDataToSend);
      
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

  // Renderizar o avatar do usuário
  const renderAvatar = () => {
    // Animação ao tocar no avatar
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
      ]).start();
    };
    
    // Se o usuário tem um avatar e não houve erro no carregamento
    if (user.avatar_url && !avatarError) {
      // Construir URL completa do avatar
      const avatarUrl = user.avatar_url.startsWith('http')
        ? user.avatar_url
        : `${api.defaults.baseURL}${user.avatar_url}`;
        
      return (
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: avatarScale }] }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAvatarPress}
          >
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              onError={(e) => {
                console.log("Erro ao carregar avatar:", e.nativeEvent.error);
                setAvatarError(true);
              }}
            />
            <View style={[
              styles.avatarBadge,
              { backgroundColor: user.isActive ? '#4CAF50' : '#9E9E9E' }
            ]} />
          </TouchableOpacity>
        </Animated.View>
      );
    } else {
      // Fallback com iniciais quando não há avatar ou houve erro
      const getColorFromRole = (role: string) => {
        switch (role) {
          case 'admin':
            return '#E1306C'; // Rosa
          case 'manager':
            return '#FCAF45'; // Laranja
          case 'editor':
            return '#4F5BD5'; // Azul
          default:
            return '#00B2FF'; // Azul claro
        }
      };
      
      // Obter iniciais do nome ou username
      const getInitials = () => {
        if (user.fullName && user.fullName.length > 0) {
          return user.fullName.charAt(0).toUpperCase();
        }
        return user.username.charAt(0).toUpperCase();
      };
      
      const backgroundColor = getColorFromRole(user.role);
      
      return (
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ scale: avatarScale }] }
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAvatarPress}
          >
            <View 
              style={[
                styles.avatarFallback,
                { backgroundColor }
              ]}
            >
              <Text style={styles.avatarInitials}>
                {getInitials()}
              </Text>
            </View>
            <View style={[
              styles.avatarBadge,
              { backgroundColor: user.isActive ? '#4CAF50' : '#9E9E9E' }
            ]} />
          </TouchableOpacity>
        </Animated.View>
      );
    }
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
          {/* Avatar do usuário */}
          {renderAvatar()}
          
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Editar Usuário
          </Text>
          <Text style={[
            styles.headerSubtitle,
            { color: isDarkMode ? theme.textLight : '#555555' }
          ]}>
            ID: {userId} - Criado em {new Date().toLocaleDateString()}
          </Text>
          
          {/* Badges de status e função */}
          <View style={styles.badgesContainer}>
            <View style={[
              styles.roleBadge,
              { backgroundColor: getRoleBadgeColor(user.role) }
            ]}>
              <Text style={styles.badgeText}>
                {getRoleDescription(user.role)}
              </Text>
            </View>
            
            <View style={[
              styles.statusBadge,
              { 
                backgroundColor: user.isActive ? 
                  'rgba(46, 125, 50, 0.2)' : 
                  'rgba(235, 77, 75, 0.2)',
                borderColor: user.isActive ? '#2E7D32' : '#eb4d4b',
                borderWidth: 1
              }
            ]}>
              <View style={[
                styles.statusDot,
                { backgroundColor: user.isActive ? '#2E7D32' : '#eb4d4b' }
              ]} />
              <Text style={[
                styles.badgeText,
                { color: user.isActive ? '#2E7D32' : '#eb4d4b' }
              ]}>
                {user.isActive ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </View>
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
              styles.roleBadgeSmall,
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
  avatarContainer: {
    width: 100,
    height: 100,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  roleBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
  roleBadgeSmall: {
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