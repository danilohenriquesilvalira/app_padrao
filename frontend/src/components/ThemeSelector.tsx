// src/components/ThemeSelector.tsx
import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
  ActivityIndicator,
  Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, Theme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;
const CARD_HEIGHT = 180;

const ThemeSelector = () => {
  const {
    theme,
    currentThemeName,
    availableThemes,
    changeTheme,
    isChangingTheme,
    fadeAnim,
    isDarkMode,
    toggleDarkMode,
    useSystemTheme,
    setUseSystemTheme
  } = useTheme();
  
  // Animation for scroll indication
  const scrollIndicatorAnim = useRef(new Animated.Value(0)).current;
  
  // Start the scroll indicator animation
  React.useEffect(() => {
    const pulseAnimation = Animated.sequence([
      Animated.timing(scrollIndicatorAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scrollIndicatorAnim, {
        toValue: 0.6,
        duration: 800,
        useNativeDriver: true,
      }),
    ]);
    
    Animated.loop(pulseAnimation).start();
  }, []);

  const renderThemePreview = (themeItem: Theme, index: number) => {
    const isSelected = currentThemeName === themeItem.name;
    const isDark = themeItem.name === 'dark' || 
                  themeItem.name === 'midnight' || 
                  themeItem.name === 'ocean' ||
                  themeItem.background_color.toLowerCase() === '#121212' ||
                  themeItem.background_color.toLowerCase().startsWith('#0');

    return (
      <TouchableOpacity
        key={`theme-preview-${themeItem.id}-${index}`} // Chave única com id e índice
        style={[
          styles.themeCard,
          {
            backgroundColor: themeItem.background_color,
            borderColor: isSelected ? themeItem.accent_color : 'transparent',
          }
        ]}
        onPress={() => !isChangingTheme && changeTheme(themeItem.name)}
        disabled={isChangingTheme || isSelected}
        activeOpacity={0.8}
      >
        <View style={styles.themePreviewContainer}>
          {/* Header */}
          <View style={[styles.previewHeader, { backgroundColor: themeItem.primary_color }]}>
            <View style={styles.previewHeaderContent}>
              <View style={styles.previewTitle} />
            </View>
          </View>
          
          {/* Content */}
          <View style={styles.previewContent}>
            <View style={[styles.previewCard, { backgroundColor: isDark ? '#222' : '#FFFFFF' }]}>
              <View style={styles.previewCardHeader} />
              <View style={styles.previewCardContent}>
                <View style={[styles.previewText, { backgroundColor: themeItem.secondary_color }]} />
                <View style={[styles.previewText, { width: '70%', backgroundColor: themeItem.secondary_color }]} />
              </View>
            </View>
            
            <View style={[styles.previewButton, { backgroundColor: themeItem.secondary_color }]} />
          </View>
        </View>
        
        <View style={[styles.themeInfoContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)' }]}>
          <View>
            <Text style={[styles.themeName, { color: isDark ? '#fff' : themeItem.text_color }]}>
              {themeItem.description || themeItem.name.charAt(0).toUpperCase() + themeItem.name.slice(1)}
            </Text>
          </View>
          
          {isSelected && (
            <View style={[styles.selectedBadge, { backgroundColor: themeItem.accent_color }]}>
              <Feather name="check" size={16} color="#FFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.sectionHeader}>
        <Feather name="droplet" size={22} color={theme.primary} />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Aparência
        </Text>
      </View>
      
      <View style={[styles.optionCard, { backgroundColor: theme.card }]}>
        {/* Dark mode toggle */}
        <View style={[styles.optionRow, { borderBottomColor: theme.divider }]}>
          <View style={styles.optionInfo}>
            <Feather 
              name={isDarkMode ? "moon" : "sun"} 
              size={20} 
              color={theme.primary} 
              style={styles.optionIcon} 
            />
            <View>
              <Text style={[styles.optionText, { color: theme.text }]}>
                Modo Escuro
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                {isDarkMode ? "Aparência escura ativada" : "Aparência clara ativada"}
              </Text>
            </View>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ 
              false: theme.disabled, 
              true: `${theme.primary}90` 
            }}
            thumbColor={isDarkMode ? theme.primary : '#f4f3f4'}
            disabled={useSystemTheme}
          />
        </View>
        
        {/* System theme toggle */}
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Feather 
              name="smartphone" 
              size={20} 
              color={theme.primary} 
              style={styles.optionIcon} 
            />
            <View>
              <Text style={[styles.optionText, { color: theme.text }]}>
                Usar tema do sistema
              </Text>
              <Text style={[styles.optionDescription, { color: theme.textSecondary }]}>
                Seguir as configurações do seu dispositivo
              </Text>
            </View>
          </View>
          <Switch
            value={useSystemTheme}
            onValueChange={setUseSystemTheme}
            trackColor={{ 
              false: theme.disabled, 
              true: `${theme.primary}90` 
            }}
            thumbColor={useSystemTheme ? theme.primary : '#f4f3f4'}
          />
        </View>
      </View>
      
      <View style={styles.themesHeader}>
        <Text style={[styles.themesTitle, { color: theme.text }]}>Temas</Text>
        <Text style={[styles.themesDescription, { color: theme.textSecondary }]}>
          Personalize a aparência do aplicativo
        </Text>
      </View>
      
      {isChangingTheme ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.card }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Aplicando tema...
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.themesScrollContent}
            snapToInterval={CARD_WIDTH + 16}
            decelerationRate="fast"
            style={styles.themesScroll}
          >
            {availableThemes.map((themeOption, index) => renderThemePreview(themeOption, index))}
          </ScrollView>
          
          <View style={styles.hintContainer}>
            <Animated.View style={{ 
              opacity: scrollIndicatorAnim,
              transform: [{ translateX: scrollIndicatorAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-5, 5]
              }) }]
            }}>
              <Feather name="chevrons-right" size={16} color={theme.textSecondary} />
            </Animated.View>
            <Text style={[styles.hintText, { color: theme.textSecondary }]}>
              Deslize para ver mais temas
            </Text>
            <Animated.View style={{ 
              opacity: scrollIndicatorAnim,
              transform: [{ translateX: scrollIndicatorAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [5, -5]
              }) }]
            }}>
              <Feather name="chevrons-left" size={16} color={theme.textSecondary} />
            </Animated.View>
          </View>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  optionCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  themesHeader: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  themesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  themesDescription: {
    fontSize: 14,
  },
  themesScroll: {
    marginVertical: 8,
  },
  themesScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  themeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  themePreviewContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  previewHeader: {
    height: 40,
    padding: 12,
    paddingTop: 16,
  },
  previewHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewTitle: {
    height: 8,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 4,
  },
  previewContent: {
    flex: 1,
    padding: 12,
  },
  previewCard: {
    height: 60,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  previewCardHeader: {
    height: 6,
    width: '40%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 10,
  },
  previewCardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  previewText: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginVertical: 4,
  },
  previewButton: {
    height: 32,
    width: 100,
    borderRadius: 16,
    alignSelf: 'center',
  },
  themeInfoContainer: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  themeName: {
    fontWeight: '600',
    fontSize: 14,
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    height: CARD_HEIGHT,
    marginHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  hintContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 12,
    marginHorizontal: 8,
  },
});

export default ThemeSelector;