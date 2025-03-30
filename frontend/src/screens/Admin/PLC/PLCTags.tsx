// src/screens/Admin/PLC/PLCTags.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import EmptyListSvg from '../../../components/EmptyListSvg';
import plcApi, { PLC, PLCTag } from '../../../services/plcApi';

interface RouteParams {
  plcId: number;
}

const PLCTags = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { plcId } = route.params as RouteParams;
  
  const [plc, setPlc] = useState<PLC | null>(null);
  const [tags, setTags] = useState<PLCTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<PLCTag | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const tagAnimatedValues = useRef<{[key: number]: Animated.Value}>({}).current;

  const ensureTagAnimation = (id: number) => {
    if (!tagAnimatedValues[id]) {
      tagAnimatedValues[id] = new Animated.Value(0);
    }
    return tagAnimatedValues[id];
  };

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
    
    loadData();
  }, [plcId]);

  // Animate items as they enter
  useEffect(() => {
    tags.forEach((tag, index) => {
      const delay = index * 100;
      Animated.timing(ensureTagAnimation(tag.id), {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }).start();
    });
  }, [tags]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load PLC details
      const plcData = await plcApi.getPLC(plcId);
      setPlc(plcData);
      
      // Load PLC tags
      const tagsData = await plcApi.getPLCTags(plcId);
      setTags(tagsData);
    } catch (error) {
      console.error('Erro ao carregar tags do PLC:', error);
      Alert.alert('Erro', 'Não foi possível carregar as tags do PLC');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteTag = (tag: PLCTag) => {
    setSelectedTag(tag);
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir a tag "${tag.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await plcApi.deleteTag(tag.id);
              setTags(tags.filter(t => t.id !== tag.id));
              Alert.alert('Sucesso', 'Tag excluída com sucesso!');
            } catch (error) {
              console.error('Erro ao excluir tag:', error);
              Alert.alert('Erro', 'Não foi possível excluir a tag');
            } finally {
              setLoading(false);
              setSelectedTag(null);
            }
          }
        }
      ]
    );
  };

  const toggleTagActive = async (tag: PLCTag) => {
    try {
      const updatedTag = { 
        ...tag, 
        active: !tag.active 
      };
      
      // Update UI first for better UX
      setTags(tags.map(t => t.id === tag.id ? updatedTag : t));
      
      // Then update in the backend
      await plcApi.updateTag(updatedTag);
    } catch (error) {
      // Revert change if error
      setTags(tags.map(t => t.id === tag.id ? tag : t));
      Alert.alert('Erro', 'Não foi possível alterar o status da tag');
    }
  };

  const renderItem = ({ item }: { item: PLCTag }) => {
    const animValue = ensureTagAnimation(item.id);
    
    return (
      <Animated.View
        style={[
          {
            opacity: animValue,
            transform: [
              { 
                translateY: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0]
                })
              }
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tagCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0'
            }
          ]}
          onPress={() => navigation.navigate('EditPLCTag', { 
            plcId,
            tagId: item.id 
          })}
          activeOpacity={0.7}
        >
          <View style={styles.tagHeader}>
            <View style={styles.tagTitleContainer}>
              <View style={[
                styles.dataTypeIndicator, 
                { backgroundColor: getDataTypeColor(item.data_type) }
              ]}>
                <Text style={styles.dataTypeText}>
                  {item.data_type.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.tagName, { color: theme.text }]}>
                {item.name}
              </Text>
            </View>
            
            <Switch
              value={item.active}
              onValueChange={() => toggleTagActive(item)}
              trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
              thumbColor={item.active ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              style={styles.switch}
            />
          </View>
          
          <Text 
            style={[
              styles.tagDescription, 
              { color: theme.textSecondary }
            ]}
            numberOfLines={2}
          >
            {item.description || 'Sem descrição'}
          </Text>
          
          <View style={styles.tagDetailsContainer}>
            <View style={styles.tagDetailItem}>
              <Text style={[styles.tagDetailLabel, { color: theme.textSecondary }]}>
                Endereço:
              </Text>
              <Text style={[styles.tagDetailValue, { color: theme.text }]}>
                DB{item.db_number}.{item.byte_offset}
              </Text>
            </View>
            
            <View style={styles.tagDetailItem}>
              <Text style={[styles.tagDetailLabel, { color: theme.textSecondary }]}>
                Monitoramento:
              </Text>
              <Text style={[styles.tagDetailValue, { color: theme.text }]}>
                {item.scan_rate}ms
              </Text>
            </View>
            
            <View style={styles.tagDetailItem}>
              <Text style={[styles.tagDetailLabel, { color: theme.textSecondary }]}>
                Valor Atual:
              </Text>
              <Text style={[
                styles.tagValue, 
                { color: theme.primary }
              ]}>
                {item.current_value !== undefined ? String(item.current_value) : '-'}
              </Text>
            </View>
          </View>
          
          <View style={styles.tagActions}>
            <TouchableOpacity
              style={[styles.tagActionButton, { backgroundColor: `${theme.secondary}15` }]}
              onPress={() => navigation.navigate('EditPLCTag', { 
                plcId,
                tagId: item.id 
              })}
            >
              <Feather name="edit-2" size={16} color={theme.secondary} />
              <Text style={[styles.tagActionText, { color: theme.secondary }]}>Editar</Text>
            </TouchableOpacity>
            
            {item.can_write && (
              <TouchableOpacity
                style={[styles.tagActionButton, { backgroundColor: `${theme.primary}15` }]}
                onPress={() => navigation.navigate('WritePLCTag', { 
                  plcId, 
                  tagName: item.name,
                  dataType: item.data_type
                })}
              >
                <Feather name="edit-3" size={16} color={theme.primary} />
                <Text style={[styles.tagActionText, { color: theme.primary }]}>Escrever</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={[styles.tagActionButton, { backgroundColor: '#F4433615' }]}
              onPress={() => handleDeleteTag(item)}
            >
              <Feather name="trash-2" size={16} color="#F44336" />
              <Text style={[styles.tagActionText, { color: '#F44336' }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const getDataTypeColor = (dataType: string) => {
    switch (dataType.toLowerCase()) {
      case 'real': return '#2196F3';
      case 'int': return '#4CAF50';
      case 'word': return '#FF9800';
      case 'bool': return '#9C27B0';
      case 'string': return '#795548';
      default: return '#9E9E9E';
    }
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <EmptyListSvg 
        width={160} 
        height={160} 
        primaryColor={theme.primary} 
        secondaryColor={theme.secondary} 
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Nenhuma tag configurada
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Configure as tags para começar a monitorar os dados do seu PLC.
      </Text>
      <Button
        title="Adicionar Tag"
        onPress={() => navigation.navigate('CreatePLCTag', { plcId })}
        icon={<Feather name="plus" size={18} color="#fff" />}
        style={{ marginTop: 16 }}
      />
    </View>
  );

  if (loading && !refreshing && tags.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando tags...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        {plc && (
          <View style={styles.plcInfo}>
            <Text style={[styles.plcName, { color: theme.text }]}>
              {plc.name}
            </Text>
            <Text style={[styles.plcIp, { color: theme.textSecondary }]}>
              {plc.ip_address} • Rack: {plc.rack} • Slot: {plc.slot}
            </Text>
          </View>
        )}
        
        <Button
          title="Adicionar Tag"
          onPress={() => navigation.navigate('CreatePLCTag', { plcId })}
          icon={<Feather name="plus" size={18} color="#fff" />}
          full
        />
        
        <View style={styles.tagCountContainer}>
          <Text style={[styles.tagCount, { color: theme.textSecondary }]}>
            {tags.length} {tags.length === 1 ? 'tag' : 'tags'} configuradas
          </Text>
          
          <TouchableOpacity
            style={styles.backToPlcButton}
            onPress={() => navigation.navigate('PLCDetails', { plcId })}
          >
            <Feather name="arrow-left" size={14} color={theme.primary} />
            <Text style={[styles.backToPlcText, { color: theme.primary }]}>
              Voltar ao PLC
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      <FlatList
        data={tags}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          tags.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={renderEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: 16,
  },
  plcInfo: {
    marginBottom: 16,
  },
  plcName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  plcIp: {
    fontSize: 14,
  },
  tagCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  tagCount: {
    fontSize: 14,
  },
  backToPlcButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backToPlcText: {
    fontSize: 14,
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  tagCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataTypeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  dataTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  tagDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  tagDetailsContainer: {
    marginBottom: 16,
  },
  tagDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tagDetailLabel: {
    fontSize: 13,
  },
  tagDetailValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  tagActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tagActionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default PLCTags;