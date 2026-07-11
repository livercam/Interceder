// FeedAudio — Player de áudio com waveform (20 barras)
// Layout horizontal: play/pause, waveform (barras de 3px), timestamp

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { COLORS, SPACING } from '../constants/theme';

const fmt = (s) => {
  if (!s || s === Infinity) return '0:00';
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const seg = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${seg}`;
};

const WAVE_BARS = 20;
const ALTURAS = [10, 15, 20, 12, 18, 8, 14, 22, 16, 10, 20, 14, 18, 8, 12, 20, 14, 16, 10, 18];

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
    if (tocando && playerRef.current) {
      await playerRef.current.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTocando(false);
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
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
      }, 200);
    } catch (e) { console.warn('[FeedAudio]', e.message); }
  }, [audioUrl, tocando]);

  const barraAtiva = Math.floor(progresso * WAVE_BARS);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playBtn} activeOpacity={0.7} onPress={togglePlayback}>
        <Ionicons name={tocando ? 'pause' : 'play'} size={12} color={COLORS.primary} style={{ marginLeft: tocando ? 0 : 1.5 }} />
      </TouchableOpacity>
      <View style={styles.waveformContainer}>
        {ALTURAS.map((altura, i) => (
          <View
            key={i}
            style={[
              styles.waveBar,
              {
                height: altura,
                backgroundColor: i <= barraAtiva ? COLORS.primary : COLORS.gray300,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.timer}>{fmt(tempoDecorrido)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  playBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 3,
  },
  timer: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.gray400,
    fontVariant: ['tabular-nums'],
    minWidth: 30,
    textAlign: 'right',
  },
});