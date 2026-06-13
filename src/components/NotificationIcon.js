// Componente NotificationIcon - Ícone de Sino com Badge de Notificações Não Lidas
// Escuta em tempo real as notificações não lidas do utilizador logado
// e exibe uma badge vermelha com o número absoluto de não lidas.

import React, { useState, useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { ouvirNotificacoesNaoLidas } from '../services/firestoreService';
import { COLORS, FONTS, SPACING } from '../constants/theme';

export default function NotificationIcon() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setNaoLidas(0);
      return;
    }

    // Escuta em tempo real as notificações não lidas
    unsubscribeRef.current = ouvirNotificacoesNaoLidas(user.uid, (notificacoes) => {
      setNaoLidas(notificacoes.length);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user]);

  const handlePress = () => {
    navigation.navigate('Notificacoes');
  };

  // Se não há utilizador logado, não renderiza nada
  if (!user) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={styles.sinoIcon}>🔔</Text>
      {naoLidas > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {naoLidas > 99 ? '99+' : naoLidas}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: SPACING.md,
    padding: 4,
  },
  sinoIcon: {
    fontSize: 24,
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
