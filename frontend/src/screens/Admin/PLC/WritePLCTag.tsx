// src/screens/Admin/PLC/WritePLCTag.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Animated,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import plcApi from '../../../services/plcApi';

interface RouteParams {
  plcId: number;
  tagName: string;
  dataType: string;
}

const WritePLCTag = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { plcId, tagName, dataType } = route.params as RouteParams;
  
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [valueError, setValueError] = useState('');
  const [boolValue, setBoolValue] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // History of values written to this tag (in-memory only)
  const [valueHistory, setValueHistory] = useState<{value: string; timestamp: Date}[]>([]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const validateValue = () => {
    setValueError('');
    
    if (dataType === 'bool') {
      // Boolean values are handled separately with a switch
      return true;
    }
    
    if (!value.trim()) {
      setValueError('Valor é obrigatório');
      return false;
    }
    
    switch (dataType) {
      case 'real':
        if (isNaN(parseFloat(value))) {
          setValueError('Valor deve ser um número');
          return false;
        }
        break;
        
      case 'int':
      case 'word':
        if (isNaN(parseInt(value))) {
          setValueError('Valor deve ser um número inteiro');
          return false;
        }
        break;
        
      case 'string':
        // No specific validation for strings
        break;
        
      default:
        setValueError(`Tipo de dados ${dataType} não suportado`);
        return false;
    }
    
    return true;
  };

  const formatValueForDisplay = (val: any, type: string) => {
    switch (type) {
      case 'bool':
        return val ? 'true' : 'false';
      case 'real':
        return typeof val === 'number' ? val.toFixed(2) : val;
      default:
        return String(val);
    }
  };

  const handleWriteValue = async () => {
    if (!validateValue()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert value based on data type
      let convertedValue: any;
      
      switch (dataType) {
        case 'real':
          convertedValue = parseFloat(value);
          break;
          
        case 'int':
        case 'word':
          convertedValue = parseInt(value);
          break;
          
        case 'bool':
          convertedValue = boolValue;
          break;
          
        case 'string':
          convertedValue = value;
          break;
          
        default:
          throw new Error(`Tipo de dados ${dataType} não suportado`);
      }
      
      await plcApi.writeTagValue(tagName, convertedValue);
      
      // Add to history
      setValueHistory([
        { value: formatValueForDisplay(convertedValue, dataType), timestamp: new Date() },
        ...valueHistory
      ].slice(0, 5)); // Keep only last 5
      
      Alert.alert(
        'Sucesso',
        `Valor escrito com sucesso na tag ${tagName}`,
        [{ text: 'OK' }]
      );
      
      // Clear the value field after successful write
      if (dataType !== 'bool') {
        setValue('');
      }
    } catch (error) {
      console.error('Erro ao escrever valor:', error);
      Alert.alert('Erro', 'Não foi possível escrever o valor na tag. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Get example placeholder based on data type
  const getPlaceholder = () => {
    switch (dataType) {
      case 'real': return 'Ex: 23.5';
      case 'int': return 'Ex: 42';
      case 'word': return 'Ex: 100';
      case 'string': return 'Ex: Motor ligado';
      default: return 'Insira um valor';
    }
  };

  // Get keyboard type based on data type
  const getKeyboardType = () => {
    switch (dataType) {
      case 'real': return 'numeric';
      case 'int':
      case 'word': return 'number-pad';
      default: return 'default';
    }
  };
  
  // Get color for data type
  const getDataTypeColor = () => {
    switch (dataType) {
      case 'real': return '#2196F3';
      case 'int': return '#4CAF50';
      case 'word': return '#FF9800';
      case 'bool': return '#9C27B0';
      case 'string': return '#795548';
      default: return '#9E9E9E';
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.headerIconContainer}>
            <Feather name="edit-3" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Escrever Valor
          </Text>
          <View style={styles.tagInfoContainer}>
            <Text style={[styles.tagName, { color: theme.text }]}>
              {tagName}
            </Text>
            <View style={[
              styles.dataTypeBadge,
              { backgroundColor: getDataTypeColor() }
            ]}>
              <Text style={styles.dataTypeText}>
                {dataType.toUpperCase()}
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.formCard,
            {
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="edit-2" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Valor para Escrita
            </Text>
          </View>
          
          {dataType === 'bool' ? (
            <View style={styles.boolContainer}>
              <Text style={[styles.boolLabel, { color: theme.text }]}>
                Valor Booleano:
              </Text>
              <View style={styles.boolSwitchContainer}>
                <Text style={[
                  styles.boolValueText, 
                  { color: boolValue ? theme.success : theme.error }
                ]}>
                  {boolValue ? 'TRUE' : 'FALSE'}
                </Text>
                <Switch
                  value={boolValue}
                  onValueChange={setBoolValue}
                  trackColor={{ 
                    false: isDarkMode ? '#555' : theme.error + '40', 
                    true: theme.success + '40' 
                  }}
                  thumbColor={boolValue ? theme.success : theme.error}
                  style={styles.boolSwitch}
                />
              </View>
            </View>
          ) : (
            <Input
              label={`Valor (${dataType.toUpperCase()})`}
              icon="edit-2"
              placeholder={getPlaceholder()}
              value={value}
              onChangeText={setValue}
              error={valueError}
              keyboardType={getKeyboardType()}
              helperText={`Insira um valor do tipo ${dataType}`}
              required
            />
          )}
          
          <View style={styles.warningContainer}>
            <Feather name="alert-triangle" size={18} color={theme.warning} />
            <Text style={[styles.warningText, { color: theme.warning }]}>
              Atenção: Esta ação escreverá diretamente no PLC e pode impactar processos em execução.
            </Text>
          </View>
          
          <Button
            title="Escrever Valor"
            onPress={handleWriteValue}
            loading={loading}
            icon={<Feather name="send" size={18} color="#fff" />}
            full
            style={styles.writeButton}
          />
        </Animated.View>
        
        {/* History section */}
        {valueHistory.length > 0 && (
          <Animated.View
            style={[
              styles.historyCard,
              {
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0',
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Histórico de Valores
              </Text>
            </View>
            
            {valueHistory.map((item, index) => (
              <View 
                key={index}
                style={[
                  styles.historyItem,
                  index < valueHistory.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: isDarkMode ? theme.border : '#f0f0f0'
                  }
                ]}
              >
                <View style={styles.historyValue}>
                  <Feather 
                    name="check-circle" 
                    size={16} 
                    color={theme.success} 
                    style={styles.historyIcon} 
                  />
                  <Text style={[styles.historyValueText, { color: theme.text }]}>
                    {item.value}
                  </Text>
                </View>
                <Text style={[styles.historyTime, { color: theme.textSecondary }]}>
                  {formatTime(item.timestamp)}
                </Text>
              </View>
            ))}
          </Animated.View>
        )}
        
        <View style={styles.buttonsContainer}>
          <Button
            title="Retornar às Tags"
            variant="outline"
            onPress={() => navigation.navigate('PLCTags', { plcId })}
            icon={<Feather name="arrow-left" size={18} color={theme.primary} />}
            full
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Helper to format time
const formatTime = (date: Date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagInfoContainer: {
    alignItems: 'center',
  },
  tagName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  dataTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  dataTypeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  formCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  boolContainer: {
    marginBottom: 20,
  },
  boolLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  boolSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  boolValueText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  boolSwitch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'flex-start',
  },
  warningText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  writeButton: {
    marginTop: 8,
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    marginRight: 8,
  },
  historyValueText: {
    fontSize: 16,
    fontWeight: '500',
  },
  historyTime: {
    fontSize: 14,
  },
  buttonsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
});

export default WritePLCTag;