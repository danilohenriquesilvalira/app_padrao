// src/components/Input.tsx
import React, { useState } from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Feather.glyphMap;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  helperText?: string;
}

export default function Input({ 
  icon, 
  label, 
  error, 
  style, 
  secureTextEntry,
  helperText,
  ...rest 
}: InputProps) {
  const { theme, isDarkMode } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>
          {label}
        </Text>
      )}
      
      <View style={[
        styles.inputContainer, 
        { 
          borderColor: isFocused ? theme.primary : error ? theme.error : theme.border,
          backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
        },
        error ? styles.inputError : null,
        rest.multiline ? styles.multiline : null,
        style
      ]}>
        {icon && (
          <Feather 
            name={icon} 
            size={20} 
            color={isFocused ? theme.primary : theme.placeholder} 
            style={styles.icon} 
          />
        )}
        
        <TextInput 
          {...rest} 
          style={[
            styles.input, 
            { 
              color: theme.text,
              flex: 1,
            },
            icon ? styles.inputWithIcon : null
          ]} 
          placeholderTextColor={theme.placeholder}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={togglePasswordVisibility} style={styles.passwordToggle}>
            <Feather 
              name={isPasswordVisible ? 'eye-off' : 'eye'} 
              size={20} 
              color={theme.placeholder} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>}
      {helperText && !error && (
        <Text style={[styles.helperText, { color: theme.placeholder }]}>
          {helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    position: 'relative',
  },
  multiline: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  icon: {
    paddingHorizontal: 10,
  },
  input: {
    height: '100%',
    padding: 10,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputError: {
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  passwordToggle: {
    padding: 10,
  }
});