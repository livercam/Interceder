// Tela Mural da Célula - Feed de Pedidos de Oração Privados da Célula
// Funcionalidades:
// - Lista apenas pedidos com privacidade 'celula' que contenham o celulaId
// - Cards clicáveis que navegam para PedidoDetalhesScreen
// - Botão flutuante para criar novo pedido (direcionado para esta célula)
// - Design consistente com o Mural Global

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
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
import { CATEGORIAS_PEDIDO } from '../constants/firestore';
import {
  criarPedido,
  listarPedidosDaCelula,
  denunciarPedido,
  getCelula,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

// Altura estimada de cada card
const CARD_ESTIMATED_HEIGHT = 200;

// ============================================================
// Utilitários
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

const getCategoriaLabel = (cat) => {
  const labels = {
    saude: 'Saúde',
    familia: 'Família',
    financas: 'Finanças',
    causas_impossiveis: 'Causas Impossíveis',
    gratidao: 'Gratidão',
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
// Componente de Card Clicável (Memoizado)
// ============================================================
const PedidoCard = React.memo(function PedidoCard({ pedido, onDenunciar }) {
  const navigation = useNavigation();
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
        </View>

        {isRespondido && (
          <View style={styles.badgeRespondido}>
            <Text style={styles.badgeRespondidoText}>🎉 ORAÇÃO RESPONDIDA</Text>
          </View>
        )}
      </View>

      {/* Texto do Pedido */}
      <Text style={styles.cardTexto} numberOfLines={3} ellipsizeMode="tail">
        {pedido.texto}
      </Text>

      {/* Rodapé do Card */}
      <View style={styles.cardFooter}>
        <View style={styles.autorInfo}>
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
          <Text style={styles.autorNome} numberOfLines={1}>
            {formatarNomeCurto(pedido.autor_nome)}
          </Text>
        </View>

        <View style={styles.cardStats}>
          <Text style={styles.tempoTexto}>
            {getTempoRelativo(pedido.createdAt)}
          </Text>
          <Text style={styles.statsSeparator}>•</Text>
          <Text style={styles.intercessoresTexto}>
            🙏 {pedido.intercessores_count || 0}
          </Text>
        </View>
      </View>

      {/* Dica de clique */}
      <View style={styles.tapHint}>
        <Text style={styles.tapHintText}>👆 Toque para ver detalhes</Text>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// Tela Principal do Mural da Célula
// ============================================================
export default function MuralCelulaScreen({ route }) {
  const { celulaId, celulaNome } = route.params;
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celula, setCelula] = useState(null);
  const unsubscribeRef = useRef(null);
  const navigation = useNavigation();

  // Estado reativo global via AuthContext
  const { user } = useAuth();

  // Carregar dados da célula
  useEffect(() => {
    if (!user) return;
    const carregarCelula = async () => {
      try {
        const dados = await getCelula(celulaId);
        setCelula(dados);
      } catch (error) {
        console.warn('[MuralCelula] Erro ao carregar célula:', error.message);
      }
    };
    carregarCelula();
  }, [user, celulaId]);

  // Escutar pedidos da célula em tempo real
  useEffect(() => {
    if (!user) return;

    unsubscribeRef.current = listarPedidosDaCelula(celulaId, (pedidosAtualizados) => {
      setPedidos(pedidosAtualizados);
      setLoading(false);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user, celulaId]);

  // keyExtractor estável
  const keyExtractor = useCallback((item) => item.id, []);

  // getItemLayout para scroll mais rápido
  const getItemLayout = useCallback((_data, index) => ({
    length: CARD_ESTIMATED_HEIGHT,
    offset: CARD_ESTIMATED_HEIGHT * index,
    index,
  }), []);

  // Denunciar um pedido
  const handleDenunciar = useCallback(async (pedido) => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para denunciar.');
      return;
    }

    Alert.alert(
      'Confirmar Denúncia',
      `Tem certeza que deseja denunciar o pedido de ${pedido.autor_nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar',
          style: 'destructive',
          onPress: async () => {
            try {
              await denunciarPedido(pedido.id, user.uid);
              Alert.alert('Denúncia registrada', 'O pedido será analisado pela moderação.');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível denunciar. Tente novamente.');
            }
          },
        },
      ]
    );
  }, []);

  // Renderizar cada card (memoizado)
  const renderPedido = useCallback(
    ({ item }) => (
      <PedidoCard
        pedido={item}
        onDenunciar={handleDenunciar}
      />
    ),
    [handleDenunciar]
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
        </View>
      ) : (
        <FlatList
          data={pedidos}
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
              <Text style={styles.emptyEmoji}>🙏</Text>
              <Text style={styles.emptyTitle}>Nenhum pedido na célula</Text>
              <Text style={styles.emptySubtitle}>
                Os pedidos de oração compartilhados com esta célula aparecerão aqui.
              </Text>
            </View>
          }
        />
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
  autorNome: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
    flex: 1,
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
  tapHint: {
    marginTop: SPACING.xs,
    alignItems: 'flex-end',
  },
  tapHintText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray300,
    fontStyle: 'italic',
  },

  // Card Respondido (verde)
  cardRespondido: {
    backgroundColor: '#F0FFF0',
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
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    flexWrap: 'wrap',
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

});
