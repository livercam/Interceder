// Tela de Detalhes do Pedido de Oração

// - Cabeçalho com avatar, nome, data e tag de categoria
// - Texto completo do pedido
// - Botão grande "🙏 Interceda" com animação Lottie
// - Seção de Mensagens de Apoio (comentários)
// - Réplicas (Reply) a mensagens específicas
// - Detetor de @menções com sugestões de username
// - Renderização de @menções destacadas no texto

import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from "../constants/theme";
import { CATEGORIAS_PEDIDO } from "../constants/firestore";
import {
  getPedido,
  adicionarMensagemApoio,
  listarMensagensApoio,
  excluirMensagemApoio,
  buscarUsuariosPorUsername,
  toggleSalvarPedido,
} from "../services/firestoreService";
import { useAuth } from "../contexts/AuthContext";
import { formatarNomeCurto } from "../utils/formatters";
import FeedAudio from "../components/FeedAudio";
import DenunciaModal from "../components/DenunciaModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================
// Utilitários
// ============================================================
const getCategoriaColor = (cat) => {
  const cores = {
    saude: "#EF4444",
    familia: "#3B82F6",
    financas: "#10B981",
    espiritual: "#8B5CF6",
    vida_sentimental: "#EC4899",
    outros: "#6B7280",
  };
  return cores[cat] || COLORS.gray400;
};

const getCategoriaLabel = (cat) => {
  const labels = {
    saude: "Saúde",
    familia: "Família",
    financas: "Finanças",
    espiritual: "Espiritual",
    vida_sentimental: "Vida Sentimental",
    outros: "Outros",
  };
  return labels[cat] || cat;
};

const getTempoRelativo = (timestamp) => {
  if (!timestamp) return "agora";
  const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHoras < 24) return `há ${diffHoras}h`;
  if (diffDias < 7) return `há ${diffDias}d`;
  return data.toLocaleDateString("pt-PT");
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
        if (parte.startsWith("@")) {
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
  const [textoMensagem, setTextoMensagem] = useState("");
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
        Alert.alert("Erro", "Não foi possível carregar o pedido.");
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
    navigation.navigate("SalaIntercessao", {
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
      setTextoMensagem(novoTexto + " ");

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
      Alert.alert("Atenção", "Faça login para enviar mensagens.");
      return;
    }

    setEnviandoMensagem(true);
    try {
      const mensagemData = {
        autor_id: user.uid,
        autor_nome: user.displayName || "Anônimo",
        texto: textoMensagem.trim(),
        replyTo_id: replyingTo ? replyingTo.id : null,
        replyTo_autor: replyingTo ? replyingTo.autor : null,
        mentions: mentions.length > 0 ? mentions : [],
      };

      await adicionarMensagemApoio(pedidoId, mensagemData);
      setTextoMensagem("");
      setReplyingTo(null);
      setMentions([]);
      setUsuariosSugeridos([]);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível enviar a mensagem.");
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
        "Excluir Mensagem",
        "Tem certeza que deseja excluir esta mensagem?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              try {
                await excluirMensagemApoio(pedidoId, msg.id);
              } catch (error) {
                Alert.alert("Erro", "Não foi possível excluir a mensagem.");
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
      Alert.alert("Atenção", "Faça login para denunciar.");
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
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
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
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              {pedido.autor_foto_url ? (
                <TouchableOpacity onPress={() => { if (pedido.autor_id) navigation.navigate("PublicProfile", { userId: pedido.autor_id }); }} activeOpacity={0.7}>
                  <Image source={{ uri: pedido.autor_foto_url }} style={styles.autorAvatarFoto} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.autorAvatar} onPress={() => { if (pedido.autor_id) navigation.navigate("PublicProfile", { userId: pedido.autor_id }); }} activeOpacity={0.7}>
                  <Text style={styles.autorAvatarText}>{pedido.autor_nome?.charAt(0)?.toUpperCase() || "?"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.autorInfo} onPress={() => { if (pedido.autor_id) navigation.navigate("PublicProfile", { userId: pedido.autor_id }); }} activeOpacity={0.7}>
                <View style={styles.autorNomeRow}>
                  <Text style={styles.autorNome}>{formatarNomeCurto(pedido.autor_nome)}</Text>
                  {pedido.autor_premium === true && <Text style={styles.seloPremium}>💎</Text>}
                </View>
                <Text style={styles.autorData}>
                  {(pedido.autor_endossos_count >= 5 || pedido.autor_verificado_lideranca === true) && pedido.autor_cargo && pedido.autor_cargo.toLowerCase() !== "membro"
                    ? (pedido.autor_cargo === "diacono" ? "Diácono" :
                       pedido.autor_cargo === "missionario" ? "Missionário" :
                       pedido.autor_cargo === "evangelista" ? "Evangelista" :
                       pedido.autor_cargo === "presbitero" ? "Presbítero" :
                       pedido.autor_cargo === "pastor" ? "Pastor" : pedido.autor_cargo)
                    : "Membro"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.headerBadgeWrap, { display: "none" }]}>
              <TouchableOpacity onPress={() => { if (pedido.autor_id) navigation.navigate("PublicProfile", { userId: pedido.autor_id }); }} activeOpacity={0.7}>
                <View style={[styles.categoriaTag, { backgroundColor: categoriaColor + "20" }]}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View><View style={styles.pedidoContainer}>
          <View style={styles.pedidoHeader}>
            <View style={styles.pedidoHeaderLeft}>
              <View style={styles.pedidoIconBg}>
                <Text style={{ fontSize: 18 }}>📝</Text>
              </View>
              <View style={styles.pedidoTitleCol}>
                <Text style={styles.pedidoTitle}>Pedido de Oração</Text>
                <View style={styles.pedidoUnderline} />
              </View>
            </View>
            <View style={styles.pedidoAlertBg}>
              <TouchableOpacity onPress={handleDenunciar} activeOpacity={0.7}>
                <Text style={{ fontSize: 16 }}>⛔</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.pedidoBody}>{pedido.texto}</Text>
          <View style={styles.pedidoDivider} />
          <View style={styles.pedidoFooter}>
            <View style={styles.pedidoFooterItem}>
              <View style={styles.pedidoIconSec}>
                <Text style={{ fontSize: 14 }}>🏷️</Text>
              </View>
              <View style={styles.pedidoFooterCol}>
                <Text style={styles.pedidoLabel}>Tipo</Text>
                <Text style={styles.pedidoValue}>{getCategoriaLabel(pedido.categoria)}</Text>
              </View>
            </View>
            <View style={styles.pedidoFooterItem}>
              <View style={styles.pedidoIconSec}>
                <Text style={{ fontSize: 14 }}>📅</Text>
              </View>
              <View style={styles.pedidoFooterCol}>
                <Text style={styles.pedidoLabel}>Enviado em</Text>
                <Text style={styles.pedidoValue}>{getTempoRelativo(pedido.createdAt)}</Text>
              </View>
            </View>
          </View>
        </View>
        {/* ============================================ */}
        {/* Botão Interceda + Contador (lado a lado) */}
        {/* ============================================ */}
        {pedido.status === "respondido" ? (
          <View style={styles.cardContainer}>
            <View style={styles.bannerTop}>
              <View style={styles.bannerLeftContent}>
                <View style={styles.iconCircle}>
                  <Text style={{ fontSize: 24 }}>🎉</Text>
                </View>
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>Oração Respondida!</Text>
                  <Text style={styles.bannerSubtitle}>Este pedido já foi respondido</Text>
                </View>
              </View>
            </View>
            <View style={styles.statsBottom}>
              <View style={styles.statItem}>
                <Text style={{ fontSize: 20 }}>💬</Text>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statNumber}>{mensagens.length}</Text>
                  <Text style={styles.statLabel}>Mensagens</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statNumber}>{pedido.intercessores_count || 0}</Text>
                  <Text style={styles.statLabel}>Intercessões</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cardContainer}>
            <View style={styles.bannerTop}>
              <View style={styles.bannerLeftContent}>
                <View style={styles.iconCircle}>
                  <Text style={{ fontSize: 24 }}>🙏</Text>
                </View>
                <View style={styles.bannerTextContainer}>
                  <Text style={styles.bannerTitle}>Interceda</Text>
                  <Text style={styles.bannerSubtitle}>Ore por esse pedido e faça a diferença na vida de alguém</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.bannerButton} onPress={() => { if (!user) { Alert.alert("Atenção","Faça login."); return; } setShowTempoModal(true); }} activeOpacity={0.85}>
                <Text style={styles.bannerButtonText}>Orar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsBottom}>
              <View style={styles.statItem}>
                <Text style={{ fontSize: 20 }}>💬</Text>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statNumber}>{mensagens.length}</Text>
                  <Text style={styles.statLabel}>Mensagens</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.statItem}>
                <Text style={{ fontSize: 20 }}>🔥</Text>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statNumber}>{pedido.intercessores_count || 0}</Text>
                  <Text style={styles.statLabel}>Intercessões</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        {/* ============================================ */}
        {/* Mensagens de Apoio */}
        {/* ============================================ */}
        <View style={styles.mensagensSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#1E293B" />
            <Text style={styles.sectionTitle}>Mensagens de Apoio</Text>
          </View>
          {mensagens.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateEmoji}>💭</Text>
              <Text style={styles.emptyStateText}>
                Nenhuma mensagem de apoio ainda.
              </Text>
              <Text style={styles.emptyStateHint}>
                Seja o primeiro a encorajar!
              </Text>
            </View>
          ) : (
            <View style={styles.feedContainer}>
              {mensagens.map((msg) => {
                const ehAutor = pedido && msg.autor_id === pedido.autor_id;
                return (
                  <View key={msg.id} style={styles.messageCard}>
                    {/* Cabeçalho: Avatar, Nome, Data + Ações */}
                    <View style={styles.messageHeader}>
                      <View style={styles.authorInfoRow}>
                        <View style={[styles.avatarContainer, ehAutor && { backgroundColor: '#A94438' }]}>
                          <Text style={[{ fontSize: 16, fontWeight: '600', color: '#1E293B' }, ehAutor && { color: '#FFF' }]}>
                            {msg.autor_nome?.charAt(0)?.toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.authorName}>{formatarNomeCurto(msg.autor_nome)}</Text>
                            {ehAutor && (
                              <View style={styles.autorBadge}>
                                <Ionicons name="crown" size={12} color="#A94438" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.timeAgo}>{getTempoRelativo(msg.criadoEm)}</Text>
                        </View>
                      </View>

                      {/* Ações (Responder/Apagar) no topo à direita */}
                      <View style={styles.actionIconsRow}>
                        <TouchableOpacity
                          onPress={() => handleReply(msg)}
                          activeOpacity={0.6}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="chatbubble-outline" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        {user && pedido && (msg.autor_id === user.uid || pedido.autor_id === user.uid) && (
                          <TouchableOpacity
                            onPress={() => handleExcluirMensagem(msg)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={18} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Indicador de Réplica */}
                    {msg.replyTo_autor && (
                      <View style={[styles.replyIndicator, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="return-up-back" size={12} color="#A94438" />
                        <Text style={styles.replyIndicatorText}>
                          Respondendo a {formatarNomeCurto(msg.replyTo_autor)}
                        </Text>
                      </View>
                    )}

                    {/* Texto da mensagem com @menções destacadas */}
                    {msg.texto ? renderTextoComMencoes(msg.texto, styles.messageText) : null}

                    {/* Player de Áudio Embutido */}
                    {msg.audio_url ? (
                      <View style={{ marginTop: 12 }}>
                        <FeedAudio audioUrl={msg.audio_url} />
                      </View>
                    ) : null}
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
      {pedido?.status === "respondido" ? (
        <View style={[styles.inputAreaCard, { paddingBottom: Math.max(insets.bottom, SPACING.sm), paddingVertical: SPACING.lg, alignItems: "center" }]}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🎉</Text>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: COLORS.gray800, marginBottom: 4, textAlign: "center" }}>Oração Respondida!</Text>
          <Text style={{ fontSize: 14, color: COLORS.gray500, textAlign: "center", marginBottom: 12, lineHeight: 20 }}>
            Este pedido já foi respondido. Que tal compartilhar esse testemunho com a comunidade?
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 24 }}
            onPress={() => navigation.navigate("TestemunhoDetalhes", { testemunhoId: pedido.testemunho_id })}
            activeOpacity={0.85}
          >
            <Text style={{ color: COLORS.white, fontWeight: "bold", fontSize: 16 }}>📖 Ver Testemunho</Text>
          </TouchableOpacity>
        </View>
      ) : user ? (
        <View style={styles.bottomInputBar}>
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
          {usuariosSugeridos.length > 0 && (
            <View style={styles.sugestoesContainer}>
              <ScrollView style={styles.sugestoesList} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                {usuariosSugeridos.map((item) => (
                  <TouchableOpacity key={item.uid} style={styles.sugestaoItem} onPress={() => handleSelecionarUsuario(item)} activeOpacity={0.7}>
                    <View style={styles.sugestaoAvatar}>
                      <Text style={styles.sugestaoAvatarText}>{item.nome?.charAt(0)?.toUpperCase() || "?"}</Text>
                    </View>
                    <View style={styles.sugestaoInfo}>
                      <Text style={styles.sugestaoNome} numberOfLines={1}>{item.nome}</Text>
                      <Text style={styles.sugestaoUsername} numberOfLines={1}>{item.username}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TextInput
              ref={inputRef}
              style={styles.inputField}
              placeholder={replyingTo ? `Responder a ${formatarNomeCurto(replyingTo.autor)}...` : "Escreva uma mensagem de apoio... (use @ para mencionar)"}
              placeholderTextColor={"#94A3B8"}
              value={textoMensagem}
              onChangeText={handleChangeTexto}
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
                <ActivityIndicator color={"#FFFFFF"} size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
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
                    await toggleSalvarPedido(user.uid, pedido.id, "salvar");
                    setShowTempoModal(false);
                    Alert.alert("📌 Pedido salvo!", "Pedido salvo na sua Lista de Oração.");
                  } catch (error) {
                    Alert.alert("Erro", "Não foi possível salvar o pedido.");
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
  scrollContent: { paddingHorizontal: 8, paddingBottom: 8 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  errorText: {
    fontSize: 24,
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
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  autorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.md,
  },
  autorAvatarFoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: SPACING.md,
  },
  autorAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: "bold",
  },
  autorInfo: {
    flex: 1,
  },
  autorNomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  autorNome: {
    fontSize: FONTS.sizes.lg,
    fontFamily: "Nunito_700Bold",
    color: COLORS.gray800,
  },
  seloPremium: {
    fontSize: 18,
  },
  cargoBadge: {
    backgroundColor: COLORS.primary + "20",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cargoBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: "600",
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
    backgroundColor: COLORS.danger + "10",
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACING.xs,
  },
  denunciarBtnText: {
    fontSize: 18,
  },

  headerBadgeWrap: { alignItems: "flex-end", justifyContent: "flex-start", marginLeft: 12 },
  categoriaAcoesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  acoesIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  categoriaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  categoriaTag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  categoriaText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
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
    // Pedido Card Premium
  pedidoContainer: { backgroundColor: "#FFFFFF", borderRadius: 8, padding: 24, marginBottom: 4, borderWidth: 1, borderColor: "#E2E8F0", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  pedidoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  pedidoHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  pedidoIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EEF4FF", justifyContent: "center", alignItems: "center" },
  pedidoTitleCol: { flexDirection: "column", justifyContent: "center" },
  pedidoTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  pedidoUnderline: { width: 24, height: 3, backgroundColor: COLORS.primary, borderRadius: 2, marginTop: 4 },
  pedidoAlertBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center" },
  pedidoBody: { fontSize: 16, fontWeight: "400", color: "#334155", lineHeight: 28 },
  pedidoDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 24 },
  pedidoFooter: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 80 },
  pedidoFooterItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  pedidoIconSec: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  pedidoFooterCol: { flexDirection: "column" },
  pedidoLabel: { fontSize: 12, fontWeight: "500", color: "#64748B", marginBottom: 2 },
  pedidoValue: { fontSize: 14, fontWeight: "600", color: "#1E293B" },
textoSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    borderRadius: 0,
    padding: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  textoLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  textoLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: "600",
    color: COLORS.gray500,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  textoCompleto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 26,
  },

  // Intercessão (largura total)
    // Card Interceda Premium
  cardContainer: { backgroundColor: "#FFFFFF", borderRadius: 24, marginVertical: 12, borderWidth: 1, borderColor: "#E2E8F0", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  bannerTop: { backgroundColor: COLORS.primary, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  bannerLeftContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  bannerTextContainer: { flex: 1, paddingRight: 12 },
  bannerTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.9)", lineHeight: 18 },
  bannerButton: { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, gap: 6 },
  bannerButtonText: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  statsBottom: { backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", paddingVertical: 16 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  statTextContainer: { flexDirection: "column" },
  statNumber: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  statLabel: { fontSize: 12, fontWeight: "400", color: "#94A3B8", marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: "#E2E8F0" },
intercessaoSection: {
    flexDirection: "column",
    alignItems: "stretch",
    marginHorizontal: 0,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 0,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  intercederBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
    fontWeight: "bold",
  },
  intercessoresInfo: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  intercessoresIcon: {
    fontSize: 18,
  },
  intercessoresDivider: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray300,
    fontWeight: "300",
  },
  intercessoresCount: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    fontWeight: "700",
  },

  // Banner de Oração Respondida
  respondidoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1.5,
    borderColor: "#4CAF50",
  },
  respondidoBannerIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  respondidoBannerText: {
    fontSize: FONTS.sizes.md,
    color: "#2E7D32",
    fontWeight: "bold",
  },

  // ==========================================
  // FEED DE MENSAGENS (CONTAINER GERAL)
  // ==========================================
  mensagensSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    borderRadius: 0,
    padding: SPACING.lg,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  emptyStateEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  emptyStateHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // ==========================================
  // CARD DE MENSAGEM INDIVIDUAL
  // ==========================================
  feedContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorName: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  timeAgo: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    color: '#94A3B8',
    marginTop: 2,
  },
  actionIconsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  messageText: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 24,
  },

  // ==========================================
  // @Menção destacada no texto
  // ==========================================
  mencaoTexto: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },

  // ==========================================
  // Indicador de Réplica na mensagem
  // ==========================================
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginBottom: SPACING.xs,
    alignSelf: 'flex-start',
  },
  replyIndicatorText: {
    fontSize: 12,
    color: COLORS.primary,
    fontStyle: 'italic',
  },

  // ==========================================
  // BARRA DE INPUT INFERIOR (FIXA)
  // ==========================================
  inputAreaCard: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      ios: { paddingBottom: 24 },
      android: { paddingBottom: 12 },
    }),
    ...SHADOWS.md,
  },
  bottomInputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...Platform.select({
      ios: { paddingBottom: 24 },
      android: { paddingBottom: 12 },
    }),
  },
  inputField: {
    flex: 1,
    backgroundColor: '#F6F8FC',
    borderRadius: 24,
    minHeight: 48,
    paddingHorizontal: 20,
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#1E293B',
    marginRight: 12,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enviarBtnDisabled: {
    opacity: 0.5,
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

  // Autor badge (crown)
  autorBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal de Seleção de Tempo
  tempoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  tempoModalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    ...SHADOWS.lg,
  },
  tempoModalEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  tempoModalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: "bold",
    color: COLORS.gray800,
    textAlign: "center",
    marginBottom: SPACING.sm,
  },
  tempoModalSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    textAlign: "center",
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  tempoOpcoes: {
    width: "100%",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tempoOpcao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.gray200,
  },
  tempoOpcaoDestaque: {
    backgroundColor: COLORS.primary + "10",
    borderColor: COLORS.primary,
  },
  tempoOpcaoIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  tempoOpcaoTempo: {
    fontSize: FONTS.sizes.md,
    fontWeight: "bold",
    color: COLORS.gray800,
    flex: 1,
  },
  tempoOpcaoDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    fontWeight: "500",
  },
  tempoModalDivisor: {
    width: "100%",
    height: 1,
    backgroundColor: COLORS.gray200,
    marginBottom: SPACING.md,
  },
  salvarPedidoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: "100%",
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
    fontWeight: "600",
    color: COLORS.gray700,
  },
  tempoModalCancelar: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tempoModalCancelarText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: "600",
  },
});