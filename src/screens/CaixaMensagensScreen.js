// Tela Caixa de Mensagens (Inbox) - Lista de Chats Ativos
// Escuta em tempo real os chats do usuário, exibe cards com avatar, nome e última mensagem

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { ouvirMeusChats } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

function formatarTimestamp(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const agora = new Date();
  const diffMs = agora - d;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHoras < 24) return `${diffHoras}h`;
  if (diffDias === 1) return 'ontem';
  if (diffDias < 7) return `${diffDias}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function CaixaMensagensScreen() {
  const { user: currentUser } = useAuth();
  const navigation = useNavigation();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = ouvirMeusChats(currentUser.uid, (lista) => {
      setChats(lista);
      setLoading(false);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser]);

  const renderItem = useCallback(({ item }) => {
    // Descobre o outro participante
    const outroUid = item.participantes?.find((uid) => uid !== currentUser?.uid);
    const outroDados = outroUid ? item.dados_participantes?.[outroUid] : null;
    const nome = outroDados?.nome || 'Usuário';
    const foto = outroDados?.foto || null;
    const ultimaMsg = item.ultima_mensagem || '';
    const timestamp = item.timestamp_atualizacao;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('Chat1x1', { chatId: item.id, contatoNome: nome, contatoFoto: foto })
        }
      >
        {/* Avatar */}
        {foto ? (
          <Image source={{ uri: foto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{nome.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        {/* Coluna de textos */}
        <View style={styles.textCol}>
          <View style={styles.topRow}>
            <Text style={styles.nome} numberOfLines={1}>{nome}</Text>
            <Text style={styles.data}>{formatarTimestamp(timestamp)}</Text>
          </View>
          <Text style={styles.ultimaMsg} numberOfLines={1}>
            {ultimaMsg || 'Nenhuma mensagem ainda'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [currentUser, navigation]);

  const keyExtractor = useCallback((item) => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={chats.length === 0 ? styles.emptyList : null}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.gray300} />
            <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptySubtitle}>
              Visite o perfil de um irmão para iniciar uma conversa.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: COLORS.gray400,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray300,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    alignItems: 'center',
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    marginRight: SPACING.md,
  },
  avatarFallback: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarFallbackText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  textCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nome: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    flex: 1,
    marginRight: SPACING.sm,
  },
  data: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },
  ultimaMsg: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },
});