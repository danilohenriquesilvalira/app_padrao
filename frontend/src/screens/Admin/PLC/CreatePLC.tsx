// src/screens/Admin/PLC/CreatePLC.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Switch,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../../contexts/ThemeContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import plcApi from '../../../services/plcApi';

// Define the navigation param list types
type PLCStackParamList = {
  PLCList: undefined;
  CreatePLC: undefined;
  EditPLC: { plcId: number };
  // Add other screens as needed
};

type NavigationProp = StackNavigationProp<PLCStackParamList>;

const CreatePLC = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    rack: '0',
    slot: '1',
    is_active: true,
  });
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({
    name: '',
    ip_address: '',
    rack: '',
    slot: '',
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
  }, []);

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

    // Validate IP address - basic validation
    const ipPattern = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/;
    if (!formData.ip_address.trim()) {
      newErrors.ip_address = 'Endereço IP é obrigatório';
      isValid = false;
    } else if (!ipPattern.test(formData.ip_address)) {
      newErrors.ip_address = 'Endereço IP inválido';
      isValid = false;
    }

    // Validate rack and slot are numbers
    if (isNaN(parseInt(formData.rack))) {
      newErrors.rack = 'Rack deve ser um número';
      isValid = false;
    }

    if (isNaN(parseInt(formData.slot))) {
      newErrors.slot = 'Slot deve ser um número';
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
      
      // Convert rack and slot to numbers
      const plcData = {
        ...formData,
        rack: parseInt(formData.rack),
        slot: parseInt(formData.slot),
      };
      
      const id = await plcApi.createPLC(plcData);
      
      Alert.alert(
        'Sucesso',
        'PLC cadastrado com sucesso!',
        [{ 
          text: 'OK', 
          onPress: () => navigation.goBack() 
        }]
      );
    } catch (error) {
      console.error('Erro ao criar PLC:', error);
      Alert.alert('Erro', 'Não foi possível cadastrar o PLC. Tente novamente.');
    } finally {
      setLoading(false);
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
            <Feather name="cpu" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Adicionar Novo PLC
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Configure os detalhes do controlador lógico programável
          </Text>
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
              label="Nome do PLC"
              icon="tag"
              placeholder="Ex: PLC Principal"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              error={errors.name}
              required
            />

            <Input
              label="Endereço IP"
              icon="globe"
              placeholder="Ex: 192.168.1.100"
              value={formData.ip_address}
              onChangeText={(text) => handleInputChange('ip_address', text)}
              error={errors.ip_address}
              required
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Configuração de Conexão
              </Text>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Rack"
                  icon="hard-drive"
                  placeholder="Ex: 0"
                  value={formData.rack}
                  onChangeText={(text) => handleInputChange('rack', text)}
                  error={errors.rack}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.halfInput}>
                <Input
                  label="Slot"
                  icon="server"
                  placeholder="Ex: 1"
                  value={formData.slot}
                  onChangeText={(text) => handleInputChange('slot', text)}
                  error={errors.slot}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.switchContainer}>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>
                  Ativo
                </Text>
                <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                  {formData.is_active 
                    ? "O PLC será monitorado automaticamente" 
                    : "O PLC não será monitorado automaticamente"}
                </Text>
              </View>

              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={formData.is_active ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
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
            // Fix the Type error by typing the navigation properly
            onPress={() => {
              // You can add a help screen navigation here if needed
              // For now, just show an alert
              Alert.alert(
                "Ajuda",
                "Para configurar um PLC Siemens, você precisa fornecer o IP, Rack e Slot corretos. Consulte a documentação do seu PLC para mais detalhes."
              );
            }}
          >
            <Feather name="help-circle" size={16} color={theme.primary} />
            <Text style={[styles.helpText, { color: theme.primary }]}>
              Como configurar um PLC Siemens?
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
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    maxWidth: '90%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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

export default CreatePLC;