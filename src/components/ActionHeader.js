// ActionHeader — Header reutilizável para telas de criação
// Esquerda: "Cancelar" | Centro: Título | Direita: Botão "Publicar"
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const PRIMARY = '#A53F36';

export default function ActionHeader({ titulo, onCancelar, onPublicar, publicando, desabilitarPublicar }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'ios' ? 8 : 12) }]}>
      <View style={styles.inner}>
        {/* Esquerda - Cancelar */}
        <TouchableOpacity onPress={onCancelar} activeOpacity={0.7} style={styles.leftBtn} disabled={publicando}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>

        {/* Centro - Título */}
        <Text style={styles.title}>{titulo}</Text>

        {/* Direita - Publicar */}
        <TouchableOpacity
          onPress={onPublicar}
          activeOpacity={0.7}
          style={[styles.publishBtn, desabilitarPublicar && styles.publishBtnDisabled]}
          disabled={desabilitarPublicar || publicando}
        >
          <Text style={[styles.publishText, desabilitarPublicar && styles.publishTextDisabled]}>
            {publicando ? 'Publicando...' : 'Publicar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: PRIMARY,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  leftBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  publishBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  publishTextDisabled: {
    opacity: 0.7,
  },
});
