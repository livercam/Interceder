// Tela de Notificações In-App
// Lista todas as notificações do utilizador logado, ordenadas por data (mais recentes primeiro).
// Itens não lidos têm fundo destacado. Ao clicar, marca como lida e navega para o destino.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  listarNotificacoes,
  marcarNotificacaoComoLida,
} from '../services/firestoreService';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

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

const getIconePorTipo = (tipo) => {
  const icones = {
    apoio: '💬',
    intercessao: '🙏',
    testemunho: '🕊️',
    sistema: '⚙️',
  };
  return icones[tipo] || '🔔';
};

// ============================================================
// Componente de Item da Lista
// ============================================================
function NotificacaoItem({ item, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.notificacaoCard,
        !item.lida && styles.notificacaoCardNaoLida,
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificacaoIconContainer}>
        <Text style={styles.notificacaoIcon}>
          {getIconePorTipo(item.tipo)}
        </Text>
      </View>
      <View style={styles.notificacaoContent}>
        <View style={styles.notificacaoHeader}>
          <Text
            style={[
              styles.notificacaoTitulo,
              !item.lida && styles.notificacaoTituloNaoLido,
            ]}
            numberOfLines={1}
          >
            {item.titulo}
          </Text>
          {!item.lida && <View style={styles.naoLidaDot} />}
        </View>
        <Text
          style={styles.notificacaoMensagem}
          numberOfLines={2}
        >
          {item.mensagem}
        </Text>
        <Text style={styles.notificacaoData}>
          {getTempoRelativo(item.criado_em)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// Tela Principal
// ============================================================
export default function NotificacoesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarNotificacoes = useCallback(async () => {
    if (!user) return;
    try {
      const dados = await listarNotificacoes(user.uid);
      setNotificacoes(dados);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Carregar ao focar na tela (para atualizar após marcar como lida noutro sítio)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      carregarNotificacoes();
    }, [carregarNotificacoes])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    carregarNotificacoes();
  };

  const handlePressNotificacao = useCallback(
    async (notificacao) => {
      // Marcar como lida
      try {
        await marcarNotificacaoComoLida(notificacao.id);
      } catch (error) {
        console.warn('Erro ao marcar notificação como lida:', error);
      }

      // Navegar para o destino conforme o tipo
      if (notificacao.referencia_id) {
        if (notificacao.tipo === 'apoio' || notificacao.tipo === 'intercessao') {
          navigation.navigate('PedidoDetalhes', {
            pedidoId: notificacao.referencia_id,
          });
        } else if (notificacao.tipo === 'testemunho') {
          navigation.navigate('TestemunhoDetalhes', {
            testemunhoId: notificacao.referencia_id,
          });
        } else {
          // Tipo 'sistema' ou outro: apenas marca como lida, sem navegação
        }
      }
    },
    [navigation]
  );

  // ============================================================
  // Renderização
  // ============================================================
  if (loading && notificacoes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {notificacoes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptySubtitle}>
            Quando alguém interceder por ti ou enviar uma mensagem de apoio,
            aparecerá aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notificacoes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificacaoItem item={item} onPress={handlePressNotificacao} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  // Card de Notificação
  notificacaoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  notificacaoCardNaoLida: {
    backgroundColor: '#EFF6FF', // Azul bem clarinho
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  notificacaoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  notificacaoIcon: {
    fontSize: 22,
  },
  notificacaoContent: {
    flex: 1,
  },
  notificacaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificacaoTitulo: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray800,
    flex: 1,
  },
  notificacaoTituloNaoLido: {
    fontWeight: 'bold',
    color: COLORS.gray900,
  },
  naoLidaDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginLeft: SPACING.sm,
  },
  notificacaoMensagem: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificacaoData: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },

  // Estado Vazio
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
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
