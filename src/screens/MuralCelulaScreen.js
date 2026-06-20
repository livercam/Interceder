// Tela Mural da Célula v2 - Feed de Pedidos com Estilo Rede Social
// Cards modernos com avatar grande no cabeçalho, categoria destacada,
// contador de intercessões e badge de oração respondida.

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
  const diffMin = Math.floor((agora - data) / 60000);
  const diffHoras = Math.floor((agora - data) / 3600000);
  const diffDias = Math.floor((agora - data) / 86400000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHoras < 24) return `${diffHoras}h`;
  if (diffDias < 30) return `${diffDias}d`;
  return data.toLocaleDateString('pt-BR');
};

// ============================================================
// Card de Pedido (Estilo Rede Social)
// ============================================================
const PedidoCard = React.memo(function PedidoCard({ pedido, onDenunciar }) {
  const navigation = useNavigation();
  const isRespondido = pedido.status === 'respondido';
  const corCategoria = getCategoriaColor(pedido.categoria);

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
    if (isRespondido) return;
    Alert.alert(
      'Opções do Pedido',
      `O que deseja fazer com o pedido de "${pedido.autor_nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Denunciar', style: 'destructive', onPress: () => onDenunciar(pedido) },
      ]
    );
  };

  const handlePerfil = () => {
    if (pedido.autor_id) {
      navigation.navigate('PublicProfile', { userId: pedido.autor_id });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, isRespondido && styles.cardRespondido]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      delayLongPress={800}
    >
      {/* Cabeçalho: Avatar + Nome + Tempo */}
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={handlePerfil} style={styles.autorRow} activeOpacity={0.7}>
          {pedido.autor_foto_url ? (
            <Image source={{ uri: pedido.autor_foto_url }} style={styles.autorAvatar} />
          ) : (
            <View style={styles.autorAvatar}>
              <Text style={styles.autorAvatarText}>{pedido.autor_nome?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View style={styles.autorInfo}>
            <Text style={styles.autorNome} numberOfLines={1}>{formatarNomeCurto(pedido.autor_nome)}</Text>
            <Text style={styles.autorTempo}>{getTempoRelativo(pedido.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {/* Badge Respondido */}
        {isRespondido && (
          <View style={styles.badgeRespondido}>
            <Text style={styles.badgeRespondidoText}>🎉 Respondido</Text>
          </View>
        )}
      </View>

      {/* Categoria Tag */}
      <View style={[styles.categoriaTag, { backgroundColor: corCategoria + '18' }]}>
        <View style={[styles.categoriaDot, { backgroundColor: corCategoria }]} />
        <Text style={[styles.categoriaText, { color: corCategoria }]}>
          {getCategoriaLabel(pedido.categoria)}
        </Text>
      </View>

      {/* Texto do Pedido */}
      <Text style={styles.cardTexto} numberOfLines={4} ellipsizeMode="tail">
        {pedido.texto}
      </Text>

      {/* Barra de Interações */}
      <View style={styles.interacoesRow}>
        <View style={styles.interacaoItem}>
          <Text style={styles.interacaoIcone}>🙏</Text>
          <Text style={styles.interacaoContador}>{pedido.intercessores_count || 0}</Text>
        </View>
        {pedido.intercessores_count > 0 && (
          <View style={styles.interacaoItem}>
            <Text style={styles.interacaoIcone}>💬</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// Tela Principal
// ============================================================
export default function MuralCelulaScreen({ route }) {
  const { celulaId, celulaNome } = route.params;
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celula, setCelula] = useState(null);
  const unsubscribeRef = useRef(null);
  const navigation = useNavigation();
  const { user } = useAuth();

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

  useEffect(() => {
    if (!user) return;
    unsubscribeRef.current = listarPedidosDaCelula(celulaId, (pedidosAtualizados) => {
      setPedidos(pedidosAtualizados);
      setLoading(false);
    });
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user, celulaId]);

  const keyExtractor = useCallback((item) => item.id, []);

  const handleDenunciar = useCallback(async (pedido) => {
    if (!user) { Alert.alert('Atenção', 'Faça login para denunciar.'); return; }
    Alert.alert(
      'Confirmar Denúncia',
      `Tem certeza que deseja denunciar o pedido de ${pedido.autor_nome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Denunciar', style: 'destructive',
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

  const renderPedido = useCallback(({ item }) => (
    <PedidoCard pedido={item} onDenunciar={handleDenunciar} />
  ), [handleDenunciar]);

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
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONTS.sizes.md },
  listContent: { padding: SPACING.md, paddingBottom: 100 },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardRespondido: {
    backgroundColor: '#F0FFF0',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
  },

  // Cabeçalho
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
  autorAvatarText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
  autorInfo: { flex: 1 },
  autorNome: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.gray800 },
  autorTempo: { fontSize: FONTS.sizes.xs, color: COLORS.gray400, marginTop: 2 },

  // Badge Respondido
  badgeRespondido: {
    backgroundColor: '#4CAF50',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeRespondidoText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: 'bold' },

  // Categoria
  categoriaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.sm,
  },
  categoriaDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  categoriaText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },

  // Texto
  cardTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },

  // Interações
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
  interacaoIcone: { fontSize: 16 },
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
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.md },
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