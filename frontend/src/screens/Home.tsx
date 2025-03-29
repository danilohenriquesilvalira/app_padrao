// src/screens/Home.tsx
import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  StatusBar,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

export default function Home() {
  const { user, signOut } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  // Animation references
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const welcomeAnim = useRef(new Animated.Value(-50)).current;
  const cardsAnim = useRef([
    new Animated.Value(50),
    new Animated.Value(50),
    new Animated.Value(50),
  ]).current;

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  useEffect(() => {
    // Sequence of animations for a smooth entrance
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered animation for cards
    Animated.stagger(150, cardsAnim.map(anim => 
      Animated.timing(anim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      })
    )).start();
  }, []);

  // Format date to a readable string
  const getFormattedDate = () => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const now = new Date();
    const day = days[now.getDay()];
    const date = now.getDate();
    const month = months[now.getMonth()];
    
    return `${day}, ${date} de ${month}`;
  };

  // Render user avatar or fallback
  const renderAvatar = () => {
    // Usar acesso seguro com ?. e verificar se a propriedade existe
    // @ts-ignore - Ignorando erro de tipagem aqui
    const avatarUrl = user && user.avatarURL ? user.avatarURL : 
                    // @ts-ignore - Outra verificação de propriedade alternativa
                    (user && user.avatar_url);
        
    if (avatarUrl) {
      // Ensure complete URL
      const fullAvatarUrl = avatarUrl.startsWith('http')
        ? avatarUrl
        : `${api.defaults.baseURL}${avatarUrl}`;
        
      return (
        <Image
          source={{ uri: fullAvatarUrl }}
          style={styles.avatar}
          resizeMode="cover"
          onError={() => console.log("Error loading avatar")}
        />
      );
    } else {
      // Fallback with initials
      const getInitials = () => {
        if (user?.fullName && user.fullName.length > 0) {
          return user.fullName.charAt(0).toUpperCase();
        }
        return user?.username?.charAt(0).toUpperCase() || 'U';
      };
      
      return (
        <View style={[styles.avatarFallback, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        backgroundColor={isDarkMode ? theme.background : theme.primary}
        barStyle={isDarkMode ? "light-content" : "light-content"}
      />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header, 
          { backgroundColor: theme.primary },
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <View style={styles.headerContent}>
          {/* User info section */}
          <View style={styles.userInfoContainer}>
            <View style={styles.avatarContainer}>
              {renderAvatar()}
            </View>
            
            <Animated.View 
              style={[
                styles.welcomeContainer,
                { transform: [{ translateX: welcomeAnim }] }
              ]}
            >
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.username} numberOfLines={1} ellipsizeMode="tail">
                {user?.fullName || user?.username || 'Usuário'}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user?.role || 'user'}</Text>
              </View>
            </Animated.View>
          </View>
          
          {/* Date section */}
          <View style={styles.dateContainer}>
            <Text style={styles.date}>{getFormattedDate()}</Text>
          </View>
        </View>
        
        {/* Wave decoration */}
        <View style={styles.wave}>
          <View style={styles.waveShape} />
        </View>
      </Animated.View>
      
      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Welcome card */}
        <Animated.View 
          style={[
            styles.card,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : 'rgba(0,0,0,0.05)'
            },
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: cardsAnim[0] }] 
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Feather name="home" size={22} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Bem-vindo ao App Padrão</Text>
          </View>
          
          <Text style={[styles.cardText, { color: theme.textSecondary }]}>
            Este é o seu painel principal onde você pode acessar todas as funcionalidades do sistema.
          </Text>
          
          <View style={styles.cardActions}>
            <Button 
              title="Meu Perfil" 
              onPress={() => navigation.navigate('Profile' as never)}
              icon={<Feather name="user" size={18} color="#FFF" />}
              variant="primary"
            />
          </View>
        </Animated.View>
        
        {/* User info card */}
        <Animated.View 
          style={[
            styles.card,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : 'rgba(0,0,0,0.05)'
            },
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: cardsAnim[1] }] 
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Feather name="info" size={22} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Informações da Conta</Text>
          </View>
          
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Feather name="user" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Usuário:</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {user?.username || 'Não definido'}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Feather name="mail" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Email:</Text>
              </View>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {user?.email || 'Não definido'}
              </Text>
            </View>
            
            {user?.fullName && (
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Feather name="user-check" size={16} color={theme.textSecondary} />
                  <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Nome completo:</Text>
                </View>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {user.fullName}
                </Text>
              </View>
            )}
            
            {user?.phone && (
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Feather name="phone" size={16} color={theme.textSecondary} />
                  <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Telefone:</Text>
                </View>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {user.phone}
                </Text>
              </View>
            )}
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Feather name="shield" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Função:</Text>
              </View>
              <View 
                style={[
                  styles.roleChip,
                  { backgroundColor: user?.role === 'admin' ? '#E1306C20' : '#00B2FF20' }
                ]}
              >
                <Text 
                  style={[
                    styles.roleChipText,
                    { color: user?.role === 'admin' ? '#E1306C' : '#00B2FF' }
                  ]}
                >
                  {user?.role || 'user'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Feather name="check-circle" size={16} color={theme.textSecondary} />
                <Text style={[styles.infoLabelText, { color: theme.textSecondary }]}>Status:</Text>
              </View>
              <View 
                style={[
                  styles.statusChip,
                  { backgroundColor: user?.isActive ? '#2ed57320' : '#eb4d4b20' }
                ]}
              >
                <View 
                  style={[
                    styles.statusDot, 
                    { backgroundColor: user?.isActive ? '#2ed573' : '#eb4d4b' }
                  ]} 
                />
                <Text 
                  style={[
                    styles.statusText,
                    { color: user?.isActive ? '#2ed573' : '#eb4d4b' }
                  ]}
                >
                  {user?.isActive ? 'Ativo' : 'Inativo'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
        
        {/* Quick actions card */}
        <Animated.View 
          style={[
            styles.card,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#FFFFFF',
              borderColor: isDarkMode ? theme.border : 'rgba(0,0,0,0.05)'
            },
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: cardsAnim[2] }] 
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Feather name="command" size={22} color={theme.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Ações Rápidas</Text>
          </View>
          
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={[
                styles.quickActionButton,
                { backgroundColor: `${theme.primary}15` }
              ]}
              onPress={() => navigation.navigate('Profile' as never)}
            >
              <Feather name="user" size={24} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Perfil</Text>
            </TouchableOpacity>
            
            {/* Botão de Preferências removido */}
            
            {user?.role === 'admin' && (
              <TouchableOpacity 
                style={[
                  styles.quickActionButton,
                  { backgroundColor: '#E1306C15' }
                ]}
                onPress={() => navigation.navigate('Admin' as never)}
              >
                <Feather name="shield" size={24} color="#E1306C" />
                <Text style={[styles.quickActionText, { color: theme.text }]}>Admin</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[
                styles.quickActionButton,
                { backgroundColor: '#eb4d4b15' }
              ]}
              onPress={signOut}
            >
              <Feather name="log-out" size={24} color="#eb4d4b" />
              <Text style={[styles.quickActionText, { color: theme.text }]}>Sair</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    paddingBottom: 80,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
  },
  headerContent: {
    paddingHorizontal: 20,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  welcomeContainer: {
    marginLeft: 15,
    flex: 1,
  },
  greeting: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  username: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  date: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  wave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    overflow: 'hidden',
  },
  waveShape: {
    position: 'absolute',
    bottom: -10,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  content: {
    flex: 1,
    marginTop: -40,
    zIndex: 10,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 15,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  infoContainer: {
    marginTop: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabelText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    maxWidth: '60%',
    textAlign: 'right',
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickActionButton: {
    width: '48%',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  quickActionText: {
    marginTop: 8,
    fontWeight: '600',
    fontSize: 14,
  },
});