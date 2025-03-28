// src/screens/Profile.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

// Definindo os tipos de navegação
type ProfileStackParamList = {
  ProfileMain: undefined;
  ProfileDetails: undefined;
  Preferences: undefined;
};

type ProfileScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
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

  const navigateToProfileDetails = () => {
    navigation.navigate('ProfileDetails');
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

      <TouchableOpacity 
        style={styles.advancedProfileButton} 
        onPress={navigateToProfileDetails}
      >
        <View style={styles.advancedButtonContent}>
          <Feather name="user-plus" size={20} color="#4285F4" />
          <Text style={styles.advancedButtonText}>Perfil Avançado</Text>
        </View>
        <Feather name="chevron-right" size={20} color="#4285F4" />
      </TouchableOpacity>
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
  },
  advancedProfileButton: {
    marginTop: 25,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  advancedButtonContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  advancedButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10
  }
});