// Tela de Detalhes do Testemunho
// Funcionalidades:
// - Cabeçalho com avatar, nome e data
// - Texto completo do testemunho
// - Botão "🙌 Glória a Deus!" para celebrar
// - Botão de denúncia (bandeira 🚩)
// - Seção de Mensagens de Apoio (comentários)
// - Réplicas (Reply) a mensagens específicas

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
import { formatarNomeCurto } from '../utils/formatters';
import DenunciaModal from '../components/DenunciaModal';

// ============================================================
// Utilitários
// ============================================================
const getTempoRelativo = (timestamp) => {
  if (!timestamp) return 'agora mesmo';
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHoras < 24) return `há ${diffHoras}h`;
  if (diffDias < 7) return `há ${diffDias}d`;
  return data.toLocaleDateString('pt-PT');
};

// ============================================================
// Componente de Partícula Flutuante (Chuva de Glória)
// ============================================================
const EMOJIS_GLORIA = ['🙌', '🔥', '✨', '🌟', '💫', '🕊️', '❤️', '🎉'];

function ParticulaGloria({ id, xOffset, onRemover }) {
  const animY = useRef(new Animated.Value(0)).current;
  const animOpacity = useRef(new Animated.Value(1)).current;
  const emoji = useRef(EMOJIS_GLORIA[Math.floor(Math.random() * EMOJIS_GLORIA.length)]).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animY, {
        toValue: -150,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRemover(id);
    });
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        bottom: 0,
        left: 20 + xOffset,
        fontSize: 24,
        transform: [{ translateY: animY }],
        opacity: animOpacity,
        zIndex: 999,
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ============================================================
// Tela de Detalhes do Testemunho
// ============================================================
export default function TestemunhoDetalhesScreen({ route, navigation }) {
  const { testemunhoId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [testemunho, setTestemunho] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mensagens de apoio
  const [mensagens, setMensagens] = useState([]);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  // Réplicas (Reply)
  const [replyingTo, setReplyingTo] = useState(null);
  const inputRef = useRef(null);

  // Denúncia
  const [showDenunciaModal, setShowDenunciaModal] = useState(false);

  // Partículas de Glória (Chuva de Animações)
  const [particulas, setParticulas] = useState([]);

  // Carregar testemunho
  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await getTestemunho(testemunhoId);
        setTestemunho(dados);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar o testemunho.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [testemunhoId]);

  // Escutar mensagens de apoio em tempo real
  useEffect(() => {
    const unsubscribe = listarMensagensApoioTestemunho(testemunhoId, (mensagensAtualizadas) => {
      setMensagens(mensagensAtualizadas);
    });
    return () => unsubscribe();
  }, [testemunhoId]);

  // ============================================================
  // Celebrar (Glória a Deus!) + Chuva de Partículas
  // ============================================================
  const handleCelebrar = useCallback(async () => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para celebrar.');
      return;
    }

    // Gerar partícula visual (mesmo se o backend falhar)
    const novaParticula = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      xOffset: Math.random() * 40 - 20, // deslocamento lateral aleatório entre -20 e +20
    };
    setParticulas((prev) => [...prev, novaParticula]);

    try {
      await celebrarTestemunho(testemunhoId, user.uid);
      setTestemunho((prev) => prev ? { ...prev, glorias: (prev.glorias || 0) + 1 } : prev);
    } catch (error) {
      // Silencia o erro (ex: "Já celebraste") — a partícula visual já foi gerada
    }
  }, [user, testemunhoId]);

  // ============================================================
  // Remover partícula após animação terminar
  // ============================================================
  const removerParticula = useCallback((id) => {
    setParticulas((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ============================================================
  // Denunciar (abre modal lateral)
  // ============================================================
  const handleDenunciar = useCallback(() => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para denunciar.');
      return;
    }
    setShowDenunciaModal(true);
  }, [user]);

  // ============================================================
  // Iniciar Réplica (Reply)
  // ============================================================
  const handleReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, autor: msg.autor_nome });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // ============================================================
  // Cancelar Réplica
  // ============================================================
  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // ============================================================
  // Enviar Mensagem
  // ============================================================
  const handleEnviarMensagem = async () => {
    if (!textoMensagem.trim()) return;
    if (!user) {
      Alert.alert('Atenção', 'Faça login para enviar mensagens.');
      return;
    }

    setEnviandoMensagem(true);
    try {
      const mensagemData = {
        autor_id: user.uid,
        autor_nome: user.displayName || 'Anônimo',
        texto: textoMensagem.trim(),
        replyTo_id: replyingTo ? replyingTo.id : null,
        replyTo_autor: replyingTo ? replyingTo.autor : null,
      };

      await adicionarMensagemApoioTestemunho(testemunhoId, mensagemData);
      setTextoMensagem('');
      setReplyingTo(null);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  // ============================================================
  // Excluir Mensagem
  // ============================================================
  const handleExcluirMensagem = useCallback(
    (msg) => {
      const podeExcluir =
        user &&
        testemunho &&
        (msg.autor_id === user.uid || testemunho.autor_id === user.uid);

      if (!podeExcluir) return;

      Alert.alert(
        'Excluir Mensagem',
        'Tem certeza que deseja excluir esta mensagem?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              try {
                await excluirMensagemApoioTestemunho(testemunhoId, msg.id);
              } catch (error) {
                Alert.alert('Erro', 'Não foi possível excluir a mensagem.');
              }
            },
          },
        ]
      );
    },
    [user, testemunho, testemunhoId]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!testemunho) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Testemunho não encontrado</Text>
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
        {/* Cabeçalho do Autor */}
        <View style={styles.autorSection}>
          <View style={styles.autorRow}>
              {testemunho.autor_foto_url ? (
                <TouchableOpacity
                  onPress={() => {
                    if (testemunho.autor_id) {
                      navigation.navigate('PublicProfile', { userId: testemunho.autor_id });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: testemunho.autor_foto_url }} style={styles.autorAvatarFoto} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.autorAvatar}
                  onPress={() => {
                    if (testemunho.autor_id) {
                      navigation.navigate('PublicProfile', { userId: testemunho.autor_id });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.autorAvatarText}>
                    {testemunho.autor_nome?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </TouchableOpacity>
              )}
            <TouchableOpacity
              style={styles.autorInfo}
              onPress={() => {
                if (testemunho.autor_id) {
                  navigation.navigate('PublicProfile', { userId: testemunho.autor_id });
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.autorNomeRow}>
                <Text style={styles.autorNome}>{formatarNomeCurto(testemunho.autor_nome)}</Text>
                {testemunho.autor_premium === true && (
                  <Text style={styles.seloPremium}>💎</Text>
                )}
                {/* Regra de Ouro: título ministerial só aparece se o ministério for reconhecido */}
                {(testemunho.autor_endossos_count >= 5 || testemunho.autor_verificado_lideranca === true) &&
                 testemunho.autor_cargo && testemunho.autor_cargo.toLowerCase() !== 'membro' && (
                  <View style={styles.cargoBadge}>
                    <Text style={styles.cargoBadgeText}>
                      {testemunho.autor_cargo === 'diacono' ? 'Diácono' :
                       testemunho.autor_cargo === 'missionario' ? 'Missionário' :
                       testemunho.autor_cargo === 'evangelista' ? 'Evangelista' :
                       testemunho.autor_cargo === 'presbitero' ? 'Presbítero' :
                       testemunho.autor_cargo === 'pastor' ? 'Pastor' : testemunho.autor_cargo} 🛡️
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.autorData}>
                {getTempoRelativo(testemunho.criadoEm)}
              </Text>
            </TouchableOpacity>
          </View>

          {testemunho.pedido_vinculado_id && (
            <TouchableOpacity
              style={styles.linkPedidoBtn}
              onPress={() =>
                navigation.navigate('PedidoDetalhes', {
                  pedidoId: testemunho.pedido_vinculado_id,
                })
              }
              activeOpacity={0.7}
            >
              <Text style={styles.linkPedidoText}>🔗 Ver pedido de oração original</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Texto Completo do Testemunho */}
        <View style={styles.textoSection}>
          <View style={styles.textoLabelRow}>
            <Text style={styles.textoLabel}>🕊️ Testemunho</Text>
            <TouchableOpacity
              style={styles.denunciarBtn}
              onPress={handleDenunciar}
              activeOpacity={0.7}
            >
              <Text style={styles.denunciarBtnText}>🚩</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.textoCompleto}>{testemunho.texto}</Text>
        </View>

        {/* Botão Glória a Deus! + Chuva de Partículas + Contadores */}
        <View style={styles.gloriaSection}>
          <View style={styles.gloriaBtnContainer}>
            <TouchableOpacity
              style={styles.gloriaBtn}
              onPress={handleCelebrar}
              activeOpacity={0.85}
            >
              <Text style={styles.gloriaBtnIcon}>🙌</Text>
              <Text style={styles.gloriaBtnText}>Glória a Deus!</Text>
            </TouchableOpacity>

            {/* Partículas flutuando para cima */}
            {particulas.map((p) => (
              <ParticulaGloria
                key={p.id}
                id={p.id}
                xOffset={p.xOffset}
                onRemover={removerParticula}
              />
            ))}
          </View>

          <View style={styles.gloriaInfo}>
            <Text style={styles.gloriaIcon}>💬</Text>
            <Text style={styles.gloriaCount}>{mensagens.length}</Text>
            <Text style={styles.gloriaDivider}>|</Text>
            <Text style={styles.gloriaIcon}>🔥</Text>
            <Text style={styles.gloriaCount}>{testemunho.glorias || 0}</Text>
          </View>
        </View>

        {/* Mensagens de Apoio */}
        <View style={styles.mensagensSection}>
          <Text style={styles.mensagensTitle}>💬 Parabéns e Mensagens</Text>

          {mensagens.length === 0 ? (
            <View style={styles.semMensagens}>
              <Text style={styles.semMensagensEmoji}>💭</Text>
              <Text style={styles.semMensagensText}>Nenhuma mensagem ainda.</Text>
              <Text style={styles.semMensagensHint}>Seja o primeiro a dar os parabéns!</Text>
            </View>
          ) : (
            mensagens.map((msg) => (
              <View key={msg.id} style={styles.mensagemCard}>
                <View style={styles.mensagemHeader}>
                  <View style={styles.mensagemAvatar}>
                    <Text style={styles.mensagemAvatarText}>
                      {msg.autor_nome?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.mensagemInfo}>
                    <Text style={styles.mensagemAutor}>{formatarNomeCurto(msg.autor_nome)}</Text>
                    <Text style={styles.mensagemData}>{getTempoRelativo(msg.criadoEm)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.replyBtn}
                    onPress={() => handleReply(msg)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.replyBtnText}>↩ Responder</Text>
                  </TouchableOpacity>
                  {user && testemunho && (msg.autor_id === user.uid || testemunho.autor_id === user.uid) && (
                    <TouchableOpacity
                      style={styles.excluirMsgBtn}
                      onPress={() => handleExcluirMensagem(msg)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.excluirMsgBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {msg.replyTo_autor && (
                  <View style={styles.replyIndicator}>
                    <Text style={styles.replyIndicatorText}>↩ Respondendo a {formatarNomeCurto(msg.replyTo_autor)}</Text>
                  </View>
                )}
                <Text style={styles.mensagemTexto}>{msg.texto}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* ============================================ */}
      {/* Input de Mensagem (FORA da ScrollView) — Card Elevado */}
      {/* ============================================ */}
      {user ? (
        <View style={[styles.inputAreaCard, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
          {replyingTo && (
            <View style={styles.replyBar}>
              <Text style={styles.replyBarText} numberOfLines={1}>
                ↩ Respondendo a <Text style={styles.replyBarNome}>{formatarNomeCurto(replyingTo.autor)}</Text>
              </Text>
              <TouchableOpacity
                style={styles.replyBarClose}
                onPress={handleCancelReply}
                activeOpacity={0.7}
              >
                <Text style={styles.replyBarCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.mensagemInput}
              placeholder={replyingTo ? `Responder a ${formatarNomeCurto(replyingTo.autor)}...` : 'Escreva uma mensagem de parabéns...'}
              placeholderTextColor={COLORS.gray400}
              value={textoMensagem}
              onChangeText={setTextoMensagem}
              multiline
              maxLength={500}
              editable={!enviandoMensagem}
            />
            <TouchableOpacity
              style={[styles.enviarBtn, (!textoMensagem.trim() || enviandoMensagem) && styles.enviarBtnDisabled]}
              onPress={handleEnviarMensagem}
              disabled={!textoMensagem.trim() || enviandoMensagem}
              activeOpacity={0.8}
            >
              {enviandoMensagem ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.enviarBtnText}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.loginParaComentar}>
          <Text style={styles.loginParaComentarText}>🔒 Faça login para enviar mensagens.</Text>
        </View>
      )}

      {/* ============================================ */}
      {/* Modal de Denúncia (Lateral Animado) */}
      {/* ============================================ */}
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
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  errorText: { fontSize: FONTS.sizes.lg, color: COLORS.gray500, marginBottom: SPACING.md },
  voltarBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md },
  voltarBtnText: { color: COLORS.white, fontWeight: '600' },
  autorSection: { backgroundColor: COLORS.white, padding: SPACING.lg, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, ...SHADOWS.md, marginBottom: SPACING.md },
  autorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  autorAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  autorAvatarFoto: { width: 48, height: 48, borderRadius: 24, marginRight: SPACING.md },
  autorAvatarText: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
  autorInfo: { flex: 1 },
  autorNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  autorNome: { fontSize: FONTS.sizes.lg, fontFamily: 'Nunito_700Bold', color: COLORS.gray800 },
  seloPremium: {
    fontSize: 18,
  },
  cargoBadge: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cargoBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  autorData: { fontSize: FONTS.sizes.sm, color: COLORS.gray400, marginTop: 2 },
  denunciarBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.danger + '10', justifyContent: 'center', alignItems: 'center' },
  denunciarBtnText: { fontSize: 18 },
  linkPedidoBtn: { backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, alignSelf: 'flex-start' },
  linkPedidoText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },
  textoSection: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.md, marginBottom: SPACING.md },
  textoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  textoLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 1 },
  textoCompleto: { fontSize: FONTS.sizes.md, color: COLORS.gray800, lineHeight: 26 },
  gloriaSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.md },
  gloriaBtnContainer: { position: 'relative', overflow: 'visible' },
  gloriaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4CAF50', borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: SPACING.lg, ...SHADOWS.sm },
  gloriaBtnIcon: { fontSize: 20, marginRight: SPACING.sm },
  gloriaBtnText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
  gloriaBtnDisabled: { opacity: 0.7 },
  gloriaBtnDisabledText: { color: COLORS.gray400 },
  gloriaBtnIconDisabled: { opacity: 0.5 },
  gloriaBtnTextDisabled: { color: COLORS.gray400 },
  gloriaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  gloriaIcon: {
    fontSize: 18,
  },
  gloriaDivider: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray300,
    fontWeight: '300',
    marginHorizontal: 2,
  },
  gloriaCount: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    fontWeight: '700',
  },
  mensagensSection: { backgroundColor: COLORS.white, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.md, marginBottom: SPACING.md },
  mensagensTitle: { fontSize: FONTS.sizes.md, fontWeight: 'bold', color: COLORS.gray800, marginBottom: SPACING.md },
  semMensagens: { alignItems: 'center', paddingVertical: SPACING.lg },
  semMensagensEmoji: { fontSize: 40, marginBottom: SPACING.sm },
  semMensagensText: { fontSize: FONTS.sizes.md, color: COLORS.gray500, marginBottom: SPACING.xs },
  semMensagensHint: { fontSize: FONTS.sizes.sm, color: COLORS.gray400 },
  mensagemCard: { backgroundColor: COLORS.background, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm },
  mensagemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  mensagemAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  mensagemAvatarText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: 'bold' },
  mensagemInfo: { flex: 1 },
  mensagemAutor: { fontSize: FONTS.sizes.sm, fontFamily: 'Nunito_700Bold', color: COLORS.gray800 },
  mensagemData: { fontSize: FONTS.sizes.xs, color: COLORS.gray400 },
  replyBtn: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  replyBtnText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600' },
  excluirMsgBtn: { padding: SPACING.xs },
  excluirMsgBtnText: { fontSize: 16 },
  replyIndicator: { backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, marginBottom: SPACING.sm, alignSelf: 'flex-start' },
  replyIndicatorText: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontStyle: 'italic' },
  mensagemTexto: { fontSize: FONTS.sizes.sm, color: COLORS.gray700, lineHeight: 20 },
  inputArea: { marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.gray200, paddingTop: SPACING.md },

  // Card Elevado de Input — respeita safe area do Android
  inputAreaCard: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    ...SHADOWS.lg,
  },

  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '10', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, marginBottom: SPACING.sm },
  replyBarText: { flex: 1, fontSize: FONTS.sizes.xs, color: COLORS.gray600 },
  replyBarNome: { fontWeight: 'bold', color: COLORS.primary },
  replyBarClose: { padding: SPACING.xs },
  replyBarCloseText: { fontSize: 14, color: COLORS.gray500, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  mensagemInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: FONTS.sizes.sm, maxHeight: 100, borderWidth: 1, borderColor: COLORS.gray300, marginRight: SPACING.sm },
  enviarBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, justifyContent: 'center', alignItems: 'center' },
  enviarBtnDisabled: { opacity: 0.5 },
  enviarBtnText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '600' },
  loginParaComentar: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  loginParaComentarText: { fontSize: FONTS.sizes.sm, color: COLORS.gray500 },
});