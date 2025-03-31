// src/screens/Admin/PLC/PLCDetails.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLC, PLCTag } from '../../../services/plcApi';

const { width } = Dimensions.get('window');

interface RouteParams {
  plcId: number;
}

const PLCDetails = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { plcId } = route.params as RouteParams;
  
  const [plc, setPlc] = useState<PLC | null>(null);
  const [tags, setTags] = useState<PLCTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>('unknown');
  const [isResetting, setIsResetting] = useState(false);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const tagsAnim = useRef(new Animated.Value(50)).current;

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
      
      // Load PLC details
      const plcData = await plcApi.getPLC(plcId);
      setPlc(plcData);
      
      // Load PLC tags
      const tagsData = await plcApi.getPLCTags(plcId);
      setTags(tagsData);
      
      // Load health status
      try {
        const healthData = await plcApi.getPLCHealth();
        if (healthData && healthData[plcId]) {
          setHealthStatus(healthData[plcId]);
        }
      } catch (error) {
        console.error('Erro ao carregar saúde do PLC:', error);
      }
      
      // Animate tags section after data is loaded
      Animated.timing(tagsAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Erro ao carregar detalhes do PLC:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do PLC');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'offline': return '#F44336';
      default: return '#9E9E9E'; // unknown or undefined
    }
  };

  const getHealthStatusColor = (status: string) => {
    if (status.startsWith('online')) return '#4CAF50';
    if (status.startsWith('offline')) return '#F44336';
    if (status.startsWith('falha')) return '#FF9800';
    return '#9E9E9E'; // unknown or undefined
  };

  const getHealthStatusLabel = (status: string) => {
    if (status.startsWith('online')) return 'Online';
    if (status.startsWith('offline')) return 'Offline';
    if (status.startsWith('falha')) return 'Falha';
    return 'Desconhecido';
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const handleResetConnection = async () => {
    try {
      setIsResetting(true);
      await plcApi.resetPLCConnection(plcId);
      
      Alert.alert(
        'Reconexão Iniciada',
        'O processo de reconexão com o PLC foi iniciado. Atualize a página em alguns segundos para ver o novo status.',
        [{ text: 'OK' }]
      );
      
      // Aguardar alguns segundos antes de recarregar os dados para dar tempo ao backend
      setTimeout(() => {
        loadData();
      }, 5000);
    } catch (error) {
      console.error('Erro ao resetar conexão:', error);
      Alert.alert('Erro', 'Não foi possível resetar a conexão com o PLC');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading && !refreshing && !plc) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando detalhes do PLC...
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
          onRefresh={handleRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      {plc && (
        <>
          <Animated.View 
            style={[
              styles.headerCard,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0' 
              },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.headerContent}>
              <LinearGradient
                colors={['#4F5BD5', '#962FBF']}
                style={styles.iconContainer}
              >
                <Feather name="cpu" size={32} color="#fff" />
              </LinearGradient>
              
              <View style={styles.plcMetaContainer}>
                <Text style={[styles.plcName, { color: theme.text }]}>
                  {plc.name}
                </Text>
                
                <View style={styles.statusContainer}>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: `${getStatusColor(plc.status)}20` }
                  ]}>
                    <View style={[
                      styles.statusDot, 
                      { backgroundColor: getStatusColor(plc.status) }
                    ]} />
                    <Text style={[
                      styles.statusText, 
                      { color: getStatusColor(plc.status) }
                    ]}>
                      {plc.status || 'Desconhecido'}
                    </Text>
                  </View>
                  
                  <View style={[
                    styles.activeBadge, 
                    { 
                      backgroundColor: plc.is_active 
                        ? 'rgba(46, 213, 115, 0.2)' 
                        : 'rgba(235, 77, 75, 0.2)',
                      borderColor: plc.is_active ? '#2ed573' : '#eb4d4b'
                    }
                  ]}>
                    <Text style={[
                      styles.activeText, 
                      { color: plc.is_active ? '#2ed573' : '#eb4d4b' }
                    ]}>
                      {plc.is_active ? 'Ativo' : 'Inativo'}
                    </Text>
                  </View>
                </View>
                
                <Text style={[styles.plcIp, { color: theme.textSecondary }]}>
                  {plc.ip_address}
                </Text>
                
                <Text style={[styles.configInfo, { color: theme.textSecondary }]}>
                  Rack: {plc.rack} • Slot: {plc.slot}
                </Text>
              </View>
            </View>
            
            <View style={styles.actionsContainer}>
              <Button
                title="Editar PLC"
                onPress={() => navigation.navigate('EditPLC', { plcId: plc.id })}
                variant="outline"
                icon={<Feather name="edit-2" size={16} color={theme.primary} />}
              />
              
              <Button
                title="Gerenciar Tags"
                onPress={() => navigation.navigate('PLCTags', { plcId: plc.id })}
                icon={<Feather name="tag" size={16} color="#fff" />}
              />
            </View>
          </Animated.View>
          
          {/* Nova seção para informações de saúde e botão de reset */}
          <Animated.View 
            style={[
              styles.healthCard,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0' 
              },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.cardHeader}>
              <Feather name="activity" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Status de Conexão
              </Text>
            </View>
            
            <View style={styles.healthSection}>
              <View style={styles.healthStatus}>
                <View style={[
                  styles.healthBadge,
                  { backgroundColor: getHealthStatusColor(healthStatus) + '20' }
                ]}>
                  <View style={[
                    styles.healthDot,
                    { backgroundColor: getHealthStatusColor(healthStatus) }
                  ]} />
                  <Text style={[
                    styles.healthText,
                    { color: getHealthStatusColor(healthStatus) }
                  ]}>
                    {getHealthStatusLabel(healthStatus)}
                  </Text>
                </View>
                
                {healthStatus !== 'online' && (
                  <Text style={[styles.healthDetails, { color: theme.textSecondary }]}>
                    {healthStatus.includes(':') ? healthStatus.split(':')[1].trim() : ''}
                  </Text>
                )}
              </View>
              
              <Button
                title="Reconectar"
                onPress={handleResetConnection}
                loading={isResetting}
                disabled={isResetting}
                variant="secondary"
                icon={<Feather name="refresh-cw" size={16} color={isDarkMode ? '#fff' : theme.secondary} />}
                full
                style={styles.resetButton}
              />
            </View>
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.infoCard,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0' 
              },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.cardHeader}>
              <Feather name="info" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Informações Detalhadas
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                ID:
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {plc.id}
              </Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Criado em:
              </Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>
                {formatDateTime(plc.created_at)}
              </Text>
            </View>
            
            {plc.updated_at && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  Atualizado em:
                </Text>
                <Text style={[styles.infoValue, { color: theme.text }]}>
                  {formatDateTime(plc.updated_at)}
                </Text>
              </View>
            )}
          </Animated.View>
          
          {/* Nova seção para ações avançadas */}
          <Animated.View 
            style={[
              styles.actionCard,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0' 
              },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.cardHeader}>
              <Feather name="zap" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                Ações Avançadas
              </Text>
            </View>
            
            <View style={styles.advancedActionsContainer}>
              <TouchableOpacity
                style={[
                  styles.advancedActionButton,
                  { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f4f8' }
                ]}
                onPress={() => navigation.navigate('PLCTagMonitor', { plcId: plc.id })}
              >
                <Feather name="monitor" size={20} color={theme.primary} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Monitor de Tags
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.advancedActionButton,
                  { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f4f8' }
                ]}
                onPress={() => navigation.navigate('PLCDiagnostic')}
              >
                <Feather name="activity" size={20} color={theme.secondary} />
                <Text style={[styles.actionButtonText, { color: theme.text }]}>
                  Diagnóstico
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.tagsCard,
              { 
                backgroundColor: isDarkMode ? theme.surface : '#fff',
                borderColor: isDarkMode ? theme.border : '#e0e0e0' 
              },
              { opacity: fadeAnim, transform: [{ translateY: tagsAnim }] }
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.tagsHeaderLeft}>
                <Feather name="tag" size={20} color={theme.primary} />
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  Tags de Comunicação
                </Text>
              </View>
              
              <View style={styles.tagCount}>
                <Text style={[styles.tagCountText, { color: theme.textSecondary }]}>
                  {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
                </Text>
              </View>
            </View>
            
            {tags.length === 0 ? (
              <View style={styles.emptyTagsContainer}>
                <Feather name="tag" size={40} color={`${theme.textSecondary}40`} />
                <Text style={[styles.emptyTagsText, { color: theme.textSecondary }]}>
                  Nenhuma tag configurada
                </Text>
                <Button
                  title="Adicionar Tag"
                  onPress={() => navigation.navigate('CreatePLCTag', { plcId: plc.id })}
                  variant="outline"
                  size="small"
                  icon={<Feather name="plus" size={14} color={theme.primary} />}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              <View style={styles.tagsListContainer}>
                {tags.slice(0, 3).map((tag) => (
                  <TouchableOpacity 
                    key={tag.id} 
                    style={[
                      styles.tagItem,
                      { borderBottomColor: isDarkMode ? theme.border : '#f0f0f0' }
                    ]}
                    onPress={() => navigation.navigate('EditPLCTag', { 
                      plcId: plc.id,
                      tagId: tag.id 
                    })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tagInfoContainer}>
                      <Text style={[styles.tagName, { color: theme.text }]}>
                        {tag.name}
                      </Text>
                      <Text style={[styles.tagDescription, { color: theme.textSecondary }]}>
                        {tag.description || 'Sem descrição'}
                      </Text>
                      <View style={styles.tagMetaContainer}>
                        <Text style={[styles.tagMeta, { color: theme.textSecondary }]}>
                          {tag.data_type.toUpperCase()} • DB{tag.db_number}.{tag.byte_offset}
                        </Text>
                        <View style={[
                          styles.tagActiveBadge,
                          { backgroundColor: tag.active ? '#2ed57320' : '#9e9e9e20' }
                        ]}>
                          <Text style={[
                            styles.tagActiveText,
                            { color: tag.active ? '#2ed573' : '#9e9e9e' }
                          ]}>
                            {tag.active ? 'Ativo' : 'Inativo'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.tagValueContainer}>
                      <Text style={[styles.tagValue, { color: theme.primary }]}>
                        {tag.current_value !== undefined ? 
                          String(tag.current_value) : 
                          '-'
                        }
                      </Text>
                      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
                    </View>
                  </TouchableOpacity>
                ))}
                
                {tags.length > 3 && (
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate('PLCTags', { plcId: plc.id })}
                  >
                    <Text style={[styles.viewAllText, { color: theme.primary }]}>
                      Ver todas as {tags.length} tags
                    </Text>
                    <Feather name="arrow-right" size={16} color={theme.primary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        </>
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
  headerCard: {
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
  headerContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  plcMetaContainer: {
    flex: 1,
  },
  plcName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
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
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  plcIp: {
    fontSize: 14,
    marginBottom: 4,
  },
  configInfo: {
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  healthCard: {
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
  healthSection: {
    marginBottom: 8,
  },
  healthStatus: {
    marginBottom: 16,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  healthText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  healthDetails: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
  resetButton: {
    marginTop: 8,
  },
  infoCard: {
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionCard: {
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
  advancedActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  advancedActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontWeight: '500',
    marginLeft: 8,
  },
  tagsCard: {
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
  tagsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagCount: {
    marginLeft: 'auto',
  },
  tagCountText: {
    fontSize: 12,
  },
  emptyTagsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyTagsText: {
    fontSize: 16,
    marginTop: 12,
  },
  tagsListContainer: {
    marginTop: 8,
  },
  tagItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  tagInfoContainer: {
    flex: 1,
    marginRight: 16,
  },
  tagName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  tagDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  tagMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagMeta: {
    fontSize: 12,
    marginRight: 8,
  },
  tagActiveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagActiveText: {
    fontSize: 10,
    fontWeight: '500',
  },
  tagValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
});

export default PLCDetails;