// Lista de Oração Pessoal - Pedidos Salvos pelo Utilizador
// Funcionalidades:
// - Busca o documento do utilizador para obter o array pedidos_salvos
// - Busca os pedidos ativos cujo ID esteja no array
// - Renderiza cartões iguais aos do Mural
// - Ao clicar, navega para PedidoDetalhesScreen
// - Estado vazio elegante

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getUserProfile } from '../services/firestoreService';
import { getPedido } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

// ============================================================
// Utilitários (mesmos do Mural)
// ============================================================
const getCategoriaColor = (cat) => {
  const cores = {
    saude: '#EF4444',
    familia: '#3B82F6',
    financas: '#10B981',
    causas_impossiveis: '#F59E0B',
    gratidao: '#EC4899',
  };
  return cores[cat] || COLORS.gray400;
};

const getCategoriaIcon = (cat) => {
  const icons = {
    saude: '🩺',
    familia: '👨‍👩‍👧‍👦',
    financas: '💰',
    causas_impossiveis: '🔥',
    gratidao: '🙌',
  };
  return icons[cat] || '🙏';
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
// Card de Pedido (mesmo estilo do Mural)
// ============================================================
function PedidoCard({ pedido, onPress }) {
  const categoriaColor = getCategoriaColor(pedido.categoria);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Cabeçalho do Card */}
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>
            {pedido.autor_nome?.charAt(0)?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardAutor} numberOfLines={1}>
            {formatarNomeCurto(pedido.autor_nome)}
          </Text>
          <Text style={styles.cardData}>
            {getTempoRelativo(pedido.createdAt)}
          </Text>
        </View>
        <View style={[styles.cardCategoria, { backgroundColor: categoriaColor + '20' }]}>
          <Text style={[styles.cardCategoriaText, { color: categoriaColor }]}>
            {getCategoriaIcon(pedido.categoria)}
          </Text>
        </View>
      </View>

      {/* Texto do Pedido (truncado) */}
      <Text style={styles.cardTexto} numberOfLines={3}>
        {pedido.texto}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.cardIntercessoes}>
          🙏 {pedido.intercessores_count || 0} intercessões
        </Text>
        {pedido.privacidade === 'celula' && (
          <Text style={styles.cardPrivacidade}>🔒 Célula</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Tela Principal
// ============================================================
export default function ListaOracaoScreen({ navigation }) {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarPedidosSalvos = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Buscar o perfil do utilizador para obter pedidos_salvos
      const perfil = await getUserProfile(user.uid);
      const idsSalvos = perfil?.pedidos_salvos || [];

      if (idsSalvos.length === 0) {
        setPedidos([]);
        return;
      }

      // 2. Buscar cada pedido individualmente (Firestore não suporta array-contains
      //    em múltiplos documentos de forma eficiente com in limitado a 10)
      //    Estratégia: buscar todos os ativos e filtrar no frontend
      const resultados = [];
      // Processar em lotes para não sobrecarregar
      const lote = idsSalvos.slice(0, 50); // Máximo 50 pedidos salvos

      for (const id of lote) {
        try {
          const pedido = await getPedido(id);
          if (pedido && pedido.status === 'ativo') {
            resultados.push(pedido);
          }
        } catch {
          // Ignorar pedidos que não existem mais ou deram erro
        }
      }

      // Ordenar do mais recente para o mais antigo
      resultados.sort((a, b) => {
        const dataA = a.createdAt?.toDate?.() || new Date(0);
        const dataB = b.createdAt?.toDate?.() || new Date(0);
        return dataB - dataA;
      });

      setPedidos(resultados);
    } catch (error) {
      console.error('Erro ao carregar pedidos salvos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Recarregar sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregarPedidosSalvos();
    }, [carregarPedidosSalvos])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    carregarPedidosSalvos();
  };

  const handleAbrirPedido = (pedido) => {
    navigation.navigate('PedidoDetalhes', { pedidoId: pedido.id });
  };

  // ============================================================
  // Estado Vazio
  // ============================================================
  if (!loading && pedidos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>📌</Text>
        <Text style={styles.emptyTitle}>Sua lista está vazia</Text>
        <Text style={styles.emptySubtitle}>
          Salve pedidos no Mural para orar quando tiver um tempo tranquilo.
        </Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Mural' })}
          activeOpacity={0.85}
        >
          <Text style={styles.emptyBtnText}>Ir para o Mural</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================
  // Loading
  // ============================================================
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando lista...</Text>
      </View>
    );
  }

  // ============================================================
  // Lista de Pedidos
  // ============================================================
  return (
    <View style={styles.container}>
      <FlatList
        data={pedidos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PedidoCard pedido={item} onPress={() => handleAbrirPedido(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
      />
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
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
  },

  // Estado Vazio
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
    maxWidth: 300,
  },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxl,
    ...SHADOWS.md,
  },
  emptyBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  cardAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
  },
  cardInfo: {
    flex: 1,
  },
  cardAutor: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  cardData: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginTop: 1,
  },
  cardCategoria: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCategoriaText: {
    fontSize: 16,
  },
  cardTexto: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIntercessoes: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },
  cardPrivacidade: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    fontWeight: '500',
  },
});
