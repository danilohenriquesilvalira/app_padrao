// src/screens/Register.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { register } = useAuth();

  async function handleRegister() {
    if (!username || !email || !password) {
      return Alert.alert('Erro', 'Preencha todos os campos');
    }

    if (password.length < 6) {
      return Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
    }

    setLoading(true);
    try {
      // O backend já espera username, email e password exatamente com esses nomes
      // então não precisamos fazer adaptações aqui
      await register(username, email, password);
      Alert.alert('Sucesso', 'Registro realizado com sucesso', [
        { text: 'OK', onPress: () => navigation.navigate('Login' as never) }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao registrar usuário');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Criar Conta</Text>
      
      <Input
        placeholder="Nome de usuário"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      
      <Input
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      
      <Input
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      
      <Button 
        title="Cadastrar" 
        onPress={handleRegister} 
        loading={loading}
      />
      
      <TouchableOpacity 
        onPress={() => navigation.navigate('Login' as never)} 
        style={styles.loginLink}
      >
        <Text style={styles.loginText}>Já tem uma conta? Faça login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  loginLink: {
    marginTop: 15,
    alignItems: 'center'
  },
  loginText: {
    color: '#4285F4'
  }
});