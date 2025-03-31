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
  TextInput,
  Dimensions,
  Vibration,
  Platform,
  Modal
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLC, PLCTag } from '../../../services/plcApi';

const { width } = Dimensions.get('window');

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
  
  // New state variables for enhanced functionality
  const [refreshRate, setRefreshRate] = useState(5000); // 5 seconds default
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlyWithValues, setShowOnlyWithValues] = useState(false);
  const [isHealthy, setIsHealthy] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'type'>('name');
  const [selectedTag, setSelectedTag] = useState<PLCTag | null>(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [writeLoading, setWriteLoading] = useState(false);
  const [valueHistory, setValueHistory] = useState<Record<number, { values: any[], timestamps: string[] }>>({});
  
  // Pagination variables
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Show 5 tags per page
  const [paginatedTags, setPaginatedTags] = useState<PLCTag[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Auto refresh interval
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Reference for tracking last refresh time
  const lastRefreshTime = useRef<Date>(new Date());
  const [timeSinceRefresh, setTimeSinceRefresh] = useState('');
  
  // Ref to track value changes (for highlight animation)
  const changedValues = useRef<Record<number, boolean>>({});
  
  // Store Animated.Value objects directly instead of refs to them
  const valueRefs = useRef<Record<number, Animated.Value>>({});
  
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
    
    // Health check for PLC
    checkPLCHealth();
    
    // Cleanup
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
      clearInterval(timer);
    };
  }, [plcId, autoRefresh, monitorActive, refreshRate]);

  // Update filtered tags when search text, tags, or filters change
  useEffect(() => {
    filterTags();
  }, [searchText, tags, showOnlyActive, showOnlyWithValues, sortBy]);

  // Update paginated tags when filteredTags or current page changes
  useEffect(() => {
    updatePaginatedTags();
  }, [filteredTags, currentPage]);

  const updatePaginatedTags = () => {
    // Calculate total pages
    const total = Math.ceil(filteredTags.length / itemsPerPage);
    setTotalPages(total > 0 ? total : 1);
    
    // Adjust current page if needed
    if (currentPage > total && total > 0) {
      setCurrentPage(total);
      return;
    }
    
    // Slice the data based on pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedTags(filteredTags.slice(startIndex, endIndex));
  };

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
      }, refreshRate);
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
      
      // Initialize animation values for all tags
      tagsData.forEach(tag => {
        if (!valueRefs.current[tag.id]) {
          valueRefs.current[tag.id] = new Animated.Value(1);
        }
      });
      
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
      
      // Compare values to detect changes
      const prevTags = [...tags];
      
      // Update tags
      setTags(tagsData);
      
      // Track changed values for animation
      tagsData.forEach(tag => {
        const prevTag = prevTags.find(t => t.id === tag.id);
        
        // If value has changed, mark it for animation and update history
        if (prevTag && 
            JSON.stringify(prevTag.current_value) !== JSON.stringify(tag.current_value) && 
            tag.current_value !== undefined) {
          
          // Mark for animation
          changedValues.current[tag.id] = true;
          
          // Trigger animation if value exists
          if (valueRefs.current[tag.id]) {
            Animated.sequence([
              Animated.timing(valueRefs.current[tag.id], {
                toValue: 1.2,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(valueRefs.current[tag.id], {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              })
            ]).start(() => {
              // Clear changed flag after animation
              setTimeout(() => {
                changedValues.current[tag.id] = false;
              }, 2000);
            });
          }
          
          // Add to history
          const history = valueHistory[tag.id] || { values: [], timestamps: [] };
          
          // Only keep last 10 values
          const newHistory = {
            values: [tag.current_value, ...history.values].slice(0, 10),
            timestamps: [new Date().toLocaleTimeString(), ...history.timestamps].slice(0, 10)
          };
          
          setValueHistory(prev => ({
            ...prev,
            [tag.id]: newHistory
          }));
          
          // Vibrate on value change if on mobile
          if (Platform.OS !== 'web') {
            Vibration.vibrate(50);
          }
        }
      });
      
      // Update last refresh time
      lastRefreshTime.current = new Date();
      setTimeSinceRefresh('agora');
      
    } catch (error) {
      console.error('Erro ao atualizar valores das tags:', error);
      // Don't show alert on silent refresh
      if (showRefreshIndicator) {
        Alert.alert('Erro', 'Não foi possível atualizar os valores das tags');
      }
      
      // Update health status
      setIsHealthy(false);
    } finally {
      if (showRefreshIndicator) {
        setRefreshing(false);
      }
    }
  };

  const checkPLCHealth = async () => {
    try {
      const healthData = await plcApi.getPLCHealth();
      if (healthData && healthData[plcId]) {
        setIsHealthy(healthData[plcId].startsWith('online'));
      } else {
        setIsHealthy(false);
      }
    } catch (error) {
      console.error('Erro ao verificar saúde do PLC:', error);
      setIsHealthy(false);
    }
  };

  const resetPLCConnection = async () => {
    try {
      await plcApi.resetPLCConnection(plcId);
      Alert.alert(
        'Reconexão Iniciada',
        'O PLC está sendo reconectado. Aguarde alguns segundos e atualize os dados.'
      );
      
      // Check health after a delay
      setTimeout(() => {
        checkPLCHealth();
        refreshData(true);
      }, 5000);
    } catch (error) {
      console.error('Erro ao resetar conexão:', error);
      Alert.alert('Erro', 'Não foi possível resetar a conexão');
    }
  };

  const handleWrite = async () => {
    if (!selectedTag) return;
    
    // Validate value based on data type
    let parsedValue: any = newValue;
    
    try {
      switch (selectedTag.data_type.toLowerCase()) {
        case 'bool':
          // Convert various boolean representations
          if (newValue.toLowerCase() === 'true' || newValue === '1') {
            parsedValue = true;
          } else if (newValue.toLowerCase() === 'false' || newValue === '0') {
            parsedValue = false;
          } else {
            throw new Error('Valor deve ser true/false ou 1/0');
          }
          break;
          
        case 'int':
        case 'word':
          // Ensure it's a valid integer
          if (!Number.isInteger(Number(newValue))) {
            throw new Error('Valor deve ser um número inteiro');
          }
          parsedValue = parseInt(newValue);
          break;
          
        case 'real':
          // Ensure it's a valid float
          if (isNaN(Number(newValue))) {
            throw new Error('Valor deve ser um número');
          }
          parsedValue = parseFloat(newValue);
          break;
          
        // For string, use as is
      }
      
      setWriteLoading(true);
      
      // Call API to write value
      await plcApi.writeTagValue(selectedTag.name, parsedValue);
      
      // Close modal and refresh data
      setShowWriteModal(false);
      setNewValue('');
      
      // Refresh to see new value
      setTimeout(() => refreshData(true), 500);
      
      Alert.alert('Sucesso', `Valor escrito com sucesso na tag ${selectedTag.name}`);
      
    } catch (error) {
      Alert.alert('Erro', `Falha ao escrever valor: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setWriteLoading(false);
    }
  };

  const filterTags = useCallback(() => {
    if (!tags) return;
    
    let filtered = [...tags];
    
    // Apply search filter
    if (searchText.trim()) {
      filtered = filtered.filter(tag => 
        tag.name.toLowerCase().includes(searchText.toLowerCase()) ||
        tag.description?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Apply active filter
    if (showOnlyActive) {
      filtered = filtered.filter(tag => tag.active);
    }
    
    // Apply value filter
    if (showOnlyWithValues) {
      filtered = filtered.filter(tag => tag.current_value !== undefined && tag.current_value !== null);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.data_type.localeCompare(b.data_type);
        case 'value':
          // For value sorting, handle undefined values and different types
          if (a.current_value === undefined && b.current_value === undefined) return 0;
          if (a.current_value === undefined) return 1;
          if (b.current_value === undefined) return -1;
          
          // Convert to string for comparison
          return String(a.current_value).localeCompare(String(b.current_value));
      }
    });
    
    setFilteredTags(filtered);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [tags, searchText, showOnlyActive, showOnlyWithValues, sortBy]);

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const toggleMonitor = () => {
    setMonitorActive(!monitorActive);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
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
          
          {/* New status indicator */}
          <View style={[
            styles.statusIndicator, 
            { backgroundColor: isHealthy ? '#4CAF5020' : '#F4433620' }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isHealthy ? '#4CAF50' : '#F44336' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: isHealthy ? '#4CAF50' : '#F44336' }
            ]}>
              {isHealthy ? 'Conectado' : 'Offline'}
            </Text>
          </View>
          
          {/* Navigation and action icons */}
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => refreshData(true)}
            >
              <Feather name="refresh-cw" size={20} color={theme.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color={theme.primary} />
            </TouchableOpacity>
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
            
            {/* New config button */}
            <TouchableOpacity
              style={[
                styles.configButton,
                { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f5f5f5' }
              ]}
              onPress={() => setShowConfigModal(true)}
            >
              <Feather name="settings" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Filter toolbar with search and filters */}
        <View style={styles.filterToolbar}>
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
          
          {/* Sort/Filter buttons */}
          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === 'name' && { backgroundColor: theme.primary + '20' }
              ]}
              onPress={() => setSortBy('name')}
            >
              <Feather 
                name="align-left" 
                size={14} 
                color={sortBy === 'name' ? theme.primary : theme.textSecondary} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === 'type' && { backgroundColor: theme.primary + '20' }
              ]}
              onPress={() => setSortBy('type')}
            >
              <Feather 
                name="code" 
                size={14} 
                color={sortBy === 'type' ? theme.primary : theme.textSecondary} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.filterButton,
                sortBy === 'value' && { backgroundColor: theme.primary + '20' }
              ]}
              onPress={() => setSortBy('value')}
            >
              <Feather 
                name="hash" 
                size={14} 
                color={sortBy === 'value' ? theme.primary : theme.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Tag counter and pagination info */}
        <View style={styles.tagCounter}>
          <Text style={[styles.tagCountText, { color: theme.textSecondary }]}>
            {filteredTags.length} tags 
            {showOnlyActive ? ' (ativos)' : ''}
            {showOnlyWithValues ? ' (com valores)' : ''}
          </Text>
          
          <Text style={[styles.paginationInfo, { color: theme.textSecondary }]}>
            Página {currentPage} de {totalPages}
          </Text>
        </View>
      </Animated.View>
      
      {/* Tags List */}
      <FlatList
        data={paginatedTags}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => {
          // Initialize animation value if needed
          if (!valueRefs.current[item.id]) {
            valueRefs.current[item.id] = new Animated.Value(1);
          }
          
          const isChanged = changedValues.current[item.id];
          
          return (
            <TouchableOpacity
              onPress={() => {
                setSelectedTag(item);
                if (item.can_write) {
                  setShowWriteModal(true);
                  setNewValue(item.current_value !== undefined ? String(item.current_value) : '');
                } else {
                  // Show history if available
                  if (valueHistory[item.id] && valueHistory[item.id].values.length > 0) {
                    Alert.alert(
                      `Histórico: ${item.name}`,
                      valueHistory[item.id].values.map((v, i) => 
                        `${valueHistory[item.id].timestamps[i]}: ${v}`
                      ).join('\n')
                    );
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <Animated.View style={[
                styles.tagCard,
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  borderColor: isDarkMode ? theme.border : '#e0e0e0',
                  borderLeftWidth: 4,
                  borderLeftColor: getDataTypeColor(item.data_type),
                  opacity: fadeAnim,
                  transform: [
                    { scale: valueRefs.current[item.id] || new Animated.Value(1) }
                  ]
                },
                isChanged && { 
                  borderColor: getTagValueColor(item),
                  shadowColor: getTagValueColor(item),
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 4,
                  elevation: 4 
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
                  
                  <Animated.Text style={[
                    styles.tagValue, 
                    { color: getTagValueColor(item) }
                  ]}>
                    {formatTagValue(item)}
                  </Animated.Text>
                </View>
                
                <View style={styles.tagFooter}>
                  {!item.active && (
                    <View style={[
                      styles.inactiveTag,
                      { backgroundColor: '#9e9e9e20' }
                    ]}>
                      <Text style={[styles.inactiveText, { color: '#9e9e9e' }]}>
                        Inativo
                      </Text>
                    </View>
                  )}
                  
                  {item.can_write && (
                    <View style={[
                      styles.writableTag,
                      { backgroundColor: theme.primary + '20' }
                    ]}>
                      <Feather name="edit-3" size={12} color={theme.primary} />
                      <Text style={[styles.writableText, { color: theme.primary }]}>
                        Escrita
                      </Text>
                    </View>
                  )}
                  
                  {valueHistory[item.id] && valueHistory[item.id].values.length > 0 && (
                    <View style={[
                      styles.historyBadge,
                      { backgroundColor: '#9c27b020' }
                    ]}>
                      <Feather name="clock" size={12} color="#9c27b0" />
                      <Text style={[styles.historyText, { color: '#9c27b0' }]}>
                        {valueHistory[item.id].values.length}
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>
            </TouchableOpacity>
          );
        }}
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
      
      {/* Pagination Controls */}
      {filteredTags.length > 0 && (
        <View style={[
          styles.paginationControls, 
          { backgroundColor: isDarkMode ? theme.surface + 'E6' : '#ffffffE6' }
        ]}>
          <TouchableOpacity 
            style={[
              styles.paginationButton,
              { backgroundColor: currentPage > 1 ? theme.primary + '20' : isDarkMode ? theme.surfaceVariant : '#f5f5f5' }
            ]}
            onPress={goToPrevPage}
            disabled={currentPage <= 1}
          >
            <Feather 
              name="chevron-left" 
              size={20} 
              color={currentPage > 1 ? theme.primary : theme.textSecondary + '80'} 
            />
          </TouchableOpacity>
          
          <View style={styles.paginationIndicator}>
            <Text style={[styles.paginationText, { color: theme.text }]}>
              {currentPage} / {totalPages}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.paginationButton,
              { backgroundColor: currentPage < totalPages ? theme.primary + '20' : isDarkMode ? theme.surfaceVariant : '#f5f5f5' }
            ]}
            onPress={goToNextPage}
            disabled={currentPage >= totalPages}
          >
            <Feather 
              name="chevron-right" 
              size={20} 
              color={currentPage < totalPages ? theme.primary : theme.textSecondary + '80'} 
            />
          </TouchableOpacity>
          
          {!isHealthy && (
            <TouchableOpacity
              style={[styles.reconnectButton, { backgroundColor: '#F44336' }]}
              onPress={resetPLCConnection}
            >
              <Feather name="wifi-off" size={16} color="#fff" />
              <Text style={styles.reconnectText}>Reconectar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      {/* Config Modal */}
      <Modal
        visible={showConfigModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfigModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowConfigModal(false)}
        >
          <View style={[
            styles.modalContent,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0'
            }
          ]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Configurações do Monitor
              </Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.configSection}>
              <Text style={[styles.configSectionTitle, { color: theme.text }]}>
                Taxa de Atualização
              </Text>
              
              <View style={styles.refreshRateButtons}>
                {[1000, 2000, 5000, 10000, 30000].map(rate => (
                  <TouchableOpacity
                    key={rate}
                    style={[
                      styles.refreshRateButton,
                      refreshRate === rate && { 
                        backgroundColor: theme.primary,
                        borderColor: theme.primary
                      },
                      { borderColor: isDarkMode ? theme.border : '#e0e0e0' }
                    ]}
                    onPress={() => {
                      setRefreshRate(rate);
                      // Reset interval with new rate
                      if (refreshInterval.current) {
                        clearInterval(refreshInterval.current);
                      }
                      if (autoRefresh && monitorActive) {
                        refreshInterval.current = setInterval(() => {
                          refreshData(false);
                        }, rate);
                      }
                    }}
                  >
                    <Text style={[
                      styles.refreshRateText, 
                      refreshRate === rate ? { color: '#fff' } : { color: theme.text }
                    ]}>
                      {rate >= 1000 ? `${rate / 1000}s` : `${rate}ms`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <View style={styles.configSection}>
              <Text style={[styles.configSectionTitle, { color: theme.text }]}>
                Filtros
              </Text>
              
              <View style={styles.filterOption}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>
                  Mostrar apenas tags ativas
                </Text>
                <Switch
                  value={showOnlyActive}
                  onValueChange={setShowOnlyActive}
                  trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                  thumbColor={showOnlyActive ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.filterOption}>
                <Text style={[styles.filterLabel, { color: theme.text }]}>
                  Mostrar apenas tags com valores
                </Text>
                <Switch
                  value={showOnlyWithValues}
                  onValueChange={setShowOnlyWithValues}
                  trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
                  thumbColor={showOnlyWithValues ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
                />
              </View>
            </View>
            
            <View style={styles.modalActions}>
              <Button
                title="Aplicar"
                onPress={() => setShowConfigModal(false)}
                full
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* Write Value Modal */}
      <Modal
        visible={showWriteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWriteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWriteModal(false)}
        >
          <View style={[
            styles.modalContent,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0'
            }
          ]}>
            {selectedTag && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Escrever em {selectedTag.name}
                  </Text>
                  <TouchableOpacity onPress={() => setShowWriteModal(false)}>
                    <Feather name="x" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.writeSection}>
                  <Text style={[styles.writeInfoText, { color: theme.textSecondary }]}>
                    Tipo: {selectedTag.data_type.toUpperCase()}
                  </Text>
                  
                  <Text style={[styles.writeInfoText, { color: theme.textSecondary }]}>
                    Endereço: DB{selectedTag.db_number}.DBX{selectedTag.byte_offset}
                    {selectedTag.data_type === 'bool' ? `.${selectedTag.bit_offset}` : ''}
                  </Text>
                  
                  <Text style={[styles.writeLabel, { color: theme.text }]}>
                    Valor Atual: {formatTagValue(selectedTag)}
                  </Text>
                  
                  <View style={[
                    styles.writeInputContainer,
                    { 
                      borderColor: isDarkMode ? theme.border : '#e0e0e0',
                      backgroundColor: isDarkMode ? theme.surfaceVariant : '#f9f9f9'
                    }
                  ]}>
                    <TextInput
                      style={[styles.writeInput, { color: theme.text }]}
                      value={newValue}
                      onChangeText={setNewValue}
                      placeholder={`Digite o valor (${selectedTag.data_type})`}
                      placeholderTextColor={theme.textSecondary}
                      keyboardType={selectedTag.data_type === 'real' ? 'numeric' : 'default'}
                      autoCapitalize="none"
                    />
                  </View>
                  
                  {selectedTag.data_type === 'bool' && (
                    <View style={styles.boolButtons}>
                      <TouchableOpacity
                        style={[
                          styles.boolButton,
                          { backgroundColor: '#4CAF5020', borderColor: '#4CAF50' }
                        ]}
                        onPress={() => setNewValue('true')}
                      >
                        <Text style={{ color: '#4CAF50' }}>TRUE</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.boolButton,
                          { backgroundColor: '#F4433620', borderColor: '#F44336' }
                        ]}
                        onPress={() => setNewValue('false')}
                      >
                        <Text style={{ color: '#F44336' }}>FALSE</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <View style={styles.warningContainer}>
                    <Feather name="alert-triangle" size={16} color="#FF9800" />
                    <Text style={[styles.warningText, { color: '#FF9800' }]}>
                      Esta ação escreverá diretamente no PLC e pode impactar processos em execução.
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modalActions}>
                  <Button
                    title="Cancelar"
                    variant="outline"
                    onPress={() => setShowWriteModal(false)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  
                  <Button
                    title="Escrever"
                    onPress={handleWrite}
                    loading={writeLoading}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
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
    alignItems: 'center',
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
  configButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  filterToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    padding: 0,
    height: '100%',
  },
  filterButtons: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  filterButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  tagCounter: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagCountText: {
    fontSize: 12,
  },
  paginationInfo: {
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Extra padding for pagination controls
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
  tagFooter: {
    flexDirection: 'row',
    marginTop: 4,
  },
  inactiveTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  inactiveText: {
    fontSize: 10,
  },
  writableTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  writableText: {
    fontSize: 10,
    marginLeft: 4,
  },
  historyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyText: {
    fontSize: 10,
    marginLeft: 2,
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
  paginationControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationIndicator: {
    paddingHorizontal: 16,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    position: 'absolute',
    right: 16,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  configSection: {
    marginBottom: 16,
  },
  configSectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  refreshRateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  refreshRateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
 refreshRateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
  },
  modalActions: {
    marginTop: 16,
  },
  writeSection: {
    marginBottom: 16,
  },
  writeInfoText: {
    fontSize: 14,
    marginBottom: 8,
  },
  writeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 8,
  },
  writeInputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  writeInput: {
    fontSize: 16,
    height: '100%',
  },
  boolButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  boolButton: {
    width: '48%',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  warningText: {
    marginLeft: 8,
    fontSize: 12,
  },
});

export default PLCTagMonitor;