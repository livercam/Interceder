// FeedImagem — Imagem + caption abaixo
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function FeedImagem({ imagemUrl, texto }) {
  return (
    <View>
      <Image source={{ uri: imagemUrl }} style={s.imageAttachment} resizeMode="cover" />
      {texto ? <Text style={s.captionText}>{texto}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  imageAttachment: { width: '100%', height: 250, borderRadius: 12, resizeMode: 'cover', marginBottom: 12 },
  captionText: { fontSize: 15, color: '#050505', lineHeight: 22, marginBottom: 0 },
});
