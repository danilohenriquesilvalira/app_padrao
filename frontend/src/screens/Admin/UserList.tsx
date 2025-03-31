// src/screens/Admin/UserList.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  TextInput,
  Modal,
  StatusBar,
  Image,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';
import Button from '../../components/Button';
import { useTheme } from '../../contexts/ThemeContext';
import EmptyListSvg from '../../components/EmptyListSvg';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 46;

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  fullName?: string;
  phone?: string;
  avatar_url?: string;
};

export default function UserList({ navigation }: any) {
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [avatarErrors, setAvatarErrors] = useState<{[key: number]: boolean}>({});

  // Animation references
  const listAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const searchBarWidth = useRef(new Animated.Value(width - 32)).current;

  // Role colors mapping for badges - Cores mais elegantes
  const getRoleColor = (role: string) => {
    switch(role) {
      case 'admin':
        return {
          bg: '#E1306C',
          gradientColors: ['#E1306C', '#C13584'] as readonly [string, string],
          text: '#FFFFFF'
        };
      case 'manager':
        return {
          bg: '#FCAF45',
          gradientColors: ['#FCAF45', '#F77737'] as readonly [string, string],
          text: '#FFFFFF'
        };
      case 'editor':
        return {
          bg: '#4F5BD5',
          gradientColors: ['#4F5BD5', '#962FBF'] as readonly [string, string],
          text: '#FFFFFF'
        };
      case 'user':
      default:
        return {
          bg: '#00B2FF',
          gradientColors: ['#00B2FF', '#0077E6'] as readonly [string, string],
          text: '#FFFFFF'
        };
    }
  };

  // Animation for list items
  const itemAnimatedValues = useRef<{[key: number]: Animated.Value}>({}).current;

  const ensureItemAnimation = (id: number) => {
    if (!itemAnimatedValues[id]) {
      itemAnimatedValues[id] = new Animated.Value(0);
    }
    return itemAnimatedValues[id];
  };

  // Start animations when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(listAnimation, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      })
    ]).start();
    
    loadUsers();
  }, []);

  // Filter users when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) ||
        (user.fullName && user.fullName.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  // Animate items as they enter
  useEffect(() => {
    users.forEach((user: User, index) => {
      const delay = index * 100;
      Animated.timing(ensureItemAnimation(user.id), {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }).start();
    });
  }, [users]);

  const loadUsers = async (p = 1, shouldRefresh = false) => {
    try {
      if (p === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      const response = await api.get(`/api/admin/users?page=${p}&pageSize=10`);
      
      // Garantir que temos um array válido de usuários, mesmo se a resposta for nula
      const responseUsers = Array.isArray(response.data?.users) ? response.data.users : [];
      const responseTotal = typeof response.data?.total === 'number' ? response.data.total : 0;
      
      // Converter campos de snake_case para camelCase se necessário
      const formattedUsers = responseUsers.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.is_active !== undefined ? user.is_active : user.isActive,
        fullName: user.full_name || user.fullName || '',
        phone: user.phone || '',
        avatar_url: user.avatar_url || null
      }));
      
      if (shouldRefresh || p === 1) {
        setUsers(formattedUsers);
      } else {
        setUsers(prevUsers => [...prevUsers, ...formattedUsers]);
      }
      
      setTotal(responseTotal);
      setPage(p);
      
      // Limpar erros de avatar ao carregar novos usuários
      setAvatarErrors({});
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      
      // Em caso de erro, garantir que temos pelo menos um array vazio
      if (p === 1) {
        setUsers([]);
        setTotal(0);
      }
      
      Alert.alert(
        'Erro', 
        'Falha ao carregar usuários. Tente novamente mais tarde.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers(1, true);
  };

  const handleLoadMore = () => {
    if (users.length < total && !loadingMore) {
      loadUsers(page + 1);
    }
  };

  const handleDeleteConfirm = (user: User) => {
    setSelectedUser(user);
    setDeleteConfirmModal(true);
  };

  const executeDelete = async () => {
    if (!selectedUser) return;
    
    try {
      setDeleteConfirmModal(false);
      setLoading(true);
      
      await api.delete(`/api/admin/users/${selectedUser.id}`);
      
      // Atualizar o estado local sem fazer uma nova requisição
      setUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));
      setFilteredUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));
      setTotal(prevTotal => Math.max(0, prevTotal - 1));
      
      // Mostrar mensagem de sucesso
      Alert.alert('Sucesso', 'Usuário excluído com sucesso');
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      Alert.alert('Erro', 'Falha ao excluir usuário. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
      setSelectedUser(null);
    }
  };

  const handleSearchFocus = (focused: boolean) => {
    setIsSearchFocused(focused);
    Animated.timing(searchBarWidth, {
      toValue: focused ? width - 80 : width - 32,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleAvatarError = (userId: number) => {
    // Registrar erro para este avatar específico
    setAvatarErrors(prev => ({ ...prev, [userId]: true }));
  };

  const renderAvatar = (user: User) => {
    // Verificar se o usuário tem um avatar_url e não houve erro ao carregar
    if (user.avatar_url && !avatarErrors[user.id]) {
      // Construir a URL completa do avatar
      const avatarUrl = user.avatar_url.startsWith('http') 
        ? user.avatar_url 
        : `${api.defaults.baseURL}${user.avatar_url}`;

      return (
        <View style={styles.avatarContainer}>
          <Image 
            source={{ uri: avatarUrl }} 
            style={styles.avatarImage}
            onError={() => handleAvatarError(user.id)}
          />
          {user.isActive && <View style={styles.activeIndicator} />}
        </View>
      );
    }
    
    // Fallback para o avatar com inicial se não tiver URL ou ocorreu erro
    const getColorFromEmail = (email: string) => {
      const colors = [
        '#E1306C', // Rosa Instagram 
        '#F77737', // Laranja Instagram
        '#FCAF45', // Amarelo Instagram
        '#4F5BD5', // Azul Instagram
        '#962FBF', // Roxo Instagram
        '#00B2FF', // Azul Twitter
        '#00C06B', // Verde moderno
        '#6B4CF5', // Roxo moderno
      ];
      
      let sum = 0;
      for (let i = 0; i < email.length; i++) {
        sum += email.charCodeAt(i);
      }
      
      return colors[sum % colors.length];
    };
    
    const avatarColor = getColorFromEmail(user.email);
    
    // Get initials from name or username
    const getInitials = (name: string) => {
      return name.charAt(0).toUpperCase();
    };
    
    return (
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarFallback, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{getInitials(user.username)}</Text>
        </View>
        {user.isActive && <View style={styles.activeIndicator} />}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: User, index: number }) => {
    const animValue = ensureItemAnimation(item.id);
    const roleColor = getRoleColor(item.role);
    
    return (
      <Animated.View
        style={[
          styles.userItemContainer,
          {
            opacity: animValue,
            transform: [
              { 
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              }
            ]
          }
        ]}
      >
        <View style={styles.userCard}>
          {/* Avatar e Informações do Usuário */}
          <View style={styles.userMainInfo}>
            {renderAvatar(item)}
            
            <View style={styles.userDetails}>
              <View style={styles.nameContainer}>
                <Text style={styles.username}>{item.username}</Text>
                
                <LinearGradient
                  colors={roleColor.gradientColors}
                  start={{x: 0, y: 0}}
                  end={{x: 1, y: 0}}
                  style={styles.roleBadge}
                >
                  <Text style={styles.roleBadgeText}>{item.role}</Text>
                </LinearGradient>
              </View>
              
              <Text style={styles.email} numberOfLines={1} ellipsizeMode="tail">
                {item.email}
              </Text>
              
              {/* Status do usuário */}
              <View style={styles.statusContainer}>
                <View style={[
                  styles.statusBadge, 
                  { 
                    backgroundColor: item.isActive ? 'rgba(46, 213, 115, 0.1)' : 'rgba(235, 77, 75, 0.1)',
                    borderColor: item.isActive ? '#2ed573' : '#eb4d4b'
                  }
                ]}>
                  <View style={[
                    styles.statusDot, 
                    { backgroundColor: item.isActive ? '#2ed573' : '#eb4d4b' }
                  ]} />
                  <Text style={[
                    styles.statusText, 
                    { color: item.isActive ? '#2ed573' : '#eb4d4b' }
                  ]}>
                    {item.isActive ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
                
                <Text style={styles.userID}>ID: #{item.id}</Text>
              </View>
            </View>
          </View>
          
          {/* Botões de Ação - Agora com fundo azul claro */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('EditUser', { userId: item.id })}
              style={styles.actionButton}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonLight}>
                <Feather name="edit-2" size={14} color="#00C9FF" />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleDeleteConfirm(item)}
              style={styles.actionButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.8}
            >
              <View style={styles.actionButtonLight}>
                <Feather name="trash-2" size={14} color="#FF3131" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Animated.View style={[
          styles.searchBar, 
          { width: searchBarWidth }
        ]}>
          <Feather 
            name="search" 
            size={20} 
            color="#A0A0A0" 
            style={styles.searchIcon} 
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuários..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => handleSearchFocus(true)}
            onBlur={() => handleSearchFocus(false)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              onPress={() => setSearchQuery('')}
              style={styles.clearSearch}
            >
              <Feather name="x" size={18} color="#999999" />
            </TouchableOpacity>
          )}
        </Animated.View>
        
        {isSearchFocused ? (
          <TouchableOpacity 
            style={styles.cancelSearch}
            onPress={() => {
              setSearchQuery('');
              handleSearchFocus(false);
            }}
          >
            <Text style={{ color: theme.primary }}>Cancelar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.addUserButton}
            onPress={() => navigation.navigate('CreateUser')}
            activeOpacity={0.7}
          >
            <View style={styles.addUserIconContainer}>
              <Feather name="user-plus" size={20} color={theme.primary} />
            </View>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Cards de estatísticas com fundo azul suave */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.statCardLight]}>
          <View style={styles.statIconContainer}>
            <Feather name="users" size={20} color="#4F5BD5" />
          </View>
          <Text style={[styles.statValue, styles.statValueDark]}>{total}</Text>
          <Text style={[styles.statLabel, styles.statLabelDark]}>Total</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardLight]}>
          <View style={styles.statIconContainer}>
            <Feather name="user-check" size={20} color="#00C06B" />
          </View>
          <Text style={[styles.statValue, styles.statValueDark]}>
            {users.filter(u => u.isActive).length}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelDark]}>Ativos</Text>
        </View>
        
        <View style={[styles.statCard, styles.statCardLight]}>
          <View style={styles.statIconContainer}>
            <Feather name="shield" size={20} color="#E1306C" />
          </View>
          <Text style={[styles.statValue, styles.statValueDark]}>
            {users.filter(u => u.role === 'admin').length}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelDark]}>Admins</Text>
        </View>
      </View>
      
      {/* Cabeçalho da lista de resultados */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'} encontrados
        </Text>
        {searchQuery && (
          <Text style={styles.searchInfo}>
            Buscando por: "<Text style={styles.searchQuery}>{searchQuery}</Text>"
          </Text>
        )}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={styles.footerText}>
          Carregando mais usuários...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <EmptyListSvg 
          width={200} 
          height={200}
          primaryColor="#4F5BD5"
          secondaryColor="#E1306C"
        />
        
        <Text style={styles.emptyTitle}>
          {searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
        </Text>
        
        <Text style={styles.emptyDescription}>
          {searchQuery
            ? `Não encontramos nenhum usuário para "${searchQuery}"`
            : 'Comece adicionando um novo usuário pelo botão de adicionar no topo da tela'
          }
        </Text>
        
        {searchQuery && (
          <Button
            title="Limpar Busca"
            onPress={() => setSearchQuery('')}
            variant="outline"
            icon={<Feather name="x" size={16} color={theme.primary} style={{ marginRight: 8 }} />}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        backgroundColor="#2563EB" 
        barStyle="light-content" 
      />
      
      <FlatList
        data={filteredUsers}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={[
          styles.list,
          filteredUsers.length === 0 && styles.emptyList
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        showsVerticalScrollIndicator={false}
      />
      
      {loading && !refreshing && (
        <View style={styles.loader}>
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#4F5BD5" />
            <Text style={styles.loaderText}>
              Carregando usuários...
            </Text>
          </View>
        </View>
      )}
      
      {/* Modal de confirmação de exclusão redesenhado */}
      <Modal
        visible={deleteConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderDanger}>
              <Feather name="alert-triangle" size={28} color="#FF3131" />
              <Text style={styles.modalTitle}>
                Confirmar Exclusão
              </Text>
            </View>
            
            <Text style={styles.modalMessage}>
              Tem certeza que deseja excluir o usuário{' '}
              <Text style={styles.modalHighlight}>
                {selectedUser?.username}
              </Text>?
              Esta ação não pode ser desfeita.
            </Text>
            
            <View style={styles.userPreview}>
              {selectedUser && renderAvatar(selectedUser)}
              <View style={styles.userPreviewInfo}>
                <Text style={styles.previewUsername}>
                  {selectedUser?.username}
                </Text>
                <Text style={styles.previewEmail}>
                  {selectedUser?.email}
                </Text>
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <Button 
                title="Cancelar" 
                onPress={() => setDeleteConfirmModal(false)}
                variant="outline"
              />
              <Button 
                title="Excluir" 
                onPress={executeDelete}
                variant="error"
                icon={<Feather name="trash-2" size={16} color="#fff" style={{ marginRight: 8 }} />}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFC', // Fundo mais suave
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  userItemContainer: {
    marginBottom: 12,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: Platform.OS === 'ios' ? 0 : 1,
    borderColor: Platform.OS === 'ios' ? undefined : 'rgba(0,0,0,0.05)',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    marginRight: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2ed573',
    borderWidth: 1.5,
    borderColor: 'white',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginRight: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  email: {
    fontSize: 14,
    color: '#737373',
    marginBottom: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  userID: {
    fontSize: 11,
    color: '#A0A0A0',
    marginLeft: 'auto',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    marginLeft: 8,
  },
  // Novo estilo para botões com fundo azul claro
  actionButtonLight: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  // Estilos antigos mantidos para referência
  actionGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 1,
  },
  searchBar: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  searchIcon: {
    marginLeft: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#262626',
  },
  clearSearch: {
    padding: 8,
    marginRight: 4,
  },
  cancelSearch: {
    marginLeft: 8,
    padding: 8,
  },
  // Novo botão de adicionar usuário
  addUserButton: {
    marginLeft: 8,
    padding: 2,
  },
  addUserIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  // Novos estilos para os cards com fundo azul suave
  statCardLight: {
    backgroundColor: '#f0f7ff',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  statValueDark: {
    color: '#262626',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statLabelDark: {
    color: '#737373',
  },
  resultsHeader: {
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
  },
  searchInfo: {
    fontSize: 13,
    marginTop: 4,
    color: '#737373',
  },
  searchQuery: {
    fontWeight: '600',
    color: '#262626',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loaderContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  footerLoader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#737373',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: '#262626',
  },
  emptyDescription: {
    fontSize: 15,
    marginBottom: 24,
    textAlign: 'center',
    color: '#737373',
    lineHeight: 22,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
    color: '#262626',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
    color: '#737373',
  },
  modalHighlight: {
    fontWeight: '700',
    color: '#262626',
  },
  userPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#F9FAFC',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  userPreviewInfo: {
    marginLeft: 12,
  },
  previewUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 2,
  },
  previewEmail: {
    fontSize: 14,
    color: '#737373',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});