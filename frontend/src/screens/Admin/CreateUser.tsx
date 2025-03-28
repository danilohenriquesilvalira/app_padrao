// src/screens/Admin/CreateUser.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, Text } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Input from '../../components/Input';
import Button from '../../components/Button';
import api from '../../services/api';

export default function CreateUser({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    fullName: '',
    phone: ''
  });
  const [roles, setRoles] = useState([
    { id: 1, name: 'admin', description: 'Administrador' },
    { id: 2, name: 'manager', description: 'Gerente' },
    { id: 3, name: 'user', description: 'Usuário' }
  ]);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/admin/roles');
      if (response.data.roles) {
        setRoles(response.data.roles);
      }
    } catch (error) {
      console.error('Erro ao carregar funções', error);
    }
  };

  const handleCreateUser = async () => {
    if (!user.username || !user.email || !user.password) {
      return Alert.alert('Erro', 'Preencha os campos obrigatórios');
    }

    if (user.password.length < 6) {
      return Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
    }

    try {
      setLoading(true);
      await api.post('/api/admin/users', user);
      Alert.alert('Sucesso', 'Usuário criado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Input
        placeholder="Nome de usuário *"
        value={user.username}
        onChangeText={text => setUser({...user, username: text})}
      />
      
      <Input
        placeholder="Email *"
        keyboardType="email-address"
        value={user.email}
        onChangeText={text => setUser({...user, email: text})}
      />
      
      <Input
        placeholder="Senha *"
        secureTextEntry
        value={user.password}
        onChangeText={text => setUser({...user, password: text})}
      />
      
      <Input
        placeholder="Nome completo"
        value={user.fullName}
        onChangeText={text => setUser({...user, fullName: text})}
      />
      
      <Input
        placeholder="Telefone"
        keyboardType="phone-pad"
        value={user.phone}
        onChangeText={text => setUser({...user, phone: text})}
      />
      
      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Função:</Text>
        <Picker
          selectedValue={user.role}
          onValueChange={value => setUser({...user, role: value})}
          style={styles.picker}
        >
          {roles.map(role => (
            <Picker.Item key={role.id} label={role.description} value={role.name} />
          ))}
        </Picker>
      </View>
      
      <Text style={styles.required}>* Campos obrigatórios</Text>
      
      <Button 
        title="Criar Usuário" 
        onPress={handleCreateUser} 
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12
  },
  picker: {
    height: 50
  },
  label: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 10,
    paddingTop: 5
  },
  required: {
    color: '#F44336',
    marginBottom: 15,
    fontSize: 12
  }
});