// src/components/Input.tsx
import React, { useState, useRef } from 'react';
import { 
  TextInput, 
  StyleSheet, 
  TextInputProps, 
  View, 
  Text, 
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Feather.glyphMap;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  helperText?: string;
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  required?: boolean;
  success?: boolean;
  containerStyle?: any;
}

export default function Input({ 
  icon, 
  label, 
  error, 
  style, 
  secureTextEntry,
  helperText,
  leftComponent,
  rightComponent,
  required = false,
  success = false,
  containerStyle,
  ...rest 
}: InputProps) {
  const { theme, isDarkMode } = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // Get colors
  const getBorderColor = () => {
    if (error) return theme.error;
    if (success) return theme.success;
    return theme.border;
  };

  const getBackgroundColor = () => {
    return isDarkMode ? theme.surface : '#FFFFFF';
  };

  const getIconColor = () => {
    if (error) return theme.error;
    if (success) return theme.success;
    return theme.placeholder;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>
          {label} {required && <Text style={{ color: theme.error }}>*</Text>}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer, 
        { 
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
        },
        error ? styles.inputError : null,
        rest.multiline ? styles.multiline : null,
        style
      ]}>
        {leftComponent && <View style={styles.leftComponent}>{leftComponent}</View>}
        
        {icon && (
          <Feather 
            name={icon} 
            size={20} 
            color={getIconColor()} 
            style={styles.icon} 
          />
        )}
        
        <TextInput 
          {...rest} 
          ref={inputRef}
          style={[
            styles.input, 
            { 
              color: theme.text,
              flex: 1,
            },
            icon || leftComponent ? styles.inputWithIcon : null
          ]} 
          placeholderTextColor={theme.placeholder}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          // Remova qualquer manipulação de foco/blur para simplificar
        />

        {secureTextEntry && (
          <TouchableOpacity 
            onPress={togglePasswordVisibility} 
            style={styles.passwordToggle}
          >
            <Feather 
              name={isPasswordVisible ? 'eye-off' : 'eye'} 
              size={20} 
              color={theme.placeholder} 
            />
          </TouchableOpacity>
        )}
        
        {rightComponent && <View style={styles.rightComponent}>{rightComponent}</View>}
        
        {success && !rightComponent && !secureTextEntry && (
          <Feather name="check-circle" size={20} color={theme.success} style={styles.successIcon} />
        )}
      </View>
      
      {error && (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={14} color={theme.error} style={styles.errorIcon} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
        </View>
      )}
      
      {helperText && !error && (
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  multiline: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingTop: 12,
    paddingBottom: 12,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    height: 50,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputError: {
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 12,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  passwordToggle: {
    padding: 8,
    marginLeft: 4,
  },
  leftComponent: {
    marginRight: 10,
  },
  rightComponent: {
    marginLeft: 10,
  },
  successIcon: {
    marginLeft: 4,
  }
});