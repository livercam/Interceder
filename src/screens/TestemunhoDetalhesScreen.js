// Tela de Detalhes do Testemunho
// Layout redesenhado no estilo "Detalhes do Pedido" com cartoes brancos, fundo creme (#F6F8FC)
//
// Funcionalidades mantidas:
// - Cabecalho com avatar, nome e data
// - Texto completo do testemunho
// - Botao de celebrar com particulas
// - Denuncia
// - Secao de Mensagens de Apoio (comentarios)
// - Replicas (Reply) a mensagens especificas

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  getTestemunho,
  celebrarTestemunho,
  listarMensagensApoioTestemunho,
  adicionarMensagemApoioTestemunho,
  excluirMensagemApoioTestemunho,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { formatarNomeCurto } from '../utils/formatters';
import DenunciaModal from '../components/DenunciaModal';

// Utilitarios
const getTempoRelativo = (timestamp) => {
  if (!timestamp) return 'agora mesmo';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `ha ${diffMin} min`;
  if (diffHoras < 24) return `ha ${diffHoras}h`;
  if (diffDias < 7) return `ha ${diffDias}d`;
  return data.toLocaleDateString('pt-PT');
};

const getDataFormatada = (timestamp) => {
  if (!timestamp) return '';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return data.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
};

const EMOJIS_GLORIA = ['🙌', '🔥', '✨', '🌟', '💫', '🕊️', '❤️', '🎉'];

function ParticulaGloria({ id, xOffset, onRemover }) {
  const animY = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;
  const emoji = useRef(EMOJIS_GLORIA[Math.floor(Math.random() * EMOJIS_GLORIA.length)]).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animY, { toValue: -150, duration: 1000, useNativeDriver: true }),
      Animated.timing(animOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start(() => onRemover(id));
  }, []);

  return (
    <Animated.Text style={{
      position: 'absolute', bottom: 0, left: 20 + xOffset,
      fontSize: 24, transform: [{ translateY: animY }],
      opacity: animOpacity, zIndex: 999,
    }}>
      {emoji}
    </Animated.Text>
  );
}

export default function TestemunhoDetalhesScreen({ route, navigation }) {
  const { testemunhoId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [testemunho, setTestemunho] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mensagens, setMensagens] = useState([]);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const inputRef = useRef(null);
  const [showDenunciaModal, setShowDenunciaModal] = useState(false);
  const [particulas, setParticulas] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await getTestemunho(testemunhoId);
        setTestemunho(dados);
      } catch (error) {
        Alert.alert('Erro', 'Nao foi possivel carregar o testemunho.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [testemunhoId]);

  useEffect(() => {
    const unsubscribe = listarMensagensApoioTestemunho(testemunhoId, (mensagensAtualizadas) => {
      setMensagens(mensagensAtualizadas);
    });
    return () => unsubscribe();
  }, [testemunhoId]);

  const handleCelebrar = useCallback(async () => {
    if (!user) { Alert.alert('Atencao', 'Faca login para celebrar.'); return; }
    const novaParticula = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      xOffset: Math.random() * 40 - 20,
    };
    setParticulas((prev) => [...prev, novaParticula]);
    try {
      await celebrarTestemunho(testemunhoId, user.uid);
      setTestemunho((prev) => prev ? { ...prev, glorias: (prev.glorias || 0) + 1 } : prev);
    } catch (error) {}
  }, [user, testemunhoId]);

  const removerParticula = useCallback((id) => {
    setParticulas((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleDenunciar = useCallback(() => {
    if (!user) { Alert.alert('Atencao', 'Faca login para denunciar.'); return; }
    setShowDenunciaModal(true);
  }, [user]);

  const handleReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, autor: msg.autor_nome });
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleCancelReply = useCallback(() => setReplyingTo(null), []);

  const handleEnviarMensagem = async () => {
    if (!textoMensagem.trim()) return;
    if (!user) { Alert.alert('Atencao', 'Faca login para enviar mensagens.'); return; }
    setEnviandoMensagem(true);
    try {
      await adicionarMensagemApoioTestemunho(testemunhoId, {
        autor_id: user.uid,
        autor_nome: user.displayName || 'Anonimo',
        texto: textoMensagem.trim(),
        replyTo_id: replyingTo ? replyingTo.id : null,
        replyTo_autor: replyingTo ? replyingTo.autor : null,
      });
      setTextoMensagem('');
      setReplyingTo(null);
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel enviar a mensagem.');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const handleExcluirMensagem = useCallback((msg) => {
    if (!user || !testemunho) return;
    if (msg.autor_id !== user.uid && testemunho.autor_id !== user.uid) return;
    Alert.alert('Excluir Mensagem', 'Tem certeza que deseja excluir esta mensagem?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try { await excluirMensagemApoioTestemunho(testemunhoId, msg.id); }
        catch (error) { Alert.alert('Erro', 'Nao foi possivel excluir a mensagem.'); }
      }},
    ]);
  }, [user, testemunho, testemunhoId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!testemunho) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Testemunho nao encontrado</Text>
        <TouchableOpacity style={styles.voltarBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.voltarBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cartao do Autor */}
        <View style={styles.autorCard}>
          <View style={styles.autorHeader}>
            {testemunho.autor_foto_url ? (
              <TouchableOpacity onPress={() => testemunho.autor_id && navigation.navigate('PublicProfile', { userId: testemunho.autor_id })} activeOpacity={0.7}>
                <Image source={{ uri: testemunho.autor_foto_url }} style={styles.avatarImage} />
              </TouchableOpacity>
            ) : (
              <View style={styles.avatarCirculo}>
                <Text style={styles.avatarTexto}>{testemunho.autor_nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.autorInfo}>
              <Text style={styles.autorNome}>{formatarNomeCurto(testemunho.autor_nome)}</Text>
              <Text style={styles.autorData}>{getDataFormatada(testemunho.criadoEm)}</Text>
            </View>
          </View>
          {/* Link movido para o rodape do card de testemunho */}
        </View>

        {/* Cartao do Testemunho (Estilo Refinado) */}
        <View style={styles.TestemunhoCardContainer}>
          {/* Cabecalho */}
          <View style={styles.TestemunhoHeader}>
            <View style={styles.TestemunhoHeaderLeft}>
              <View style={styles.iconPrimaryBg}>
                <Ionicons name="hand-left" size={22} color="#3B82F6" />
              </View>
              <View style={styles.TestemunhoTitleContainer}>
                <Text style={styles.TestemunhoTitle}>Testemunho</Text>
                <View style={styles.TestemunhoUnderline} />
              </View>
            </View>
            <TouchableOpacity onPress={handleDenunciar} activeOpacity={0.7}>
              <View style={styles.iconAlertBg}>
                <Ionicons name="flag-outline" size={18} color="#EF4444" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Corpo do Texto */}
          <Text style={styles.TestemunhoBodyText}>{testemunho.texto}</Text>

          {/* Divisoria */}
          <View style={styles.TestemunhoDivider} />

          {/* Rodape: Link + Data */}
          <View style={styles.TestemunhoFooter}>
            {testemunho.pedido_vinculado_id ? (
              <TouchableOpacity
                style={styles.footerItem}
                onPress={() => navigation.navigate('PedidoDetalhes', { pedidoId: testemunho.pedido_vinculado_id })}
                activeOpacity={0.7}
              >
                <View style={styles.footerIconBg}>
                  <Ionicons name="link" size={16} color="#3B82F6" />
                </View>
                <View style={styles.footerTextCol}>
                  <Text style={styles.footerLabel}>Acesse</Text>
                  <Text style={styles.footerValue}>Pedido Original</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.footerItem}>
                <View style={styles.footerIconBg}>
                  <Ionicons name="link" size={16} color="#3B82F6" />
                </View>
                <View style={styles.footerTextCol}>
                  <Text style={styles.footerLabel}>Acesse</Text>
                  <Text style={styles.footerValue}>Pedido Original</Text>
                </View>
              </View>
            )}
            <View style={styles.footerItem}>
              <View style={styles.footerIconBg}>
                <Ionicons name="time-outline" size={16} color="#3B82F6" />
              </View>
              <View style={styles.footerTextCol}>
                <Text style={styles.footerLabel}>Enviado em</Text>
                <Text style={styles.footerValue}>{getDataFormatada(testemunho.criadoEm)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Card Unificado: Banner Verde + Estatisticas */}
        <View style={styles.unifiedActionCard}>
          {/* Parte Superior: Banner Verde */}
          <View style={styles.actionBanner}>
            <View style={styles.actionBannerLeft}>
              <View style={styles.actionIconCircle}>
                <Ionicons name="heart" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Agradecimento</Text>
                <Text style={styles.actionSubtitle}>Fique feliz com seu irmao e celebrem juntos!</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleCelebrar} activeOpacity={0.85}>
              <Text style={styles.actionButtonText}>Gloria a Deus</Text>
            </TouchableOpacity>
          </View>

          {/* Particulas flutuando para cima */}
          {particulas.map((p) => (
            <ParticulaGloria key={p.id} id={p.id} xOffset={p.xOffset} onRemover={removerParticula} />
          ))}

          {/* Parte Inferior: Estatisticas */}
          <View style={styles.actionStats}>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#94A3B8" />
              <View style={styles.statTextContainer}>
                <Text style={styles.statNumber}>{mensagens.length}</Text>
                <Text style={styles.statLabel}>Mensagens</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="flame" size={22} color="#94A3B8" />
              <View style={styles.statTextContainer}>
                <Text style={styles.statNumber}>{testemunho.glorias || 0}</Text>
                <Text style={styles.statLabel}>Intercessoes</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Mensagens de Apoio */}
        <View style={styles.mensagensSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#1E293B" />
            <Text style={styles.sectionTitle}>Deixe uma Mensagem</Text>
          </View>
          {mensagens.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>{'💭'}</Text>
              <Text style={styles.emptyStateText}>Nenhuma mensagem ainda.</Text>
              <Text style={styles.emptyStateHint}>Seja o primeiro a dar os parabens!</Text>
            </View>
          ) : (
            <View style={styles.feedContainer}>
              {mensagens.map((msg) => {
                const ehAutor = testemunho && msg.autor_id === testemunho.autor_id;
                return (
                  <View key={msg.id} style={styles.messageCard}>
                    <View style={styles.messageHeader}>
                      <View style={styles.authorInfoRow}>
                        <View style={[styles.msgAvatarCirculo, ehAutor && { backgroundColor: '#3B82F6' }]}>
                          <Text style={[styles.msgAvatarTexto, ehAutor && { color: '#FFF' }]}>
                            {msg.autor_nome?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.authorName}>{formatarNomeCurto(msg.autor_nome)}</Text>
                            {ehAutor && <Ionicons name="crown" size={14} color="#3B82F6" />}
                          </View>
                          <Text style={styles.timeAgo}>{getTempoRelativo(msg.criadoEm)}</Text>
                        </View>
                      </View>
                      <View style={styles.actionIconsRow}>
                        <TouchableOpacity onPress={() => handleReply(msg)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="chatbubble-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        {user && testemunho && (msg.autor_id === user.uid || testemunho.autor_id === user.uid) && (
                          <TouchableOpacity onPress={() => handleExcluirMensagem(msg)} activeOpacity={0.6} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    {msg.replyTo_autor && (
                      <View style={styles.replyIndicator}>
                        <Ionicons name="return-up-back" size={12} color="#3B82F6" style={{ marginRight: 4 }} />
                        <Text style={styles.replyIndicatorText}>Respondendo a {formatarNomeCurto(msg.replyTo_autor)}</Text>
                      </View>
                    )}
                    <Text style={styles.messageText}>{msg.texto}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Input Bar - estilo PedidoDetalhes */}
      {user ? (
        <View style={[styles.bottomInputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {replyingTo && (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {'↩'} Respondendo a <Text style={styles.replyBarNome}>{formatarNomeCurto(replyingTo.autor)}</Text>
              </Text>
              <TouchableOpacity style={styles.replyBarClose} onPress={handleCancelReply} activeOpacity={0.7}>
                <Text style={styles.replyBarCloseText}>{'✕'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              ref={inputRef}
              style={[styles.inputField, textoMensagem.length > 0 && styles.inputFieldActive]}
              placeholder={replyingTo ? `Responder a ${formatarNomeCurto(replyingTo.autor)}...` : 'Escreva uma mensagem de parabens...'}
              placeholderTextColor="#94A3B8"
              value={textoMensagem}
              onChangeText={setTextoMensagem}
              multiline
              maxLength={500}
              editable={!enviandoMensagem}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!textoMensagem.trim() || enviandoMensagem) && styles.enviarBtnDisabled]}
              onPress={handleEnviarMensagem}
              disabled={!textoMensagem.trim() || enviandoMensagem}
              activeOpacity={0.8}
            >
              {enviandoMensagem ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loginParaComentar}>
          <Text style={styles.loginParaComentarText}>{'🔒'} Faca login para enviar mensagens.</Text>
        </View>
      )}

      <DenunciaModal
        visible={showDenunciaModal}
        onClose={() => setShowDenunciaModal(false)}
        itemId={testemunhoId}
        itemTipo="testemunho"
      />
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Estilos — Design "Detalhes do Pedido"
// ============================================================
const CARD_SHADOW = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
  android: { elevation: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8FC' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F6F8FC' },
  errorText: { fontSize: 18, color: '#94A3B8', marginBottom: 16, fontFamily: 'Inter' },
  voltarBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  voltarBtnText: { color: '#FFFFFF', fontWeight: '600', fontFamily: 'Inter' },

  // --- Cartao do Autor ---
  autorCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, ...CARD_SHADOW },
  autorHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCirculo: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarImage: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarTexto: { fontFamily: 'Inter', fontSize: 20, fontWeight: '600', color: '#FFFFFF' },
  autorInfo: { flex: 1 },
  autorNome: { fontFamily: 'Inter', fontSize: 16, fontWeight: '600', color: '#1E293B' },
  autorData: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#94A3B8', marginTop: 2 },


  // --- Cartao do Testemunho (Estilo Refinado) ---
  TestemunhoCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  TestemunhoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  TestemunhoHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconPrimaryBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  TestemunhoTitleContainer: { flexDirection: 'column', justifyContent: 'center' },
  TestemunhoTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '700', color: '#1E293B' },
  TestemunhoUnderline: { width: 24, height: 3, backgroundColor: '#3B82F6', borderRadius: 2, marginTop: 4 },
  iconAlertBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  TestemunhoBodyText: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', color: '#334155', lineHeight: 28 },
  TestemunhoDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 },
  TestemunhoFooter: { flexDirection: 'row', justifyContent: 'flex-start', gap: 32 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEF4FF', justifyContent: 'center', alignItems: 'center' },
  footerTextCol: { flexDirection: 'column' },
  footerLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '500', color: '#64748B', marginBottom: 2 },
  footerValue: { fontFamily: 'Inter', fontSize: 14, fontWeight: '600', color: '#1E293B' },

  // --- Card Unificado (Banner Verde + Estatisticas) ---
  unifiedActionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginVertical: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  actionBanner: {
    backgroundColor: '#2E9F5C',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  actionIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionTextContainer: { flex: 1, paddingRight: 12 },
  actionTitle: { fontFamily: 'Inter', fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  actionSubtitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '400', color: 'rgba(255, 255, 255, 0.95)', lineHeight: 18 },
  actionButton: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, gap: 6 },
  actionButtonText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '700', color: '#166534' },
  actionStats: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statTextContainer: { flexDirection: 'column' },
  statNumber: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700', color: '#1E293B' },
  statLabel: { fontFamily: 'Inter', fontSize: 12, fontWeight: '400', color: '#64748B', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },

  // --- Mensagens de Apoio (estilo PedidoDetalhes) ---
  mensagensSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    borderRadius: 0,
    padding: 24,
    ...SHADOWS.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter',
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyStateEmoji: { fontSize: 40, marginBottom: 8 },
  emptyStateText: { fontFamily: 'Inter', fontSize: 16, color: '#94A3B8', textAlign: 'center' },
  emptyStateHint: { fontFamily: 'Inter', fontSize: 14, color: '#CBD5E1', textAlign: 'center', marginTop: 4 },
  feedContainer: { paddingHorizontal: 2, paddingTop: 2, paddingBottom: 2 },
  messageCard: { backgroundColor: '#F0F4FF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  authorInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msgAvatarCirculo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
  msgAvatarTexto: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  authorName: { fontFamily: 'Inter', fontSize: 15, fontWeight: '700', color: '#1E293B' },
  timeAgo: { fontFamily: 'Inter', fontSize: 12, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  actionIconsRow: { flexDirection: 'row', gap: 16 },
  messageText: { fontFamily: 'Inter', fontSize: 15, fontWeight: '400', color: '#475569', lineHeight: 24 },
  replyIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F610', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12, alignSelf: 'flex-start' },
  replyIndicatorText: { fontSize: 12, color: '#3B82F6', fontStyle: 'italic', fontFamily: 'Inter' },

  // --- Bottom Input Bar (estilo PedidoDetalhes) ---
  bottomInputBar: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...SHADOWS.md,
    ...Platform.select({
      ios: { paddingBottom: 24 },
      android: { paddingBottom: 12 },
    }),
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F610', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  replyBarText: { flex: 1, fontSize: 12, color: '#475569', fontFamily: 'Inter' },
  replyBarNome: { fontWeight: 'bold', color: '#3B82F6' },
  replyBarClose: { padding: 4 },
  replyBarCloseText: { fontSize: 14, color: '#94A3B8', fontWeight: 'bold' },
  inputField: { flex: 1, backgroundColor: '#F6F8FC', borderRadius: 24, minHeight: 48, paddingHorizontal: 20, fontFamily: 'Inter', fontSize: 16, color: '#1E293B', marginRight: 12 },
  inputFieldActive: { minHeight: 80 },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  enviarBtnDisabled: { opacity: 0.5 },
  loginParaComentar: { marginHorizontal: 24, marginTop: 16, marginBottom: 24, alignItems: 'center', paddingVertical: 24, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  loginParaComentarText: { fontSize: 14, color: '#94A3B8', fontFamily: 'Inter' },
});
