// HeaderLogo - Componente de cabeçalho com logo + título
// Usado nos headers das telas principais do app

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants/theme';

/**
 * HeaderLogo
 * Exibe o logo à esquerda do título no header
 * @param {string} title - Título a ser exibido
 * @param {number} logoSize - Tamanho do logo (default 28)
 */
export default function HeaderLogo({ title, logoSize = 40 }) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.png')}
        style={[styles.logo, { width: logoSize, height: logoSize }]}
        resizeMode="contain"
      />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md, // alinha com o padding dos cards abaixo
  },
  logo: {
    marginRight: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});