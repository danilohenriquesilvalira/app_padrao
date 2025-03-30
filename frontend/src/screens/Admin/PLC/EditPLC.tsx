// src/screens/Admin/PLC/EditPLC.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import plcApi, { PLC } from '../../../services/plcApi';

interface RouteParams {
  plcId: number;
}

const EditPLC = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { plcId } = route.params as RouteParams;
  
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    rack: '',
    slot: '',
    is_active: true,
  });
  
  // Keep original data to detect changes
  const [originalData, setOriginalData] = useState<PLC | null>(null);
  
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
    
    loadPlc();
  }, [plcId]);

  const loadPlc = async () => {
    try {
      setInitialLoad(true);
      const plcData = await plcApi.getPLC(plcId);
      setFormData({
        name: plcData.name,
        ip_address: plcData.ip_address,
        rack: plcData.rack.toString(),
        slot: plcData.slot.toString(),
        is_active: plcData.is_active,
      });
      setOriginalData(plcData);
    } catch (error) {
      console.error('Erro ao carregar detalhes do PLC:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do PLC');
      navigation.goBack();
    } finally {
      setInitialLoad(false);
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

  const hasChanges = () => {
    if (!originalData) return false;
    
    return (
      formData.name !== originalData.name ||
      formData.ip_address !== originalData.ip_address ||
      parseInt(formData.rack) !== originalData.rack ||
      parseInt(formData.slot) !== originalData.slot ||
      formData.is_active !== originalData.is_active
    );
  };

  const handleSubmit = async () => {
    if (!validateForm() || !originalData) {
      return;
    }

    try {
      setLoading(true);
      
      // Create updated PLC object preserving existing fields
      const plcData: PLC = {
        ...originalData,
        name: formData.name,
        ip_address: formData.ip_address,
        rack: parseInt(formData.rack),
        slot: parseInt(formData.slot),
        is_active: formData.is_active,
      };
      
      await plcApi.updatePLC(plcData);
      
      Alert.alert(
        'Sucesso',
        'PLC atualizado com sucesso!',
        [{ 
          text: 'OK', 
          onPress: () => navigation.goBack() 
        }]
      );
    } catch (error) {
      console.error('Erro ao atualizar PLC:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o PLC. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDiscard = () => {
    if (hasChanges()) {
      Alert.alert(
        'Descartar alterações',
        'Você tem alterações não salvas. Deseja realmente sair?',
        [
          { text: 'Continuar editando', style: 'cancel' },
          { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  if (initialLoad) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando dados do PLC...
        </Text>
      </View>
    );
  }

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
            Editar PLC
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Atualize as configurações do controlador lógico programável
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
              onPress={confirmDiscard}
              icon={<Feather name="x" size={18} color={theme.primary} />}
            />
            
            <Button
              title="Salvar"
              onPress={handleSubmit}
              loading={loading}
              disabled={!hasChanges()}
              icon={<Feather name="check" size={18} color="#fff" />}
            />
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
        >
          <Button
            title="Gerenciar Tags"
            onPress={() => (navigation as any).navigate('PLCTags', { plcId })}
            icon={<Feather name="tag" size={18} color="#fff" />}
            full
            style={styles.manageTags}
          />
        </Animated.View>

        {/* Delete button at bottom */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
        >
          <Button
            title="Excluir PLC"
            variant="error"
            onPress={() => {
              Alert.alert(
                'Confirmar exclusão',
                'Você tem certeza que deseja excluir este PLC? Esta ação não pode ser desfeita.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Excluir', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await plcApi.deletePLC(plcId);
                        Alert.alert('Sucesso', 'PLC excluído com sucesso!');
                        navigation.navigate('PLCList' as never);
                      } catch (error) {
                        console.error('Erro ao excluir PLC:', error);
                        Alert.alert('Erro', 'Não foi possível excluir o PLC.');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }
                ]
              );
            }}
            icon={<Feather name="trash-2" size={18} color="#fff" />}
            full
            style={styles.deleteButton}
          />
        </Animated.View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
    paddingHorizontal: 16,
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
  manageTags: {
    marginTop: 8,
    marginBottom: 24,
  },
  deleteButton: {
    marginTop: 8,
  },
});

export default EditPLC;