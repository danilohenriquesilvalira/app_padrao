// src/components/Input.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  TextInput, 
  StyleSheet, 
  TextInputProps, 
  View, 
  Text, 
  TouchableOpacity,
  Animated,
  Platform
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
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFilled, setIsFilled] = useState(false);
  
  // Animation values
  const labelAnim = useRef(new Animated.Value(0)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;
  
  // Check if input has content
  useEffect(() => {
    setIsFilled(!!rest.value);
  }, [rest.value]);

  // Handle focus animations
  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused || isFilled ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    
    if (label) {
      Animated.timing(labelAnim, {
        toValue: isFocused || isFilled ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused, isFilled]);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // Get border colors for different states
  const getBorderColor = () => {
    if (error) return theme.error;
    if (success) return theme.success;
    if (isFocused) return theme.primary;
    return theme.border;
  };

  // Get background color
  const getBackgroundColor = () => {
    if (isDarkMode) {
      return isFocused ? theme.surfaceVariant : theme.surface;
    }
    return isFocused ? '#F9FAFB' : '#FFFFFF';
  };

  // Get icon color
  const getIconColor = () => {
    if (error) return theme.error;
    if (success) return theme.success;
    if (isFocused) return theme.primary;
    return theme.placeholder;
  };

  // Get animated label style
  const getLabelStyle = () => {
    if (!label) return {};
    
    const top = labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['50%', '-25%'],
    });
    
    const fontSize = labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [14, 12],
    });
    
    const color = labelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.placeholder, error ? theme.error : success ? theme.success : theme.primary],
    });
    
    return {
      top,
      fontSize,
      color,
      backgroundColor: theme.background,
      paddingHorizontal: 4,
    };
  };

  return (
    <View style={[
      styles.container,
      containerStyle
    ]}>
      {label && (
        <Animated.Text 
          style={[
            styles.label,
            getLabelStyle()
          ]}
        >
          {label} {required && <Text style={{ color: theme.error }}>*</Text>}
        </Animated.Text>
      )}
      
      <View style={[
        styles.inputContainer, 
        { 
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
        },
        error ? styles.inputError : null,
        success ? styles.inputSuccess : null,
        rest.multiline ? styles.multiline : null,
        // Apply elevated styles if focused
        isFocused && Platform.OS === 'ios' && {
          shadowColor: error ? theme.error : success ? theme.success : theme.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        isFocused && Platform.OS === 'android' && {
          elevation: 2,
        },
        style
      ]}>
        {leftComponent && (
          <View style={styles.leftComponent}>
            {leftComponent}
          </View>
        )}
        
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
          onFocus={(e) => {
            setIsFocused(true);
            if (rest.onFocus) rest.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (rest.onBlur) rest.onBlur(e);
          }}
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
        
        {rightComponent && (
          <View style={styles.rightComponent}>
            {rightComponent}
          </View>
        )}
        
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
    position: 'absolute',
    left: 12,
    zIndex: 1,
    paddingHorizontal: 4,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    position: 'relative',
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
    height: '100%',
    padding: 10,
    paddingHorizontal: 0,
    fontSize: 16,
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  inputError: {
    borderWidth: 1,
  },
  inputSuccess: {
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