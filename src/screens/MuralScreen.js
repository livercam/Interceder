// Tela Mural - Feed de Pedidos de Oração com Detalhes e Interação
// Funcionalidades:
// - Filtros rápidos por categoria
// - Botão flutuante para criar novo pedido (Modal)
// - Cards clicáveis que navegam para tela de detalhes
// - Opção de denúncia ao segurar o card

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, getCountFromServer, query } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { CATEGORIAS_PEDIDO, PRIVACIDADE_OPCOES } from '../constants/firestore';
import { db } from '../services/firebaseConfig';
import {
  criarPedido,
  listarPedidos,
  listarCelulas,
  denunciarPedido,
  toggleSalvarPedido,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';
import { listarCategorias } from '../services/categoriaService';
import BannerAd from '../components/BannerAd';

// Altura estimada de cada card para getItemLayout (calculada com base no padding + conteúdo)
const CARD_ESTIMATED_HEIGHT = 220;

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

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHoras < 24) return `${diffHoras}h`;
  return `${diffDias}d`;
};

// ============================================================
// Componente de Card Clicável (Memoizado para evitar re-renderizações desnecessárias)
// ============================================================
const PedidoCard = React.memo(function PedidoCard({ pedido, onDenunciar }) {
  const navigation = useNavigation();
  const { user, userProfile } = useAuth();
  const longPressTimer = useRef(null);
  const isRespondido = pedido.status === 'respondido';

  const handlePress = () => {
    if (isRespondido) {
      if (pedido.testemunho_id) {
        navigation.navigate('TestemunhoDetalhes', { testemunhoId: pedido.testemunho_id });
      } else {
        Alert.alert('Aviso', 'O testemunho deste pedido não foi encontrado.');
      }
    } else {
      navigation.navigate('PedidoDetalhes', { pedidoId: pedido.id });
    }
  };

  const jaSalvo = userProfile?.pedidos_salvos?.includes(pedido.id) || false;

  const handleSalvarPedido = async () => {
    if (!user) { Alert.alert('Aviso', 'Faça login para salvar pedidos.'); return; }
    const acao = jaSalvo ? 'remover' : 'salvar';
    try {
      await toggleSalvarPedido(user.uid, pedido.id, acao);
      if (acao === 'salvar') {
        Alert.alert('📌 Pedido salvo!', 'Pedido salvo na sua lista de oração. Acesse seu Perfil');
      }
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  const handleLongPress = () => {
    if (isRespondido) return; // Não permite denunciar pedidos respondidos
    Alert.alert(
      'Opções do Pedido',
      `O que deseja fazer com o pedido de "${pedido.autor_nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar',
          style: 'destructive',
          onPress: () => onDenunciar(pedido),
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isRespondido && styles.cardRespondido,
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      delayLongPress={800}
    >
      {/* Tag de Categoria + Badge de Oração Respondida */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.categoriaTag,
              { backgroundColor: getCategoriaColor(pedido.categoria) + '20' },
            ]}
          >
            <View
              style={[
                styles.categoriaDot,
                { backgroundColor: getCategoriaColor(pedido.categoria) },
              ]}
            />
            <Text
              style={[
                styles.categoriaText,
                { color: getCategoriaColor(pedido.categoria) },
              ]}
            >
              {getCategoriaLabel(pedido.categoria)}
            </Text>
          </View>

          {pedido.privacidade === 'celula' && (
            <View style={styles.privacidadeTag}>
              <Text style={styles.privacidadeText}>🔒 Célula</Text>
            </View>
          )}
        </View>

        {isRespondido && (
          <View style={styles.badgeRespondido}>
            <Text style={styles.badgeRespondidoText}>🎉 ORAÇÃO RESPONDIDA</Text>
          </View>
        )}

        {!isRespondido && (
          <TouchableOpacity
            onPress={handleSalvarPedido}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.salvarBtn}
          >
            <Ionicons name={jaSalvo ? "bookmark" : "bookmark-outline"} size={22} color={jaSalvo ? "#A53F36" : "#64748B"} />
          </TouchableOpacity>
        )}
      </View>

      {/* Texto do Pedido */}
      <Text style={styles.cardTexto} numberOfLines={3} ellipsizeMode="tail">
        {pedido.texto}
      </Text>

      {/* Rodapé do Card */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.autorInfo}
          onPress={() => {
            if (pedido.autor_id) {
              navigation.navigate('PublicProfile', { userId: pedido.autor_id });
            }
          }}
          activeOpacity={0.7}
        >
          {pedido.autor_foto_url ? (
            <Image
              source={{ uri: pedido.autor_foto_url }}
              style={styles.autorAvatarFoto}
            />
          ) : (
            <View style={styles.autorAvatar}>
              <Text style={styles.autorAvatarText}>
                {pedido.autor_nome?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.autorNomeCol}>
            <View style={styles.autorNomeRow}>
              <Text style={styles.autorNome} numberOfLines={1}>
                {formatarNomeCurto(pedido.autor_nome)}
              </Text>
              {pedido.autor_premium === true && (
                <Text style={styles.seloPremium}>💎</Text>
              )}
            </View>
            {/* Regra de Ouro: título ministerial só aparece se o ministério for reconhecido */}
            {(pedido.autor_endossos_count >= 5 || pedido.autor_verificado_lideranca === true) &&
             pedido.autor_cargo && pedido.autor_cargo.toLowerCase() !== 'membro' && (
              <Text style={styles.autorCargoText}>
                {pedido.autor_cargo === 'diacono' ? 'Diácono' :
                 pedido.autor_cargo === 'missionario' ? 'Missionário' :
                 pedido.autor_cargo === 'evangelista' ? 'Evangelista' :
                 pedido.autor_cargo === 'presbitero' ? 'Presbítero' :
                 pedido.autor_cargo === 'pastor' ? 'Pastor' : pedido.autor_cargo} 🛡️
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.cardStats}>
          <Text style={styles.tempoTexto}>
            {getTempoRelativo(pedido.createdAt)}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.intercessoresTexto}>
            🙏 {pedido.intercessores_count || 0}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.intercessoresTexto}>
            💬 {pedido.mensagens_count || 0}
          </Text>
        </View>
      </View>

    </TouchableOpacity>
  );
});

// ============================================================
// Modal de Criação de Pedido
// ============================================================
function CriarPedidoModal({ visible, onClose, onCriar, celulasDisponiveis, categoriasDisponiveis }) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('saude');
  const [privacidade, setPrivacidade] = useState('publico');
  const [celulasSelecionadas, setCelulasSelecionadas] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleCriar = async () => {
    if (!texto.trim()) {
      Alert.alert('Atenção', 'Escreva o seu pedido de oração.');
      return;
    }

    if (privacidade === 'celula' && celulasSelecionadas.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos uma célula para compartilhar o pedido.');
      return;
    }

    setLoading(true);
    try {
      await onCriar(texto, categoria, privacidade, celulasSelecionadas);
      setTexto('');
      setCategoria('saude');
      setPrivacidade('publico');
      setCelulasSelecionadas([]);
      onClose();
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTexto('');
    setCategoria('saude');
    setPrivacidade('publico');
    setCelulasSelecionadas([]);
    onClose();
  };

  const toggleCelula = (celulaId) => {
    setCelulasSelecionadas((prev) =>
      prev.includes(celulaId)
        ? prev.filter((id) => id !== celulaId)
        : [...prev, celulaId]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: SPACING.xxl }}
            >
            {/* Header do Modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Pedido de Oração</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Campo de Texto */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Seu pedido</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Escreva aqui o seu pedido de oração..."
                placeholderTextColor={COLORS.gray400}
                value={texto}
                onChangeText={setTexto}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Seletor de Categoria */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Categoria</Text>
              <View style={styles.categoriaGrid}>
                {(categoriasDisponiveis || CATEGORIAS_PEDIDO).map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.categoriaOption,
                      categoria === cat.value && styles.categoriaOptionActive,
                    ]}
                    onPress={() => setCategoria(cat.value)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.categoriaOptionText,
                        categoria === cat.value && styles.categoriaOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Seletor de Privacidade */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Privacidade</Text>
              <View style={styles.privacidadeRow}>
                {PRIVACIDADE_OPCOES.map((op) => (
                  <TouchableOpacity
                    key={op.value}
                    style={[
                      styles.privacidadeOption,
                      privacidade === op.value && styles.privacidadeOptionActive,
                    ]}
                    onPress={() => {
                      setPrivacidade(op.value);
                      if (op.value !== 'celula') {
                        setCelulasSelecionadas([]);
                      }
                    }}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.privacidadeOptionText,
                        privacidade === op.value && styles.privacidadeOptionTextActive,
                      ]}
                    >
                      {op.value === 'publico' ? '🌍' : '🔒'} {op.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Seletor de Células (aparece apenas quando privacidade = 'celula') */}
            {privacidade === 'celula' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  📌 Células de destino {celulasSelecionadas.length > 0 && `(${celulasSelecionadas.length} selecionada${celulasSelecionadas.length > 1 ? 's' : ''})`}
                </Text>
                {celulasDisponiveis && celulasDisponiveis.length > 0 ? (
                  <View style={styles.celulasDestinoContainer}>
                    {celulasDisponiveis.map((celula) => {
                      const selecionada = celulasSelecionadas.includes(celula.id);
                      return (
                        <TouchableOpacity
                          key={celula.id}
                          style={[
                            styles.celulaDestinoOption,
                            selecionada && styles.celulaDestinoOptionActive,
                          ]}
                          onPress={() => toggleCelula(celula.id)}
                          disabled={loading}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.celulaDestinoIcon}>
                            {selecionada ? '✅' : '🔲'}
                          </Text>
                          <View style={styles.celulaDestinoInfo}>
                            <Text
                              style={[
                                styles.celulaDestinoNome,
                                selecionada && styles.celulaDestinoNomeActive,
                              ]}
                              numberOfLines={1}
                            >
                              {celula.nome}
                            </Text>
                            <Text style={styles.celulaDestinoHorario}>
                              ⏰ {celula.horario}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.semCelulasMsg}>
                    <Text style={styles.semCelulasMsgText}>
                      Você não está inscrito em nenhuma célula.
                    </Text>
                    <Text style={styles.semCelulasMsgHint}>
                      Inscreva-se em uma célula na aba "Células" para compartilhar pedidos privados.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Aviso LGPD - Transparência de Dados */}
            <View style={styles.avisoLgpd}>
              <Text style={styles.avisoLgpdIcon}>🌐</Text>
              <Text style={styles.avisoLgpdText}>
                Este conteúdo será público e visível para toda a comunidade. Evite partilhar dados pessoais sensíveis de terceiros.
              </Text>
            </View>

            {/* Botão Publicar */}
            <TouchableOpacity
              style={[styles.publicarBtn, loading && styles.publicarBtnDisabled]}
              onPress={handleCriar}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.publicarBtnText}>Publicar Pedido</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// Tela Principal do Mural
// ============================================================
export default function MuralScreen() {
  const navigation = useNavigation();
  const [pedidos, setPedidos] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todasCelulas, setTodasCelulas] = useState([]);
  const [categorias, setCategorias] = useState(CATEGORIAS_PEDIDO);
  const unsubscribeRef = useRef(null);
  const unsubscribeCelulasRef = useRef(null);
  const unsubscribeCategoriasRef = useRef(null);

  // Estado reativo global via AuthContext
  const { user, userProfile } = useAuth();

  // IDs das células que o usuário participa
  const userCelulasIds = userProfile?.celulas_inscritas || [];

  // Contagem de mensagens de apoio
  const [contagensMensagens, setContagensMensagens] = useState({});

  const carregarContagens = useCallback(async (listaPedidos) => {
    if (!listaPedidos || listaPedidos.length === 0) return;
    try {
      const resultados = await Promise.all(
        listaPedidos.map(async (pedido) => {
          if (pedido.status === 'respondido' && pedido.testemunho_id) {
            const q = query(collection(db, 'testemunhos', pedido.testemunho_id, 'mensagens_apoio'));
            const snap = await getCountFromServer(q);
            return { id: pedido.id, count: snap.data().count };
          }
          const q = query(collection(db, 'pedidos_oracao', pedido.id, 'mensagens_apoio'));
          const snap = await getCountFromServer(q);
          return { id: pedido.id, count: snap.data().count };
        })
      );
      const mapa = {};
      resultados.forEach((r) => { mapa[r.id] = r.count; });
      setContagensMensagens(mapa);
    } catch (e) {
      console.warn('[Mural] Erro ao buscar contagens:', e.message);
    }
  }, []);

  useEffect(() => {
    if (pedidos.length > 0) carregarContagens(pedidos);
  }, [pedidos.length]); // eslint-disable-line

  useEffect(() => {
    // Visitantes também podem visualizar os pedidos (apenas não podem criar)
    // Escutar pedidos públicos em tempo real
    unsubscribeRef.current = listarPedidos((pedidosAtualizados) => {
      // Usar setPedidos com função updater para evitar closures desatualizadas
      setPedidos(pedidosAtualizados);
      setLoading(false);
    });

    // Escutar categorias do Firestore (com fallback para fixas)
    unsubscribeCategoriasRef.current = listarCategorias((categoriasAtualizadas) => {
      setCategorias(categoriasAtualizadas);
    });

    // Escutar células apenas se estiver logado (para o modal de criação)
    if (user) {
      unsubscribeCelulasRef.current = listarCelulas((celulasAtualizadas) => {
        setTodasCelulas(celulasAtualizadas);
      });
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (unsubscribeCelulasRef.current) {
        unsubscribeCelulasRef.current();
      }
      if (unsubscribeCategoriasRef.current) {
        unsubscribeCategoriasRef.current();
      }
    };
  }, [user]);

  // Filtrar por categoria (memoizado para evitar recálculo a cada render)
  const pedidosFiltrados = useMemo(() => {
    return filtroCategoria
      ? pedidos.filter((p) => p.categoria === filtroCategoria)
      : pedidos;
  }, [pedidos, filtroCategoria]);

  // Celulas do usuário memoizadas
  const celulasDoUsuario = useMemo(() => {
    return todasCelulas.filter((c) => userCelulasIds.includes(c.id));
  }, [todasCelulas, userCelulasIds]);

  // Denunciar um pedido
  const handleDenunciar = useCallback(async (pedido) => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para denunciar.');
      return;
    }

    Alert.alert(
      '🚨 Denunciar conteúdo impróprio?',
      `Tem certeza que deseja denunciar o pedido de ${pedido.autor_nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await denunciarPedido(pedido.id, user.uid);
              Alert.alert('Obrigado por ajudar a manter a comunidade segura.');
            } catch (error) {
              Alert.alert('Aviso', error.message || 'Não foi possível denunciar.');
            }
          },
        },
      ]
    );
  }, []);

  // Criar novo pedido
  const handleCriarPedido = useCallback(async (texto, categoria, privacidade, celulasDestino) => {
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    await criarPedido(texto, categoria, privacidade, celulasDestino || [], {
      uid: user.uid,
      nome: user.displayName || 'Anônimo',
      cargo: userProfile?.titulo_ministerial || 'membro',
      isPremium: userProfile?.isPremium === true || false,
      whatsapp: userProfile?.whatsapp || null,
      endossosCount: userProfile?.endossos_uids?.length || 0,
      verificadoLideranca: userProfile?.verificado_lideranca === true,
    }, userProfile?.foto_url || user?.photoURL || null);
  }, [user, userProfile]);

  // Renderizar cada card - usando extraData para garantir re-render quando handleDenunciar mudar
  const renderPedido = useCallback(
    ({ item }) => (
      <PedidoCard
        pedido={{ ...item, mensagens_count: contagensMensagens[item.id] ?? item.mensagens_count ?? 0 }}
        onDenunciar={handleDenunciar}
      />
    ),
    [handleDenunciar, contagensMensagens]
  );

  // keyExtractor estável
  const keyExtractor = useCallback((item) => item.id, []);

  // getItemLayout para scroll mais rápido (altura estimada)
  const getItemLayout = useCallback((_data, index) => ({
    length: CARD_ESTIMATED_HEIGHT,
    offset: CARD_ESTIMATED_HEIGHT * index,
    index,
  }), []);

  // Header da FlatList (banner + filtros)
  const renderHeader = () => (
    <View>
      <BannerAd telaAtual="mural" />
      <View style={styles.filtrosContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtrosScroll}
        >
          <TouchableOpacity
            style={[
              styles.filtroChip,
              filtroCategoria === null && styles.filtroChipActive,
            ]}
            onPress={() => setFiltroCategoria(null)}
          >
            <Text
              style={[
                styles.filtroChipText,
                filtroCategoria === null && styles.filtroChipTextActive,
              ]}
            >
              Todos
            </Text>
          </TouchableOpacity>

          {categorias.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.filtroChip,
                filtroCategoria === cat.value && styles.filtroChipActive,
              ]}
              onPress={() =>
                setFiltroCategoria(filtroCategoria === cat.value ? null : cat.value)
              }
            >
              <Text
                style={[
                  styles.filtroChipText,
                  filtroCategoria === cat.value && styles.filtroChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  // Estado vazio
  if (!loading && pedidos.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🙏</Text>
          <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
          <Text style={styles.emptySubtitle}>
            Seja o primeiro a compartilhar um pedido de oração com a comunidade.
          </Text>
        </View>

        {/* Botão Flutuante (apenas para utilizadores logados) */}
        {user && (
          <>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => navigation.navigate('CriarPedido')}
              activeOpacity={0.8}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>


          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidosFiltrados}
          renderItem={renderPedido}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={8}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nenhum pedido encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Nenhum pedido com o filtro selecionado.
              </Text>
            </View>
          }
        />
      )}

      {/* Botão Flutuante (apenas para utilizadores logados) */}
      {user && (
        <>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CriarPedido')}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>


        </>
      )}
    </View>
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray500,
    fontSize: FONTS.sizes.md,
  },

  // Filtros
  filtrosContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  filtrosScroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filtroChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    marginRight: SPACING.sm,
  },
  filtroChipActive: {
    backgroundColor: COLORS.primary,
  },
  filtroChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  filtroChipTextActive: {
    color: COLORS.white,
  },

  // Lista
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  categoriaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  categoriaText: {
    fontSize: FONTS.sizes.xs,
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
  cardTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    paddingTop: SPACING.sm,
  },
  autorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  autorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  autorAvatarFoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.sm,
  },
  autorAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
  autorNomeCol: {
    flex: 1,
  },
  autorNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autorNome: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontFamily: 'Nunito_700Bold',
  },
  seloPremium: {
    fontSize: 14,
    marginLeft: 4,
  },
  autorCargoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 1,
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tempoTexto: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },
  statsSeparator: {
    marginHorizontal: 4,
    color: COLORS.gray300,
  },
  intercessoresTexto: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Estado Vazio
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  fabText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
    marginTop: -2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.gray500,
    fontWeight: 'bold',
  },

  // Inputs do Modal
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  textArea: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 100,
  },
  categoriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoriaOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoriaOptionActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  categoriaOptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  categoriaOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  privacidadeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  privacidadeOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  privacidadeOptionActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  privacidadeOptionText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  privacidadeOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  publicarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  publicarBtnDisabled: {
    opacity: 0.7,
  },
  publicarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Seletor de Células de Destino
  celulasDestinoContainer: {
    gap: SPACING.sm,
  },
  celulaDestinoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  celulaDestinoOptionActive: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  celulaDestinoIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  celulaDestinoInfo: {
    flex: 1,
  },
  celulaDestinoNome: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  celulaDestinoNomeActive: {
    color: COLORS.primary,
  },
  celulaDestinoHorario: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  semCelulasMsg: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  semCelulasMsgText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  salvarBtn: { padding: 4, marginLeft: 8 },
  semCelulasMsgHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Aviso LGPD
  avisoLgpd: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  avisoLgpdIcon: {
    fontSize: 14,
    marginRight: SPACING.sm,
  },
  avisoLgpdText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },

  // Card Respondido
  cardRespondido: {
    backgroundColor: '#F0FFF0', // tom suave de verde
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },
  badgeRespondido: {
    backgroundColor: '#4CAF50',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeRespondidoText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
});
