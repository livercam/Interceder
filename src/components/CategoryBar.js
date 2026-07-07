// CategoryBar — Barra de Categorias Horizontal Edge-to-Edge
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

export default function CategoryBar({ categorias, filtroCategoria, onChangeFiltro }) {
  return (
    <View style={styles.filtrosContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtrosScroll}
      >
        <TouchableOpacity
          style={[
            styles.filtroChip,
            filtroCategoria === null && styles.filtroChipActive,
          ]}
          onPress={() => onChangeFiltro(null)}
        >
          <Text
            style={[
              styles.filtroChipText,
              filtroCategoria === null && styles.filtroChipTextActive,
            ]}
          >
            Todos
          </Text>
        </TouchableOpacity>

        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[
              styles.filtroChip,
              filtroCategoria === cat.value && styles.filtroChipActive,
            ]}
            onPress={() =>
              onChangeFiltro(filtroCategoria === cat.value ? null : cat.value)
            }
          >
            <Text
              style={[
                styles.filtroChipText,
                filtroCategoria === cat.value && styles.filtroChipTextActive,
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filtrosContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  filtrosScroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filtroChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    marginRight: SPACING.sm,
  },
  filtroChipActive: {
    backgroundColor: COLORS.primary,
  },
  filtroChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  filtroChipTextActive: {
    color: COLORS.white,
  },
});
