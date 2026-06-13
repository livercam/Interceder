// Tela de Onboarding - Boas-vindas ao Interceder
// Aparece apenas na primeira vez que o usuário abre o app
// Carrossel com 3 passos usando FlatList horizontal com pagingEnabled

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================
// Dados do Carrossel
// ============================================================
const PASSOS = [
  {
    id: '1',
    icone: '🙏',
    titulo: 'Bem-vindo(a) à Comunidade',
    texto:
      'Aqui você nunca ora sozinho. Conecte-se com irmãos em Cristo para compartilhar suas cargas.',
  },
  {
    id: '2',
    icone: '⏳',
    titulo: 'Mural de Intercessão',
    texto:
      'Coloque seus pedidos e interceda pelas necessidades de outros com o nosso cronômetro de oração.',
  },
  {
    id: '3',
    icone: '🕊️',
    titulo: 'Celebre Milagres',
    texto:
      'Transforme dores em testemunhos. Compartilhe suas vitórias e dê glórias a Deus em comunidade.',
  },
];

// ============================================================
// Componente de cada Slide
// ============================================================
function Slide({ item, isUltimo, onFinalizar }) {
  return (
    <View style={styles.slide}>
      <View style={styles.iconeContainer}>
        <Text style={styles.icone}>{item.icone}</Text>
      </View>
      <Text style={styles.titulo}>{item.titulo}</Text>
      <Text style={styles.texto}>{item.texto}</Text>

      {isUltimo && (
        <TouchableOpacity
          style={styles.botaoComecar}
          onPress={onFinalizar}
          activeOpacity={0.85}
        >
          <Text style={styles.botaoComecarText}>Começar Agora</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================
// Tela Principal de Onboarding
// ============================================================
export default function OnboardingScreen({ navigation }) {
  const flatListRef = useRef(null);
  const [passoAtual, setPassoAtual] = useState(0);

  const handleFinalizar = async () => {
    // Marca que o onboarding já foi visto
    await AsyncStorage.setItem('@primeira_vez', 'nao');
    // Navega para o Login, substituindo a pilha
    navigation.replace('Login');
  };

  const handleAvancar = () => {
    if (passoAtual < PASSOS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: passoAtual + 1, animated: true });
    }
  };

  const handlePular = async () => {
    await AsyncStorage.setItem('@primeira_vez', 'nao');
    navigation.replace('Login');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setPassoAtual(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.backgroundApp} />

      {/* Botão Pular (só aparece se não estiver no último passo) */}
      {passoAtual < PASSOS.length - 1 && (
        <TouchableOpacity style={styles.pularBtn} onPress={handlePular}>
          <Text style={styles.pularBtnText}>Pular</Text>
        </TouchableOpacity>
      )}

      {/* Carrossel */}
      <FlatList
        ref={flatListRef}
        data={PASSOS}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <Slide
            item={item}
            isUltimo={index === PASSOS.length - 1}
            onFinalizar={handleFinalizar}
          />
        )}
      />

      {/* Indicadores de página + Botão Avançar */}
      <View style={styles.footer}>
        <View style={styles.indicadores}>
          {PASSOS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicador,
                index === passoAtual && styles.indicadorAtivo,
              ]}
            />
          ))}
        </View>

        {passoAtual < PASSOS.length - 1 && (
          <TouchableOpacity style={styles.avancarBtn} onPress={handleAvancar}>
            <Text style={styles.avancarBtnText}>Avançar →</Text>
          </TouchableOpacity>
        )}
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
    backgroundColor: COLORS.backgroundApp,
  },

  // Botão Pular
  pularBtn: {
    position: 'absolute',
    top: 60,
    right: SPACING.lg,
    zIndex: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  pularBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },

  // Slide
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  iconeContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icone: {
    fontSize: 64,
  },
  titulo: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    lineHeight: 32,
  },
  texto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },

  // Botão Começar Agora
  botaoComecar: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xxl * 2,
    marginTop: SPACING.xl,
    ...SHADOWS.md,
  },
  botaoComecarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 50,
    paddingTop: SPACING.lg,
  },
  indicadores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  indicador: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gray300,
  },
  indicadorAtivo: {
    width: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
  },

  // Botão Avançar
  avancarBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  avancarBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
