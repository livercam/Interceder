// MediaToolbar — Barra inferior de mídia reutilizável
// Esquerda: Microfone (Gravar Áudio) | Direita: Câmera (Adicionar Imagem)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MediaToolbar({ onGravarAudio, onAdicionarImagem }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.mediaBtn} onPress={onGravarAudio} activeOpacity={0.7}>
        <Ionicons name="mic-outline" size={28} color="#E87A4A" />
        <Text style={styles.mediaLabel}>Gravar áudio</Text>
      </TouchableOpacity>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.mediaBtn} onPress={onAdicionarImagem} activeOpacity={0.7}>
        <Ionicons name="camera-outline" size={28} color="#E87A4A" />
        <Text style={styles.mediaLabel}>Adicionar imagem</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  mediaBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  mediaLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
});
