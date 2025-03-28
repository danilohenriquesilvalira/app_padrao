import React from 'react';
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import Login from '../screens/Login';
import Register from '../screens/Register';
import Home from '../screens/Home';
import Profile from '../screens/Profile';
import Preferences from '../screens/Preferences';
import UserList from '../screens/Admin/UserList';
import EditUser from '../screens/Admin/EditUser';
import CreateUser from '../screens/Admin/CreateUser';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Properly type the HeaderButton props
interface HeaderButtonProps {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label?: string; // Made optional with ?
}

// Custom header button component for better UI
const HeaderButton: React.FC<HeaderButtonProps> = ({ icon, onPress, label }) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity 
      style={styles.headerButton} 
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Feather name={icon} size={20} color="#fff" />
      {label && <Text style={styles.headerButtonText}>{label}</Text>}
    </TouchableOpacity>
  );
};

function ProfileStack() {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: '600' as '600', // Explicitly type as a valid fontWeight value
        },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={Profile} 
        options={{ title: 'Perfil' }} 
      />
      <Stack.Screen 
        name="Preferences" 
        component={Preferences} 
        options={{ title: 'Preferências' }} 
      />
    </Stack.Navigator>
  );
}

function AdminStack() {
  const { theme } = useTheme();
  
  // Unified header style for admin section
  const screenOptions = {
    headerStyle: {
      backgroundColor: theme.primary,
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
    },
    headerTitleStyle: {
      fontWeight: '600' as '600', // Explicitly type as a valid fontWeight value
    },
    headerTintColor: '#fff',
  };
  
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen 
        name="UserList" 
        component={UserList} 
        options={({ navigation }) => ({
          title: 'Usuários',
          headerRight: () => (
            <HeaderButton 
              icon="plus" 
              onPress={() => navigation.navigate('CreateUser')}
              // Label is now optional, so we don't need to provide it
            />
          ),
        })}
      />
      <Stack.Screen 
        name="EditUser" 
        component={EditUser} 
        options={{ title: 'Editar Usuário' }}
      />
      <Stack.Screen 
        name="CreateUser" 
        component={CreateUser} 
        options={{ title: 'Novo Usuário' }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { isAdmin } = useAuth();
  const { theme, isDarkMode } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap = 'home';
          
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Profile') {
            iconName = 'user';
          } else if (route.name === 'Admin') {
            iconName = 'settings';
          }
          
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textLight,
        tabBarStyle: {
          backgroundColor: isDarkMode ? theme.card : '#FFFFFF',
          borderTopColor: theme.border,
          elevation: 0,
          shadowOpacity: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: theme.primary,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          fontWeight: '600' as '600', // Explicitly type as a valid fontWeight value
        },
        headerTintColor: '#fff',
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={Home} 
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        options={{ title: 'Perfil', headerShown: false }}
      />
      {isAdmin && (
        <Tab.Screen 
          name="Admin" 
          component={AdminStack} 
          options={{ title: 'Admin', headerShown: false }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { signed, loading } = useAuth();
  const { theme, isDarkMode } = useTheme();

  // Create custom themes for the NavigationContainer
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
      notification: theme.accent,
    },
  };

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: theme.background 
      }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={customLightTheme}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          headerStyle: {
            backgroundColor: theme.primary,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
          headerTitleStyle: {
            fontWeight: '600' as '600', // Explicitly type as a valid fontWeight value
          },
          headerTintColor: '#fff',
          cardStyle: {
            backgroundColor: theme.background
          }
        }}
      >
        {signed ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen 
              name="Register" 
              component={Register}
              options={{ 
                headerShown: true, 
                title: 'Cadastro',
                headerStyle: {
                  backgroundColor: theme.primary,
                  elevation: 0,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTitleStyle: {
                  fontWeight: '600' as '600', // Explicitly type as a valid fontWeight value
                },
                headerTintColor: '#fff',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  headerButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  }
});