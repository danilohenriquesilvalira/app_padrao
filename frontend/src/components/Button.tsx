// src/components/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  icon?: React.ReactNode;
};

export default function Button({ 
  title, 
  onPress, 
  loading, 
  disabled, 
  variant = 'primary',
  icon
}: ButtonProps) {
  const { theme } = useTheme();
  
  // Estilos baseados no tema e na variante
  const getBackgroundColor = () => {
    if (disabled) return theme.disabled;
    
    switch (variant) {
      case 'primary':
        return theme.primary;
      case 'secondary':
        return theme.secondary;
      case 'outline':
      case 'text':
        return 'transparent';
      default:
        return theme.primary;
    }
  };
  
  const getTextColor = () => {
    if (disabled) return '#fff';
    
    switch (variant) {
      case 'primary':
      case 'secondary':
        return '#fff';
      case 'outline':
        return theme.primary;
      case 'text':
        return theme.primary;
      default:
        return '#fff';
    }
  };
  
  const getBorderColor = () => {
    if (disabled) return theme.disabled;
    
    switch (variant) {
      case 'outline':
        return theme.primary;
      default:
        return 'transparent';
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.button,
        { 
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 2 : 0,
        },
        variant === 'text' && styles.textButton,
        disabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text 
            style={[
              styles.buttonText, 
              { color: getTextColor() },
              // Corrigido: o erro estava aqui, verificando se icon existe antes de aplicar o estilo
              icon ? styles.buttonTextWithIcon : null
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  buttonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonTextWithIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.7,
  },
  textButton: {
    backgroundColor: 'transparent',
    height: 40,
  },
});