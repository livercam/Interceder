// Componente MessageIcon - Ícone de Mensagens com Badge de Chats Não Lidos
// Escuta em tempo real o total de chats com mensagens não lidas

import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { ouvirTotalMensagensNaoLidas } from '../services/firestoreService';
import { COLORS, SPACING } from '../constants/theme';

export default function MessageIcon() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = ouvirTotalMensagensNaoLidas(user.uid, (total) => {
      setNaoLidas(total);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => navigation.navigate('CaixaMensagens')}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="chatbubbles-outline" size={24} color="#FFFFFF" />
      {naoLidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{naoLidas > 99 ? '99+' : naoLidas}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: SPACING.sm,
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
});