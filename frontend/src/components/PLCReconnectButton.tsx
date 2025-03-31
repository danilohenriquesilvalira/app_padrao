// src/components/PLCReconnectButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import plcApi from '../services/plcApi';

interface PLCReconnectButtonProps {
  plcId: number;
  size?: 'small' | 'medium' | 'large';
  onReconnectSuccess?: () => void;
  style?: any;
}

const PLCReconnectButton: React.FC<PLCReconnectButtonProps> = ({ 
  plcId, 
  size = 'medium',
  onReconnectSuccess,
  style 
}) => {
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleReconnect = async () => {
    try {
      setLoading(true);
      await plcApi.resetPLCConnection(plcId);
      Alert.alert('Sucesso', 'Solicitação de reconexão enviada com sucesso');
      
      if (onReconnectSuccess) {
        onReconnectSuccess();
      }
    } catch (error) {
      console.error(`Erro ao resetar conexão do PLC ${plcId}:`, error);
      Alert.alert('Erro', 'Não foi possível resetar a conexão');
    } finally {
      setLoading(false);
    }
  };

  // Size styles
  const buttonSize = {
    small: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      iconSize: 14,
      fontSize: 12,
    },
    medium: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      iconSize: 16,
      fontSize: 14,
    },
    large: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      iconSize: 18,
      fontSize: 16,
    }
  }[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          backgroundColor: `${theme.primary}15`,
          borderColor: theme.primary,
          paddingHorizontal: buttonSize.paddingHorizontal,
          paddingVertical: buttonSize.paddingVertical,
        },
        style
      ]}
      onPress={handleReconnect}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : (
        <>
          <Feather 
            name="refresh-cw" 
            size={buttonSize.iconSize} 
            color={theme.primary} 
            style={styles.icon} 
          />
          <Text style={[styles.text, { color: theme.primary, fontSize: buttonSize.fontSize }]}>
            Reconectar
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '500',
  }
});

export default PLCReconnectButton;