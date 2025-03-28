import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme, Theme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_HEIGHT = 180;

const ThemeSelector: React.FC = () => {
  const {
    theme,
    currentThemeName,
    availableThemes,
    changeTheme,
    isChangingTheme,
    fadeAnim
  } = useTheme();

  const renderThemePreview = (themeItem: Theme) => {
    const isSelected = currentThemeName === themeItem.name;
    const isDark = themeItem.name === 'dark' || 
                  themeItem.name === 'midnight' || 
                  themeItem.background_color.toLowerCase() === '#121212' ||
                  themeItem.background_color.toLowerCase().startsWith('#0');

    return (
      <TouchableOpacity
        key={themeItem.id}
        style={[
          styles.themeCard,
          {
            backgroundColor: themeItem.background_color,
            borderColor: isSelected ? themeItem.accent_color : 'transparent',
          }
        ]}
        onPress={() => !isChangingTheme && changeTheme(themeItem.name)}
        disabled={isChangingTheme || isSelected}
      >
        <View style={styles.themePreviewContainer}>
          {/* Cabeçalho simulado */}
          <View style={[styles.previewHeader, { backgroundColor: themeItem.primary_color }]}>
            <View style={styles.previewStatusBar} />
            <View style={styles.previewHeaderContent}>
              <View style={styles.previewIcon} />
              <View style={styles.previewTitle} />
            </View>
          </View>
          
          {/* Conteúdo simulado */}
          <View style={styles.previewContent}>
            <View style={[styles.previewCard, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' }]}>
              <View style={styles.previewCardHeader} />
              <View style={styles.previewCardContent}>
                <View style={styles.previewText} />
                <View style={styles.previewText} />
              </View>
            </View>
            
            <View style={styles.previewButton}>
              <View style={[styles.previewButtonInner, { backgroundColor: themeItem.secondary_color }]} />
            </View>
          </View>
        </View>
        
        <View style={styles.themeInfoContainer}>
          <View>
            <Text style={[styles.themeName, { color: themeItem.text_color }]}>
              {themeItem.name.charAt(0).toUpperCase() + themeItem.name.slice(1)}
            </Text>
            <Text style={[styles.themeDescription, { color: isDark ? '#BBBBBB' : '#757575' }]} numberOfLines={1}>
              {themeItem.description || `Tema ${themeItem.name}`}
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
        <Feather name="droplet" size={20} color={theme.primary} />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Temas
        </Text>
      </View>
      
      <Text style={[styles.description, { color: theme.textSecondary }]}>
        Personalize a aparência do aplicativo escolhendo um tema que combine com seu estilo
      </Text>
      
      {isChangingTheme && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Aplicando tema...
          </Text>
        </View>
      )}
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.themesScrollContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        style={styles.themesScroll}
      >
        {availableThemes.map(renderThemePreview)}
      </ScrollView>
      
      <View style={styles.hintContainer}>
        <Feather name="info" size={16} color={theme.textSecondary} style={styles.hintIcon} />
        <Text style={[styles.hintText, { color: theme.textSecondary }]}>
          Deslize para ver mais temas
        </Text>
      </View>
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
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 20,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  themesScroll: {
    marginVertical: 8,
  },
  themesScrollContent: {
    paddingHorizontal: 16,
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
    height: 50,
    padding: 8,
    paddingTop: 16,
  },
  previewStatusBar: {
    height: 4,
    width: '70%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 6,
  },
  previewHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 8,
  },
  previewTitle: {
    height: 8,
    width: 80,
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    marginBottom: 8,
  },
  previewCardHeader: {
    height: 6,
    width: '40%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 6,
  },
  previewCardContent: {
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  previewText: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginVertical: 4,
  },
  previewButton: {
    height: 20,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewButtonInner: {
    height: 10,
    width: 40,
    borderRadius: 5,
  },
  themeInfoContainer: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  themeDescription: {
    fontSize: 12,
    marginTop: 2,
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
    justifyContent: 'center',
    alignItems: 'center',
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
  hintIcon: {
    marginRight: 6,
  },
  hintText: {
    fontSize: 12,
  },
});

export default ThemeSelector;