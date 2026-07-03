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
          {testemunho.pedido_vinculado_id && (
            <TouchableOpacity
              style={styles.linkPedidoBtn}
              onPress={() => navigation.navigate('PedidoDetalhes', { pedidoId: testemunho.pedido_vinculado_id })}
              activeOpacity={0.7}
            >
              <Ionicons name="link" size={14} color="#3B82F6" style={{ marginRight: 6 }} />
              <Text style={styles.linkPedidoText}>Ver pedido original</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cartao do Pedido de Oracao */}
        <View style={styles.pedidoCard}>
          <View style={styles.pedidoHeaderRow}>
            <View style={styles.pedidoHeaderTitleRow}>
              <Ionicons name="hand-left" size={22} color="#3B82F6" style={{ marginRight: 10 }} />
              <Text style={styles.pedidoHeader}>Pedido de oracao</Text>
            </View>
            <TouchableOpacity onPress={handleDenunciar} activeOpacity={0.7}>
              <Ionicons name="flag-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <Text style={styles.pedidoBody}>{testemunho.texto}</Text>
        </View>

        {/* Banner de Intercessao */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <Ionicons name="hand-left" size={32} color="#FFFFFF" style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.bannerTitle}>Interceder</Text>
            <Text style={styles.bannerSubTitle}>Ore por este pedido...</Text>
            <Text style={styles.bannerAction}>[ Interceder ]</Text>
          </View>
        </View>

        {/* Cartao de Estatisticas */}
        <View style={styles.statsCard}>
          <View style={styles.statSection}>
            <Ionicons name="chatbubble-ellipses" size={24} color="#94A3B8" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.statNumber}>{mensagens.length}</Text>
              <Text style={styles.statLabel}>Mensagens</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statSection}>
            <Ionicons name="flame" size={24} color="#94A3B8" style={{ marginRight: 10 }} />
            <View>
              <Text style={styles.statNumber}>{testemunho.glorias || 0}</Text>
              <Text style={styles.statLabel}>Intercessoes</Text>
            </View>
          </View>
        </View>

        {/* Cartao de Mensagens de Apoio */}
        <View style={styles.comentarioCard}>
          <View style={styles.comentarioCardRow}>
            <View style={styles.comentarioHeaderRow}>
              <Ionicons name="chatbubble-ellipses" size={22} color="#3B82F6" style={{ marginRight: 10 }} />
              <Text style={styles.comentarioHeader}>Mensagens de apoio</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.comentarioFilterText}>Mais recentes ▼</Text>
            </TouchableOpacity>
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

      {/* Bottom Input Bar */}
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
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.inputIcon} activeOpacity={0.6}>
                <Ionicons name="mic-outline" size={20} color="#CBD5E1" />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={replyingTo ? `Responder a ${formatarNomeCurto(replyingTo.autor)}...` : 'Escreva uma mensagem de parabens...'}
                placeholderTextColor="#CBD5E1"
                value={textoMensagem}
                onChangeText={setTextoMensagem}
                multiline
                maxLength={500}
                editable={!enviandoMensagem}
              />
              <TouchableOpacity style={styles.inputIcon} activeOpacity={0.6}>
                <Ionicons name="attach-outline" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!textoMensagem.trim() || enviandoMensagem) && styles.enviarBtnDisabled]}
              onPress={handleEnviarMensagem}
              disabled={!textoMensagem.trim() || enviandoMensagem}
              activeOpacity={0.8}
            >
              {enviandoMensagem ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
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
  linkPedidoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF4FF', alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, marginTop: 12 },
  linkPedidoText: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: '#3B82F6' },

  // --- Cartao do Pedido ---
  pedidoCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, ...CARD_SHADOW },
  pedidoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pedidoHeaderTitleRow: { flexDirection: 'row', alignItems: 'center' },
  pedidoHeader: { fontFamily: 'Inter', fontSize: 20, fontWeight: '700', color: '#1E293B' },
  pedidoBody: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', color: '#1E293B', lineHeight: 24 },

  // --- Banner de Intercessao ---
  bannerCard: {
    borderRadius: 20, padding: 16, marginBottom: 16, backgroundColor: '#2575FC',
    ...Platform.select({
      ios: { shadowColor: '#2575FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  bannerContent: { alignItems: 'center', paddingVertical: 8 },
  bannerTitle: { fontFamily: 'Inter', fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  bannerSubTitle: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#FFFFFF', textAlign: 'center', marginTop: 4, opacity: 0.85 },
  bannerAction: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginTop: 8, opacity: 0.9 },

  // --- Cartao de Estatisticas ---
  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, flexDirection: 'row', marginBottom: 16, ...CARD_SHADOW },
  statSection: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  statDivider: { width: 1, backgroundColor: '#E1E8EE', marginHorizontal: 8 },
  statNumber: { fontFamily: 'Inter', fontSize: 20, fontWeight: '600', color: '#1E293B' },
  statLabel: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#1E293B', opacity: 0.7 },

  // --- Cartao de Mensagens de Apoio ---
  comentarioCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, ...CARD_SHADOW },
  comentarioCardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  comentarioHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  comentarioHeader: { fontFamily: 'Inter', fontSize: 20, fontWeight: '700', color: '#1E293B' },
  comentarioFilterText: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#94A3B8' },
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

  // --- Bottom Input Bar ---
  bottomInputBar: { backgroundColor: '#F6F8FC', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E1E8EE', position: 'absolute', bottom: 0, left: 0, right: 0 },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F610', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  replyBarText: { flex: 1, fontSize: 12, color: '#475569', fontFamily: 'Inter' },
  replyBarNome: { fontWeight: 'bold', color: '#3B82F6' },
  replyBarClose: { padding: 4 },
  replyBarCloseText: { fontSize: 14, color: '#94A3B8', fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6EAED', borderRadius: 999, paddingHorizontal: 12, marginRight: 12, height: 48 },
  input: { flex: 1, fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#1E293B', height: '100%', paddingVertical: 0 },
  inputIcon: { padding: 6 },
  sendButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  enviarBtnDisabled: { opacity: 0.5 },
  loginParaComentar: { marginHorizontal: 24, marginTop: 16, marginBottom: 24, alignItems: 'center', paddingVertical: 24, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  loginParaComentarText: { fontSize: 14, color: '#94A3B8', fontFamily: 'Inter' },
});
