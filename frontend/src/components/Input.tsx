// src/components/Input.tsx
import React from 'react';
import { TextInput, StyleSheet, TextInputProps, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  icon?: keyof typeof Feather.glyphMap;
  label?: string;
  error?: string;
}

export default function Input({ icon, label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer, 
        error ? styles.inputError : null,
        rest.multiline ? styles.multiline : null,
        style
      ]}>
        {icon && (
          <Feather name={icon} size={20} color="#999" style={styles.icon} />
        )}
        
        <TextInput 
          {...rest} 
          style={[styles.input, icon ? styles.inputWithIcon : null]} 
          placeholderTextColor="#999"
        />
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 100,
    alignItems: 'flex-start',
  },
  icon: {
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    padding: 10,
    color: '#333',
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputError: {
    borderColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 4,
  }
});