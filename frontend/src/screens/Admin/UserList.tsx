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
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../../services/api';
import Button from '../../components/Button';
import { useTheme } from '../../contexts/ThemeContext';
import EmptyListSvg from '../../components/EmptyListSvg';

const { width } = Dimensions.get('window');
const AVATAR_SIZE = 50;

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  fullName?: string;
  phone?: string;
};

export default function UserList({ navigation }: any) {
  const { theme, isDarkMode } = useTheme();
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

  // Animation references
  const listAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(0)).current;
  const searchBarWidth = useRef(new Animated.Value(width - 32)).current;

  // Role colors mapping for badges - Now using theme colors
  const getRoleColor = (role: string) => {
    switch(role) {
      case 'admin':
        return {
          bg: theme.error,
          text: '#fff'
        };
      case 'manager':
        return {
          bg: theme.warning,
          text: isDarkMode ? '#000' : '#fff'
        };
      case 'editor':
        return {
          bg: theme.accent,
          text: isDarkMode ? '#000' : '#fff'
        };
      case 'user':
      default:
        return {
          bg: theme.success,
          text: '#fff'
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
  }, []);

  // Load users on component mount
  useEffect(() => {
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
    users.forEach((user, index) => {
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
      
      if (shouldRefresh || p === 1) {
        setUsers(response.data.users);
      } else {
        setUsers([...users, ...response.data.users]);
      }
      
      setTotal(response.data.total);
      setPage(p);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      Alert.alert('Erro', 'Falha ao carregar usuários. Tente novamente mais tarde.');
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
      
      // Remove user from state
      setUsers(users.filter(user => user.id !== selectedUser.id));
      
      // Show success message
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

  const renderAvatar = (username: string, email: string) => {
    // Generate unique color based on email
    const getColorFromEmail = (email: string) => {
      const colors = [
        theme.primary, theme.secondary, theme.accent, theme.primaryLight, // Theme colors
        theme.primaryDark, theme.info, theme.success, theme.warning, // More theme colors
      ];
      
      let sum = 0;
      for (let i = 0; i < email.length; i++) {
        sum += email.charCodeAt(i);
      }
      
      return colors[sum % colors.length];
    };
    
    const avatarColor = getColorFromEmail(email);
    
    // Get initials from name or username
    const getInitials = (name: string) => {
      return name.charAt(0).toUpperCase();
    };
    
    return (
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{getInitials(username)}</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: User, index: number }) => {
    const animValue = ensureItemAnimation(item.id);
    
    // Get role color
    const roleColor = getRoleColor(item.role);
    
    // Determine the status color
    const statusColor = item.isActive ? theme.success : theme.textLight;
    
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
        <View style={[
          styles.userItem, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.card,
            borderLeftColor: roleColor.bg,
            shadowColor: theme.text,
          }
        ]}>
          <View style={styles.userMainInfo}>
            {renderAvatar(item.username, item.email)}
            
            <View style={styles.userDetails}>
              <View style={styles.userNameRow}>
                <Text style={[styles.username, { color: theme.text }]}>
                  {item.username}
                </Text>
                <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              </View>
              
              <Text style={[styles.email, { color: theme.textSecondary }]}>
                {item.email}
              </Text>
              
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: roleColor.bg }]}>
                  <Text style={[styles.badgeText, { color: roleColor.text }]}>
                    {item.role}
                  </Text>
                </View>
                
                <View style={[
                  styles.badge, 
                  { 
                    backgroundColor: item.isActive 
                      ? `${theme.success}20` 
                      : `${theme.textLight}20`,
                    borderWidth: 1,
                    borderColor: item.isActive ? theme.success : theme.textLight
                  }
                ]}>
                  <Text style={[
                    styles.badgeText, 
                    { 
                      color: item.isActive ? theme.success : theme.textLight,
                      fontWeight: '600'
                    }
                  ]}>
                    {item.isActive ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={() => navigation.navigate('EditUser', { userId: item.id })}
              style={[styles.actionButton, styles.editButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="edit-2" size={16} color="#fff" />
              <Text style={styles.actionText}>Editar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => handleDeleteConfirm(item)}
              style={[styles.actionButton, styles.deleteButton, { backgroundColor: theme.error }]}
            >
              <Feather name="trash-2" size={16} color="#fff" />
              <Text style={styles.actionText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <Animated.View 
      style={[
        styles.header,
        { opacity: fadeAnimation }
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        Gerenciar Usuários
      </Text>
      
      <View style={styles.searchContainer}>
        <Animated.View style={[
          styles.searchBar, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.card,
            borderColor: theme.border,
            width: searchBarWidth 
          }
        ]}>
          <Feather 
            name="search" 
            size={20} 
            color={theme.placeholder} 
            style={styles.searchIcon} 
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar usuários..."
            placeholderTextColor={theme.placeholder}
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
              <Feather name="x" size={18} color={theme.placeholder} />
            </TouchableOpacity>
          )}
        </Animated.View>
        
        {isSearchFocused && (
          <TouchableOpacity 
            style={styles.cancelSearch}
            onPress={() => {
              setSearchQuery('');
              handleSearchFocus(false);
            }}
          >
            <Text style={{ color: theme.primary }}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <Button 
        title="Novo Usuário" 
        onPress={() => navigation.navigate('CreateUser')}
        icon={<Feather name="plus" size={16} color="#fff" style={{ marginRight: 8 }} />}
        full={true}
      />
      
      <View style={styles.statsContainer}>
        <View style={[
          styles.statCard, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.card,
            borderColor: theme.border
          }
        ]}>
          <Feather name="users" size={20} color={theme.primary} />
          <Text style={[styles.statValue, { color: theme.text }]}>{total}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
        </View>
        
        <View style={[
          styles.statCard, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.card,
            borderColor: theme.border
          }
        ]}>
          <Feather name="user-check" size={20} color={theme.success} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {users.filter(u => u.isActive).length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Ativos</Text>
        </View>
        
        <View style={[
          styles.statCard, 
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : theme.card,
            borderColor: theme.border
          }
        ]}>
          <Feather name="shield" size={20} color={theme.error} />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {users.filter(u => u.role === 'admin').length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Admins</Text>
        </View>
      </View>
      
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderText, { color: theme.text }]}>
          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'} encontrados
        </Text>
        {searchQuery && (
          <Text style={[styles.searchingFor, { color: theme.textSecondary }]}>
            Buscando por: "{searchQuery}"
          </Text>
        )}
      </View>
    </Animated.View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
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
          primaryColor={theme.primary}
          secondaryColor={theme.secondary}
        />
        
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          {searchQuery ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
        </Text>
        
        <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
          {searchQuery
            ? `Não encontramos nenhum usuário para "${searchQuery}"`
            : 'Comece adicionando um novo usuário através do botão acima'
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        backgroundColor={isDarkMode ? theme.background : theme.primary} 
        barStyle={isDarkMode ? "light-content" : "light-content"} 
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
      />
      
      {loading && !refreshing && (
        <View style={styles.loader}>
          <View style={[
            styles.loaderContainer, 
            { 
              backgroundColor: isDarkMode 
                ? `${theme.background}E6` // Hexadecimal for 90% opacity
                : `${theme.card}E6`,
              borderColor: theme.border
            }
          ]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loaderText, { color: theme.text }]}>
              Carregando usuários...
            </Text>
          </View>
        </View>
      )}
      
      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[
            styles.modalContent, 
            { 
              backgroundColor: isDarkMode ? theme.surface : theme.card,
              borderColor: theme.border
            }
          ]}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={28} color={theme.error} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Confirmar Exclusão
              </Text>
            </View>
            
            <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>
              Tem certeza que deseja excluir o usuário{' '}
              <Text style={{ fontWeight: 'bold', color: theme.text }}>
                {selectedUser?.username}
              </Text>?
              Esta ação não pode ser desfeita.
            </Text>
            
            <View style={[styles.userPreview, { backgroundColor: theme.surfaceVariant }]}>
              {selectedUser && renderAvatar(selectedUser.username, selectedUser.email)}
              <View style={styles.userPreviewInfo}>
                <Text style={[styles.previewUsername, { color: theme.text }]}>
                  {selectedUser?.username}
                </Text>
                <Text style={[styles.previewEmail, { color: theme.textSecondary }]}>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  userItemContainer: {
    marginBottom: 12,
  },
  userItem: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  userMainInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  email: {
    fontSize: 14,
    marginTop: 2,
    marginBottom: 8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 12,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchBar: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  searchIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  clearSearch: {
    padding: 8,
  },
  cancelSearch: {
    marginLeft: 8,
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  listHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 15,
    fontWeight: '500',
  },
  searchingFor: {
    fontSize: 13,
    marginTop: 4,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  loaderContainer: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
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
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
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
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalMessage: {
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  userPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  userPreviewInfo: {
    marginLeft: 12,
  },
  previewUsername: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewEmail: {
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});