// PaywallScreen - Tela de Assinatura Premium (Selo Azul de Verificação)
// Funcionalidades:
// - Exibe benefícios do plano premium
// - Busca ofertas do RevenueCat dinamicamente
// - Botão de assinar com preço dinâmico
// - Sincroniza isPremium no Firestore após compra bem-sucedida

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  getOfferings,
  purchasePackage,
  syncPremiumToFirestore,
} from '../services/RevenueCatService';

// ============================================================
// Benefícios do Premium
// ============================================================
const BENEFICIOS = [
  {
    icon: '💎',
    title: 'Selo Azul de Verificação',
    desc: 'Destaque-se com o selo azul ao lado do seu nome em todo o app.',
  },
  {
    icon: '🚀',
    title: 'Maior Visibilidade',
    desc: 'Seus pedidos de oração e testemunhos aparecem com destaque no feed.',
  },
  {
    icon: '🙌',
    title: 'Apoio à Comunidade',
    desc: 'Contribui diretamente para a manutenção e crescimento do ministério.',
  },
  {
    icon: '⭐',
    title: 'Reconhecimento Especial',
    desc: 'Badge de Membro Apoiador visível no seu perfil público.',
  },
];

// ============================================================
// Tela Paywall
// ============================================================
export default function PaywallScreen({ navigation }) {
  const { user } = useAuth();

  const [offerings, setOfferings] = useState(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  // Carregar offerings ao montar a tela
  useEffect(() => {
    const carregarOfferings = async () => {
      setLoadingOfferings(true);
      const offering = await getOfferings();
      setOfferings(offering);
      setLoadingOfferings(false);
    };
    carregarOfferings();
  }, []);

  // ============================================================
  // Assinar
  // ============================================================
  const handleAssinar = async () => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para assinar.');
      return;
    }

    if (!offerings || !offerings.availablePackages || offerings.availablePackages.length === 0) {
      Alert.alert(
        'Indisponível',
        'Nenhum plano disponível no momento. Tente novamente mais tarde.'
      );
      return;
    }

    setPurchasing(true);

    try {
      // Pega o primeiro pacote disponível
      const pacote = offerings.availablePackages[0];
      const resultado = await purchasePackage(pacote);

      if (resultado.success) {
        // Compra bem-sucedida → sincronizar com Firestore
        const sincronizado = await syncPremiumToFirestore(user.uid);

        if (sincronizado) {
          Alert.alert(
            '🎉 Selo Azul Ativado!',
            'Parabéns! Agora és um Membro Apoiador. O selo azul já aparece ao lado do teu nome.',
            [
              {
                text: 'Continuar',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        } else {
          Alert.alert(
            '✅ Compra realizada!',
            'A compra foi concluída, mas houve um erro ao sincronizar. O selo será ativado em breve.',
            [
              {
                text: 'Voltar',
                onPress: () => navigation.goBack(),
              },
            ]
          );
        }
      } else if (resultado.cancelled) {
        // Utilizador cancelou — não mostrar erro
        console.log('[Paywall] Utilizador cancelou a compra.');
      } else {
        // Erro na compra
        Alert.alert(
          'Erro',
          resultado.error || 'Não foi possível processar a compra. Tente novamente.'
        );
      }
    } catch (error) {
      console.error('[Paywall] Erro inesperado:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setPurchasing(false);
    }
  };

  // ============================================================
  // Obter preço formatado do pacote
  // ============================================================
  const getPreco = () => {
    if (!offerings || !offerings.availablePackages || offerings.availablePackages.length === 0) {
      return null;
    }
    const pacote = offerings.availablePackages[0];
    return pacote.product.priceString || `${pacote.product.price}€`;
  };

  const preco = getPreco();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <View style={styles.headerSection}>
        <View style={styles.headerIconContainer}>
          <Text style={styles.headerIcon}>💎</Text>
        </View>
        <Text style={styles.headerTitle}>Torne-se um Membro Apoiador</Text>
        <Text style={styles.headerSubtitle}>
          Ative o Selo Azul de Verificação e destaque-se na comunidade
        </Text>
      </View>

      {/* ============================================ */}
      {/* BENEFÍCIOS */}
      {/* ============================================ */}
      <View style={styles.beneficiosSection}>
        <Text style={styles.sectionTitle}>✨ Benefícios Exclusivos</Text>

        {BENEFICIOS.map((beneficio, index) => (
          <View key={index} style={styles.beneficioCard}>
            <Text style={styles.beneficioIcon}>{beneficio.icon}</Text>
            <View style={styles.beneficioInfo}>
              <Text style={styles.beneficioTitle}>{beneficio.title}</Text>
              <Text style={styles.beneficioDesc}>{beneficio.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ============================================ */}
      {/* PLANO / PREÇO */}
      {/* ============================================ */}
      <View style={styles.planoSection}>
        {loadingOfferings ? (
          <View style={styles.loadingPreco}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingPrecoText}>Carregando planos...</Text>
          </View>
        ) : preco ? (
          <View style={styles.planoCard}>
            <Text style={styles.planoBadge}>📅 Assinatura Mensal</Text>
            <Text style={styles.planoPreco}>{preco}</Text>
            <Text style={styles.planoDesc}>por mês, cancela quando quiseres</Text>
          </View>
        ) : (
          <View style={styles.planoCard}>
            <Text style={styles.planoBadge}>📅 Assinatura Mensal</Text>
            <Text style={styles.planoPreco}>Em breve</Text>
            <Text style={styles.planoDesc}>Planos disponíveis em instantes</Text>
          </View>
        )}

        {/* Botão Assinar */}
        <TouchableOpacity
          style={[
            styles.assinarBtn,
            (purchasing || loadingOfferings) && styles.assinarBtnDisabled,
          ]}
          onPress={handleAssinar}
          disabled={purchasing || loadingOfferings}
          activeOpacity={0.85}
        >
          {purchasing ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Text style={styles.assinarBtnIcon}>💎</Text>
              <Text style={styles.assinarBtnText}>
                {preco ? `Assinar por ${preco}/mês` : 'Ativar Selo Azul'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.assinarDisclaimer}>
          Pagamento seguro processado pela App Store / Google Play.
          {'\n'}Podes cancelar quando quiseres nas definições da tua conta.
        </Text>
      </View>

      {/* ============================================ */}
      {/* BOTÃO VOLTAR */}
      {/* ============================================ */}
      <TouchableOpacity
        style={styles.voltarBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.voltarBtnText}>Agora não, obrigado</Text>
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
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
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  headerIcon: {
    fontSize: 40,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },

  // Seções
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },

  // Benefícios
  beneficiosSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  beneficioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  beneficioIcon: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  beneficioInfo: {
    flex: 1,
  },
  beneficioTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: 2,
  },
  beneficioDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    lineHeight: 18,
  },

  // Plano
  planoSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  loadingPreco: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  loadingPrecoText: {
    marginLeft: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  planoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  planoBadge: {
    fontSize: FONTS.sizes.sm,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  planoPreco: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  planoDesc: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },

  // Botão Assinar
  assinarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    ...SHADOWS.md,
    marginBottom: SPACING.sm,
  },
  assinarBtnDisabled: {
    opacity: 0.6,
  },
  assinarBtnIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  assinarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  assinarDisclaimer: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Voltar
  voltarBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  voltarBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },
});
