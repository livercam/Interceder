// Tela de Chat 1x1 - Mensagens Diretas Nativas
// Sem bibliotecas externas: FlatList, KeyboardAvoidingView, onSnapshot
// Funcionalidades: enviar, editar, excluir, balões estilo WhatsApp/Telegram

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
import {
  enviarMensagemChat,
  ouvirMensagensChat,
  editarMensagemChat,
  excluirMensagemChat,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

export default function Chat1x1Screen({ route }) {
  const { chatId, contatoNome } = route.params;
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagemEmEdicao, setMensagemEmEdicao] = useState(null);
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

  // Cancela modo de edição
  const cancelarEdicao = useCallback(() => {
    setMensagemEmEdicao(null);
    setTexto('');
  }, []);

  // Long Press no balão — apenas para mensagens próprias
  const handleLongPress = useCallback((item) => {
    if (item.autor_id !== currentUser?.uid) return;

    Alert.alert('Opções da Mensagem', undefined, [
      {
        text: 'Editar',
        onPress: () => {
          setMensagemEmEdicao({ id: item.id, texto: item.texto });
          setTexto(item.texto);
        },
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Excluir mensagem', 'Tem certeza que deseja excluir esta mensagem?', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: async () => {
                try {
                  await excluirMensagemChat(chatId, item.id);
                } catch (error) {
                  Alert.alert('Erro', error.message || 'Não foi possível excluir.');
                }
              },
            },
          ]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [currentUser, chatId]);

  // Envia ou edita mensagem
  const handleEnviar = useCallback(async () => {
    const textoTrim = texto.trim();
    if (!textoTrim || enviando) return;

    setEnviando(true);
    try {
      if (mensagemEmEdicao) {
        // Modo edição
        await editarMensagemChat(chatId, mensagemEmEdicao.id, textoTrim);
        cancelarEdicao();
      } else {
        // Modo criação
        await enviarMensagemChat(chatId, textoTrim, currentUser.uid);
        setTexto('');
      }
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }, [texto, chatId, currentUser, enviando, mensagemEmEdicao, cancelarEdicao]);

  // Renderiza cada mensagem
  const renderMensagem = useCallback(({ item }) => {
    const ehMinha = item.autor_id === currentUser?.uid;
    const foiEditada = !!item.editadoEm;

    return (
      <TouchableOpacity
        activeOpacity={ehMinha ? 0.7 : 1}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
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
          {foiEditada && (
            <Text style={[styles.editadoTag, { color: ehMinha ? 'rgba(255,255,255,0.7)' : COLORS.gray400 }]}>
              (editado)
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [currentUser, handleLongPress]);

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
        {/* Indicador de modo edição */}
        {mensagemEmEdicao && (
          <View style={styles.editandoBar}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editandoTexto}>Editando mensagem...</Text>
            <TouchableOpacity onPress={cancelarEdicao} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
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
              <Ionicons name={mensagemEmEdicao ? 'checkmark' : 'send'} size={20} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
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
  editadoTag: {
    fontSize: FONTS.sizes.xs,
    fontStyle: 'italic',
    marginTop: 2,
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
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  editandoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary + '08',
    gap: SPACING.sm,
  },
  editandoTexto: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    padding: SPACING.sm,
    alignItems: 'flex-end',
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