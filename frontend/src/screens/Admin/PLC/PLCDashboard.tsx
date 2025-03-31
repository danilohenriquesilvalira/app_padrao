import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
  Modal,
  StatusBar,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLC, PLCHealth, PLCStatistics } from '../../../services/plcApi';

const { width } = Dimensions.get('window');

const PLCDashboard = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  
  const [plcs, setPlcs] = useState<PLC[]>([]);
  const [health, setHealth] = useState<PLCHealth>({});
  const [statistics, setStatistics] = useState<PLCStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // New state variables for enhanced functionality
  const [selectedPLC, setSelectedPLC] = useState<PLC | null>(null);
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Auto refresh interval
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Reference for tracking last refresh time
  const lastRefreshTime = useRef<Date>(new Date());

  useEffect(() => {
    // Initial animation
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
    
    // Initial data load
    loadDashboardData();
    
    // Auto refresh setup
    setupAutoRefresh();
    
    // Cleanup
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh]);

  const setupAutoRefresh = () => {
    // Clear any existing interval
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
      refreshInterval.current = null;
    }
    
    // Set up new interval if auto-refresh is enabled
    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        refreshData(false);
      }, 15000); // Refresh every 15 seconds
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel for faster loading
      const [plcsData, healthData, statsData] = await Promise.all([
        plcApi.getAllPLCs(),
        plcApi.getPLCHealth(),
        plcApi.getPLCStatistics(),
      ]);
      
      setPlcs(plcsData);
      setHealth(healthData);
      setStatistics(statsData);
      
      // Update last refresh time
      lastRefreshTime.current = new Date();
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
      // Load all data in parallel
      const [plcsData, healthData, statsData] = await Promise.all([
        plcApi.getAllPLCs(),
        plcApi.getPLCHealth(),
        plcApi.getPLCStatistics(),
      ]);
      
      setPlcs(plcsData);
      setHealth(healthData);
      setStatistics(statsData);
      
      // Update last refresh time
      lastRefreshTime.current = new Date();
      
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
    } finally {
      if (showRefreshIndicator) {
        setRefreshing(false);
      }
    }
  };

  const getStatusColor = (status?: string) => {
    if (!status) return '#9E9E9E';
    
    if (status.startsWith('online')) return '#4CAF50';
    if (status.startsWith('offline')) return '#F44336';
    if (status.startsWith('falha')) return '#FF9800';
    return '#9E9E9E';
  };

  const getStatusLabel = (status?: string) => {
    if (!status) return 'Desconhecido';
    
    if (status.startsWith('online')) return 'Online';
    if (status.startsWith('offline')) return 'Offline';
    if (status.startsWith('falha')) return 'Falha';
    return 'Desconhecido';
  };

  const getHealthStatus = (plcId: number) => {
    return health[plcId] || 'unknown';
  };

  // Calculate stats
  const calculateStats = () => {
    if (!plcs || plcs.length === 0) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        unknown: 0,
        activeTags: statistics?.active_tags || 0,
        totalTags: statistics?.total_tags || 0,
      };
    }
    
    const stats = {
      total: plcs.length,
      online: 0,
      offline: 0,
      unknown: 0,
      activeTags: statistics?.active_tags || 0,
      totalTags: statistics?.total_tags || 0,
    };
    
    plcs.forEach(plc => {
      const status = getHealthStatus(plc.id);
      if (status.startsWith('online')) {
        stats.online++;
      } else if (status.startsWith('offline') || status.startsWith('falha')) {
        stats.offline++;
      } else {
        stats.unknown++;
      }
    });
    
    return stats;
  };

  // Run quick diagnostic
  const runQuickDiagnostic = async () => {
    try {
      setRunningDiagnostic(true);
      const results = await plcApi.runDiagnosticTags();
      setDiagnosticResults(results);
      
      // Show a summary of the diagnostic
      let message = `Diagnóstico concluído:\n`;
      message += `Tags corrigidas: ${results.fixed_tags}\n`;
      message += `Tags com erro: ${results.error_tags}`;
      
      alert(message);
    } catch (error) {
      console.error('Erro ao executar diagnóstico:', error);
    } finally {
      setRunningDiagnostic(false);
    }
  };

  const stats = calculateStats();

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando dados...
        </Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent={true}
      />
      
      <View style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refreshData(true)}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Stats Overview Cards - Moved higher up with reduced spacing */}
          <View style={styles.statsOverviewContainer}>
            <Animated.View 
              style={[
                styles.statsCard, 
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['#2196F320', '#2196F310']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.statsCardContent}>
                <Feather name="cpu" size={22} color={theme.primary} />
                <Text style={[styles.statsCardValue, { color: theme.primary }]}>
                  {stats.total}
                </Text>
                <Text style={[styles.statsCardLabel, { color: theme.textSecondary }]}>
                  Total PLCs
                </Text>
              </View>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.statsCard, 
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['#2196F320', '#2196F310']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.statsCardContent}>
                <Feather name="check-circle" size={22} color="#4CAF50" />
                <Text style={[styles.statsCardValue, { color: '#4CAF50' }]}>
                  {stats.online}
                </Text>
                <Text style={[styles.statsCardLabel, { color: theme.textSecondary }]}>
                  Online
                </Text>
              </View>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.statsCard, 
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['#2196F320', '#2196F310']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.statsCardContent}>
                <Feather name="x-circle" size={22} color="#F44336" />
                <Text style={[styles.statsCardValue, { color: '#F44336' }]}>
                  {stats.offline}
                </Text>
                <Text style={[styles.statsCardLabel, { color: theme.textSecondary }]}>
                  Offline
                </Text>
              </View>
            </Animated.View>
            
            <Animated.View 
              style={[
                styles.statsCard, 
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <LinearGradient
                colors={['#2196F320', '#2196F310']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.statsCardContent}>
                <Feather name="tag" size={22} color="#9c27b0" />
                <Text style={[styles.statsCardValue, { color: '#9c27b0' }]}>
                  {stats.totalTags}
                </Text>
                <Text style={[styles.statsCardLabel, { color: theme.textSecondary }]}>
                  Total Tags
                </Text>
              </View>
            </Animated.View>
          </View>
          
          {/* Quick Actions */}
          <Animated.View 
            style={[
              styles.sectionContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Ações Rápidas
              </Text>
            </View>
            
            <View style={styles.actionCardsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  { 
                    backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff',
                    borderColor: isDarkMode ? theme.border : '#e0e0e0' 
                  },
                ]}
                onPress={() => navigation.navigate('PLCList')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionCardIconContainer, { backgroundColor: '#2196F320' }]}>
                  <Feather name="list" size={24} color="#2196F3" />
                </View>
                <Text style={[styles.actionCardTitle, { color: theme.text }]}>Listar PLCs</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  { 
                    backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff',
                    borderColor: isDarkMode ? theme.border : '#e0e0e0' 
                  },
                ]}
                onPress={() => navigation.navigate('CreatePLC')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionCardIconContainer, { backgroundColor: '#2196F320' }]}>
                  <Feather name="plus-circle" size={24} color="#4CAF50" />
                </View>
                <Text style={[styles.actionCardTitle, { color: theme.text }]}>Novo PLC</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  { 
                    backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff',
                    borderColor: isDarkMode ? theme.border : '#e0e0e0' 
                  },
                ]}
                onPress={() => navigation.navigate('PLCDiagnostic')}
                activeOpacity={0.7}
              >
                <View style={[styles.actionCardIconContainer, { backgroundColor: '#2196F320' }]}>
                  <Feather name="activity" size={24} color="#FF9800" />
                </View>
                <Text style={[styles.actionCardTitle, { color: theme.text }]}>Diagnóstico</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          {/* Quick Tools */}
          <Animated.View 
            style={[
              styles.toolsContainer,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0',
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.toolsGrid}>
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                ]}
                onPress={runQuickDiagnostic}
                disabled={runningDiagnostic}
              >
                {runningDiagnostic ? (
                  <ActivityIndicator size="small" color="#2196F3" />
                ) : (
                  <Feather name="zap" size={20} color="#2196F3" />
                )}
                <Text style={[styles.toolText, { color: theme.text }]}>
                  Diagnóstico Rápido
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                ]}
                onPress={() => {
                  if (plcs.length > 0) {
                    // Find first PLC with tags
                    plcApi.getPLCTags(plcs[0].id).then(tags => {
                      if (tags.length > 0) {
                        navigation.navigate('PLCTagMonitor', { plcId: plcs[0].id });
                      } else {
                        alert('Nenhuma tag encontrada para monitorar');
                      }
                    });
                  } else {
                    alert('Nenhum PLC disponível');
                  }
                }}
              >
                <Feather name="monitor" size={20} color="#4CAF50" />
                <Text style={[styles.toolText, { color: theme.text }]}>
                  Monitor de Tags
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.toolButton,
                  { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                ]}
                onPress={() => navigation.navigate('PLCTags', { plcId: plcs[0]?.id })}
              >
                <Feather name="list" size={20} color="#9C27B0" />
                <Text style={[styles.toolText, { color: theme.text }]}>
                  Listar Tags
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          {/* PLC Status List */}
          <Animated.View 
            style={[
              styles.sectionContainer,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Status dos PLCs
              </Text>
            </View>
            
            <View style={[
              styles.plcListContainer,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0'
              }
            ]}>
              {plcs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="cpu" size={40} color={theme.textSecondary + '40'} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Nenhum PLC cadastrado
                  </Text>
                  <TouchableOpacity
                    style={[styles.emptyButton, { borderColor: theme.primary }]}
                    onPress={() => navigation.navigate('CreatePLC')}
                  >
                    <Feather name="plus" size={16} color={theme.primary} />
                    <Text style={[styles.emptyButtonText, { color: theme.primary }]}>
                      Adicionar PLC
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {plcs.map((plc) => {
                    const healthStatus = getHealthStatus(plc.id);
                    
                    return (
                      <View key={plc.id}>
                        <TouchableOpacity
                          style={[
                            styles.plcStatusItem,
                            { borderBottomColor: isDarkMode ? theme.border : '#f0f0f0' }
                          ]}
                          onPress={() => navigation.navigate('PLCDetails', { plcId: plc.id })}
                        >
                          <View style={styles.plcInfo}>
                            <Text style={[styles.plcName, { color: theme.text }]}>
                              {plc.name}
                            </Text>
                            <Text style={[styles.plcAddress, { color: theme.textSecondary }]}>
                              {plc.ip_address} • Rack {plc.rack} • Slot {plc.slot}
                            </Text>
                          </View>
                          
                          <View style={styles.plcStatusBadgeContainer}>
                            <View style={[
                              styles.plcStatusBadge,
                              { backgroundColor: getStatusColor(healthStatus) + '20' }
                            ]}>
                              <View style={[
                                styles.statusDot,
                                { backgroundColor: getStatusColor(healthStatus) }
                              ]} />
                              <Text style={[
                                styles.statusText,
                                { color: getStatusColor(healthStatus) }
                              ]}>
                                {getStatusLabel(healthStatus)}
                              </Text>
                            </View>
                            
                            <View style={[
                              styles.tagCountBadge,
                              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f5f5f5' }
                            ]}>
                              <Feather name="tag" size={12} color={theme.textSecondary} />
                              <Text style={[styles.tagCountText, { color: theme.textSecondary }]}>
                                {statistics?.tags_per_plc?.[plc.id] || 0}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        
                        <View style={styles.plcActions}>
                          <TouchableOpacity
                            style={[
                              styles.plcActionButton,
                              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                            ]}
                            onPress={() => navigation.navigate('PLCTags', { plcId: plc.id })}
                          >
                            <Feather name="tag" size={14} color="#2196F3" />
                            <Text style={[styles.plcActionText, { color: theme.textSecondary }]}>
                              Tags
                            </Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            style={[
                              styles.plcActionButton,
                              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                            ]}
                            onPress={() => navigation.navigate('PLCTagMonitor', { plcId: plc.id })}
                          >
                            <Feather name="monitor" size={14} color="#4CAF50" />
                            <Text style={[styles.plcActionText, { color: theme.textSecondary }]}>
                              Monitor
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          </Animated.View>
          
          {/* Error Stats if needed */}
          {statistics && (statistics.manager?.ReadErrors > 0 || statistics.manager?.WriteErrors > 0) && (
            <Animated.View 
              style={[
                styles.errorContainer,
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  borderColor: isDarkMode ? theme.border : '#e0e0e0',
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <View style={styles.errorHeader}>
                <Feather name="alert-triangle" size={18} color="#F44336" />
                <Text style={[styles.errorTitle, { color: theme.text }]}>
                  Erros Detectados
                </Text>
              </View>
              
              <View style={styles.errorStats}>
                <View style={styles.errorStatItem}>
                  <Text style={[styles.errorStatValue, { color: '#F44336' }]}>
                    {statistics.manager?.ReadErrors || 0}
                  </Text>
                  <Text style={[styles.errorStatLabel, { color: theme.textSecondary }]}>
                    Erros de Leitura
                  </Text>
                </View>
                
                <View style={styles.errorStatItem}>
                  <Text style={[styles.errorStatValue, { color: '#FF9800' }]}>
                    {statistics.manager?.WriteErrors || 0}
                  </Text>
                  <Text style={[styles.errorStatLabel, { color: theme.textSecondary }]}>
                    Erros de Escrita
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.viewDiagButton, { borderColor: theme.primary }]}
                onPress={() => navigation.navigate('PLCDiagnostic')}
              >
                <Feather name="activity" size={14} color={theme.primary} />
                <Text style={[styles.viewDiagText, { color: theme.primary }]}>
                  Ver Diagnóstico Completo
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </View>
      
      {/* Quick Action Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showQuickActionModal}
        onRequestClose={() => setShowQuickActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickActionModal(false)}
        >
          <View style={[
            styles.modalContent,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0'
            }
          ]}>
            {selectedPLC && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {selectedPLC.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowQuickActionModal(false)}
                  >
                    <Feather name="x" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[
                      styles.modalActionButton,
                      { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                    ]}
                    onPress={() => {
                      setShowQuickActionModal(false);
                      navigation.navigate('PLCDetails', { plcId: selectedPLC.id });
                    }}
                  >
                    <Feather name="info" size={20} color="#2196F3" />
                    <Text style={[styles.modalActionText, { color: theme.text }]}>
                      Detalhes
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.modalActionButton,
                      { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                    ]}
                    onPress={() => {
                      setShowQuickActionModal(false);
                      navigation.navigate('PLCTags', { plcId: selectedPLC.id });
                    }}
                  >
                    <Feather name="tag" size={20} color="#4CAF50" />
                    <Text style={[styles.modalActionText, { color: theme.text }]}>
                      Tags
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.modalActionButton,
                      { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
                    ]}
                    onPress={() => {
                      setShowQuickActionModal(false);
                      navigation.navigate('PLCTagMonitor', { plcId: selectedPLC.id });
                    }}
                  >
                    <Feather name="monitor" size={20} color="#FF9800" />
                    <Text style={[styles.modalActionText, { color: theme.text }]}>
                      Monitor
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 12, // Reduced padding to move content up
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
  // Stats cards - Updated to move higher
  statsOverviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 16, // Reduced bottom margin
    marginTop: -5, // Negative margin to move up
  },
  statsCard: {
    width: (width - 32) / 2, // Slightly wider cards
    height: 110, // Slightly smaller height
    borderRadius: 16,
    margin: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statsCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 6,
  },
  statsCardLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Sections styling - Reduced spacing
  sectionContainer: {
    marginBottom: 16, // Reduced margin
  },
  sectionHeader: {
    marginBottom: 8, // Reduced margin
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Action cards
  actionCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 48) / 3,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 1,
  },
  actionCardIconContainer: {
    width: 48, // Slightly smaller
    height: 48, // Slightly smaller
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8, // Reduced margin
  },
  actionCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Tools container
  toolsContainer: {
    borderRadius: 14,
    padding: 14, // Reduced padding
    marginBottom: 16, // Reduced margin
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  toolsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toolButton: {
    width: '31%',
    alignItems: 'center',
    padding: 12, // Reduced padding
    borderRadius: 12,
  },
  toolText: {
    fontSize: 12, // Smaller font
    fontWeight: '600',
    marginTop: 8, // Reduced margin
    textAlign: 'center',
  },
  // PLC List
  plcListContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  plcStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12, // Reduced padding
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  plcInfo: {
    flex: 1,
  },
  plcName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  plcAddress: {
    fontSize: 12,
  },
  plcStatusBadgeContainer: {
    alignItems: 'flex-end',
  },
  plcStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagCountText: {
    fontSize: 11,
    marginLeft: 4,
  },
  plcActions: {
    flexDirection: 'row',
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 8,
  },
  plcActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  plcActionText: {
    fontSize: 12,
    marginLeft: 6,
  },
  // Error section
  errorContainer: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  errorStatItem: {
    alignItems: 'center',
  },
  errorStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorStatLabel: {
    fontSize: 12,
  },
  viewDiagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewDiagText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
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
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalActionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});

export default PLCDashboard;