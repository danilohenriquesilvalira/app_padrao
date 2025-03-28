// src/navigation/index.tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import Login from '../screens/Login';
import Register from '../screens/Register';
import Home from '../screens/Home';
import { useAuth } from '../contexts/AuthContext';

const Stack = createStackNavigator();

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
      <Stack.Navigator>
        {signed ? (
          <Stack.Screen 
            name="Home" 
            component={Home} 
            options={{ 
              title: 'Início',
              headerLeft: () => null,
            }}
          />
        ) : (
          <>
            <Stack.Screen 
              name="Login" 
              component={Login}
              options={{ headerShown: false }}
            />
            <Stack.Screen 
              name="Register" 
              component={Register}
              options={{ title: 'Cadastro' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}