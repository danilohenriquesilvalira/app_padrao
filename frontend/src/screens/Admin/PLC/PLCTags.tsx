// src/screens/Admin/PLC/PLCTags.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLCTag } from '../../../services/plcApi';
import EmptyListSvg from '../../../components/EmptyListSvg';

interface RouteParams {
  plcId: number;
}

const PLCTags = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { plcId } = route.params as RouteParams;
  
  const [tags, setTags] = useState<PLCTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plcName, setPlcName] = useState('');
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
    
    loadData();
  }, [plcId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load PLC details to get name
      const plcData = await plcApi.getPLC(plcId);
      setPlcName(plcData.name);
      
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

  // Get background color for each data type
  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'real': return '#2196F3';
      case 'int': return '#4CAF50';
      case 'word': return '#FF9800';
      case 'bool': return '#9C27B0';
      case 'string': return '#795548';
      default: return '#9E9E9E';
    }
  };

  const renderItem = ({ item }: { item: PLCTag }) => {
    const dataTypeColor = getDataTypeColor(item.data_type);
    
    return (
      <Animated.View
        style={[
          styles.tagCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0'
          },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <TouchableOpacity
          style={styles.tagContent}
          onPress={() => navigation.navigate('EditPLCTag', { 
            plcId: plcId,
            tagId: item.id
          })}
          activeOpacity={0.7}
        >
          <View style={styles.tagHeader}>
            <View style={styles.tagNameContainer}>
              <Text style={[styles.tagName, { color: theme.text }]}>
                {item.name}
              </Text>
              <View style={[
                styles.dataTypeBadge, 
                { backgroundColor: `${dataTypeColor}20`, borderColor: dataTypeColor }
              ]}>
                <Text style={[styles.dataTypeText, { color: dataTypeColor }]}>
                  {item.data_type.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={[
              styles.activeIndicator, 
              { 
                backgroundColor: item.active ? 
                  'rgba(46, 213, 115, 0.2)' : 'rgba(235, 77, 75, 0.2)'
              }
            ]}>
              <View style={[
                styles.activeDot, 
                { 
                  backgroundColor: item.active ? 
                    '#2ed573' : '#eb4d4b'
                }
              ]} />
              <Text style={[
                styles.activeText, 
                { color: item.active ? '#2ed573' : '#eb4d4b' }
              ]}>
                {item.active ? 'Ativo' : 'Inativo'}
              </Text>
            </View>
          </View>
          
          {item.description && (
            <Text style={[styles.tagDescription, { color: theme.textSecondary }]}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.tagDetails}>
            <View style={styles.tagDetail}>
              <Feather name="database" size={12} color={theme.textSecondary} />
              <Text style={[styles.tagDetailText, { color: theme.textSecondary }]}>
                DB{item.db_number}.{item.byte_offset}
                {item.data_type === 'bool' ? `.${item.bit_offset}` : ''}
              </Text>
            </View>
            
            <View style={styles.tagDetail}>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <Text style={[styles.tagDetailText, { color: theme.textSecondary }]}>
                {item.scan_rate}ms
              </Text>
            </View>
            
            {item.can_write && (
              <View style={styles.tagDetail}>
                <Feather name="edit-2" size={12} color={theme.textSecondary} />
                <Text style={[styles.tagDetailText, { color: theme.textSecondary }]}>
                  Escrita
                </Text>
              </View>
            )}
          </View>
          
          {item.current_value !== undefined && (
            <View style={styles.tagValueContainer}>
              <Text style={[styles.tagValueLabel, { color: theme.textSecondary }]}>
                Valor atual:
              </Text>
              <Text style={[styles.tagValue, { color: theme.primary }]}>
                {String(item.current_value)}
              </Text>
            </View>
          )}
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: `${theme.secondary}15` }]}
              onPress={() => navigation.navigate('EditPLCTag', { 
                plcId: plcId,
                tagId: item.id
              })}
            >
              <Feather name="edit-2" size={16} color={theme.secondary} />
              <Text style={[styles.actionText, { color: theme.secondary }]}>
                Editar
              </Text>
            </TouchableOpacity>
            
            {item.can_write && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${theme.primary}15` }]}
                onPress={() => navigation.navigate('WritePLCTag', { 
                  plcId: plcId,
                  tagName: item.name,
                  dataType: item.data_type,
                  bitOffset: item.bit_offset // Novo parâmetro
                })}
              >
                <Feather name="edit-3" size={16} color={theme.primary} />
                <Text style={[styles.actionText, { color: theme.primary }]}>
                  Escrever
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <EmptyListSvg 
        width={180} 
        height={180}
        primaryColor={theme.primary}
        secondaryColor={theme.secondary}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        Nenhuma tag configurada
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Adicione tags para monitorar variáveis do seu PLC
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
          Carregando tags do PLC...
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
        <View style={styles.titleContainer}>
          <View style={styles.titleIconContainer}>
            <Feather name="tag" size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>
              Tags de Comunicação
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {plcName ? `PLC: ${plcName}` : 'Gerencie as variáveis do seu PLC'}
            </Text>
          </View>
        </View>
        
        <Button
          title="Nova Tag"
          onPress={() => navigation.navigate('CreatePLCTag', { plcId })}
          icon={<Feather name="plus" size={18} color="#fff" />}
          style={styles.addButton}
          full
        />
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
    paddingTop: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    marginTop: 8,
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
  tagContent: {
    flex: 1,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tagNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  tagName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
    marginBottom: 4,
  },
  dataTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  dataTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  activeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  tagDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  tagDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tagDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  tagDetailText: {
    fontSize: 12,
    marginLeft: 4,
  },
  tagValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tagValueLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  tagValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  actionText: {
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