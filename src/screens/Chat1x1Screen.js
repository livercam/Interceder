// Tela de Chat 1x1 - Mensagens Diretas Nativas
// Sem bibliotecas externas: FlatList, KeyboardAvoidingView, onSnapshot
// Design: balões estilo WhatsApp/Telegram com theme.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { enviarMensagemChat, ouvirMensagensChat } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

export default function Chat1x1Screen({ route }) {
  const { chatId, contatoNome } = route.params;
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const flatListRef = useRef(null);

  // Escuta mensagens em tempo real
  useEffect(() => {
    const unsubscribe = ouvirMensagensChat(chatId, (msgs) => {
      setMensagens(msgs);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId]);

  // Envia mensagem
  const handleEnviar = useCallback(async () => {
    const textoTrim = texto.trim();
    if (!textoTrim || enviando) return;

    setEnviando(true);
    try {
      await enviarMensagemChat(chatId, textoTrim, currentUser.uid);
      setTexto('');
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }, [texto, chatId, currentUser, enviando]);

  // Renderiza cada mensagem
  const renderMensagem = useCallback(({ item }) => {
    const ehMinha = item.autor_id === currentUser?.uid;
    return (
      <View
        style={[
          styles.balaoContainer,
          ehMinha ? styles.balaoMinha : styles.balaoOutro,
        ]}
      >
        <View
          style={[
            styles.balao,
            ehMinha ? styles.balaoMinhaFundo : styles.balaoOutroFundo,
          ]}
        >
          <Text
            style={[
              styles.balaoTexto,
              { color: ehMinha ? COLORS.white : COLORS.gray800 },
            ]}
          >
            {item.texto}
          </Text>
        </View>
      </View>
    );
  }, [currentUser]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      {/* Lista de Mensagens */}
      <FlatList
        ref={flatListRef}
        data={mensagens}
        keyExtractor={keyExtractor}
        renderItem={renderMensagem}
        inverted={true}
        contentContainerStyle={styles.listaContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.gray300} />
            <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
            <Text style={styles.emptySubtext}>Envie uma mensagem para iniciar a conversa</Text>
          </View>
        }
      />

      {/* Área de Input com Safe Area (Android navigation bar) */}
      <View style={[styles.inputArea, { paddingBottom: Math.max(SPACING.sm, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          placeholder="Digite sua mensagem..."
          placeholderTextColor={COLORS.gray400}
          multiline
          maxLength={500}
          textAlignVertical="center"
        />
        <TouchableOpacity
          style={[styles.btnEnviar, (!texto.trim() || enviando) && styles.btnEnviarDisabled]}
          onPress={handleEnviar}
          disabled={!texto.trim() || enviando}
          activeOpacity={0.7}
        >
          {enviando ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={20} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  listaContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  // Balões
  balaoContainer: {
    marginBottom: SPACING.xs,
    maxWidth: '80%',
  },
  balaoMinha: {
    alignSelf: 'flex-end',
  },
  balaoOutro: {
    alignSelf: 'flex-start',
  },
  balao: {
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  balaoMinhaFundo: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  balaoOutroFundo: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
  },
  balaoTexto: {
    fontSize: FONTS.sizes.md,
    lineHeight: 20,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray400,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray300,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Input
  inputArea: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    maxHeight: 100,
    marginRight: SPACING.sm,
  },
  btnEnviar: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEnviarDisabled: {
    opacity: 0.5,
  },
});