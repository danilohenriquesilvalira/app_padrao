// src/screens/Admin/PLC/CreatePLCTag.tsx
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
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../../contexts/ThemeContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import plcApi, { PLC } from '../../../services/plcApi';

// Define the navigation param list types
type PLCStackParamList = {
  PLCList: undefined;
  PLCDetails: { plcId: number };
  PLCTags: { plcId: number };
  CreatePLCTag: { plcId: number };
  EditPLCTag: { plcId: number; tagId: number };
};

type CreatePLCTagRouteProp = RouteProp<PLCStackParamList, 'CreatePLCTag'>;
type NavigationProp = StackNavigationProp<PLCStackParamList>;

const CreatePLCTag = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreatePLCTagRouteProp>();
  const { plcId } = route.params;
  
  const [plc, setPlc] = useState<PLC | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPlc, setLoadingPlc] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    db_number: '',
    byte_offset: '',
    bit_offset: '0',  // Campo para o bit offset (0-7)
    data_type: 'bool', // Alterado para bool por padrão para teste
    scan_rate: '1000',
    monitor_changes: true,
    can_write: false,
    active: true,
  });
  
  // Fix error 1: Use Record<string, string> for errors object
  const [errors, setErrors] = useState<Record<string, string>>({
    name: '',
    db_number: '',
    byte_offset: '',
    bit_offset: '',  // Campo para erros de bit offset
    scan_rate: '',
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
    
    loadPlc();
  }, [plcId]);

  const loadPlc = async () => {
    try {
      setLoadingPlc(true);
      const plcData = await plcApi.getPLC(plcId);
      setPlc(plcData);
    } catch (error) {
      console.error('Erro ao carregar detalhes do PLC:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do PLC');
    } finally {
      setLoadingPlc(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // Clear error when user types
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }

    setFormData({ ...formData, [field]: value });
  };

  const validateForm = () => {
    const newErrors = { ...errors };
    let isValid = true;

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
      isValid = false;
    }

    // Validate DB number
    if (!formData.db_number.trim()) {
      newErrors.db_number = 'Número do DB é obrigatório';
      isValid = false;
    } else if (isNaN(parseInt(formData.db_number))) {
      newErrors.db_number = 'Deve ser um número';
      isValid = false;
    }

    // Validate byte offset
    if (!formData.byte_offset.trim()) {
      newErrors.byte_offset = 'Offset de byte é obrigatório';
      isValid = false;
    } else if (isNaN(parseInt(formData.byte_offset))) {
      newErrors.byte_offset = 'Deve ser um número';
      isValid = false;
    }

    // Validar bit offset para tipos booleanos
    if (formData.data_type === 'bool') {
      if (!formData.bit_offset.trim()) {
        newErrors.bit_offset = 'Bit offset é obrigatório';
        isValid = false;
      } else {
        const bitOffset = parseInt(formData.bit_offset);
        if (isNaN(bitOffset)) {
          newErrors.bit_offset = 'Deve ser um número';
          isValid = false;
        } else if (bitOffset < 0 || bitOffset > 7) {
          newErrors.bit_offset = 'Deve estar entre 0 e 7';
          isValid = false;
        }
      }
    }

    // Validate scan rate
    if (!formData.scan_rate.trim()) {
      newErrors.scan_rate = 'Taxa de atualização é obrigatória';
      isValid = false;
    } else if (isNaN(parseInt(formData.scan_rate))) {
      newErrors.scan_rate = 'Deve ser um número';
      isValid = false;
    } else if (parseInt(formData.scan_rate) < 100) {
      newErrors.scan_rate = 'Mínimo de 100ms';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Convert numeric fields
      const tagData = {
        name: formData.name,
        description: formData.description,
        db_number: parseInt(formData.db_number),
        byte_offset: parseInt(formData.byte_offset),
        bit_offset: parseInt(formData.bit_offset),  // Convertido para número
        data_type: formData.data_type,
        scan_rate: parseInt(formData.scan_rate),
        monitor_changes: formData.monitor_changes,
        can_write: formData.can_write,
        active: formData.active,
      };
      
      await plcApi.createTag(plcId, tagData);
      
      Alert.alert(
        'Sucesso',
        'Tag cadastrada com sucesso!',
        [{ 
          text: 'OK', 
          onPress: () => navigation.navigate('PLCTags', { plcId }) 
        }]
      );
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      Alert.alert('Erro', 'Não foi possível cadastrar a tag. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const getDataTypeDescription = (type: string) => {
    switch (type) {
      case 'real': return 'Números de ponto flutuante';
      case 'int': return 'Números inteiros com sinal';
      case 'word': return 'Números inteiros sem sinal';
      case 'bool': return 'Valor lógico (verdadeiro/falso)';
      case 'string': return 'Texto';
      default: return '';
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
            <Feather name="tag" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Adicionar Nova Tag
          </Text>
          {plc && !loadingPlc && (
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              PLC: {plc.name}
            </Text>
          )}
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
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="info" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Informações Básicas
              </Text>
            </View>

            <Input
              label="Nome da Tag"
              icon="tag"
              placeholder="Ex: Temperatura"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              error={errors.name}
              required
            />

            <Input
              label="Descrição"
              icon="file-text"
              placeholder="Ex: Temperatura do tanque principal"
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              style={{ minHeight: 60 }}
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="database" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Endereçamento
              </Text>
            </View>

            <Text style={[styles.pickerLabel, { color: theme.text }]}>
              Tipo de Dados
            </Text>
            <View style={[
              styles.pickerContainer,
              { 
                borderColor: isDarkMode ? theme.border : '#e0e0e0',
                backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9',
              }
            ]}>
              <Picker
                selectedValue={formData.data_type}
                onValueChange={(value) => setFormData({ ...formData, data_type: value })}
                style={[styles.picker, { color: theme.text }]}
                dropdownIconColor={theme.primary}
                mode="dropdown"
              >
                <Picker.Item label="Bool (Booleano)" value="bool" />
                <Picker.Item label="Real (Float)" value="real" />
                <Picker.Item label="Int (Inteiro)" value="int" />
                <Picker.Item label="Word (Sem sinal)" value="word" />
                <Picker.Item label="String (Texto)" value="string" />
              </Picker>
            </View>
            <Text style={[styles.dataTypeDescription, { color: theme.textSecondary }]}>
              {getDataTypeDescription(formData.data_type)}
            </Text>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="DB Number"
                  icon="hash"
                  placeholder="Ex: 1"
                  value={formData.db_number}
                  onChangeText={(text) => handleInputChange('db_number', text)}
                  error={errors.db_number}
                  keyboardType="numeric"
                  required
                />
              </View>

              <View style={styles.halfInput}>
                <Input
                  label="Byte Offset"
                  icon="arrow-right"
                  placeholder="Ex: 0"
                  value={formData.byte_offset}
                  onChangeText={(text) => handleInputChange('byte_offset', text)}
                  error={errors.byte_offset}
                  keyboardType="numeric"
                  required
                />
              </View>
            </View>

            {/* Campo de Bit Offset - SEMPRE VISÍVEL PARA TESTES */}
            <Input
              label="Bit Offset (0-7)"
              icon="git-branch"
              placeholder="Ex: 0"
              value={formData.bit_offset}
              onChangeText={(text) => handleInputChange('bit_offset', text)}
              error={errors.bit_offset}
              keyboardType="numeric"
              helperText="Posição do bit dentro do byte (0-7) para tags booleanas"
              required={formData.data_type === 'bool'}
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Configurações
              </Text>
            </View>

            <Input
              label="Taxa de Atualização (ms)"
              icon="clock"
              placeholder="Ex: 1000"
              value={formData.scan_rate}
              onChangeText={(text) => handleInputChange('scan_rate', text)}
              error={errors.scan_rate}
              keyboardType="numeric"
              helperText="Tempo em milissegundos entre as leituras (mínimo 100ms)"
              required
            />

            <View style={styles.switchesContainer}>
              <View style={[
                styles.switchItem,
                { borderBottomColor: isDarkMode ? theme.border : '#f0f0f0' }
              ]}>
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Monitorar Mudanças
                  </Text>
                  <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                    Registrar apenas quando o valor mudar
                  </Text>
                </View>
                <Switch
                  value={formData.monitor_changes}
                  onValueChange={(value) => setFormData({ ...formData, monitor_changes: value })}
                  trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                  thumbColor={formData.monitor_changes ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                />
              </View>

              <View style={[
                styles.switchItem,
                { borderBottomColor: isDarkMode ? theme.border : '#f0f0f0' }
              ]}>
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Permitir Escrita
                  </Text>
                  <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                    Habilitar escrita de valores nesta tag
                  </Text>
                </View>
                <Switch
                  value={formData.can_write}
                  onValueChange={(value) => setFormData({ ...formData, can_write: value })}
                  trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                  thumbColor={formData.can_write ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchItem}>
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    Ativo
                  </Text>
                  <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                    {formData.active 
                      ? "A tag será monitorada automaticamente" 
                      : "A tag não será monitorada automaticamente"}
                  </Text>
                </View>
                <Switch
                  value={formData.active}
                  onValueChange={(value) => setFormData({ ...formData, active: value })}
                  trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                  thumbColor={formData.active ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>

          <View style={styles.buttonsContainer}>
            <Button
              title="Cancelar"
              variant="outline"
              onPress={() => navigation.goBack()}
              icon={<Feather name="x" size={18} color={theme.primary} />}
            />
            
            <Button
              title="Salvar"
              onPress={handleSubmit}
              loading={loading}
              icon={<Feather name="check" size={18} color="#fff" />}
            />
          </View>
        </Animated.View>

        <View style={styles.helpSection}>
          <TouchableOpacity 
            style={styles.helpButton}
            onPress={() => {
              Alert.alert(
                "Configuração de Tags",
                "Para configurar tags em um PLC Siemens, você precisa conhecer o número do DB (Data Block), o Byte Offset e, para tipos booleanos, o Bit Offset (0-7) da variável. Consulte a documentação do seu PLC para mais detalhes."
              );
            }}
          >
            <Feather name="help-circle" size={16} color={theme.primary} />
            <Text style={[styles.helpText, { color: theme.primary }]}>
              Como configurar tags em um PLC Siemens?
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
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
  formSection: {
    marginBottom: 20,
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
  pickerLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  dataTypeDescription: {
    fontSize: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  switchesContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 16,
  },
  switchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    maxWidth: '80%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  helpSection: {
    marginTop: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  helpText: {
    marginLeft: 6,
    fontSize: 14,
  },
});

export default CreatePLCTag;