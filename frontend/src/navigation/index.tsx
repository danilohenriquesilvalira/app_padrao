// src/navigation/index.tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Login from '../screens/Login';
import Register from '../screens/Register';
import Home from '../screens/Home';
import Profile from '../screens/Profile';
import UserList from '../screens/Admin/UserList';
import EditUser from '../screens/Admin/EditUser';
import CreateUser from '../screens/Admin/CreateUser';
import { useAuth } from '../contexts/AuthContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AdminStack() {
  return (
    <Stack.Navigator>
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
  
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Home" 
        component={Home} 
        options={{ title: 'Início' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={Profile} 
        options={{ title: 'Perfil' }}
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {signed ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen 
              name="Register" 
              component={Register}
              options={{ headerShown: true, title: 'Cadastro' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}