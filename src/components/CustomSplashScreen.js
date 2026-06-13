// CustomSplashScreen - Tela de Abertura Animada
// Exibe o logo do app com animações independentes:
// - Arcos: rotação contínua (360°)
// - Chama: pulsação suave (scale 1 → 1.1 → 1)

import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  Easing,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_SIZE = SCREEN_WIDTH * 0.5; // 50% da largura da tela

/**
 * CustomSplashScreen
 * @param {object} navigation - Objeto de navegação (opcional, para navegação automática)
 * @param {number} duration - Tempo em ms antes de navegar (default 2800)
 * @param {function} onFinish - Callback chamado ao finalizar (alternativa à navegação)
 */
export default function CustomSplashScreen({ navigation, duration = 2800, onFinish }) {
  // ============================================================
  // 1. Animated Values
  // ============================================================
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  // ============================================================
  // 2. Animações
  // ============================================================

  // Rotação dos arcos (0 → 1 equivale a 0° → 360°)
  useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();
    return () => spinAnimation.stop();
  }, [spinValue]);

  // Pulsação da chama (scale 1 → 1.1 → 1)
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.12,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [pulseValue]);

  // Fade-in inicial (entrada suave)
  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeValue]);

  // Auto-navegação após o tempo definido
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) {
        onFinish();
      } else if (navigation) {
        // Tenta ir para Home (MainTabs) se disponível, senão Login
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [navigation, duration, onFinish]);

  // ============================================================
  // 3. Interpolações
  // ============================================================
  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ============================================================
  // 4. Render
  // ============================================================
  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          { opacity: fadeValue },
        ]}
      >
        {/* Arcos (rotação contínua) */}
        <Animated.Image
          source={require('../../assets/arcos.png')}
          style={[
            styles.image,
            styles.arcos,
            {
              transform: [{ rotate: spinInterpolate }],
            },
          ]}
          resizeMode="contain"
        />

        {/* Chama (pulsação) */}
        <Animated.Image
          source={require('../../assets/chama.png')}
          style={[
            styles.image,
            styles.chama,
            {
              transform: [{ scale: pulseValue }],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary, // Terracota
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    position: 'absolute',
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  arcos: {
    // Os arcos ocupam a área total do logo
  },
  chama: {
    // A chama é ligeiramente menor para ficar centralizada dentro dos arcos
    width: LOGO_SIZE * 0.55,
    height: LOGO_SIZE * 0.55,
  },
});