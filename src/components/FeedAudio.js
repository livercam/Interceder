// FeedAudio — Player de áudio minimalista estilo WhatsApp
// Layout horizontal: play/pause redondo, barra de progresso fina, timestamp

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule, setAudioModeAsync } from 'expo-audio';
import { COLORS, FONTS, SPACING } from '../constants/theme';

const fmt = (s) => {
  if (!s || s === Infinity) return '0:00';
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const seg = String(Math.floor(s % 60)).padStart(2, '0');
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
      }, 500);
    } catch (e) { console.warn('[FeedAudio]', e.message); }
  }, [audioUrl, tocando]);

  const pct = Math.min(Math.max(progresso * 100, 2), 100);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playBtn} activeOpacity={0.7} onPress={togglePlayback}>
        <Ionicons name={tocando ? 'pause' : 'play'} size={14} color={COLORS.primary} style={{ marginLeft: tocando ? 0 : 2 }} />
      </TouchableOpacity>
      <View style={styles.progressContainer}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.timer}>{fmt(tempoDecorrido)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  progressContainer: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.gray300,
    borderRadius: 1,
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  timer: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.gray400,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },
});