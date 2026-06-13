// Tela Ofertando - Contribuição Financeira Voluntária
// Estilo "Comunitário Vibrante" com transparência, PIX e microinteração de gratidão
//
// Funcionalidades:
// - Painel de Transparência: custo do servidor + barra de progresso (tempo real via Firestore)
// - Botão "Copiar Chave PIX" com expo-clipboard
// - Botão "Já Ofertei" com microinteração visual (coração pulsando)
// - Design elegante, direto e que transmite confiança

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getFinanceiroSnapshot } from '../services/firestoreService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - SPACING.lg * 2 - SPACING.lg * 2;

// ============================================================
// Componente de Barra de Progresso Animada
// ============================================================
function ProgressBar({ progress, color }) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressBarTrack}>
      <Animated.View
        style={[
          styles.progressBarFill,
          {
            width: widthInterpolated,
            backgroundColor: color || COLORS.primary,
          },
        ]}
      />
    </View>
  );
}

// ============================================================
// Componente de Coração Pulsante (Microinteração)
// ============================================================
function CoracaoPulsante({ visible }) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      // Animação de pulso: escala 0 → 1.3 → 1, fade in/out
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(scale, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.coracaoContainer,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      <Text style={styles.coracaoEmoji}>❤️</Text>
    </Animated.View>
  );
}

// ============================================================
// Tela Principal Ofertando
// ============================================================
export default function OfertandoScreen() {
  const [showCoracao, setShowCoracao] = useState(false);
  const [jaOferteiCount, setJaOferteiCount] = useState(0);
  const [financeiro, setFinanceiro] = useState({
    custo_servidor: 250.0,
    total_arrecadado_mes: 0,
    chave_pix: 'interceder@oficinaoracao.com.br',
    nome_beneficiario: 'Rede Interceder',
  });

  // Escuta em tempo real o documento financeiro no Firestore
  useEffect(() => {
    const unsubscribe = getFinanceiroSnapshot((data) => {
      if (data) {
        setFinanceiro(data);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const custoServidor = financeiro.custo_servidor || 250.0;
  const arrecadadoMes = financeiro.total_arrecadado_mes || 0;
  const chavePix = financeiro.chave_pix || 'interceder@oficinaoracao.com.br';
  const nomeBeneficiario = financeiro.nome_beneficiario || 'Rede Interceder';

  const progresso = custoServidor > 0 ? arrecadadoMes / custoServidor : 0;
  const percentual = Math.round(progresso * 100);
  const faltante = Math.max(0, custoServidor - arrecadadoMes);

  // ============================================================
  // Copiar Chave PIX
  // ============================================================
  const handleCopiarPix = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(chavePix);
      Alert.alert(
        '✅ Chave PIX copiada!',
        `Chave: ${chavePix}\n\nUse seu banco para fazer a transferência. Sua contribuição mantém viva esta rede de oração. 🙏`,
        [{ text: 'Obrigado!' }]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível copiar a chave PIX. Tente novamente.');
    }
  }, [chavePix]);

  // ============================================================
  // Botão "Já Ofertei" com microinteração
  // ============================================================
  const handleJaOfertei = useCallback(() => {
    // Disparar microinteração do coração
    setShowCoracao(true);
    setJaOferteiCount((prev) => prev + 1);

    // Esconder o coração após a animação
    setTimeout(() => {
      setShowCoracao(false);
    }, 1500);

    // Mensagem de gratidão
    const mensagens = [
      'Deus ama quem dá com alegria! Sua oferta faz a diferença. 🙌',
      'Gratidão por apoiar esta obra! Que Deus te abençoe ricamente. 🌟',
      'Sua generosidade mantém viva a chama da intercessão! 🔥',
      'Obrigado por fazer parte desta família de oração! 💜',
      'Sua semente de amor está gerando frutos eternos! 🌱',
    ];
    const mensagem =
      mensagens[Math.floor(Math.random() * mensagens.length)];

    Alert.alert('🙏 Gratidão!', mensagem);
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================ */}
        {/* HEADER - Título e descrição */}
        {/* ============================================ */}
        <View style={styles.headerSection}>
          <Text style={styles.headerEmoji}>🎁</Text>
          <Text style={styles.headerTitle}>Ofertando</Text>
          <Text style={styles.headerSubtitle}>
            Contribua voluntariamente para a manutenção da nossa rede de oração.
            Tudo é feito com amor e transparência.
          </Text>
        </View>

        {/* ============================================ */}
        {/* PAINEL DE TRANSPARÊNCIA */}
        {/* ============================================ */}
        <View style={styles.transparenciaCard}>
          <View style={styles.transparenciaHeader}>
            <Text style={styles.transparenciaTitle}>📊 Transparência</Text>
            <Text style={styles.transparenciaMes}>Maio 2026</Text>
          </View>

          {/* Custo do Servidor */}
          <View style={styles.custoRow}>
            <Text style={styles.custoLabel}>Custo do Servidor</Text>
            <Text style={styles.custoValor}>
              R$ {custoServidor.toFixed(2)}
            </Text>
          </View>

          {/* Barra de Progresso */}
          <View style={styles.progressoSection}>
            <View style={styles.progressoLabels}>
              <Text style={styles.progressoLabel}>
                Arrecadado: R$ {arrecadadoMes.toFixed(2)}
              </Text>
              <Text style={styles.progressoPercentual}>{percentual}%</Text>
            </View>
            <ProgressBar
              progress={progresso}
              color={
                percentual >= 100
                  ? COLORS.success
                  : percentual >= 75
                  ? COLORS.accent
                  : COLORS.primary
              }
            />
            <Text style={styles.progressoFaltante}>
              {percentual >= 100
                ? '🎉 Meta alcançada! Gratidão a todos que contribuíram!'
                : `Faltam R$ ${faltante.toFixed(2)} para atingir a meta do mês`}
            </Text>
          </View>

          {/* Indicador de Confiança */}
          <View style={styles.confiancaRow}>
            <Text style={styles.confiancaIcon}>🔒</Text>
            <Text style={styles.confiancaText}>
              100% dos recursos são destinados à manutenção da plataforma.
            </Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* SEÇÃO DE AÇÃO DIRETA - PIX */}
        {/* ============================================ */}
        <View style={styles.pixSection}>
          <Text style={styles.pixTitle}>💳 Contribua via PIX</Text>
          <Text style={styles.pixDescricao}>
            Sua oferta voluntária mantém o servidor ativo, garante a moderação
            dos pedidos e permite que continuemos espalhando a corrente de
            oração. Qualquer valor é bem-vindo!
          </Text>

          {/* Card da Chave PIX */}
          <View style={styles.pixCard}>
            <View style={styles.pixCardHeader}>
              <Text style={styles.pixCardLabel}>Chave PIX (Copia e Cola)</Text>
              <Text style={styles.pixCardTipo}>📧 Email</Text>
            </View>
            <Text style={styles.pixChave} selectable>
              {chavePix}
            </Text>
            <Text style={styles.pixBeneficiario}>
              {nomeBeneficiario}
            </Text>
          </View>

          {/* Botão Copiar PIX */}
          <TouchableOpacity
            style={styles.copiarBtn}
            onPress={handleCopiarPix}
            activeOpacity={0.8}
          >
            <Text style={styles.copiarBtnIcon}>📋</Text>
            <Text style={styles.copiarBtnText}>Copiar Chave PIX</Text>
          </TouchableOpacity>

          {/* Botão "Já Ofertei" */}
          <TouchableOpacity
            style={styles.jaOferteiBtn}
            onPress={handleJaOfertei}
            activeOpacity={0.8}
          >
            <Text style={styles.jaOferteiBtnText}>
              ✅ Já Ofertei
            </Text>
          </TouchableOpacity>

          {jaOferteiCount > 0 && (
            <Text style={styles.jaOferteiCount}>
              {jaOferteiCount} {jaOferteiCount === 1 ? 'pessoa já ofertou' : 'pessoas já ofertaram'} este mês
            </Text>
          )}
        </View>

        {/* ============================================ */}
        {/* SEÇÃO DE INSPIRAÇÃO */}
        {/* ============================================ */}
        <View style={styles.inspiracaoSection}>
          <Text style={styles.inspiracaoQuote}>
            "Cada um contribua segundo propôs no seu coração, não com tristeza
            ou por necessidade; porque Deus ama quem dá com alegria."
          </Text>
          <Text style={styles.inspiracaoRef}>— 2 Coríntios 9:7</Text>
        </View>

        {/* Espaço extra no final */}
        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* Microinteração do Coração Pulsante (overlay) */}
      <CoracaoPulsante visible={showCoracao} />
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
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },

  // Painel de Transparência
  transparenciaCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  transparenciaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  transparenciaTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  transparenciaMes: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    fontWeight: '500',
  },
  custoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  custoLabel: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  custoValor: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Barra de Progresso
  progressoSection: {
    marginBottom: SPACING.md,
  },
  progressoLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  progressoLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  progressoPercentual: {
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressBarTrack: {
    height: 12,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  progressoFaltante: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },

  // Confiança
  confiancaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success + '10',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  confiancaIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
  },
  confiancaText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray600,
    flex: 1,
    lineHeight: 16,
  },

  // Seção PIX
  pixSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  pixTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
  },
  pixDescricao: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },

  // Card da Chave PIX
  pixCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary + '20',
    borderStyle: 'dashed',
    marginBottom: SPACING.md,
  },
  pixCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pixCardLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  pixCardTipo: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  pixChave: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  pixBeneficiario: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
  },

  // Botão Copiar PIX
  copiarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
    marginBottom: SPACING.sm,
  },
  copiarBtnIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  copiarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Botão "Já Ofertei"
  jaOferteiBtn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  jaOferteiBtnText: {
    color: COLORS.success,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  jaOferteiCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Inspiração
  inspiracaoSection: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary + '08',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  inspiracaoQuote: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },
  inspiracaoRef: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Coração Pulsante (Overlay)
  coracaoContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    pointerEvents: 'none',
  },
  coracaoEmoji: {
    fontSize: 120,
  },
});
