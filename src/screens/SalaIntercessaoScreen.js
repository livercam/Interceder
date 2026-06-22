// Sala de Intercessão - Cronómetro de Oração Focado
// Funcionalidades:
// - Exibe o pedido de oração de forma legível e sem distrações
// - Cronómetro grande em formato MM:SS
// - Ao final do tempo, regista a intercessão automaticamente
// - Botão "Desistir" para sair sem registar
// - Mensagem de sucesso "Amém!" ao completar

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  intercederPorPedido,
  toggleSalvarPedido,
  buscarProximoPedido,
  getUserProfile,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// Tela da Sala de Intercessão
// ============================================================
export default function SalaIntercessaoScreen({ route, navigation }) {
  const { pedidoId, pedidoTexto, pedidoAutor, tempoSegundos } = route.params;
  const { user } = useAuth();

  const [tempoRestante, setTempoRestante] = useState(tempoSegundos);
  const [ativo, setAtivo] = useState(true);
  const [concluido, setConcluido] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  // Estatísticas de gamificação (carregadas após conclusão)
  const [oracoesHoje, setOracoesHoje] = useState(0);
  const [minutosSemana, setMinutosSemana] = useState(0);
  const [buscandoProximo, setBuscandoProximo] = useState(false);

  // Animação de pulsação do cronómetro
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Referência do intervalo para limpeza
  const intervalRef = useRef(null);
  const registrarRef = useRef(null);

  // Manter a referência atualizada para evitar stale closure no setInterval
  const resultadoRef = useRef(null);
  registrarRef.current = useCallback(async () => {
    if (!user) return;

    setRegistrando(true);
    try {
      // Calcula minutos orados (arredondado para cima, mínimo 1)
      const minutosOrados = Math.max(1, Math.round(tempoSegundos / 60));
      const resultado = await intercederPorPedido(pedidoId, user.uid, minutosOrados);
      resultadoRef.current = resultado;
      // Remover automaticamente da Lista de Oração Pessoal
      await toggleSalvarPedido(user.uid, pedidoId, 'remover');
      setConcluido(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registar a intercessão.');
      setConcluido(true);
    } finally {
      setRegistrando(false);
    }
  }, [pedidoId, user, tempoSegundos]);

  // Iniciar animação de pulsação
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  // Lógica do cronómetro
  useEffect(() => {
    if (!ativo || concluido) return;

    intervalRef.current = setInterval(() => {
      setTempoRestante((prev) => {
        if (prev <= 1) {
          // Tempo acabou!
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setAtivo(false);
          // Usar a ref para evitar stale closure
          if (registrarRef.current) {
            registrarRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [ativo, concluido]);

  // Desistir / Cancelar
  const handleDesistir = () => {
    Alert.alert(
      'Desistir da Intercessão',
      'Tem certeza que deseja sair? A sua oração não será registada.',
      [
        { text: 'Continuar Orando', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  // Carregar estatísticas do utilizador após conclusão
  // Só computa se for a PRIMEIRA vez que ora por este pedido
  useEffect(() => {
    if (!concluido || !user) return;

    const resultado = resultadoRef.current;
    // Se já intercedeu antes pelo mesmo pedido, NÃO computa as estatísticas novamente
    if (resultado?.jaIntercedeu) return;

    const carregarEstatisticas = async () => {
      try {
        const perfil = await getUserProfile(user.uid);
        const stats = perfil?.stats || {};
        setOracoesHoje(stats.oracoes_hoje || 0);
        setMinutosSemana(stats.minutos_semana || 0);
      } catch (error) {
        console.warn('[SalaIntercessao] Erro ao carregar estatísticas:', error.message);
        // Fallback: usar valores mínimos para não deixar em branco
        setOracoesHoje(1);
        setMinutosSemana(Math.max(1, Math.round(tempoSegundos / 60)));
      }
    };
    carregarEstatisticas();
  }, [concluido, user]);

  // Loop de Intercessão: Orar por outro pedido
  const handleOrarProximo = async () => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para continuar intercedendo.');
      return;
    }

    setBuscandoProximo(true);
    try {
      const proximoPedido = await buscarProximoPedido(pedidoId);
      if (!proximoPedido) {
        Alert.alert('🙏 Obrigado!', 'Não há mais pedidos disponíveis no momento. Volte mais tarde!');
        setBuscandoProximo(false);
        return;
      }

      // Navegar de volta para a Sala de Intercessão com o novo pedido
      navigation.replace('SalaIntercessao', {
        pedidoId: proximoPedido.id,
        pedidoTexto: proximoPedido.texto,
        pedidoAutor: proximoPedido.autor_nome,
        tempoSegundos,
      });
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível buscar o próximo pedido.');
    } finally {
      setBuscandoProximo(false);
    }
  };

  // Navegar para a tela de Mensagem de Apoio
  const handleDeixarMensagem = () => {
    navigation.navigate('NovaMensagemApoio', {
      pedidoId,
      pedidoAutor,
    });
  };

  // Voltar ao mural após conclusão
  const handleVoltar = () => {
    // Volta para a tela anterior (PedidoDetalhes)
    navigation.goBack();
  };

  // Formatar tempo para MM:SS
  const formatarTempo = (segundos) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  // ============================================================
  // Tela de Conclusão (Gamificada)
  // ============================================================
  if (concluido) {
    return (
      <View style={styles.conclusaoContainer}>
        <View style={styles.conclusaoContent}>
          <Text style={styles.conclusaoEmojiGrande}>🙌</Text>
          <Text style={styles.conclusaoTitulo}>Amém!</Text>
          <Text style={styles.conclusaoSubtitulo}>
            A sua intercessão foi registada.
          </Text>
          <Text style={styles.conclusaoDetalhe}>
            O seu tempo de oração por <Text style={styles.conclusaoDestaque}>{pedidoAutor}</Text> foi dedicado a Deus.
          </Text>

          {registrando && (
            <ActivityIndicator
              size="small"
              color={COLORS.white}
              style={{ marginTop: SPACING.md }}
            />
          )}

          {/* ============================================ */}
          {/* Estatísticas de Gamificação */}
          {/* ============================================ */}
          {user && (
            <View style={styles.estatisticasContainer}>
              <View style={styles.estatisticaCard}>
                <Text style={styles.estatisticaEmoji}>🙏</Text>
                <Text style={styles.estatisticaValor}>{oracoesHoje}</Text>
                <Text style={styles.estatisticaLabel}>
                  {oracoesHoje === 1 ? 'pessoa hoje' : 'pessoas hoje'}
                </Text>
              </View>
              <View style={styles.estatisticaDivider} />
              <View style={styles.estatisticaCard}>
                <Text style={styles.estatisticaEmoji}>⏱️</Text>
                <Text style={styles.estatisticaValor}>{minutosSemana}</Text>
                <Text style={styles.estatisticaLabel}>
                  {minutosSemana === 1 ? 'minuto nesta semana' : 'minutos nesta semana'}
                </Text>
              </View>
            </View>
          )}

          {/* ============================================ */}
          {/* Botão: Orar por outro pedido (Loop) */}
          {/* ============================================ */}
          <TouchableOpacity
            style={styles.proximoBtn}
            onPress={handleOrarProximo}
            activeOpacity={0.85}
            disabled={buscandoProximo}
          >
            {buscandoProximo ? (
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : (
              <>
                <Text style={styles.proximoBtnIcon}>🔥</Text>
                <Text style={styles.proximoBtnText}>Orar por outro pedido</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ============================================ */}
          {/* Botão: Deixar uma palavra de apoio */}
          {/* ============================================ */}
          <TouchableOpacity
            style={styles.mensagemBtn}
            onPress={handleDeixarMensagem}
            activeOpacity={0.85}
          >
            <Text style={styles.mensagemBtnIcon}>💬</Text>
            <Text style={styles.mensagemBtnText}>Deixar uma palavra de apoio</Text>
          </TouchableOpacity>

          {/* ============================================ */}
          {/* Botão: Voltar ao Mural */}
          {/* ============================================ */}
          <TouchableOpacity
            style={styles.conclusaoBtn}
            onPress={handleVoltar}
            activeOpacity={0.85}
          >
            <Text style={styles.conclusaoBtnText}>Voltar ao Mural</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ============================================================
  // Tela da Sala de Intercessão
  // ============================================================
  return (
    <View style={styles.container}>
      {/* Fundo com gradiente suave */}
      <View style={styles.backgroundGradient} />

      {/* Conteúdo centralizado */}
      <View style={styles.content}>
        {/* Título da Oração */}
        <View style={styles.pedidoHeader}>
          <Text style={styles.pedidoLabel}>🙏 Intercedendo por</Text>
          <Text style={styles.pedidoAutor}>{pedidoAutor}</Text>
        </View>

        {/* Texto do Pedido */}
        <View style={styles.pedidoCard}>
          <Text style={styles.pedidoTexto}>{pedidoTexto}</Text>
        </View>

        {/* Cronómetro */}
        <Animated.View
          style={[
            styles.cronometroContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.cronometroTempo}>
            {formatarTempo(tempoRestante)}
          </Text>
          <Text style={styles.cronometroLabel}>
            {tempoRestante === 1 ? 'segundo restante' : 'segundos restantes'}
          </Text>
        </Animated.View>

        {/* Indicador visual de progresso */}
        <View style={styles.progressoContainer}>
          <View
            style={[
              styles.progressoBar,
              {
                width: `${((tempoSegundos - tempoRestante) / tempoSegundos) * 100}%`,
              },
            ]}
          />
        </View>

        {/* Botão Desistir */}
        <TouchableOpacity
          style={styles.desistirBtn}
          onPress={handleDesistir}
          activeOpacity={0.8}
        >
          <Text style={styles.desistirBtnText}>Desistir / Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primary,
    opacity: 0.95,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },

  // Cabeçalho do Pedido
  pedidoHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pedidoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    opacity: 0.7,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  pedidoAutor: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
  },

  // Card do Pedido
  pedidoCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    width: '100%',
    maxWidth: 400,
  },
  pedidoTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.9,
  },

  // Cronómetro
  cronometroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  cronometroTempo: {
    fontSize: 72,
    fontWeight: '200',
    color: COLORS.white,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  cronometroLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.white,
    opacity: 0.6,
    marginTop: -SPACING.xs,
  },

  // Barra de Progresso
  progressoContainer: {
    width: '100%',
    maxWidth: 300,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  progressoBar: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },

  // Botão Desistir
  desistirBtn: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  desistirBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    opacity: 0.8,
    fontWeight: '600',
  },

  // Tela de Conclusão
  conclusaoContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  conclusaoContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  conclusaoEmojiGrande: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  conclusaoTitulo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  conclusaoSubtitulo: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.white,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  conclusaoDetalhe: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  conclusaoDestaque: {
    fontWeight: 'bold',
    color: COLORS.white,
    opacity: 1,
  },
  conclusaoBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxl,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  conclusaoBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Estatísticas de Gamificação
  estatisticasContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    width: '100%',
    maxWidth: 360,
  },
  estatisticaCard: {
    flex: 1,
    alignItems: 'center',
  },
  estatisticaEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  estatisticaValor: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  estatisticaLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.white,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 2,
  },
  estatisticaDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: SPACING.md,
  },

  // Botão: Orar por outro pedido
  proximoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    width: '100%',
    maxWidth: 320,
    ...SHADOWS.md,
  },
  proximoBtnIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  proximoBtnText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },

  // Botão: Deixar uma palavra de apoio
  mensagemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  mensagemBtnIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  mensagemBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});
