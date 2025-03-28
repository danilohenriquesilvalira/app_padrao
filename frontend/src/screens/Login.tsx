// src/screens/Login.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  TouchableOpacity, 
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import Input from '../components/Input';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const { signIn } = useAuth();
  const { theme, isDarkMode } = useTheme();

  async function handleLogin() {
    if (!email || !password) {
      return Alert.alert('Erro', 'Preencha todos os campos');
    }

    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Erro', 'Falha no login, verifique suas credenciais');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={[
          styles.container, 
          { backgroundColor: theme.background }
        ]}
      >
        <View style={styles.logoContainer}>
          {isDarkMode ? (
            <Feather name="user" size={60} color={theme.primary} />
          ) : (
            <Feather name="user" size={60} color={theme.primary} />
          )}
          <Text style={[styles.appName, { color: theme.primary }]}>App Padrão</Text>
        </View>
        
        <Text style={[styles.title, { color: theme.text }]}>Login</Text>
        <Text style={[styles.subtitle, { color: theme.placeholder }]}>
          Entre com suas credenciais para continuar
        </Text>
        
        <View style={styles.formContainer}>
          <Input
            icon="mail"
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          
          <Input
            icon="lock"
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
              Esqueceu sua senha?
            </Text>
          </TouchableOpacity>
          
          <Button 
            title="Entrar" 
            onPress={handleLogin} 
            loading={loading}
            icon={<Feather name="log-in" size={18} color="#FFF" style={{ marginRight: 8 }} />}
          />
        </View>
        
        <View style={styles.footer}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Register' as never)} 
            style={styles.registerLink}
          >
            <Text style={[styles.registerText, { color: theme.placeholder }]}>
              Não tem uma conta?{' '}
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>
                Cadastre-se
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  registerLink: {
    marginTop: 15,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 16,
  }
});