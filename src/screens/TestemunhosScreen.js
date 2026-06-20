// Tela Testemunhos - Mural de Testemunhos e Milagres
// Funcionalidades:
// - FlatList com testemunhos em tempo real
// - Cartão comemorativo com avatar, nome, texto e link para pedido original
// - Botão "🙌 Glória a Deus!" para celebrar
// - FAB para criar novo testemunho (apenas logados)
// - Modal de criação com seletor de vínculo a pedido

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  adicionarTestemunho,
  listarTestemunhos,
  buscarMeusPedidos,
} from '../services/firestoreService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

// ============================================================
// Utilitários (clone do MuralScreen)
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
// Componente de Cartão de Testemunho (Estilo Rede Social)
// ============================================================
const TestemunhoCard = React.memo(function TestemunhoCard({ testemunho }) {
  const navigation = useNavigation();

  const handleAbrirDetalhes = () => {
    navigation.navigate('TestemunhoDetalhes', {
      testemunhoId: testemunho.id,
    });
  };

  const handlePerfil = () => {
    if (testemunho.autor_id) {
      navigation.navigate('PublicProfile', { userId: testemunho.autor_id });
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleAbrirDetalhes}
      activeOpacity={0.85}
    >
      {/* Cabeçalho: Avatar 40px + Nome + Tempo */}
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={handlePerfil} style={styles.autorRow} activeOpacity={0.7}>
          {testemunho.autor_foto_url ? (
            <Image source={{ uri: testemunho.autor_foto_url }} style={styles.autorAvatar} />
          ) : (
            <View style={styles.autorAvatar}>
              <Text style={styles.autorAvatarText}>
                {testemunho.autor_nome?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.autorInfo}>
            <View style={styles.autorNomeRow}>
              <Text style={styles.autorNome} numberOfLines={1}>
                {formatarNomeCurto(testemunho.autor_nome) || 'Anônimo'}
              </Text>
              {testemunho.autor_premium === true && <Text style={styles.seloPremium}>💎</Text>}
            </View>
            <Text style={styles.autorTempo}>{getTempoRelativo(testemunho.criadoEm)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Categoria (se vinculada) */}
      {testemunho.pedido_vinculado_categoria && (
        <View style={[styles.categoriaTag, { backgroundColor: getCategoriaColor(testemunho.pedido_vinculado_categoria) + '18' }]}>
          <View style={[styles.categoriaDot, { backgroundColor: getCategoriaColor(testemunho.pedido_vinculado_categoria) }]} />
          <Text style={[styles.categoriaText, { color: getCategoriaColor(testemunho.pedido_vinculado_categoria) }]}>
            {getCategoriaLabel(testemunho.pedido_vinculado_categoria)}
          </Text>
        </View>
      )}

      {/* Texto do Testemunho */}
      <Text style={styles.cardTexto} numberOfLines={4} ellipsizeMode="tail">
        {testemunho.texto}
      </Text>

      {/* Cargo Ministerial (se reconhecido) */}
      {(testemunho.autor_endossos_count >= 5 || testemunho.autor_verificado_lideranca === true) &&
       testemunho.autor_cargo && testemunho.autor_cargo.toLowerCase() !== 'membro' && (
        <View style={styles.cargoRow}>
          <Text style={styles.cargoText}>
            ⚜️ {testemunho.autor_cargo.charAt(0).toUpperCase() + testemunho.autor_cargo.slice(1)}
          </Text>
        </View>
      )}

      {/* Barra de Interações */}
      <View style={styles.interacoesRow}>
        <View style={styles.interacaoItem}>
          <Text style={styles.interacaoIcone}>🙌</Text>
          <Text style={styles.interacaoContador}>{testemunho.glorias || 0}</Text>
        </View>
        <View style={styles.interacaoItem}>
          <Text style={styles.interacaoIcone}>💬</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// Modal de Criação de Testemunho
// ============================================================
function CriarTestemunhoModal({ visible, onClose, user, userCargo, userIsPremium, userProfile }) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [carregandoPedidos, setCarregandoPedidos] = useState(true);

  // Carregar pedidos do utilizador ao abrir o modal
  useEffect(() => {
    const carregarPedidos = async () => {
      if (user?.uid) {
        setCarregandoPedidos(true);
        try {
          const pedidos = await buscarMeusPedidos(user.uid);
          console.log('Pedidos carregados para o seletor:', pedidos.length);
          setMeusPedidos(pedidos);
        } catch (error) {
          console.error('Erro ao carregar pedidos:', error);
          setMeusPedidos([]);
        } finally {
          setCarregandoPedidos(false);
        }
      }
    };
    carregarPedidos();
  }, [user?.uid]);

  const handleCriar = async () => {
    if (!texto.trim()) {
      Alert.alert('Atenção', 'Escreva o seu testemunho.');
      return;
    }

    // Extrair categoria do pedido selecionado (se houver)
    const pedidoVinculadoId = pedidoSelecionado;
    let categoriaSelecionada = null;
    if (pedidoVinculadoId) {
      const pedidoEncontrado = meusPedidos.find(p => p.id === pedidoVinculadoId);
      categoriaSelecionada = pedidoEncontrado ? pedidoEncontrado.categoria : null;
    }

    setLoading(true);
    try {
      // Enriquecer o objeto user com o cargo e isPremium para desnormalização
      const userComCargo = {
        ...user,
        cargo: userCargo || 'membro',
        isPremium: userIsPremium === true || false,
        endossosCount: userProfile?.endossos_uids?.length || 0,
        verificadoLideranca: userProfile?.verificado_lideranca === true,
        foto_url: userProfile?.foto_url || user?.photoURL || null,
      };
      await adicionarTestemunho(
        userComCargo,
        texto,
        pedidoVinculadoId,
        categoriaSelecionada
      );
      setTexto('');
      setPedidoSelecionado(null);
      onClose();
      Alert.alert('🕊️ Testemunho registado!', 'Obrigado por compartilhar o seu milagre!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível publicar o testemunho.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTexto('');
    setPedidoSelecionado(null);
    onClose();
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
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Testemunho</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Campo de Texto */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Seu testemunho</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Compartilhe aqui o milagre que Deus realizou..."
                placeholderTextColor={COLORS.gray400}
                value={texto}
                onChangeText={setTexto}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Seletor de Pedido Vinculado */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>🔗 Vincular a um pedido (opcional)</Text>
              {carregandoPedidos ? (
                <View style={styles.carregandoPedidos}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.carregandoPedidosText}>
                    Carregando seus pedidos...
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.pedidosLista}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {/* Opção "Testemunho Avulso" */}
                  <TouchableOpacity
                    style={[
                      styles.pedidoOption,
                      pedidoSelecionado === null && styles.pedidoOptionActive,
                    ]}
                    onPress={() => setPedidoSelecionado(null)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.pedidoOptionIcon,
                        pedidoSelecionado === null && styles.pedidoOptionIconActive,
                      ]}
                    >
                      {pedidoSelecionado === null ? '✅' : '✨'}
                    </Text>
                    <View style={styles.pedidoOptionInfo}>
                      <Text
                        style={[
                          styles.pedidoOptionTitle,
                          pedidoSelecionado === null && styles.pedidoOptionTitleActive,
                        ]}
                      >
                        Testemunho Avulso
                      </Text>
                      <Text style={styles.pedidoOptionDesc}>
                        Não vincular a pedido
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Pedidos do Utilizador */}
                  {meusPedidos.length === 0 ? (
                    <View style={styles.semPedidosMsg}>
                      <Text style={styles.semPedidosMsgText}>
                        Nenhum pedido encontrado.
                      </Text>
                    </View>
                  ) : (
                    meusPedidos.map((pedido) => (
                      <TouchableOpacity
                        key={pedido.id}
                        style={[
                          styles.pedidoOption,
                          pedidoSelecionado === pedido.id &&
                            styles.pedidoOptionActive,
                        ]}
                        onPress={() => setPedidoSelecionado(pedido.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.pedidoOptionIcon,
                            pedidoSelecionado === pedido.id &&
                              styles.pedidoOptionIconActive,
                          ]}
                        >
                          {pedidoSelecionado === pedido.id ? '✅' : '🔲'}
                        </Text>
                        <View style={styles.pedidoOptionInfo}>
                          <Text
                            style={[
                              styles.pedidoOptionTitle,
                              pedidoSelecionado === pedido.id &&
                                styles.pedidoOptionTitleActive,
                            ]}
                            numberOfLines={2}
                          >
                            {pedido.texto}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}
            </View>

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
                <Text style={styles.publicarBtnText}>Publicar</Text>
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
// Tela Principal de Testemunhos
// ============================================================
export default function TestemunhosScreen() {
  const [testemunhos, setTestemunhos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const { user, userProfile } = useAuth();
  const cargoAtual = userProfile?.titulo_ministerial || 'membro';
  const isPremiumAtual = userProfile?.isPremium === true || false;

  // Escutar testemunhos em tempo real
  useEffect(() => {
    const unsubscribe = listarTestemunhos((testemunhosAtualizados) => {
      setTestemunhos(testemunhosAtualizados);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // keyExtractor estável
  const keyExtractor = useCallback((item) => item.id, []);

  // Renderizar cada cartão (memoizado)
  const renderTestemunho = useCallback(
    ({ item }) => <TestemunhoCard testemunho={item} />,
    []
  );

  // Estado vazio
  if (!loading && testemunhos.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🕊️</Text>
          <Text style={styles.emptyTitle}>Nenhum testemunho ainda</Text>
          <Text style={styles.emptySubtitle}>
            Seja o primeiro a compartilhar um milagre!
          </Text>
        </View>

        {user && (
          <>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            <CriarTestemunhoModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              user={user}
              userCargo={cargoAtual}
              userIsPremium={isPremiumAtual}
              userProfile={userProfile}
            />
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando testemunhos...</Text>
        </View>
      ) : (
        <FlatList
          data={testemunhos}
          renderItem={renderTestemunho}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={8}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Nenhum testemunho encontrado</Text>
            </View>
          }
        />
      )}

      {/* FAB - apenas para utilizadores logados */}
      {user && (
        <>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

            <CriarTestemunhoModal
              visible={modalVisible}
              onClose={() => setModalVisible(false)}
              user={user}
              userCargo={cargoAtual}
              userIsPremium={isPremiumAtual}
              userProfile={userProfile}
            />
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

  // Lista
  listContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },

  // Card (Estilo Rede Social - mesmo padrão do Mural)
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  autorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  autorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  autorAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  autorInfo: {
    flex: 1,
  },
  autorNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  autorNome: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  autorTempo: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginTop: 2,
  },
  seloPremium: {
    fontSize: 14,
    marginLeft: 4,
  },
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
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
  cardTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  cargoRow: {
    marginBottom: SPACING.md,
  },
  cargoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  interacoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    paddingTop: SPACING.sm,
  },
  interacaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  interacaoIcone: {
    fontSize: 16,
  },
  interacaoContador: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
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
    marginBottom: SPACING.lg,
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
    minHeight: 120,
  },

  // Seletor de Pedidos
  carregandoPedidos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  carregandoPedidosText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  pedidosLista: {
    maxHeight: 200,
    gap: SPACING.sm,
  },
  pedidoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pedidoOptionActive: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  pedidoOptionIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  pedidoOptionIconActive: {
    // mantém o estilo base
  },
  pedidoOptionInfo: {
    flex: 1,
  },
  pedidoOptionTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  pedidoOptionTitleActive: {
    color: COLORS.primary,
  },
  pedidoOptionDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    marginTop: 2,
  },
  semPedidosMsg: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  semPedidosMsgText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
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

  // Botão Publicar
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
});
