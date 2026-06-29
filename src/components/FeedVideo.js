// FeedVideo — Thumbnail + Play overlay → Modal escuro com YoutubeIframe
import React, { useState, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import YoutubeIframe from 'react-native-youtube-iframe';

export default function FeedVideo({ videoUrl, texto, titulo, videoId: propVideoId }) {
  const [isJogando, setIsJogando] = useState(false);

  // Extrai video_id do URL ou usa o prop
  const videoId = propVideoId || (() => {
    if (!videoUrl) return '';
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
    const m = regex.exec(videoUrl);
    return m ? m[1] : videoUrl;
  })();

  const thumbUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  return (
    <View>
      {titulo ? <Text style={s.tituloVideo} numberOfLines={1}>{titulo}</Text> : null}
      {thumbUrl ? (
        <TouchableOpacity style={s.videoContainer} onPress={() => setIsJogando(true)} activeOpacity={0.9}>
          <Image source={{ uri: thumbUrl }} style={s.videoThumbnail} resizeMode="cover" />
          <View style={s.playIconCircle}>
            <Ionicons name="play" size={28} color="#050505" style={{ marginLeft: 3 }} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={s.videoContainer}>
          <Ionicons name="videocam-outline" size={48} color="#B0B3B8" />
        </View>
      )}
      {texto ? <Text style={s.captionText}>{texto}</Text> : null}

      {/* Modal escuro de reprodução */}
      <Modal visible={isJogando} transparent animationType="fade" onRequestClose={() => setIsJogando(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.btnFechar} onPress={() => setIsJogando(false)} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {videoId ? (
            <YoutubeIframe height={300} width="100%" videoId={videoId} play={true} />
          ) : (
            <Text style={{ color: '#FFF', fontSize: 16 }}>Vídeo não disponível</Text>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  videoContainer: {
    width: '100%', height: 250, borderRadius: 12, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12, backgroundColor: '#000',
  },
  videoThumbnail: { width: '100%', height: '100%', position: 'absolute', opacity: 0.8 },
  playIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
  },
  tituloVideo: { fontSize: 15, fontWeight: 'bold', color: '#1C1E21', marginBottom: 8 },
  captionText: { fontSize: 15, color: '#050505', lineHeight: 22, marginBottom: 0 },

  // Modal escuro
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  btnFechar: {
    position: 'absolute', top: 40, right: 20, zIndex: 50,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
});
