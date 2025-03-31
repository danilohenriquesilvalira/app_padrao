// src/screens/Admin/PLC/PLCDashboard.tsx
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
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
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
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Auto refresh interval
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Reference for tracking last refresh time
  const lastRefreshTime = useRef<Date>(new Date());
  const [timeSinceRefresh, setTimeSinceRefresh] = useState('');

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
      setTimeSinceRefresh('agora');
      
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
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
      setTimeSinceRefresh('agora');
      
    } catch (error) {
      console.error('Erro ao atualizar dados do dashboard:', error);
    } finally {
      if (showRefreshIndicator) {
        setRefreshing(false);
      }
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
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

  const stats = calculateStats();

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
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
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.headerTitleSection}>
          <View style={styles.iconContainer}>
            <Feather name="activity" size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Dashboard de PLCs
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              Monitoramento do sistema
            </Text>
          </View>
        </View>
        
        <View style={styles.refreshInfo}>
          <View style={styles.refreshTimeContainer}>
            <Feather name="clock" size={14} color={theme.textSecondary} />
            <Text style={[styles.refreshText, { color: theme.textSecondary }]}>
              Atualizado: {timeSinceRefresh}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.autoRefreshButton,
              { backgroundColor: autoRefresh ? theme.primary + '20' : isDarkMode ? theme.surfaceVariant : '#f5f5f5' }
            ]}
            onPress={toggleAutoRefresh}
          >
            <Feather 
              name={autoRefresh ? "pause" : "play"} 
              size={14} 
              color={autoRefresh ? theme.primary : theme.textSecondary} 
            />
            <Text style={[
              styles.autoRefreshText, 
              { color: autoRefresh ? theme.primary : theme.textSecondary }
            ]}>
              {autoRefresh ? 'Auto On' : 'Auto Off'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {/* Stats Overview */}
      <Animated.View 
        style={[
          styles.statsOverviewCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <Feather name="bar-chart-2" size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Visão Geral
          </Text>
        </View>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {stats.total}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total PLCs
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#4CAF50' }]}>
              {stats.online}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Online
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {stats.offline}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Offline
            </Text>
          </View>
        </View>
        
        <View style={[styles.divider, { backgroundColor: isDarkMode ? theme.border : '#f0f0f0' }]} />
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.secondary }]}>
              {stats.totalTags}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Total Tags
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.accent }]}>
              {stats.activeTags}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Tags Ativas
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>
              {statistics?.manager?.TagsRead || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Leituras
            </Text>
          </View>
        </View>
      </Animated.View>
      
      {/* Quick Actions */}
      <Animated.View 
        style={[
          styles.quickActionsCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <Feather name="zap" size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Ações Rápidas
          </Text>
        </View>
        
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f7ff' }
            ]}
            onPress={() => navigation.navigate('PLCList')}
          >
            <Feather name="list" size={20} color="#2196F3" />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              Listar PLCs
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0fff7' }
            ]}
            onPress={() => navigation.navigate('CreatePLC')}
          >
            <Feather name="plus-circle" size={20} color="#4CAF50" />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              Novo PLC
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff8f0' }
            ]}
            onPress={() => navigation.navigate('PLCDiagnostic')}
          >
            <Feather name="activity" size={20} color="#FF9800" />
            <Text style={[styles.actionButtonText, { color: theme.text }]}>
              Diagnóstico
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      
      {/* PLC Status List */}
      <Animated.View 
        style={[
          styles.plcStatusCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.cardHeader}>
          <Feather name="cpu" size={18} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Status dos PLCs
          </Text>
        </View>
        
        {plcs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="cpu" size={40} color={theme.textSecondary + '40'} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nenhum PLC cadastrado
            </Text>
            <Button
              title="Adicionar PLC"
              variant="outline"
              size="small"
              onPress={() => navigation.navigate('CreatePLC')}
              icon={<Feather name="plus" size={14} color={theme.primary} />}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          plcs.map((plc) => {
            const healthStatus = getHealthStatus(plc.id);
            
            return (
              <TouchableOpacity
                key={plc.id}
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
            );
          })
        )}
      </Animated.View>
      
      {/* Error Stats */}
      {statistics && (statistics.manager?.ReadErrors > 0 || statistics.manager?.WriteErrors > 0) && (
        <Animated.View 
          style={[
            styles.errorStatsCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.cardHeader}>
            <Feather name="alert-triangle" size={18} color="#F44336" />
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              Erros Registrados
            </Text>
          </View>
          
          <View style={styles.errorStatsContainer}>
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
            style={[
              styles.viewDiagnosticButton,
              { borderColor: theme.primary }
            ]}
            onPress={() => navigation.navigate('PLCDiagnostic')}
          >
            <Feather name="activity" size={14} color={theme.primary} />
            <Text style={[styles.viewDiagnosticText, { color: theme.primary }]}>
              Ver Diagnóstico Completo
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
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
    marginBottom: 16,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  refreshInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 12,
    marginLeft: 4,
  },
  autoRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoRefreshText: {
    fontSize: 12,
    marginLeft: 4,
  },
  statsOverviewCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  quickActionsCard: {
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
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  plcStatusCard: {
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  plcStatusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  plcInfo: {
    flex: 1,
  },
  plcName: {
    fontSize: 15,
    fontWeight: '500',
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
    fontWeight: '500',
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
  errorStatsCard: {
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
  errorStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  errorStatItem: {
    alignItems: 'center',
  },
  errorStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorStatLabel: {
    fontSize: 12,
  },
  viewDiagnosticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewDiagnosticText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default PLCDashboard;