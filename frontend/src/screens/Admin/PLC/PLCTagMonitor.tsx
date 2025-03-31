// src/screens/Admin/PLC/PLCTagMonitor.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Switch,
  TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLC, PLCTag } from '../../../services/plcApi';

interface RouteParams {
  plcId: number;
}

const PLCTagMonitor = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { plcId } = route.params as RouteParams;
  
  const [plc, setPlc] = useState<PLC | null>(null);
  const [tags, setTags] = useState<PLCTag[]>([]);
  const [filteredTags, setFilteredTags] = useState<PLCTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [monitorActive, setMonitorActive] = useState(true);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Auto refresh interval
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Reference for tracking last refresh time
  const lastRefreshTime = useRef<Date>(new Date());
  const [timeSinceRefresh, setTimeSinceRefresh] = useState('');
  
  useEffect(() => {
    // Initial animation
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
    
    // Initial data load
    loadData();
    
    // Timer to update "time since refresh" display
    const timer = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - lastRefreshTime.current.getTime();
      const seconds = Math.floor(diff / 1000);
      
      if (seconds < 60) {
        setTimeSinceRefresh(`${seconds}s atrás`);
      } else if (seconds < 3600) {
        setTimeSinceRefresh(`${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`);
      } else {
        setTimeSinceRefresh(`+${Math.floor(seconds / 3600)}h atrás`);
      }
    }, 1000);
    
    // Auto refresh setup
    setupAutoRefresh();
    
    // Cleanup
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      clearInterval(timer);
    };
  }, [plcId, autoRefresh, monitorActive]);

  // Update filtered tags when search text or tags change
  useEffect(() => {
    filterTags();
  }, [searchText, tags]);

  const setupAutoRefresh = () => {
    // Clear any existing interval
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
    
    // Set up new interval if auto-refresh is enabled
    if (autoRefresh && monitorActive) {
      refreshInterval.current = setInterval(() => {
        refreshData(false);
      }, 5000); // Refresh every 5 seconds
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load PLC details
      const plcData = await plcApi.getPLC(plcId);
      setPlc(plcData);
      
      // Load PLC tags with values
      const tagsData = await plcApi.getPLCTags(plcId);
      setTags(tagsData);
      
      // Update last refresh time
      lastRefreshTime.current = new Date();
      setTimeSinceRefresh('agora');
      
    } catch (error) {
      console.error('Erro ao carregar dados do PLC:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados do PLC');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async (showRefreshIndicator = true) => {
    if (showRefreshIndicator) {
      setRefreshing(true);
    }
    
    try {
      // Only refresh tags, not PLC details for faster updates
      const tagsData = await plcApi.getPLCTags(plcId);
      setTags(tagsData);
      
      // Update last refresh time
      lastRefreshTime.current = new Date();
      setTimeSinceRefresh('agora');
      
    } catch (error) {
      console.error('Erro ao atualizar valores das tags:', error);
      // Don't show alert on silent refresh
      if (showRefreshIndicator) {
        Alert.alert('Erro', 'Não foi possível atualizar os valores das tags');
      }
    } finally {
      if (showRefreshIndicator) {
        setRefreshing(false);
      }
    }
  };

  const filterTags = useCallback(() => {
    if (!searchText.trim()) {
      setFilteredTags(tags);
      return;
    }
    
    const filtered = tags.filter(tag => 
      tag.name.toLowerCase().includes(searchText.toLowerCase()) ||
      tag.description?.toLowerCase().includes(searchText.toLowerCase())
    );
    
    setFilteredTags(filtered);
  }, [tags, searchText]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const toggleMonitor = () => {
    setMonitorActive(!monitorActive);
  };

  const formatTagValue = (tag: PLCTag) => {
    if (tag.current_value === undefined || tag.current_value === null) {
      return '-';
    }
    
    try {
      // Format based on data type
      switch (tag.data_type.toLowerCase()) {
        case 'real':
          // Format floats with precision
          const num = parseFloat(String(tag.current_value));
          return isNaN(num) ? String(tag.current_value) : num.toFixed(2);
          
        case 'bool':
          // Format booleans as TRUE/FALSE
          if (typeof tag.current_value === 'boolean') {
            return tag.current_value ? 'TRUE' : 'FALSE';
          }
          return String(tag.current_value);
          
        default:
          return String(tag.current_value);
      }
    } catch (e) {
      return String(tag.current_value);
    }
  };

  const getTagValueColor = (tag: PLCTag) => {
    if (tag.current_value === undefined || tag.current_value === null) {
      return theme.textSecondary;
    }
    
    // Different colors based on data type
    switch (tag.data_type.toLowerCase()) {
      case 'real':
        return theme.primary;
      case 'bool':
        // Green for TRUE, red for FALSE
        if (typeof tag.current_value === 'boolean') {
          return tag.current_value ? '#4CAF50' : '#F44336';
        }
        return theme.text;
      default:
        return theme.text;
    }
  };

  // Get a color for tag data type badge
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

  if (loading && !refreshing) {
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.headerTitleSection}>
          <View style={styles.iconContainer}>
            <Feather name="monitor" size={20} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Monitor de Tags
            </Text>
            {plc && (
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {plc.name} • {plc.ip_address}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.monitorControls}>
          <View style={styles.refreshInfo}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <Text style={[styles.refreshText, { color: theme.textSecondary }]}>
              Atualizado: {timeSinceRefresh}
            </Text>
          </View>
          
          <View style={styles.controls}>
            <View style={styles.controlItem}>
              <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>
                Auto
              </Text>
              <Switch
                value={autoRefresh}
                onValueChange={toggleAutoRefresh}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={autoRefresh ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
            
            <View style={styles.controlItem}>
              <Text style={[styles.controlLabel, { color: theme.textSecondary }]}>
                Ativo
              </Text>
              <Switch
                value={monitorActive}
                onValueChange={toggleMonitor}
                trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                thumbColor={monitorActive ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>
          </View>
        </View>
        
        {/* Search Box */}
        <View style={[styles.searchContainer, { 
          backgroundColor: isDarkMode ? theme.surfaceVariant : '#f5f5f5',
          borderColor: isDarkMode ? theme.border : '#e0e0e0'
        }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Pesquisar tags..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
      
      {/* Tags List */}
      <FlatList
        data={filteredTags}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <Animated.View style={[
            styles.tagCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0',
              opacity: fadeAnim
            }
          ]}>
            <View style={styles.tagHeader}>
              <Text style={[styles.tagName, { color: theme.text }]}>{item.name}</Text>
              <View style={[
                styles.tagTypeBadge,
                { backgroundColor: `${getDataTypeColor(item.data_type)}20` }
              ]}>
                <Text style={[
                  styles.tagTypeText,
                  { color: getDataTypeColor(item.data_type) }
                ]}>
                  {item.data_type.toUpperCase()}
                </Text>
              </View>
            </View>
            
            {item.description && (
              <Text style={[styles.tagDescription, { color: theme.textSecondary }]}>
                {item.description}
              </Text>
            )}
            
            <View style={styles.tagDetails}>
              <Text style={[styles.tagAddress, { color: theme.textSecondary }]}>
                DB{item.db_number}.DBX{item.byte_offset}{item.data_type === 'bool' ? `.${item.bit_offset}` : ''}
              </Text>
              
              <Text style={[
                styles.tagValue, 
                { color: getTagValueColor(item) }
              ]}>
                {formatTagValue(item)}
              </Text>
            </View>
            
            {item.can_write && (
              <TouchableOpacity
                style={[
                  styles.writeButton,
                  { backgroundColor: theme.primary + '20' }
                ]}
                onPress={() => navigation.navigate('WritePLCTag', {
                  plcId,
                  tagName: item.name,
                  dataType: item.data_type
                })}
              >
                <Feather name="edit-3" size={16} color={theme.primary} />
                <Text style={[styles.writeButtonText, { color: theme.primary }]}>
                  Escrever
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshData(true)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            {/* Corrigido: usando "tag" com "x-circle" em vez de "tag-off" que não existe */}
            <View style={styles.emptyIconContainer}>
              <Feather name="tag" size={50} color={theme.textSecondary + '40'} />
              <Feather name="x-circle" size={30} color={theme.textSecondary + '60'} 
                style={styles.overlapIcon} />
            </View>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {searchText.length > 0 ? 
                'Nenhuma tag encontrada com esta pesquisa' : 
                'Nenhuma tag encontrada para este PLC'}
            </Text>
            {searchText.length > 0 && (
              <Button
                title="Limpar pesquisa"
                variant="outline"
                size="small"
                onPress={() => setSearchText('')}
                icon={<Feather name="x" size={14} color={theme.primary} />}
                style={{ marginTop: 16 }}
              />
            )}
          </View>
        )}
      />
      
      {/* Footer Buttons */}
      <View style={[
        styles.footer,
        { backgroundColor: isDarkMode ? theme.surface : '#fff' }
      ]}>
        <Button
          title="Atualizar"
          onPress={() => refreshData(true)}
          icon={<Feather name="refresh-cw" size={18} color="#fff" />}
          style={{ flex: 1, marginRight: 8 }}
        />
        
        <Button
          title="Voltar"
          variant="outline"
          onPress={() => navigation.goBack()}
          icon={<Feather name="arrow-left" size={18} color={theme.primary} />}
          style={{ flex: 1, marginLeft: 8 }}
        />
      </View>
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
    paddingBottom: 8,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  monitorControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 12,
    marginLeft: 4,
  },
  controls: {
    flexDirection: 'row',
  },
  controlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  controlLabel: {
    fontSize: 12,
    marginRight: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
    height: '100%',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding for footer
  },
  tagCard: {
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tagName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tagTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagDescription: {
    fontSize: 13,
    marginBottom: 8,
  },
  tagDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagAddress: {
    fontSize: 12,
  },
  tagValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  writeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    position: 'relative',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlapIcon: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: '80%',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});

export default PLCTagMonitor;