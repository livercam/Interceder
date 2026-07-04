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
          <Text style={styles.interacaoContador}>{testemunho.mensagens_count || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// Tela Principal de Testemunhos
// ============================================================
export default function TestemunhosScreen() {
  const navigation = useNavigation();
  const [testemunhos, setTestemunhos] = useState([]);
  const [loading, setLoading] = useState(true);
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
    ({ item }) => <TestemunhoCard testemunho={{ ...item, mensagens_count: contagensMensagens[item.id] ?? 0 }} />,
    [contagensMensagens]
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
