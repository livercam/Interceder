// Componente BannerAd v6 - Suporta Imagem e Vídeo (via WebView)
// - Um anúncio por sessão (nunca reabre)
// - Segmentação por cargo ministerial e UID
// - Métricas de visualização e clique
// - Se for imagem: mostra Image
// - Se for vídeo: usa WebView (YouTube) ou TouchableOpacity + Linking

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { buscarAnuncioUnico, marcarAnuncioVisto, registrarCliqueAnuncio } from '../services/anuncioService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function BannerAd({ telaAtual }) {
  const [anuncio, setAnuncio] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const mountedRef = useRef(true);
  const jaExecutouRef = useRef(false);
  const { userProfile } = useAuth();

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (jaExecutouRef.current) return;
    if (!telaAtual) return;
    jaExecutouRef.current = true;

    const unsubscribe = buscarAnuncioUnico(telaAtual, userProfile, async (anuncioEncontrado) => {
      if (!mountedRef.current || !anuncioEncontrado) return;

      setAnuncio(anuncioEncontrado);
      await marcarAnuncioVisto(anuncioEncontrado, userProfile?.uid);

      if (mountedRef.current) {
        setTimeout(() => {
          if (mountedRef.current) {
            setModalVisible(true);
            Animated.parallel([
              Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
            ]).start();
          }
        }, 500);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleFechar = useCallback(() => {
    if (!anuncio) return;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      if (mountedRef.current) {
        setModalVisible(false);
        setAnuncio(null);
      }
    });
  }, [anuncio, fadeAnim, scaleAnim]);

  const handleAbrirLink = useCallback(async () => {
    if (!anuncio?.linkDestino) return;
    await registrarCliqueAnuncio(anuncio.id);
    try {
      const podeAbrir = await Linking.canOpenURL(anuncio.linkDestino);
      if (podeAbrir) {
        handleFechar();
        await Linking.openURL(anuncio.linkDestino);
      } else {
        Alert.alert('Link indisponível', 'Não foi possível abrir este link.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao tentar abrir o link.');
    }
  }, [anuncio, handleFechar]);

  if (!anuncio) return null;

  const isVideo = anuncio.tipo === 'video';
  const midiaUrl = isVideo ? anuncio.videoUrl : anuncio.imagemUrl;

  // Detecta se é URL do YouTube para embed
  const isYouTube = isVideo && midiaUrl && midiaUrl.includes('youtube.com/watch');

  const renderMidia = () => {
    if (isVideo) {
      if (isYouTube) {
        // Extrai o ID do YouTube
        const videoId = midiaUrl.split('v=')[1]?.split('&')[0];
        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playsinline=1`;
        return (
          <WebView
            source={{ uri: embedUrl }}
            style={styles.video}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        );
      } else {
        // Vídeo MP4/outro: mostra botão "Assistir" que abre o link
        return (
          <View style={styles.videoFallback}>
            <Text style={styles.videoFallbackEmoji}>🎬</Text>
            <Text style={styles.videoFallbackText}>Toque para assistir ao vídeo</Text>
          </View>
        );
      }
    }
    return <Image source={{ uri: midiaUrl }} style={styles.image} resizeMode="contain" />;
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleFechar}
    >
      <View style={styles.fullScreen}>
        <TouchableOpacity style={styles.fullScreenTouch} activeOpacity={1} onPress={handleFechar} />

        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleFechar}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.95} onPress={isVideo ? handleAbrirLink : handleAbrirLink} style={styles.midiaArea}>
            {renderMidia()}

            <View style={styles.bottomOverlay}>
              {anuncio.titulo ? (
                <Text style={styles.title} numberOfLines={1}>{anuncio.titulo}</Text>
              ) : null}
              {anuncio.linkDestino ? (
                <TouchableOpacity style={styles.acessarBtn} onPress={handleAbrirLink} activeOpacity={0.8}>
                  <Text style={styles.acessarText}>Acessar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  fullScreenTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: SCREEN_WIDTH * 0.92,
    borderRadius: 10,
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  midiaArea: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  videoFallbackEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  videoFallbackText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  title: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  acessarBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  acessarText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});