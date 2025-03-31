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
  Animated,
  Dimensions,
  Modal,
  StatusBar
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../contexts/ThemeContext';
import Button from '../../../components/Button';
import plcApi, { DiagnosticResult } from '../../../services/plcApi';

const { width } = Dimensions.get('window');

const PLCDiagnostic = () => {
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult | null>(null);
  
  // New state variables for enhanced functionality
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [selectedPLCId, setSelectedPLCId] = useState<number | null>(null);
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);
  const [runningFullDiagnostic, setRunningFullDiagnostic] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [issueDetails, setIssueDetails] = useState<any | null>(null);
  const [isDashboardMode, setIsDashboardMode] = useState(true);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

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

  // Effect for progress animation
  useEffect(() => {
    if (runningFullDiagnostic) {
      Animated.timing(progressAnim, {
        toValue: diagnosticProgress,
        duration: 300,
        useNativeDriver: false
      }).start();
    }
  }, [diagnosticProgress, runningFullDiagnostic]);

  // Effect for success animation
  useEffect(() => {
    if (showSuccessAnimation) {
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }),
        Animated.delay(2000),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true
        })
      ]).start(() => {
        setShowSuccessAnimation(false);
      });
    }
  }, [showSuccessAnimation]);

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

  const runFullDiagnostic = async () => {
    try {
      setRunningFullDiagnostic(true);
      setDiagnosticProgress(0);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setDiagnosticProgress(prev => {
          const newProgress = prev + 0.05;
          return newProgress > 0.9 ? 0.9 : newProgress;
        });
      }, 500);

      // Actual diagnostic call
      const results = await plcApi.runDiagnosticTags();
      
      // Finish progress
      clearInterval(progressInterval);
      setDiagnosticProgress(1);
      
      // Set results and show success animation
      setDiagnosticResults(results);
      setShowSuccessAnimation(true);
      
      setTimeout(() => {
        setRunningFullDiagnostic(false);
      }, 500);
      
    } catch (error) {
      console.error('Erro ao executar diagnóstico completo:', error);
      Alert.alert('Erro', 'Não foi possível completar o diagnóstico');
      setRunningFullDiagnostic(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    runDiagnostic();
  };

  const renderIssueItem = (issue: any, index: number) => {
    const isSuccess = issue.result && issue.result.includes('sucesso');
    
    return (
      <TouchableOpacity 
        key={`issue-${index}`}
        style={[
          styles.issueItem,
          { 
            backgroundColor: isDarkMode ? theme.surfaceVariant : '#fff',
            borderColor: isDarkMode ? theme.border : '#e0e0e0'
          }
        ]}
        onPress={() => {
          setIssueDetails(issue);
          Alert.alert(
            `${issue.tag_name}`,
            `Problema: ${issue.issue}\n\nAção: ${issue.action}\n\nResultado: ${issue.result || 'Pendente'}`,
            [{ text: 'OK' }]
          );
        }}
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
          <Text style={[styles.issueDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {issue.issue}
          </Text>
          
          {issue.result && (
            <>
              <Text style={[styles.issueResult, { color: isSuccess ? theme.success : theme.error }]}>
                {isSuccess ? '✓ Corrigido' : '⚠ Erro na correção'}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const getHealthStatusColor = (status: string) => {
    if (status === 'online') return '#4CAF50';
    if (status === 'offline') return '#F44336';
    if (status.includes('falha')) return '#FF9800';
    return '#9E9E9E';
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

  // Show progress screen during full diagnostic
  if (runningFullDiagnostic) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <View style={styles.diagnosticProgressContainer}>
          <Text style={[styles.progressTitle, { color: theme.text }]}>
            Executando Diagnóstico Completo
          </Text>
          
          <View style={styles.progressBarContainer}>
            <View style={[
              styles.progressBarBackground,
              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f0f0' }
            ]}>
              <Animated.View 
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: theme.primary,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%']
                    })
                  }
                ]}
              />
            </View>
            
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {Math.round(diagnosticProgress * 100)}%
            </Text>
          </View>
          
          <Text style={[styles.progressDescription, { color: theme.textSecondary }]}>
            Verificando e corrigindo problemas...
          </Text>
          
          <View style={styles.progressStages}>
            <View style={styles.progressStage}>
              <Feather 
                name={diagnosticProgress > 0.3 ? "check-circle" : "circle"} 
                size={16} 
                color={diagnosticProgress > 0.3 ? theme.success : theme.textSecondary} 
              />
              <Text style={[
                styles.progressStageText, 
                { color: diagnosticProgress > 0.3 ? theme.text : theme.textSecondary }
              ]}>
                Verificação de conectividade
              </Text>
            </View>
            
            <View style={styles.progressStage}>
              <Feather 
                name={diagnosticProgress > 0.6 ? "check-circle" : "circle"} 
                size={16} 
                color={diagnosticProgress > 0.6 ? theme.success : theme.textSecondary} 
              />
              <Text style={[
                styles.progressStageText, 
                { color: diagnosticProgress > 0.6 ? theme.text : theme.textSecondary }
              ]}>
                Análise de endereçamentos
              </Text>
            </View>
            
            <View style={styles.progressStage}>
              <Feather 
                name={diagnosticProgress > 0.9 ? "check-circle" : "circle"} 
                size={16} 
                color={diagnosticProgress > 0.9 ? theme.success : theme.textSecondary} 
              />
              <Text style={[
                styles.progressStageText, 
                { color: diagnosticProgress > 0.9 ? theme.text : theme.textSecondary }
              ]}>
                Correção automática
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header with back button */}
        <View style={styles.headerWithBack}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.refreshIconButton}
            onPress={runDiagnostic}
          >
            <Feather name="refresh-cw" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
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
            
            {/* Tab switching */}
            <View style={[
              styles.tabContainer,
              { backgroundColor: isDarkMode ? theme.surfaceVariant : '#f0f0f0' }
            ]}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  isDashboardMode && { 
                    backgroundColor: isDarkMode ? theme.surface : '#fff',
                    borderColor: theme.primary
                  }
                ]}
                onPress={() => setIsDashboardMode(true)}
              >
                <Feather 
                  name="grid" 
                  size={16} 
                  color={isDashboardMode ? theme.primary : theme.textSecondary} 
                />
                <Text style={[
                  styles.tabText, 
                  { color: isDashboardMode ? theme.primary : theme.textSecondary }
                ]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.tab,
                  !isDashboardMode && { 
                    backgroundColor: isDarkMode ? theme.surface : '#fff',
                    borderColor: theme.primary
                  }
                ]}
                onPress={() => setIsDashboardMode(false)}
              >
                <Feather 
                  name="list" 
                  size={16} 
                  color={!isDashboardMode ? theme.primary : theme.textSecondary} 
                />
                <Text style={[
                  styles.tabText, 
                  { color: !isDashboardMode ? theme.primary : theme.textSecondary }
                ]}>
                  Detalhes
                </Text>
              </TouchableOpacity>
            </View>
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

              {isDashboardMode ? (
                <View style={styles.dashboardContainer}>
                  <View style={styles.statsRow}>
                    <View style={[
                      styles.statCard,
                      { backgroundColor: '#4CAF5010', borderColor: '#4CAF50' }
                    ]}>
                      <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                        {diagnosticResults.fixed_tags}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                        Corrigidas
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.statCard,
                      { backgroundColor: '#F4433610', borderColor: '#F44336' }
                    ]}>
                      <Text style={[styles.statValue, { color: '#F44336' }]}>
                        {diagnosticResults.error_tags}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                        Com Erro
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.statCard,
                      { backgroundColor: theme.primary + '10', borderColor: theme.primary }
                    ]}>
                      <Text style={[styles.statValue, { color: theme.primary }]}>
                        {Object.keys(diagnosticResults.plcs).length}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                        PLCs
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.timestampContainer}>
                    <Feather name="clock" size={14} color={theme.textSecondary} />
                    <Text style={[styles.timestampText, { color: theme.textSecondary }]}>
                      {new Date(diagnosticResults.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={[
                      styles.fullDiagnosticButton,
                      { backgroundColor: theme.primary }
                    ]}
                    onPress={runFullDiagnostic}
                  >
                    <Feather name="zap" size={18} color="#fff" />
                    <Text style={styles.fullDiagnosticText}>
                      Executar Diagnóstico Completo
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
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
              )}
            </Animated.View>
          )}

          {diagnosticResults && Object.keys(diagnosticResults.plcs).length > 0 && (
            <Animated.View
              style={[
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              {isDashboardMode ? (
                <View style={styles.plcCardsGrid}>
                  {Object.entries(diagnosticResults.plcs).map(([plcId, plcData]: [string, any]) => {
                    const hasIssues = plcData.issues && plcData.issues.length > 0;
                    const numIssues = hasIssues ? plcData.issues.length : 0;
                    
                    return (
                      <TouchableOpacity
                        key={`plc-${plcId}`}
                        style={[
                          styles.plcDashboardCard,
                          { 
                            backgroundColor: isDarkMode ? theme.surface : '#fff',
                            borderColor: isDarkMode ? theme.border : '#e0e0e0',
                            borderLeftColor: hasIssues ? theme.warning : theme.success,
                            borderLeftWidth: 4
                          }
                        ]}
                        onPress={() => {
                          navigation.navigate('PLCDetails', { plcId: parseInt(plcId) });
                        }}
                      >
                        <View style={styles.plcCardHeader}>
                          <Feather 
                            name="cpu" 
                            size={18}
                            color={hasIssues ? theme.warning : theme.success} 
                          />
                          <Text 
                            style={[styles.plcCardName, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {plcData.name}
                          </Text>
                        </View>
                        
                        <View style={styles.plcCardStats}>
                          <Text style={[styles.plcCardTagCount, { color: theme.textSecondary }]}>
                            {plcData.tags_count} tags
                          </Text>
                          
                          {hasIssues ? (
                            <View style={[
                              styles.plcCardIssueBadge,
                              { backgroundColor: theme.warning + '20' }
                            ]}>
                              <Text style={[styles.plcCardIssueText, { color: theme.warning }]}>
                                {numIssues} {numIssues === 1 ? 'problema' : 'problemas'}
                              </Text>
                            </View>
                          ) : (
                            <View style={[
                              styles.plcCardIssueBadge,
                              { backgroundColor: theme.success + '20' }
                            ]}>
                              <Text style={[styles.plcCardIssueText, { color: theme.success }]}>
                                OK
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.plcCardActions}>
                          {hasIssues && (
                            <TouchableOpacity
                              style={[
                                styles.plcCardAction,
                                { backgroundColor: theme.primary + '10' }
                              ]}
                              onPress={() => {
                                setSelectedPLCId(parseInt(plcId));
                                setShowDetailedModal(true);
                              }}
                            >
                              <Feather name="eye" size={14} color={theme.primary} />
                              <Text style={[styles.plcCardActionText, { color: theme.primary }]}>
                                Ver detalhes
                              </Text>
                            </TouchableOpacity>
                          )}
                          
                          <TouchableOpacity
                            style={[
                              styles.plcCardAction,
                              { backgroundColor: theme.primary + '10' }
                            ]}
                            onPress={() => navigation.navigate('PLCDetails', { plcId: parseInt(plcId) })}
                          >
                            <Feather name="info" size={14} color={theme.primary} />
                            <Text style={[styles.plcCardActionText, { color: theme.primary }]}>
                              Ver PLC
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Detalhes por PLC
                  </Text>

                  {Object.entries(diagnosticResults.plcs).map(([plcId, plcData]: [string, any]) => (
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
                          {plcData.issues.map((issue: any, index: number) => renderIssueItem(issue, index))}
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}
            </Animated.View>
          )}
          
          {/* Extra space at the bottom to ensure content is not covered by the FAB */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
      
      {/* Floating action button for refresh */}
      <TouchableOpacity
        style={[
          styles.floatingButton,
          { backgroundColor: theme.primary }
        ]}
        onPress={runDiagnostic}
      >
        <Feather name="refresh-cw" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* Success animation overlay */}
      {showSuccessAnimation && (
        <Animated.View 
          style={[
            styles.successOverlay,
            {
              opacity: successAnim
            }
          ]}
        >
          <View style={styles.successContent}>
            <Feather name="check-circle" size={60} color="#4CAF50" />
            <Text style={styles.successText}>Diagnóstico Concluído!</Text>
            <Text style={styles.successSubText}>
              Corrigidas: {diagnosticResults?.fixed_tags || 0} tags
            </Text>
          </View>
        </Animated.View>
      )}
      
      {/* Detailed issues modal */}
      <Modal
        visible={showDetailedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetailedModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDetailedModal(false)}
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
                Detalhes dos Problemas
              </Text>
              <TouchableOpacity onPress={() => setShowDetailedModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {selectedPLCId !== null && 
               diagnosticResults && 
               diagnosticResults.plcs[selectedPLCId]?.issues?.length > 0 ? (
                diagnosticResults.plcs[selectedPLCId].issues.map((issue: any, index: number) => (
                  <View 
                    key={`detail-${index}`}
                    style={[
                      styles.detailedIssue,
                      { borderBottomColor: isDarkMode ? theme.border : '#f0f0f0' }
                    ]}
                  >
                    <View style={styles.detailedIssueHeader}>
                      <Feather 
                        name={issue.result && issue.result.includes('sucesso') ? 
                          "check-circle" : "alert-triangle"} 
                        size={20} 
                        color={issue.result && issue.result.includes('sucesso') ? 
                          theme.success : theme.warning} 
                      />
                      <Text style={[styles.detailedIssueTitle, { color: theme.text }]}>
                        {issue.tag_name}
                      </Text>
                    </View>
                    
                    <View style={styles.detailedIssueBody}>
                      <Text style={[styles.detailedIssueSubtitle, { color: theme.text }]}>
                        Problema:
                      </Text>
                      <Text style={[styles.detailedIssueText, { color: theme.textSecondary }]}>
                        {issue.issue}
                      </Text>
                      
                      <Text style={[styles.detailedIssueSubtitle, { color: theme.text }]}>
                        Ação:
                      </Text>
                      <Text style={[styles.detailedIssueText, { color: theme.textSecondary }]}>
                        {issue.action}
                      </Text>
                      
                      {issue.result && (
                        <>
                          <Text style={[styles.detailedIssueSubtitle, { color: theme.text }]}>
                            Resultado:
                          </Text>
                          <Text style={[
                            styles.detailedIssueText, 
                            { 
                              color: issue.result.includes('sucesso') ? 
                                theme.success : theme.error 
                            }
                          ]}>
                            {issue.result}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.noIssuesText, { color: theme.textSecondary }]}>
                  Nenhum problema encontrado para este PLC
                </Text>
              )}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <Button
                title="Fechar"
                variant="outline"
                onPress={() => setShowDetailedModal(false)}
                full
              />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120, // Extra space for floating button
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
  // New header with back button
  headerWithBack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
  },
  refreshIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 91, 213, 0.1)',
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
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
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
  dashboardContainer: {
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: (width - 64) / 3,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  timestampText: {
    fontSize: 12,
    marginLeft: 6,
  },
  // Improved button
  fullDiagnosticButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  fullDiagnosticText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
  plcCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  plcDashboardCard: {
    width: (width - 40) / 2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  plcCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  plcCardName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  plcCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  plcCardTagCount: {
    fontSize: 12,
  },
  plcCardIssueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  plcCardIssueText: {
    fontSize: 11,
    fontWeight: '500',
  },
  plcCardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  plcCardAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  plcCardActionText: {
    fontSize: 11,
    marginLeft: 4,
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
    marginBottom: 8,
  },
  issueResult: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Floating action button
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomPadding: {
    height: 70,
  },
  // Diagnostic progress styles
  diagnosticProgressContainer: {
    width: '90%',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    width: 40,
    textAlign: 'right',
  },
  progressDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  progressStages: {
    marginTop: 8,
  },
  progressStage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressStageText: {
    fontSize: 14,
    marginLeft: 10,
  },
  // Success animation overlay
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  successText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  successSubText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
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
  modalBody: {
    maxHeight: '70%',
  },
  detailedIssue: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailedIssueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailedIssueTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  detailedIssueBody: {
    paddingLeft: 28,
  },
  detailedIssueSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailedIssueText: {
    fontSize: 14,
    marginBottom: 12,
  },
  noIssuesText: {
    textAlign: 'center',
    fontSize: 16,
    paddingVertical: 20,
  },
  modalActions: {
    marginTop: 16,
  },
});

export default PLCDiagnostic;