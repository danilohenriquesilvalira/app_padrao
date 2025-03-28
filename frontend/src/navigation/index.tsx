import React from 'react';
import { ActivityIndicator, View } from 'react-native';
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

function ProfileStack() {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.primary,
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
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.primary,
        },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen 
        name="UserList" 
        component={UserList} 
        options={{ title: 'Usuários' }}
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
        tabBarInactiveTintColor: theme.disabled,
        tabBarStyle: {
          backgroundColor: isDarkMode ? '#1A1A1A' : '#FFFFFF',
          borderTopColor: theme.border,
        },
        headerStyle: {
          backgroundColor: theme.primary,
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
          options={{ title: 'Admin' }}
        />
      )}
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { signed, loading } = useAuth();
  const { theme, isDarkMode } = useTheme();

  // Criar temas personalizados para o NavigationContainer
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.text,
      border: theme.border,
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
    <NavigationContainer theme={isDarkMode ? customDarkTheme : customLightTheme}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          headerStyle: {
            backgroundColor: theme.primary,
          },
          headerTintColor: '#fff',
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