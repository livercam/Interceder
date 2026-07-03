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

export default function FeedAudio({ audioUrl }) {
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
    <View style={s.audioPlayerContainer}>
      <TouchableOpacity style={s.playButtonCircle} activeOpacity={0.7} onPress={togglePlayback}>
        <Ionicons name={tocando ? 'pause' : 'play'} size={16} color="#FFF" style={{ marginLeft: tocando ? 0 : 2 }} />
      </TouchableOpacity>
      <View style={s.progressBarContainer}>
        <View style={[s.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={s.audioTimerText}>{fmt(tempoDecorrido)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // ==========================================
  // PLAYER DE ÁUDIO (ESTILO PÍLULA)
  // ==========================================
  audioPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  audioTimerText: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },
});
