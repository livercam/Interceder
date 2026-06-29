// FeedAudio — Playback funcional (reprodução múltipla)
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule, setAudioModeAsync } from 'expo-audio';

const fmt = (s) => {
  if (!s || s === Infinity) return '0:00';
  const m = String(Math.floor(s / 60)).padStart(2,'0');
  const seg = String(Math.floor(s % 60)).padStart(2,'0');
  return `${m}:${seg}`;
};

export default function FeedAudio({ audioUrl, titulo, texto }) {
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const playerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => { return () => { pararELimpar(); }; }, []);
  useEffect(() => { return () => { pararELimpar(); }; }, [audioUrl]);

  const pararELimpar = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (playerRef.current) { try { playerRef.current.remove(); } catch (e) {} playerRef.current = null; }
  };

  const togglePlayback = useCallback(async () => {
    if (!audioUrl) return;
    // Pausa se estiver tocando
    if (tocando && playerRef.current) {
      await playerRef.current.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTocando(false); return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      // SEMPRE cria um novo player para garantir fresh start
      if (playerRef.current) { try { playerRef.current.remove(); } catch (e) {} playerRef.current = null; }
      playerRef.current = new AudioModule.AudioPlayer({ uri: audioUrl }, 500, false, 0);
      playerRef.current.addListener('playingStatusDidChange', (status) => {
        if (status === 'finished') {
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
          setTocando(false); setProgresso(0); setTempoDecorrido(0);
          try { playerRef.current?.remove(); } catch (e) {} playerRef.current = null;
        }
      });
      await playerRef.current.play();
      setTocando(true);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (playerRef.current) {
          setProgresso((playerRef.current.currentTime || 0) / Math.max(playerRef.current.duration || 1, 1));
          setTempoDecorrido(playerRef.current.currentTime || 0);
        }
      }, 500);
    } catch (e) { console.warn('[FeedAudio]', e.message); }
  }, [audioUrl, tocando]);

  const pct = Math.min(Math.max(progresso * 100, 2), 100);

  return (
    <View>
      {texto ? <Text style={s.captionText}>{texto}</Text> : null}
      <View style={s.audioCard}>
        <View style={s.audioCover}><Ionicons name="musical-note" size={32} color="#B0B3B8" /></View>
        <View style={s.audioContent}>
          <Text style={s.audioTitle} numberOfLines={1}>{titulo || 'Áudio'}</Text>
          <View style={s.audioControls}>
            <TouchableOpacity style={s.playBtnAudio} activeOpacity={0.7} onPress={togglePlayback}>
              <Ionicons name={tocando ? 'pause' : 'play'} size={18} color="#FFF" style={{ marginLeft: tocando ? 0 : 2 }} />
            </TouchableOpacity>
            <View style={s.progressBarContainer}>
              <View style={[s.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={s.audioTime}>{fmt(tempoDecorrido)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  captionText: { fontSize: 15, color: '#050505', lineHeight: 22, marginBottom: 12 },
  audioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, padding: 12, marginBottom: 0 },
  audioCover: { width: 80, height: 80, borderRadius: 8, marginRight: 16, backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center' },
  audioContent: { flex: 1 },
  audioTitle: { fontSize: 16, fontWeight: 'bold', color: '#1C1E21', marginBottom: 8 },
  audioControls: { flexDirection: 'row', alignItems: 'center' },
  playBtnAudio: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1877F2', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  progressBarContainer: { flex: 1, height: 4, backgroundColor: '#E4E6EB', borderRadius: 2, marginRight: 12 },
  progressBarFill: { height: '100%', backgroundColor: '#1877F2', borderRadius: 2 },
  audioTime: { fontSize: 12, color: '#65676B' },
});
