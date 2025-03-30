// src/screens/Admin/PLC/PLCList.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
  RefreshControl
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { PLC } from '../../../services/plcApi';
import EmptyListSvg from '../../../components/EmptyListSvg';

const PLCList = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const [plcs, setPlcs] = useState<PLC[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  const [selectedPLC, setSelectedPLC] = useState<PLC | null>(null);

  // Animation
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
    
    loadPLCs();
  }, []);

  const loadPLCs = async () => {
    try {
      setLoading(true);
      const data = await plcApi.getAllPLCs();
      setPlcs(data);
    } catch (error) {
      console.error('Erro ao carregar PLCs:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de PLCs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPLCs();
  };

  const handleDeleteConfirm = (plc: PLC) => {
    setSelectedPLC(plc);
    Alert.alert(
      'Confirmar Exclusão',
      `Tem certeza que deseja excluir o PLC "${plc.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await plcApi.deletePLC(plc.id);
              setPlcs(plcs.filter(p => p.id !== plc.id));
              Alert.alert('Sucesso', 'PLC excluído com sucesso!');
            } catch (error) {
              console.error('Erro ao excluir PLC:', error);
              Alert.alert('Erro', 'Não foi possível excluir o PLC');
            } finally {
              setLoading(false);
              setSelectedPLC(null);
            }
          }
        }
      ]
    );
  };

  const togglePLCStatus = async (plc: PLC) => {
    try {
      const updatedPLC = { 
        ...plc, 
        is_active: !plc.is_active 
      };
      
      setPlcs(plcs.map(p => p.id === plc.id ? updatedPLC : p));
      await plcApi.updatePLC(updatedPLC);
    } catch (error) {
      // Reverter alteração em caso de erro
      setPlcs(plcs.map(p => p.id === plc.id ? plc : p));
      Alert.alert('Erro', 'Não foi possível alterar o status do PLC');
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'offline': return '#F44336';
      default: return '#9E9E9E'; // unknown or undefined
    }
  };

  const renderItem = ({ item }: { item: PLC }) => {
    const statusColor = getStatusColor(item.status);
    
    return (
      <Animated.View 
        style={[
          styles.plcCard,
          { 
            backgroundColor: isDarkMode ? theme.surface : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0'
          },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <TouchableOpacity 
          style={styles.cardContent}
          onPress={() => (navigation as any).navigate('PLCDetails', { plcId: item.id })}
          activeOpacity={0.7}
        >
          <View style={styles.plcInfo}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#4F5BD5', '#962FBF']}
                style={styles.iconGradient}
              >
                <Feather name="cpu" size={24} color="#fff" />
              </LinearGradient>
            </View>
            
            <View style={styles.plcDetails}>
              <Text style={[styles.plcName, { color: theme.text }]}>
                {item.name}
              </Text>
              
              <Text style={[styles.plcIp, { color: theme.textSecondary }]}>
                {item.ip_address}
              </Text>
              
              <View style={styles.plcMeta}>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                    {item.status || 'Desconhecido'}
                  </Text>
                </View>
                
                <Text style={[styles.configText, { color: theme.textSecondary }]}>
                  Rack: {item.rack} | Slot: {item.slot}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.actionsContainer}>
            <Switch
              value={item.is_active}
              onValueChange={() => togglePLCStatus(item)}
              trackColor={{ false: isDarkMode ? '#555' : '#d1d1d1', true: `${theme.primary}80` }}
              thumbColor={item.is_active ? theme.primary : isDarkMode ? '#888' : '#f4f3f4'}
              style={styles.switch}
            />
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${theme.primary}15` }]}
                onPress={() => (navigation as any).navigate('PLCTags', { plcId: item.id })}
              >
                <Feather name="tag" size={18} color={theme.primary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: `${theme.secondary}15` }]}
                onPress={() => (navigation as any).navigate('EditPLC', { plcId: item.id })}
              >
                <Feather name="edit-2" size={18} color={theme.secondary} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: '#F4433615' }]}
                onPress={() => handleDeleteConfirm(item)}
              >
                <Feather name="trash-2" size={18} color="#F44336" />
              </TouchableOpacity>
            </View>
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
        Nenhum PLC cadastrado
      </Text>
      <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Cadastre seu primeiro PLC para começar a monitorá-lo.
      </Text>
      <Button
        title="Adicionar PLC"
        onPress={() => (navigation as any).navigate('CreatePLC')}
        icon={<Feather name="plus" size={18} color="#fff" />}
        style={{ marginTop: 16 }}
      />
    </View>
  );

  if (loading && !refreshing && plcs.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Carregando PLCs...
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
            <Feather name="cpu" size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>
              Controladores Lógicos Programáveis
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Gerencie seus PLCs e monitore suas variáveis
            </Text>
          </View>
        </View>
        
        <Button
          title="Novo PLC"
          onPress={() => (navigation as any).navigate('CreatePLC')}
          icon={<Feather name="plus" size={18} color="#fff" />}
          style={styles.addButton}
          full
        />
      </Animated.View>
      
      <FlatList
        data={plcs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          plcs.length === 0 && styles.emptyListContent
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
  plcCard: {
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
  cardContent: {
    flex: 1,
  },
  plcInfo: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plcDetails: {
    flex: 1,
  },
  plcName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  plcIp: {
    fontSize: 14,
    marginBottom: 8,
  },
  plcMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
  },
  configText: {
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
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

export default PLCList;