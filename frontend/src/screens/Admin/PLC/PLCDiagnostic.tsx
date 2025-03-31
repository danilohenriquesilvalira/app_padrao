// src/screens/Admin/PLC/PLCDiagnostic.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { DiagnosticResult } from '../../../services/plcApi';

const PLCDiagnostic = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult | null>(null);

  // Animation
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

    runDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    try {
      setLoading(true);
      const results = await plcApi.runDiagnosticTags();
      setDiagnosticResults(results);
    } catch (error) {
      console.error('Erro ao executar diagnóstico:', error);
      Alert.alert('Erro', 'Não foi possível executar o diagnóstico de tags');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    runDiagnostic();
  };

  const renderIssueItem = (issue: any, index: number) => {
    const isSuccess = issue.result && issue.result.includes('sucesso');
    
    return (
      <View 
        key={`issue-${index}`}
        style={[
          styles.issueItem,
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0'
          }
        ]}
      >
        <View style={styles.issueHeader}>
          <View style={styles.issueHeaderLeft}>
            <Feather 
              name={isSuccess ? "check-circle" : "alert-triangle"} 
              size={18} 
              color={isSuccess ? theme.success : theme.warning} 
            />
            <Text style={[styles.tagName, { color: theme.text }]}>
              {issue.tag_name}
            </Text>
          </View>
          <Text style={[
            styles.issueStatus, 
            { 
              color: isSuccess ? theme.success : theme.error,
              backgroundColor: isSuccess ? `${theme.success}20` : `${theme.error}20`,
            }
          ]}>
            {isSuccess ? 'Corrigido' : 'Erro'}
          </Text>
        </View>
        
        <View style={styles.issueContent}>
          <Text style={[styles.issueTitle, { color: theme.text }]}>Problema:</Text>
          <Text style={[styles.issueDescription, { color: theme.textSecondary }]}>
            {issue.issue}
          </Text>
          
          <Text style={[styles.issueTitle, { color: theme.text }]}>Ação:</Text>
          <Text style={[styles.issueDescription, { color: theme.textSecondary }]}>
            {issue.action}
          </Text>
          
          {issue.result && (
            <>
              <Text style={[styles.issueTitle, { color: theme.text }]}>Resultado:</Text>
              <Text style={[styles.issueDescription, { color: theme.textSecondary }]}>
                {issue.result}
              </Text>
            </>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Executando diagnóstico de tags...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[theme.primary]}
          tintColor={theme.primary}
        />
      }
    >
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.headerIconContainer}>
          <Feather name="activity" size={32} color={theme.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Diagnóstico de Tags
        </Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Verificação e correção automática de problemas
        </Text>
      </Animated.View>

      {diagnosticResults && (
        <Animated.View
          style={[
            styles.summaryCard,
            { 
              backgroundColor: isDarkMode ? theme.surface : '#fff',
              borderColor: isDarkMode ? theme.border : '#e0e0e0',
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.summaryHeader}>
            <Feather name="info" size={20} color={theme.primary} />
            <Text style={[styles.summaryTitle, { color: theme.text }]}>
              Resumo do Diagnóstico
            </Text>
          </View>

          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Tags corrigidas:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.success }]}>
                {diagnosticResults.fixed_tags}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Tags com erros:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.error }]}>
                {diagnosticResults.error_tags}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                Data do diagnóstico:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {new Date(diagnosticResults.timestamp).toLocaleString()}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {diagnosticResults && Object.keys(diagnosticResults.plcs).length > 0 && (
        <Animated.View
          style={[
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Detalhes por PLC
          </Text>

          {Object.entries(diagnosticResults.plcs).map(([plcId, plcData]) => (
            <View 
              key={`plc-${plcId}`}
              style={[
                styles.plcCard,
                { 
                  backgroundColor: isDarkMode ? theme.surface : '#fff',
                  borderColor: isDarkMode ? theme.border : '#e0e0e0'
                }
              ]}
            >
              <View style={styles.plcHeader}>
                <View style={styles.plcHeaderLeft}>
                  <Feather name="cpu" size={18} color={theme.primary} />
                  <Text style={[styles.plcName, { color: theme.text }]}>
                    {plcData.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.viewPLCButton,
                    { backgroundColor: `${theme.primary}20` }
                  ]}
                  onPress={() => navigation.navigate('PLCDetails', { plcId: parseInt(plcId) })}
                >
                  <Text style={[styles.viewPLCText, { color: theme.primary }]}>
                    Ver PLC
                  </Text>
                  <Feather name="chevron-right" size={16} color={theme.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.plcSummary}>
                <Text style={[styles.plcInfoText, { color: theme.textSecondary }]}>
                  Total de tags: {plcData.tags_count}
                </Text>
                {plcData.issues && plcData.issues.length > 0 ? (
                  <Text style={[styles.plcInfoText, { color: theme.warning }]}>
                    Problemas encontrados: {plcData.issues.length}
                  </Text>
                ) : (
                  <Text style={[styles.plcInfoText, { color: theme.success }]}>
                    Nenhum problema encontrado
                  </Text>
                )}
              </View>

              {plcData.issues && plcData.issues.length > 0 && (
                <View style={styles.issuesContainer}>
                  {plcData.issues.map((issue, index) => renderIssueItem(issue, index))}
                </View>
              )}
            </View>
          ))}
        </Animated.View>
      )}

      <View style={styles.actionsContainer}>
        <Button
          title="Executar Novo Diagnóstico"
          onPress={runDiagnostic}
          loading={loading}
          icon={<Feather name="refresh-cw" size={18} color="#fff" />}
          full
        />

        <Button
          title="Voltar para Lista de PLCs"
          variant="outline"
          onPress={() => navigation.navigate('PLCList')}
          icon={<Feather name="list" size={18} color={theme.primary} />}
          full
          style={{ marginTop: 12 }}
        />
      </View>
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
  },
  summaryCard: {
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
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  summaryContent: {
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
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
  plcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  plcHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  plcName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  viewPLCButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  viewPLCText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 4,
  },
  plcSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  plcInfoText: {
    fontSize: 12,
  },
  issuesContainer: {
    marginTop: 8,
  },
  issueItem: {
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  issueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  issueStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  issueContent: {
    padding: 12,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  issueDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  actionsContainer: {
    marginTop: 16,
  },
});

export default PLCDiagnostic;