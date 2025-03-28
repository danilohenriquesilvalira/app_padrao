// src/components/Button.tsx
import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  View,
  TouchableOpacityProps,
  Platform
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'success' | 'error';
type ButtonSize = 'small' | 'medium' | 'large';
type IconPosition = 'left' | 'right';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: React.ReactNode;
  size?: ButtonSize;
  rounded?: boolean;
  full?: boolean;
  iconPosition?: IconPosition;
  elevation?: boolean;
  customBorderColor?: string; // Add an optional prop for custom border color
}

export default function Button({ 
  title, 
  onPress, 
  loading, 
  disabled, 
  variant = 'primary',
  icon,
  size = 'medium',
  rounded = false,
  full = false,
  iconPosition = 'left',
  elevation = true,
  customBorderColor,
  style,
  ...rest
}: ButtonProps) {
  const { theme, isDarkMode } = useTheme();
  
  // Get background color based on variant and state
  const getBackgroundColor = () => {
    if (disabled) return theme.disabled;
    
    switch (variant) {
      case 'primary':
        return theme.primary;
      case 'secondary':
        return theme.secondary;
      case 'success':
        return theme.success;
      case 'error':
        return theme.error;
      case 'outline':
      case 'text':
        return 'transparent';
      default:
        return theme.primary;
    }
  };
  
  // Get text color based on variant and state
  const getTextColor = () => {
    if (disabled) return isDarkMode ? theme.textLight : '#fff';
    
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'success':
      case 'error':
        return '#fff';
      case 'outline':
        if (customBorderColor) {
          return customBorderColor;
        }
        return variant === 'outline' ? theme.primary : theme.primary;
      case 'text':
        return theme.primary;
      default:
        return '#fff';
    }
  };
  
  // Get border color based on variant and state
  const getBorderColor = () => {
    if (disabled) return theme.disabled;
    
    if (variant === 'outline') {
      return customBorderColor || theme.primary;
    }
    
    return 'transparent';
  };

  // Get height based on size
  const getHeight = () => {
    switch (size) {
      case 'small':
        return 36;
      case 'large':
        return 56;
      case 'medium':
      default:
        return 48;
    }
  };

  // Get padding based on size
  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: 12 };
      case 'large':
        return { paddingHorizontal: 24 };
      case 'medium':
      default:
        return { paddingHorizontal: 16 };
    }
  };

  // Get font size based on size
  const getFontSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'large':
        return 18;
      case 'medium':
      default:
        return 16;
    }
  };

  // Get border radius based on rounded prop and size
  const getBorderRadius = () => {
    if (rounded) {
      return getHeight() / 2;
    }
    
    return 8;
  };

  // Get shadow style based on variant and elevation prop
  const getShadowStyle = () => {
    if (!elevation || variant === 'text' || variant === 'outline' || disabled) {
      return {};
    }
    
    if (Platform.OS === 'ios') {
      let shadowColor = '#000';
      if (variant === 'primary') shadowColor = theme.primary;
      else if (variant === 'secondary') shadowColor = theme.secondary;
      else if (variant === 'success') shadowColor = theme.success;
      else if (variant === 'error') shadowColor = theme.error;
      
      return {
        shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      };
    } else {
      return {
        elevation: 4,
      };
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
          height: getHeight(),
          borderRadius: getBorderRadius(),
          width: full ? '100%' : 'auto',
        },
        getPadding(),
        getShadowStyle(),
        variant === 'text' && styles.textButton,
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.7}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size={size === 'small' ? 'small' : 'small'} />
      ) : (
        <View style={[
          styles.buttonContent,
          { flexDirection: iconPosition === 'left' ? 'row' : 'row-reverse' }
        ]}>
          {icon && (
            <View style={[
              styles.iconContainer,
              { marginRight: iconPosition === 'left' ? 8 : 0, marginLeft: iconPosition === 'right' ? 8 : 0 }
            ]}>
              {icon}
            </View>
          )}
          <Text 
            style={[
              styles.buttonText, 
              { 
                color: getTextColor(),
                fontSize: getFontSize(),
              }
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  textButton: {
    backgroundColor: 'transparent',
  },
});