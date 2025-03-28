// src/screens/Admin/UserList.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import api from '../../services/api';
import Button from '../../components/Button';

type User = {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
};

export default function UserList({ navigation }: any) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadUsers = async (p = 1) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/users?page=${p}&pageSize=10`);
      
      if (p === 1) {
        setUsers(response.data.users);
      } else {
        setUsers([...users, ...response.data.users]);
      }
      
      setTotal(response.data.total);
      setPage(p);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDeleteUser = async (id: number) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este usuário?',
      [
        { text: 'Cancelar' },
        { 
          text: 'Excluir', 
          onPress: async () => {
            try {
              await api.delete(`/api/admin/users/${id}`);
              setUsers(users.filter(user => user.id !== id));
              Alert.alert('Sucesso', 'Usuário excluído com sucesso');
            } catch (error) {
              Alert.alert('Erro', 'Falha ao excluir usuário');
            }
          },
          style: 'destructive'
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.userItem}>
      <View>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
        <View style={styles.badges}>
          <Text style={[styles.badge, { backgroundColor: item.role === 'admin' ? '#FF5722' : '#4CAF50' }]}>
            {item.role}
          </Text>
          <Text style={[styles.badge, { backgroundColor: item.isActive ? '#4CAF50' : '#9E9E9E' }]}>
            {item.isActive ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('EditUser', { userId: item.id })}
          style={[styles.actionButton, styles.editButton]}
        >
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => handleDeleteUser(item.id)}
          style={[styles.actionButton, styles.deleteButton]}
        >
          <Text style={styles.actionText}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Usuários</Text>
        <Button 
          title="Novo Usuário" 
          onPress={() => navigation.navigate('CreateUser')}
        />
      </View>
      
      <FlatList
        data={users}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        onEndReached={() => {
          if (users.length < total) {
            loadUsers(page + 1);
          }
        }}
        onEndReachedThreshold={0.2}
        refreshing={loading}
        onRefresh={() => loadUsers()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  list: {
    paddingBottom: 16
  },
  userItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4
  },
  badges: {
    flexDirection: 'row',
    marginTop: 8
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontSize: 12,
    color: '#fff',
    marginRight: 6
  },
  actions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 70
  },
  actionButton: {
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60
  },
  editButton: {
    backgroundColor: '#2196F3'
  },
  deleteButton: {
    backgroundColor: '#F44336'
  },
  actionText: {
    color: '#fff',
    fontSize: 12
  }
});