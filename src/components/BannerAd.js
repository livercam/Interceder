// Componente BannerAd v12 - Suporta Imagem e Vídeo (YouTube removido)
// - Imagem: Image normal
// - Vídeo: player HTML5 via WebView (MP4, WebM, URL direta)
// - YouTube: não suportado - usar link direto de vídeo MP4

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

function gerarHTMLVideo(url) {
  return `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"></head>
<body style="margin:0;background:#000;height:100vh;display:flex;align-items:center;justify-content:center;">
<video id="p" style="width:100%;height:100%;object-fit:contain;" src="${url}" playsinline loop webkit-playsinline></video>
<script>
var v=document.getElementById('p');
function t(){v.play().catch(function(){setTimeout(t,500)});}
v.addEventListener('loadedmetadata',t);
t();
</script></body></html>`;
}

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
      if (mountedRef.current) { setModalVisible(false); setAnuncio(null); }
    });
  }, [anuncio, fadeAnim, scaleAnim]);

  const handleAbrirLink = useCallback(async () => {
    if (!anuncio?.linkDestino) return;
    await registrarCliqueAnuncio(anuncio.id);
    try {
      if (await Linking.canOpenURL(anuncio.linkDestino)) {
        handleFechar();
        await Linking.openURL(anuncio.linkDestino);
      } else {
        Alert.alert('Link indisponível');
      }
    } catch (error) {
      Alert.alert('Erro', 'Ocorreu um erro ao tentar abrir o link.');
    }
  }, [anuncio, handleFechar]);

  if (!anuncio) return null;

  const isVideo = anuncio.tipo === 'video';
  const midiaUrl = isVideo ? anuncio.videoUrl : anuncio.imagemUrl;

  const renderMidia = () => {
    if (isVideo && midiaUrl) {
      // Player HTML5 universal (MP4, WebM, URL direta)
      return (
        <WebView
          source={{ html: gerarHTMLVideo(midiaUrl) }}
          style={styles.video}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          bounces={false}
        />
      );
    }
    return <Image source={{ uri: midiaUrl }} style={styles.image} resizeMode="contain" />;
  };

  return (
    <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={handleFechar}>
      <View style={styles.fullScreen}>
        <TouchableOpacity style={styles.fullScreenTouch} activeOpacity={1} onPress={handleFechar} />
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={handleFechar}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.midiaArea}>
            {renderMidia()}
            <View style={styles.bottomOverlay}>
              {anuncio.titulo ? <Text style={styles.title} numberOfLines={1}>{anuncio.titulo}</Text> : null}
              {anuncio.linkDestino ? (
                <TouchableOpacity style={styles.acessarBtn} onPress={handleAbrirLink} activeOpacity={0.8}>
                  <Text style={styles.acessarText}>Acessar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  fullScreenTouch: { ...StyleSheet.absoluteFillObject },
  card: { width: SCREEN_WIDTH * 0.92, borderRadius: 10, overflow: 'hidden' },
  closeBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  closeText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  midiaArea: { width: '100%', height: SCREEN_HEIGHT * 0.55, backgroundColor: '#222', borderRadius: 10, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  video: { width: '100%', height: '100%', backgroundColor: '#000' },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.35)' },
  title: { color: '#FFF', fontSize: 15, fontWeight: '800', flex: 1, marginRight: 10 },
  acessarBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  acessarText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
});