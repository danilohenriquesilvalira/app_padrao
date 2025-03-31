// src/screens/Admin/PLC/EditPLCTag.tsx
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
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, StackActions } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import plcApi, { PLC, PLCTag } from '../../../services/plcApi';

interface RouteParams {
  plcId: number;
  tagId: number;
}

const EditPLCTag = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { plcId, tagId } = route.params as RouteParams;
  
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [tag, setTag] = useState<PLCTag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    db_number: '',
    byte_offset: '',
    bit_offset: '0',  // Campo para o bit offset (0-7)
    data_type: 'bool',  // Alterado para bool por padrão para teste
    scan_rate: '',
    monitor_changes: true,
    can_write: true,
    active: true,
  });
  
  // Validation state
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
    
    loadTag();
  }, [tagId]);

  const loadTag = async () => {
    try {
      setInitialLoad(true);
      const tagData = await plcApi.getTagById(tagId);
      setTag(tagData);
      
      // Set form data from tag
      setFormData({
        name: tagData.name || '',
        description: tagData.description || '',
        db_number: tagData.db_number.toString() || '',
        byte_offset: tagData.byte_offset.toString() || '',
        bit_offset: tagData.bit_offset.toString() || '0',  // Campo bit offset
        data_type: tagData.data_type || 'bool',  // Alterado para bool por padrão para teste
        scan_rate: tagData.scan_rate.toString() || '',
        monitor_changes: tagData.monitor_changes,
        can_write: tagData.can_write,
        active: tagData.active,
      });

      console.log("Tag carregada:", tagData);
      console.log("Bit offset:", tagData.bit_offset);
    } catch (error) {
      console.error('Erro ao carregar detalhes da tag:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes da tag');
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

    // Type-safe update of the form data
    setFormData(prev => {
      // Create a new object with the updated field
      const updated = { ...prev };
      
      // Explicitly set the field with proper typing
      switch(field) {
        case 'name':
          updated.name = value;
          break;
        case 'description':
          updated.description = value;
          break;
        case 'db_number':
          updated.db_number = value;
          break;
        case 'byte_offset':
          updated.byte_offset = value;
          break;
        case 'bit_offset':
          updated.bit_offset = value;
          break;
        case 'data_type':
          updated.data_type = value;
          break;
        case 'scan_rate':
          updated.scan_rate = value;
          break;
      }
      
      return updated;
    });
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
      newErrors.db_number = 'Número do DB deve ser um número inteiro';
      isValid = false;
    }

    // Validate byte offset
    if (!formData.byte_offset.trim()) {
      newErrors.byte_offset = 'Byte offset é obrigatório';
      isValid = false;
    } else if (isNaN(parseInt(formData.byte_offset))) {
      newErrors.byte_offset = 'Byte offset deve ser um número inteiro';
      isValid = false;
    }

    // Validate bit offset for boolean type
    if (formData.data_type === 'bool') {
      if (!formData.bit_offset.trim()) {
        newErrors.bit_offset = 'Bit offset é obrigatório';
        isValid = false;
      } else {
        const bitOffset = parseInt(formData.bit_offset);
        if (isNaN(bitOffset)) {
          newErrors.bit_offset = 'Bit offset deve ser um número';
          isValid = false;
        } else if (bitOffset < 0 || bitOffset > 7) {
          newErrors.bit_offset = 'Bit offset deve estar entre 0 e 7';
          isValid = false;
        }
      }
    }

    // Validate scan rate
    if (!formData.scan_rate.trim()) {
      newErrors.scan_rate = 'Taxa de scan é obrigatória';
      isValid = false;
    } else if (isNaN(parseInt(formData.scan_rate))) {
      newErrors.scan_rate = 'Taxa de scan deve ser um número inteiro';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const hasChanges = () => {
    if (!tag) return false;
    
    return (
      formData.name !== tag.name ||
      formData.description !== tag.description ||
      parseInt(formData.db_number) !== tag.db_number ||
      parseInt(formData.byte_offset) !== tag.byte_offset ||
      parseInt(formData.bit_offset) !== tag.bit_offset ||  // Verificar mudanças no bit offset
      formData.data_type !== tag.data_type ||
      parseInt(formData.scan_rate) !== tag.scan_rate ||
      formData.monitor_changes !== tag.monitor_changes ||
      formData.can_write !== tag.can_write ||
      formData.active !== tag.active
    );
  };

  const handleSubmit = async () => {
    if (!validateForm() || !tag) {
      return;
    }

    try {
      setLoading(true);
      
      // Create updated tag object
      const tagData: PLCTag = {
        ...tag,
        name: formData.name,
        description: formData.description,
        db_number: parseInt(formData.db_number),
        byte_offset: parseInt(formData.byte_offset),
        bit_offset: parseInt(formData.bit_offset),  // Incluir bit offset
        data_type: formData.data_type,
        scan_rate: parseInt(formData.scan_rate),
        monitor_changes: formData.monitor_changes,
        can_write: formData.can_write,
        active: formData.active,
      };
      
      await plcApi.updateTag(tagData);
      
      Alert.alert(
        'Sucesso',
        'Tag atualizada com sucesso!',
        [{ 
          text: 'OK', 
          onPress: () => navigation.goBack() 
        }]
      );
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a tag. Tente novamente.');
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
          Carregando dados da tag...
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
            <Feather name="tag" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Editar Tag
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Atualize as configurações da tag de monitoramento
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
              label="Nome da Tag"
              icon="tag"
              placeholder="Ex: Motor_Velocidade"
              value={formData.name}
              onChangeText={(text) => handleInputChange('name', text)}
              error={errors.name}
              required
            />

            <Input
              label="Descrição"
              icon="file-text"
              placeholder="Ex: Velocidade do motor principal"
              value={formData.description}
              onChangeText={(text) => handleInputChange('description', text)}
              multiline
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="database" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Endereçamento
              </Text>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Input
                  label="Número do DB"
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
                  icon="move"
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

            <View style={styles.formRow}>
              <Text style={[styles.pickerLabel, { color: theme.text }]}>
                Tipo de Dados
              </Text>
              <View style={[
                styles.dataTypePicker, 
                { 
                  borderColor: isDarkMode ? theme.border : '#e0e0e0',
                  backgroundColor: isDarkMode ? theme.surfaceVariant : '#f5f5f5',
                }
              ]}>
                {['bool', 'real', 'int', 'word', 'string'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.dataTypeOption,
                      formData.data_type === type && styles.dataTypeSelected,
                      formData.data_type === type && { backgroundColor: theme.primary }
                    ]}
                    onPress={() => {
                      // Resetar bit_offset para 0 se mudar de bool para outro tipo
                      if (formData.data_type === 'bool' && type !== 'bool') {
                        setFormData({...formData, data_type: type, bit_offset: '0'});
                      } else {
                        setFormData({...formData, data_type: type});
                      }
                    }}
                  >
                    <Text 
                      style={[
                        styles.dataTypeText,
                        formData.data_type === type && styles.dataTypeTextSelected
                      ]}
                    >
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <Input
              label="Taxa de Scan (ms)"
              icon="clock"
              placeholder="Ex: 1000"
              value={formData.scan_rate}
              onChangeText={(text) => handleInputChange('scan_rate', text)}
              error={errors.scan_rate}
              keyboardType="numeric"
              helperText="Intervalo em milissegundos para leitura da tag"
              required
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="settings" size={20} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Configurações Adicionais
              </Text>
            </View>

            <View style={styles.switchContainer}>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>
                  Monitorar Mudanças
                </Text>
                <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                  {formData.monitor_changes 
                    ? "Registrar alterações de valor" 
                    : "Não registrar alterações de valor"}
                </Text>
              </View>

              <Switch
                value={formData.monitor_changes}
                onValueChange={(value) => setFormData({...formData, monitor_changes: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={formData.monitor_changes ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
            </View>

            <View style={styles.switchContainer}>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>
                  Permitir Escrita
                </Text>
                <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                  {formData.can_write 
                    ? "Permite escrever valores nesta tag" 
                    : "Esta tag é somente leitura"}
                </Text>
              </View>

              <Switch
                value={formData.can_write}
                onValueChange={(value) => setFormData({...formData, can_write: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={formData.can_write ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              />
            </View>

            <View style={styles.switchContainer}>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>
                  Tag Ativa
                </Text>
                <Text style={[styles.switchDescription, { color: theme.textSecondary }]}>
                  {formData.active 
                    ? "Esta tag está sendo monitorada" 
                    : "Esta tag não está sendo monitorada"}
                </Text>
              </View>

              <Switch
                value={formData.active}
                onValueChange={(value) => setFormData({...formData, active: value})}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={formData.active ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
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

        {/* Delete button at bottom */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
        >
          <Button
            title="Excluir Tag"
            variant="error"
            onPress={() => {
              Alert.alert(
                'Confirmar exclusão',
                'Você tem certeza que deseja excluir esta tag? Esta ação não pode ser desfeita.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { 
                    text: 'Excluir', 
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await plcApi.deleteTag(tagId);
                        Alert.alert('Sucesso', 'Tag excluída com sucesso!');
                        // Use dispatch instead of navigate for more predictable navigation
                        navigation.dispatch(StackActions.replace('PLCTags', { plcId }));
                      } catch (error) {
                        console.error('Erro ao excluir tag:', error);
                        Alert.alert('Erro', 'Não foi possível excluir a tag.');
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
  formRow: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  dataTypePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  dataTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  dataTypeSelected: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dataTypeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dataTypeTextSelected: {
    color: '#fff',
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
    marginBottom: 16,
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
  deleteButton: {
    marginTop: 8,
  },
});

export default EditPLCTag;