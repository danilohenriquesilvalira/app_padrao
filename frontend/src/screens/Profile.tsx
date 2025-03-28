// src/screens/Profile.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || ''
  });

  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      await updateProfile(form);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Seu Perfil</Text>
      
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Username:</Text>
        <Text style={styles.value}>{user?.username}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Função:</Text>
        <Text style={styles.value}>{user?.role || 'user'}</Text>
      </View>
      
      <Text style={styles.subtitle}>Editar Informações</Text>
      
      <Input
        placeholder="Nome Completo"
        value={form.fullName}
        onChangeText={(text) => setForm({...form, fullName: text})}
      />
      
      <Input
        placeholder="Telefone"
        value={form.phone}
        onChangeText={(text) => setForm({...form, phone: text})}
        keyboardType="phone-pad"
      />
      
      <Button 
        title="Salvar Alterações" 
        onPress={handleUpdateProfile} 
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 30,
    marginBottom: 15
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  label: {
    fontWeight: 'bold',
    width: 100
  },
  value: {
    flex: 1
  }
});