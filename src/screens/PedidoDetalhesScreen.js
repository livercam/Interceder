// Tela de Detalhes do Pedido de Oração
// Funcionalidades:
// - Cabeçalho com avatar, nome, data e tag de categoria
// - Texto completo do pedido
// - Botão grande "🙏 Interceder" com animação Lottie
// - Seção de Mensagens de Apoio (comentários)
// - Réplicas (Reply) a mensagens específicas
// - Detetor de @menções com sugestões de username
// - Renderização de @menções destacadas no texto

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIAS_PEDIDO } from '../constants/firestore';
import {
  getPedido,
  adicionarMensagemApoio,
  listarMensagensApoio,
  excluirMensagemApoio,
  buscarUsuariosPorUsername,
  toggleSalvarPedido,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';
import DenunciaModal from '../components/DenunciaModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// Utilitários
// ============================================================
const getCategoriaColor = (cat) => {
  const cores = {
    saude: '#EF4444',
    familia: '#3B82F6',
    financas: '#10B981',
    espiritual: '#8B5CF6',
    vida_sentimental: '#EC4899',
    outros: '#6B7280',
  };
  return cores[cat] || COLORS.gray400;
};

const getCategoriaLabel = (cat) => {
  const labels = {
    saude: 'Saúde',
    familia: 'Família',
    financas: 'Finanças',
    espiritual: 'Espiritual',
    vida_sentimental: 'Vida Sentimental',
    outros: 'Outros',
  };
  return labels[cat] || cat;
};

const getTempoRelativo = (timestamp) => {
  if (!timestamp) return 'agora';
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
// Renderizador de Texto com @Menções Destacadas
// ============================================================
function renderTextoComMencoes(texto, estiloBase = {}) {
  if (!texto) return null;

  // Regex para encontrar palavras que começam com @ seguidas de letras/números/underscore
  const regex = /(@[a-zA-Z0-9_]+)/g;
  const partes = texto.split(regex);

  return (
    <Text style={estiloBase}>
      {partes.map((parte, index) => {
        if (parte.startsWith('@')) {
          return (
            <Text key={index} style={[estiloBase, styles.mencaoTexto]}>
              {parte}
            </Text>
          );
        }
        return (
          <Text key={index} style={estiloBase}>
            {parte}
          </Text>
        );
      })}
    </Text>
  );
}

// ============================================================
// Tela de Detalhes do Pedido
// ============================================================
export default function PedidoDetalhesScreen({ route, navigation }) {
  const { pedidoId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTempoModal, setShowTempoModal] = useState(false);

  // Mensagens de apoio
  const [mensagens, setMensagens] = useState([]);
  const [textoMensagem, setTextoMensagem] = useState('');
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  // Réplicas (Reply)
  const [replyingTo, setReplyingTo] = useState(null);
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);

  // @Menções
  const [usuariosSugeridos, setUsuariosSugeridos] = useState([]);
  const [termoMencao, setTermoMencao] = useState(null);
  const [mentions, setMentions] = useState([]); // Array de { uid, username }
  const debounceTimer = useRef(null);

  // Denúncia
  const [showDenunciaModal, setShowDenunciaModal] = useState(false);

  // Carregar pedido
  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await getPedido(pedidoId);
        setPedido(dados);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar o pedido.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [pedidoId]);

  // Escutar mensagens de apoio em tempo real
  useEffect(() => {
    const unsubscribe = listarMensagensApoio(pedidoId, (mensagensAtualizadas) => {
      setMensagens(mensagensAtualizadas);
    });
    return () => unsubscribe();
  }, [pedidoId]);

  const handleAbrirSalaIntercessao = (tempoSegundos) => {
    setShowTempoModal(false);
    navigation.navigate('SalaIntercessao', {
      pedidoId: pedido.id,
      pedidoTexto: pedido.texto,
      pedidoAutor: pedido.autor_nome,
      tempoSegundos,
    });
  };

  // ============================================================
  // Lógica de @Menções no Input
  // ============================================================
  const handleChangeTexto = useCallback(
    (texto) => {
      setTextoMensagem(texto);

      // Detetar se o utilizador está a digitar um @username
      // Regex: encontra o último @ seguido de caracteres alfanuméricos
      const matchMencao = texto.match(/@([a-zA-Z0-9_]*)$/);

      if (matchMencao) {
        const termo = matchMencao[1]; // O que foi digitado depois do @
        setTermoMencao(termo);

        // Debounce para evitar chamadas excessivas ao Firestore
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(async () => {
          if (termo.length >= 1) {
            const resultados = await buscarUsuariosPorUsername(`@${termo}`);
            setUsuariosSugeridos(resultados);
          } else {
            setUsuariosSugeridos([]);
          }
        }, 300);
      } else {
        // Não está a digitar uma menção
        setTermoMencao(null);
        setUsuariosSugeridos([]);
      }
    },
    []
  );

  // ============================================================
  // Selecionar um utilizador sugerido
  // ============================================================
  const handleSelecionarUsuario = useCallback(
    (usuario) => {
      // Substituir o @termo atual pelo username completo
      const novoTexto = textoMensagem.replace(/@[a-zA-Z0-9_]*$/, usuario.username);
      setTextoMensagem(novoTexto + ' ');

      // Adicionar ao array de mentions
      setMentions((prev) => {
        // Evitar duplicatas
        const jaExiste = prev.some((m) => m.uid === usuario.uid);
        if (jaExiste) return prev;
        return [...prev, { uid: usuario.uid, username: usuario.username }];
      });

      // Limpar sugestões
      setUsuariosSugeridos([]);
      setTermoMencao(null);
    },
    [textoMensagem]
  );

  // ============================================================
  // Iniciar Réplica (Reply)
  // ============================================================
  const handleReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, autor: msg.autor_nome });
    // Focar no input
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
  // Enviar Mensagem (com reply e mentions)
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
        mentions: mentions.length > 0 ? mentions : [],
      };

      await adicionarMensagemApoio(pedidoId, mensagemData);
      setTextoMensagem('');
      setReplyingTo(null);
      setMentions([]);
      setUsuariosSugeridos([]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  // ============================================================
  // Excluir Mensagem de Apoio
  // ============================================================
  const handleExcluirMensagem = useCallback(
    (msg) => {
      // Regra: só pode excluir se for o autor da mensagem OU o autor do pedido
      const podeExcluir =
        user &&
        pedido &&
        (msg.autor_id === user.uid || pedido.autor_id === user.uid);

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
                await excluirMensagemApoio(pedidoId, msg.id);
              } catch (error) {
                Alert.alert('Erro', 'Não foi possível excluir a mensagem.');
              }
            },
          },
        ]
      );
    },
    [user, pedido, pedidoId]
  );

  // ============================================================
  // Denunciar Pedido (abre modal lateral)
  // ============================================================
  const handleDenunciar = useCallback(() => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para denunciar.');
      return;
    }
    setShowDenunciaModal(true);
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!pedido) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Pedido não encontrado</Text>
        <TouchableOpacity style={styles.voltarBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.voltarBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const categoriaColor = getCategoriaColor(pedido.categoria);

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
        ref={scrollViewRef}
        onContentSizeChange={() => {}}
      >
        {/* ============================================ */}
        {/* Cabeçalho do Autor */}
        {/* ============================================ */}
        <View style={styles.autorSection}>
          <View style={styles.autorRow}>
              {pedido.autor_foto_url ? (
                <TouchableOpacity
                  onPress={() => {
                    if (pedido.autor_id) {
                      navigation.navigate('PublicProfile', { userId: pedido.autor_id });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: pedido.autor_foto_url }} style={styles.autorAvatarFoto} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.autorAvatar}
                  onPress={() => {
                    if (pedido.autor_id) {
                      navigation.navigate('PublicProfile', { userId: pedido.autor_id });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.autorAvatarText}>
                    {pedido.autor_nome?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </TouchableOpacity>
              )}
            <TouchableOpacity
              style={styles.autorInfo}
              onPress={() => {
                if (pedido.autor_id) {
                  navigation.navigate('PublicProfile', { userId: pedido.autor_id });
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.autorNomeRow}>
                <Text style={styles.autorNome}>{formatarNomeCurto(pedido.autor_nome)}</Text>
                {pedido.autor_premium === true && (
                  <Text style={styles.seloPremium}>💎</Text>
                )}
                {/* Regra de Ouro: título ministerial só aparece se o ministério for reconhecido */}
                {(pedido.autor_endossos_count >= 5 || pedido.autor_verificado_lideranca === true) &&
                 pedido.autor_cargo && pedido.autor_cargo.toLowerCase() !== 'membro' && (
                  <View style={styles.cargoBadge}>
                    <Text style={styles.cargoBadgeText}>
                      {pedido.autor_cargo === 'diacono' ? 'Diácono' :
                       pedido.autor_cargo === 'missionario' ? 'Missionário' :
                       pedido.autor_cargo === 'evangelista' ? 'Evangelista' :
                       pedido.autor_cargo === 'presbitero' ? 'Presbítero' :
                       pedido.autor_cargo === 'pastor' ? 'Pastor' : pedido.autor_cargo} 🛡️
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.autorData}>
                {getTempoRelativo(pedido.createdAt)}
              </Text>
            </TouchableOpacity>

          </View>

          {/* Badge de Categoria + Ícones de Ação (alinhados horizontalmente) */}
          <View style={styles.categoriaAcoesRow}>
            <View style={styles.categoriaRow}>
              <View
                style={[
                  styles.categoriaTag,
                  { backgroundColor: categoriaColor + '20' },
                ]}
              >
                <Text style={[styles.categoriaText, { color: categoriaColor }]}>
                  {getCategoriaLabel(pedido.categoria)}
                </Text>
              </View>
              {pedido.privacidade === 'celula' && (
                <View style={styles.privacidadeTag}>
                  <Text style={styles.privacidadeText}>🔒 Célula</Text>
                </View>
              )}
            </View>

            <View style={styles.acoesIconRow} />
          </View>

        </View>

        {/* ============================================ */}
        {/* Texto Completo do Pedido */}
        {/* ============================================ */}
        <View style={styles.textoSection}>
          <View style={styles.textoLabelRow}>
            <Text style={styles.textoLabel}>📝 Pedido de Oração</Text>
            <TouchableOpacity
              style={styles.denunciarBtn}
              onPress={handleDenunciar}
              activeOpacity={0.7}
            >
              <Text style={styles.denunciarBtnText}>🚩</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.textoCompleto}>{pedido.texto}</Text>
        </View>

        {/* ============================================ */}
        {/* Botão Interceder + Contador (lado a lado) */}
        {/* ============================================ */}
        {pedido.status === 'respondido' ? (
          <View style={styles.intercessaoSection}>
            <View style={styles.respondidoBanner}>
              <Text style={styles.respondidoBannerIcon}>🎉</Text>
              <Text style={styles.respondidoBannerText}>
                Oração Respondida!
              </Text>
            </View>
            <View style={styles.intercessoresInfo}>
              <Text style={styles.intercessoresIcon}>💬</Text>
              <Text style={styles.intercessoresCount}>
                {mensagens.length}
              </Text>
              <Text style={styles.intercessoresDivider}>|</Text>
              <Text style={styles.intercessoresIcon}>🔥</Text>
              <Text style={styles.intercessoresCount}>
                {pedido.intercessores_count || 0}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.intercessaoSection}>
            <TouchableOpacity
              style={styles.intercederBtn}
              onPress={() => {
                if (!user) {
                  Alert.alert('Atenção', 'Faça login para interceder.');
                  return;
                }
                setShowTempoModal(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.intercederBtnIcon}>🙏</Text>
              <Text style={styles.intercederBtnText}>Interceder</Text>
            </TouchableOpacity>

            <View style={styles.intercessoresInfo}>
              <Text style={styles.intercessoresIcon}>💬</Text>
              <Text style={styles.intercessoresCount}>
                {mensagens.length}
              </Text>
              <Text style={styles.intercessoresDivider}>|</Text>
              <Text style={styles.intercessoresIcon}>🔥</Text>
              <Text style={styles.intercessoresCount}>
                {pedido.intercessores_count || 0}
              </Text>
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* Mensagens de Apoio */}
        {/* ============================================ */}
        <View style={styles.mensagensSection}>
          <Text style={styles.mensagensTitle}>
            💬 Mensagens de Apoio
          </Text>

          {mensagens.length === 0 ? (
            <View style={styles.semMensagens}>
              <Text style={styles.semMensagensEmoji}>💭</Text>
              <Text style={styles.semMensagensText}>
                Nenhuma mensagem de apoio ainda.
              </Text>
              <Text style={styles.semMensagensHint}>
                Seja o primeiro a encorajar!
              </Text>
            </View>
          ) : (
            <View style={styles.mensagemTimeline}>
              {mensagens.length > 1 && <View style={styles.mensagemLine} />}
              {mensagens.map((msg, index) => {
                const ehAutor = pedido && msg.autor_id === pedido.autor_id;
                return (
                  <View key={msg.id} style={styles.mensagemCardWrapper}>
                    <View style={styles.mensagemDot} />
                    <View style={[styles.mensagemCard, ehAutor && styles.mensagemCardAutor]}>
                      <View style={styles.mensagemHeader}>
                        <View style={styles.mensagemAvatar}>
                          <Text style={styles.mensagemAvatarText}>
                            {msg.autor_nome?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={styles.mensagemInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.mensagemAutor}>{formatarNomeCurto(msg.autor_nome)}</Text>
                            {ehAutor && (
                              <View style={styles.mensagemAutorBadge}>
                                <Text style={styles.mensagemAutorBadgeText}>👑 Autor</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.mensagemData}>
                            {getTempoRelativo(msg.criadoEm)}
                          </Text>
                        </View>

                        {/* Botão Responder (Réplica) */}
                        <TouchableOpacity
                          style={styles.replyBtn}
                          onPress={() => handleReply(msg)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.replyBtnText}>↩ Responder</Text>
                        </TouchableOpacity>

                        {/* Botão Excluir (Lixeira) */}
                        {user && pedido && (msg.autor_id === user.uid || pedido.autor_id === user.uid) && (
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

                      {/* Indicador de Réplica */}
                      {msg.replyTo_autor && (
                        <View style={styles.replyIndicator}>
                          <Text style={styles.replyIndicatorText}>
                            ↩ Respondendo a {formatarNomeCurto(msg.replyTo_autor)}
                          </Text>
                        </View>
                      )}

                      {/* Texto da mensagem com @menções destacadas */}
                      {renderTextoComMencoes(msg.texto, styles.mensagemTexto)}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* ============================================ */}
      {/* Pedido Respondido: Card de Testemunho em vez de Input */}
      {/* ============================================ */}
      {pedido?.status === 'respondido' ? (
        <View style={[styles.inputAreaCard, { paddingBottom: Math.max(insets.bottom, SPACING.sm), paddingVertical: SPACING.lg, alignItems: 'center' }]}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 4, textAlign: 'center' }}>Oração Respondida!</Text>
          <Text style={{ fontSize: 14, color: COLORS.gray500, textAlign: 'center', marginBottom: 12, lineHeight: 20 }}>
            Este pedido já foi respondido. Que tal compartilhar esse testemunho com a comunidade?
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 24 }}
            onPress={() => navigation.navigate('TestemunhoDetalhes', { testemunhoId: pedido.testemunho_id })}
            activeOpacity={0.85}
          >
            <Text style={{ color: COLORS.white, fontWeight: 'bold', fontSize: 16 }}>📖 Ver Testemunho</Text>
          </TouchableOpacity>
        </View>
      ) : user ? (
        <View style={[styles.inputAreaCard, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
          {/* Barra de Réplica Ativa */}
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

          {/* Sugestões de @Menções */}
          {usuariosSugeridos.length > 0 && (
            <View style={styles.sugestoesContainer}>
              <ScrollView
                style={styles.sugestoesList}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
              >
                {usuariosSugeridos.map((item) => (
                  <TouchableOpacity
                    key={item.uid}
                    style={styles.sugestaoItem}
                    onPress={() => handleSelecionarUsuario(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sugestaoAvatar}>
                      <Text style={styles.sugestaoAvatarText}>
                        {item.nome?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.sugestaoInfo}>
                      <Text style={styles.sugestaoNome} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      <Text style={styles.sugestaoUsername} numberOfLines={1}>
                        {item.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input + Botão Enviar */}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.mensagemInput}
              placeholder={
                replyingTo
                  ? `Responder a ${formatarNomeCurto(replyingTo.autor)}...`
                  : 'Escreva uma mensagem de apoio... (use @ para mencionar)'
              }
              placeholderTextColor={COLORS.gray400}
              value={textoMensagem}
              onChangeText={handleChangeTexto}
              multiline
              maxLength={500}
              editable={!enviandoMensagem}
            />
            <TouchableOpacity
              style={[
                styles.enviarBtn,
                (!textoMensagem.trim() || enviandoMensagem) && styles.enviarBtnDisabled,
              ]}
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
          <Text style={styles.loginParaComentarText}>
            🔒 Faça login para enviar mensagens de apoio.
          </Text>
        </View>
      )}

      {/* ============================================ */}
      {/* Modal de Seleção de Tempo de Intercessão */}
      {/* ============================================ */}
      <Modal
        visible={showTempoModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTempoModal(false)}
      >
        <View style={styles.tempoModalOverlay}>
          <View style={styles.tempoModalContainer}>
            <Text style={styles.tempoModalEmoji}>⏳</Text>
            <Text style={styles.tempoModalTitle}>
              Quanto tempo deseja dedicar a esta oração?
            </Text>
            <Text style={styles.tempoModalSubtitle}>
              Escolha um período para se concentrar em intercessão
            </Text>

            <View style={styles.tempoOpcoes}>
              <TouchableOpacity
                style={styles.tempoOpcao}
                onPress={() => handleAbrirSalaIntercessao(60)}
                activeOpacity={0.8}
              >
                <Text style={styles.tempoOpcaoIcon}>⏱️</Text>
                <Text style={styles.tempoOpcaoTempo}>1 minuto</Text>
                <Text style={styles.tempoOpcaoDesc}>Rápida</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tempoOpcao, styles.tempoOpcaoDestaque]}
                onPress={() => handleAbrirSalaIntercessao(180)}
                activeOpacity={0.8}
              >
                <Text style={styles.tempoOpcaoIcon}>🔥</Text>
                <Text style={styles.tempoOpcaoTempo}>3 minutos</Text>
                <Text style={styles.tempoOpcaoDesc}>Intensa</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tempoOpcao}
                onPress={() => handleAbrirSalaIntercessao(300)}
                activeOpacity={0.8}
              >
                <Text style={styles.tempoOpcaoIcon}>🙌</Text>
                <Text style={styles.tempoOpcaoTempo}>5 minutos</Text>
                <Text style={styles.tempoOpcaoDesc}>Profunda</Text>
              </TouchableOpacity>
            </View>

            {/* Divisor */}
            <View style={styles.tempoModalDivisor} />

            {/* Botão Salvar para Orar Mais Tarde (apenas para utilizadores logados) */}
            {user && (
              <TouchableOpacity
                style={styles.salvarPedidoBtn}
                onPress={async () => {
                  try {
                    await toggleSalvarPedido(user.uid, pedido.id, 'salvar');
                    setShowTempoModal(false);
                    Alert.alert('📌 Pedido salvo!', 'Pedido salvo na sua Lista de Oração.');
                  } catch (error) {
                    Alert.alert('Erro', 'Não foi possível salvar o pedido.');
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.salvarPedidoBtnIcon}>📌</Text>
                <Text style={styles.salvarPedidoBtnText}>
                  Salvar para Orar Mais Tarde
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.tempoModalCancelar}
              onPress={() => setShowTempoModal(false)}
            >
              <Text style={styles.tempoModalCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ============================================ */}
      {/* Modal de Denúncia (Lateral Animado) */}
      {/* ============================================ */}
      <DenunciaModal
        visible={showDenunciaModal}
        onClose={() => setShowDenunciaModal(false)}
        itemId={pedidoId}
        itemTipo="pedido"
      />
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
  },
  voltarBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  voltarBtnText: {
    color: COLORS.white,
    fontWeight: '600',
  },

  // Cabeçalho do Autor
  autorSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  autorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  autorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  autorAvatarFoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: SPACING.md,
  },
  autorAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  autorInfo: {
    flex: 1,
  },
  autorNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  autorNome: {
    fontSize: FONTS.sizes.lg,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.gray800,
  },
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
  autorData: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    marginTop: 2,
  },
  // Botão Denunciar
  denunciarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.danger + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  denunciarBtnText: {
    fontSize: 18,
  },

  categoriaAcoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  acoesIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  categoriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoriaTag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  categoriaText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  privacidadeTag: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  privacidadeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
  },

  // Texto do Pedido (largura total)
  textoSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    borderRadius: 0,
    padding: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  textoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  textoLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textoCompleto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 26,
  },

  // Intercessão (largura total)
  intercessaoSection: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 0,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  intercederBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  intercederBtnDisabled: {
    opacity: 0.7,
  },
  intercederBtnIcon: {
    fontSize: 24,
  },
  intercederBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  intercessoresInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  intercessoresIcon: {
    fontSize: 18,
  },
  intercessoresDivider: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray300,
    fontWeight: '300',
  },
  intercessoresCount: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    fontWeight: '700',
  },

  // Banner de Oração Respondida
  respondidoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  respondidoBannerIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  respondidoBannerText: {
    fontSize: FONTS.sizes.md,
    color: '#2E7D32',
    fontWeight: 'bold',
  },

  // Mensagens de Apoio (largura total)
  mensagensSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    borderRadius: 0,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  mensagensTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },
  semMensagens: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  semMensagensEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  semMensagensText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  semMensagensHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  mensagemTimeline: {
    position: 'relative',
    paddingLeft: SPACING.md,
  },
  mensagemLine: {
    position: 'absolute',
    left: 16,
    top: 32,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.gray200,
  },
  mensagemCardWrapper: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  mensagemCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginLeft: SPACING.md,
    position: 'relative',
  },
  mensagemCardAutor: {
    backgroundColor: COLORS.primary + '08',
    borderColor: COLORS.primary + '25',
  },
  mensagemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  mensagemAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  mensagemAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
  },
  mensagemInfo: {
    flex: 1,
  },
  mensagemAutor: {
    fontSize: FONTS.sizes.sm,
    fontFamily: 'Nunito_700Bold',
    color: COLORS.gray700,
  },
  mensagemData: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },
  mensagemTexto: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  mensagemAutorBadge: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: SPACING.xs,
  },
  mensagemAutorBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  mensagemDot: {
    position: 'absolute',
    left: -SPACING.md - 12,
    top: 18,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  // @Menção destacada no texto
  mencaoTexto: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  // Botão Responder (Réplica)
  replyBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary + '10',
    marginLeft: SPACING.sm,
  },
  replyBtnText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Botão Excluir Mensagem (Lixeira)
  excluirMsgBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.danger + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  excluirMsgBtnText: {
    fontSize: 12,
  },

  // Indicador de Réplica na mensagem
  replyIndicator: {
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.xs,
    alignSelf: 'flex-start',
  },
  replyIndicatorText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontStyle: 'italic',
  },

  // Card Elevado de Input — respeita safe area do Android
  inputAreaCard: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    ...SHADOWS.lg,
  },

  // Login para comentar (visitantes)
  loginParaComentar: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  loginParaComentarText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    textAlign: 'center',
  },

  // Barra de Réplica Ativa
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginBottom: SPACING.xs,
  },
  replyBarText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray600,
    fontStyle: 'italic',
  },
  replyBarNome: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  replyBarClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  replyBarCloseText: {
    fontSize: 11,
    color: COLORS.gray600,
    fontWeight: 'bold',
  },

  // Sugestões de @Menções
  sugestoesContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    ...SHADOWS.md,
    maxHeight: 200,
  },
  sugestoesList: {
    maxHeight: 200,
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  sugestaoAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  sugestaoAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
  sugestaoInfo: {
    flex: 1,
  },
  sugestaoNome: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  sugestaoUsername: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },

  // Input Row
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  mensagemInput: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray800,
    maxHeight: 80,
  },
  enviarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  enviarBtnDisabled: {
    opacity: 0.5,
  },
  enviarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  // Modal de Seleção de Tempo
  tempoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  tempoModalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  tempoModalEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  tempoModalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  tempoModalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  tempoOpcoes: {
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tempoOpcao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.gray200,
  },
  tempoOpcaoDestaque: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  tempoOpcaoIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  tempoOpcaoTempo: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    flex: 1,
  },
  tempoOpcaoDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  tempoModalDivisor: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.gray200,
    marginBottom: SPACING.md,
  },
  salvarPedidoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: '100%',
    borderWidth: 2,
    borderColor: COLORS.gray200,
    marginBottom: SPACING.md,
  },
  salvarPedidoBtnIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  salvarPedidoBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  tempoModalCancelar: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tempoModalCancelarText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },
});