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
import { collection, getCountFromServer, query } from 'firebase/firestore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { db } from '../services/firebaseConfig';
import {
  adicionarTestemunho,
  listarTestemunhos,
  buscarMeusPedidos,
} from '../services/firestoreService';
import { CATEGORIAS_PEDIDO } from '../constants/firestore';
import BannerAd from '../components/BannerAd';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';
import { listarCategorias } from '../services/categoriaService';
import CategoryBar from '../components/CategoryBar';

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
// Componente de Cartão de Testemunho (Padrão Unificado com MuralScreen)
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
      {/* Tag de Categoria (apenas badge, alinhada à esquerda) */}
      {testemunho.pedido_vinculado_categoria && (
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.categoriaTag,
              { backgroundColor: getCategoriaColor(testemunho.pedido_vinculado_categoria) + '20' },
            ]}
          >
            <View
              style={[
                styles.categoriaDot,
                { backgroundColor: getCategoriaColor(testemunho.pedido_vinculado_categoria) },
              ]}
            />
            <Text
              style={[
                styles.categoriaText,
                { color: getCategoriaColor(testemunho.pedido_vinculado_categoria) },
              ]}
            >
              {getCategoriaLabel(testemunho.pedido_vinculado_categoria)}
            </Text>
          </View>
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
            🛡️ {testemunho.autor_cargo === 'diacono' ? 'Diácono' :
                 testemunho.autor_cargo === 'missionario' ? 'Missionário' :
                 testemunho.autor_cargo === 'evangelista' ? 'Evangelista' :
                 testemunho.autor_cargo === 'presbitero' ? 'Presbítero' :
                 testemunho.autor_cargo === 'pastor' ? 'Pastor' : testemunho.autor_cargo}
          </Text>
        </View>
      )}

      {/* Rodapé do Card */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.autorInfo}
          onPress={handlePerfil}
          activeOpacity={0.7}
        >
          {testemunho.autor_foto_url ? (
            <Image
              source={{ uri: testemunho.autor_foto_url }}
              style={styles.autorAvatarFoto}
            />
          ) : (
            <View style={styles.autorAvatar}>
              <Text style={styles.autorAvatarText}>
                {testemunho.autor_nome?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.autorNomeCol}>
            <View style={styles.autorNomeRow}>
              <Text style={styles.autorNome} numberOfLines={1}>
                {formatarNomeCurto(testemunho.autor_nome) || 'Anônimo'}
              </Text>
              {testemunho.autor_premium === true && (
                <Text style={styles.seloPremium}>💎</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.cardStats}>
          <Text style={styles.tempoTexto}>
            {getTempoRelativo(testemunho.criadoEm)}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.intercessoresTexto}>
            🙏 {testemunho.glorias || 0}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.intercessoresTexto}>
            💬 {testemunho.mensagens_count || 0}
          </Text>
        </View>
      </View>

    </TouchableOpacity>
  );
});
// Tela Principal de Testemunhos
// ============================================================
export default function TestemunhosScreen() {
  const navigation = useNavigation();
  const [testemunhos, setTestemunhos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [categorias, setCategorias] = useState(CATEGORIAS_PEDIDO);
  const { user, userProfile } = useAuth();
  const cargoAtual = userProfile?.titulo_ministerial || 'membro';
  const isPremiumAtual = userProfile?.isPremium === true || false;

  // Contagem de mensagens de parabéns
  const [contagensMensagens, setContagensMensagens] = useState({});

  const carregarContagens = useCallback(async (lista) => {
    if (!lista || lista.length === 0) return;
    try {
      const resultados = await Promise.all(
        lista.map(async (item) => {
          const q = query(collection(db, 'testemunhos', item.id, 'mensagens_apoio'));
          const snap = await getCountFromServer(q);
          return { id: item.id, count: snap.data().count };
        })
      );
      const mapa = {};
      resultados.forEach((r) => { mapa[r.id] = r.count; });
      setContagensMensagens(mapa);
    } catch (e) {
      console.warn('[Testemunhos] Erro ao buscar contagens:', e.message);
    }
  }, []);

  useEffect(() => {
    if (testemunhos.length > 0) carregarContagens(testemunhos);
  }, [testemunhos.length]);

  // Escutar categorias do Firestore (com fallback para fixas)
  useEffect(() => {
    const unsub = listarCategorias((categoriasAtualizadas) => {
      setCategorias(categoriasAtualizadas);
    });
    return () => unsub();
  }, []);

  // Escutar testemunhos em tempo real
  useEffect(() => {
    const unsubscribe = listarTestemunhos((testemunhosAtualizados) => {
      setTestemunhos(testemunhosAtualizados);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // keyExtractor estável
  // Filtrar por categoria (memoizado)
  const testemunhosFiltrados = useMemo(() => {
    return filtroCategoria
      ? testemunhos.filter((t) => t.pedido_vinculado_categoria === filtroCategoria)
      : testemunhos;
  }, [testemunhos, filtroCategoria]);

  const keyExtractor = useCallback((item) => item.id, []);

  // Renderizar cada cartão (memoizado)
  // Header da FlatList (banner + filtros)
  const renderHeader = useCallback(
    () => (
      <View>
        <BannerAd telaAtual="testemunhos" />
        <CategoryBar
          categorias={categorias}
          filtroCategoria={filtroCategoria}
          onChangeFiltro={setFiltroCategoria}
        />
      </View>
    ),
    [categorias, filtroCategoria]
  );

  const renderTestemunho = useCallback(
    ({ item }) => <TestemunhoCard testemunho={{ ...item, mensagens_count: contagensMensagens[item.id] ?? 0 }} />,
    [contagensMensagens]
  );

  // Estado vazio
  if (!loading && testemunhosFiltrados.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🕊️</Text>
          <Text style={styles.emptyTitle}>Nenhum testemunho ainda</Text>
          <Text style={styles.emptySubtitle}>
            Seja o primeiro a compartilhar um milagre!
          </Text>
        </View>

        {user && (
            <TouchableOpacity
              style={styles.fab}
              onPress={() => navigation.navigate('CriarTestemunho')}
              activeOpacity={0.8}
            >
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

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
          data={testemunhosFiltrados}
          renderItem={renderTestemunho}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
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
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CriarTestemunho')}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>

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
  cardTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  cargoRow: {
    marginBottom: SPACING.sm,
  },
  cargoText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 1,
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
