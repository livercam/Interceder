// FeedTexto — Renderização elegante para postagens apenas com texto
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function FeedTexto({ texto }) {
  if (!texto) return null;
  return (
    <View style={s.textOnlyContainer}>
      <Text style={s.textOnlyCaption}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  textOnlyContainer: { paddingVertical: 8, marginBottom: 12 },
  textOnlyCaption: { fontSize: 16, color: '#050505', lineHeight: 24 },
});
