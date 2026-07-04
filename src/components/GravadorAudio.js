// GravadorAudio — Gravação → Upload automático → Playback
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { requestRecordingPermissionsAsync, setAudioModeAsync, AudioModule, IOSOutputFormat, AudioQuality } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { uploadAsync } from 'expo-file-system/legacy';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../constants/theme';

const CFG = { extension: '.m4a', sampleRate: 16000, numberOfChannels: 1, bitRate: 24000, android: { outputFormat: 'mpeg4', audioEncoder: 'aac' }, ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.LOW, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false } };
const fmt = (s) => { const m = String(Math.floor(s / 60)).padStart(2,'0'); const seg = String(s % 60).padStart(2,'0'); return `${m}:${seg}`; };

export default function GravadorAudio({ onAudioReady, onRemove }) {
  const { user } = useAuth();
  const [estado, setEstado] = useState('idle');
  const [tempo, setTempo] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [tocando, setTocando] = useState(false);
  const gravacaoRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { return () => { if (playerRef.current) playerRef.current.remove(); }; }, []);

  const gravar = useCallback(async () => {
    if (gravacaoRef.current || !user) return;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { Alert.alert('Permissão', 'Precisamos de acesso ao microfone.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const r = new AudioModule.AudioRecorder(CFG);
      gravacaoRef.current = r;
      await r.prepareToRecordAsync(CFG);
      if (!gravacaoRef.current) { await setAudioModeAsync({ allowsRecording: false }); return; }
      r.record();
      setEstado('recording'); setTempo(0);
      timerRef.current = setInterval(() => setTempo(p => p + 1), 1000);
    } catch (e) { console.warn('[Audio]', e.message); gravacaoRef.current = null; Alert.alert('Erro', 'Não foi possível gravar.'); }
  }, [user]);

  const pararEEnviar = useCallback(async () => {
    const r = gravacaoRef.current;
    if (!r) return;
    gravacaoRef.current = null;
    clearInterval(timerRef.current); timerRef.current = null;
    try { await r.stop(); } catch (e) {}
    try { await setAudioModeAsync({ allowsRecording: false }); } catch (e) {}
    const uri = r.uri;
    if (!uri) { Alert.alert('Erro', 'Áudio não encontrado.'); setEstado('idle'); return; }
    setEstado('enviando');
    try {
      const token = await user.getIdToken();
      const nome = `audio_${Date.now()}.m4a`;
      const urlUp = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o?name=audio%2F${user.uid}%2F${nome}`;
      console.log('[AudioUpload] Iniciando upload para:', urlUp);
      const response = await uploadAsync(urlUp, uri, { httpMethod: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'audio/mp4' } });
      console.log('[AudioUpload] Resposta:', response.status, response.status === 200 ? 'OK' : 'FALHA');
      const urlF = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/audio%2F${user.uid}%2F${nome}?alt=media`;
      console.log('[AudioUpload] URL final:', urlF);
      setAudioUrl(urlF);
      setEstado('pronto');
      if (onAudioReady) onAudioReady({ uri: urlF, titulo: 'Áudio', duracao: tempo });
      onAudioReady({ uri: urlF, titulo: '🎤 Áudio', duracao: fmt(tempo) });
    } catch (e) { console.warn('[Audio] Upload', e.message); Alert.alert('Erro', 'Falha no upload.'); setEstado('idle'); }
  }, [user, tempo, onAudioReady]);

  const togglePlay = useCallback(async () => {
    if (!audioUrl) return;
    if (tocando && playerRef.current) { await playerRef.current.pause(); setTocando(false); return; }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!playerRef.current) playerRef.current = new AudioModule.AudioPlayer({ uri: audioUrl }, 500, false, 0);
      playerRef.current.play();
      setTocando(true);
      playerRef.current.addListener('playingStatusDidChange', (s) => { if (s === 'paused' || s === 'finished') setTocando(false); });
    } catch (e) { console.warn('[Audio] Play', e.message); }
  }, [audioUrl, tocando]);

  const limpar = useCallback(() => {
    if (playerRef.current) { try { playerRef.current.remove(); } catch (e) {} playerRef.current = null; }
    setTocando(false); setEstado('idle'); setAudioUrl(null); setTempo(0);
    onRemove();
  }, [onRemove]);


  const bg = estado === 'recording' ? '#FEF2F2' : estado === 'pronto' ? '#F0FDF4' : '#F7F8FA';
  const bc = estado === 'recording' ? '#FECACA' : estado === 'pronto' ? '#A7F3D0' : '#E4E6EB';

  if (estado === 'pronto') {
    return (
      <View style={[s.container, { backgroundColor: bg, borderColor: bc }]}>
        <View style={s.infoRow}>
          <Ionicons name="musical-note" size={20} color="#065F46" />
          <Text style={s.tempo}>{fmt(tempo)}</Text>
          <Text style={s.label}>Áudio pronto</Text>
        </View>
        <View style={s.acoes}>
          <TouchableOpacity onPress={togglePlay} activeOpacity={0.7}><Ionicons name={tocando ? 'pause-circle' : 'play-circle'} size={32} color={COLORS.primary} /></TouchableOpacity>
          <TouchableOpacity onPress={limpar} activeOpacity={0.7}><Ionicons name="close-circle" size={28} color="#EF4444" /></TouchableOpacity>
        </View>
      </View>
    );
  }
  if (estado === 'enviando') {
    return (
      <View style={[s.container, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={{ marginLeft: 10, fontSize: 14, color: '#1E40AF', fontWeight: '600' }}>Enviando áudio...</Text>
      </View>
    );
  }
  if (estado === 'recording') {
    return (
      <View style={[s.container, { backgroundColor: bg, borderColor: bc }]}>
        <View style={s.gravDot} />
        <Text style={s.gravTempo}>{fmt(tempo)}</Text>
        <Text style={s.gravLabel}>Gravando</Text>
        <TouchableOpacity onPress={pararEEnviar} activeOpacity={0.7}><Ionicons name="stop-circle" size={36} color="#EF4444" /></TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={[s.container, { backgroundColor: bg, borderColor: bc }]}>
      <TouchableOpacity onPress={gravar} style={s.btnGravar} activeOpacity={0.7}>
        <Ionicons name="mic" size={22} color="#FFF" />
        <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700', marginLeft: 8 }}>Gravar áudio</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  btnGravar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 100, paddingVertical: 10, paddingHorizontal: 20 },
  gravDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  gravTempo: { fontSize: 16, fontWeight: '700', color: '#991B1B', fontVariant: ['tabular-nums'], marginLeft: 8 },
  gravLabel: { flex: 1, fontSize: 14, color: '#991B1B', fontWeight: '600', marginLeft: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  tempo: { fontSize: 14, fontWeight: '700', color: '#065F46', marginLeft: 8 },
  label: { fontSize: 12, color: '#065F46', marginLeft: 6 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
