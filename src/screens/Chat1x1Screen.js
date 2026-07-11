// Tela de Chat 1x1 - Mensagens Diretas Nativas
// Sem bibliotecas externas: FlatList, KeyboardAvoidingView, onSnapshot
// Funcionalidades: enviar, editar, excluir, responder, fotos, áudios

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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import FeedAudio from '../components/FeedAudio';
import GravadorAudio from '../components/GravadorAudio';
import {
  enviarMensagemChat,
  ouvirMensagensChat,
  editarMensagemChat,
  excluirMensagemChat,
  marcarMensagensComoLidas,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

export default function Chat1x1Screen({ route }) {
  const { chatId, contatoNome } = route.params;
  const { user: currentUser } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensagemEmEdicao, setMensagemEmEdicao] = useState(null);
  const [mensagemEmResposta, setMensagemEmResposta] = useState(null);
  const [mostrarMidia, setMostrarMidia] = useState(false);
  const [midiaPreview, setMidiaPreview] = useState(null); // { uri, tipo: 'imagem' | 'audio' }

  // Escuta mensagens em tempo real e marca como lidas ao abrir
  useEffect(() => {
    const unsubscribe = ouvirMensagensChat(chatId, (msgs) => {
      setMensagens(msgs);
    });

    if (currentUser) {
      marcarMensagensComoLidas(chatId, currentUser.uid);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [chatId, currentUser]);

  // Cancela modo de edicao
  const cancelarEdicao = useCallback(() => {
    setMensagemEmEdicao(null);
    setTexto('');
  }, []);

  // Cancela modo de resposta
  const cancelarResposta = useCallback(() => {
    setMensagemEmResposta(null);
  }, []);

  // ===== FLUXO DE IMAGEM =====
  const handleAdicionarImagem = useCallback(async () => {
    showAlert({
      title: 'Adicionar imagem',
      buttons: [
        {
          text: '📷 Câmera',
          type: 'default',
          onPress: async () => {
            const p = await ImagePicker.requestCameraPermissionsAsync();
            if (!p.granted) {
              showAlert({ title: 'Permissão necessária', message: 'Precisamos da câmera.', buttons: [{ text: 'OK', type: 'default' }] });
              return;
            }
            const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!r.canceled && r.assets?.[0]?.uri) {
              setMidiaPreview({ uri: r.assets[0].uri, tipo: 'imagem' });
              setMostrarMidia(false);
            }
          },
        },
        {
          text: '🖼️ Galeria',
          type: 'default',
          onPress: async () => {
            const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!p.granted) {
              showAlert({ title: 'Permissão necessária', message: 'Precisamos da galeria.', buttons: [{ text: 'OK', type: 'default' }] });
              return;
            }
            const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
            if (!r.canceled && r.assets?.[0]?.uri) {
              setMidiaPreview({ uri: r.assets[0].uri, tipo: 'imagem' });
              setMostrarMidia(false);
            }
          },
        },
        { text: 'Cancelar', type: 'cancel' },
      ],
    });
  }, []);

  // ===== FLUXO DE ÁUDIO (só preview, sem envio automático) =====
  const handleAudioPronto = useCallback((dados) => {
    setMidiaPreview({ uri: dados.uri, tipo: 'audio' });
    setMostrarMidia(false);
  }, []);

  // ===== ENVIO DA MÍDIA (disparado manualmente pelo botão) =====
  const enviarMidiaPreview = useCallback(async () => {
    if (!midiaPreview || enviando) return;

    setEnviando(true);
    try {
      const token = await currentUser.getIdToken();

      if (midiaPreview.tipo === 'imagem') {
        const nome = `img_${Date.now()}.jpg`;
        const urlUp = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o?name=chat_imagens%2F${chatId}%2F${nome}`;
        await uploadAsync(urlUp, midiaPreview.uri, { httpMethod: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' } });
        const urlF = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/chat_imagens%2F${chatId}%2F${nome}?alt=media`;
        await enviarMensagemChat(chatId, '', currentUser.uid, null, urlF, null);
      } else if (midiaPreview.tipo === 'audio') {
        await enviarMensagemChat(chatId, '', currentUser.uid, null, null, midiaPreview.uri);
      }

      setMidiaPreview(null);
    } catch (error) {
      showAlert({ title: 'Erro', message: error.message || 'Falha ao enviar mídia.', buttons: [{ text: 'OK', type: 'default' }] });
    } finally {
      setEnviando(false);
    }
  }, [midiaPreview, chatId, currentUser, enviando, showAlert]);

  // ===== LONG PRESS =====
  const handleLongPress = useCallback((item) => {
    const ehMinha = item.autor_id === currentUser?.uid;

    if (item.imagem_url || item.audio_url) {
      if (ehMinha) {
        showAlert({
          title: 'Opções da Mensagem',
          buttons: [
            {
              text: 'Excluir',
              type: 'destructive',
              onPress: () => {
                showAlert({
                  title: 'Excluir mensagem',
                  message: 'Tem certeza?',
                  buttons: [
                    { text: 'Cancelar', type: 'cancel' },
                    { text: 'Excluir', type: 'destructive', onPress: async () => { try { await excluirMensagemChat(chatId, item.id); } catch (error) { showAlert({ title: 'Erro', message: error.message, buttons: [{ text: 'OK', type: 'default' }] }); } } },
                  ],
                });
              },
            },
            { text: 'Cancelar', type: 'cancel' },
          ],
        });
      }
      return;
    }

    const opcoes = [
      {
        text: 'Responder',
        type: 'default',
        onPress: () => {
          setMensagemEmEdicao(null);
          setMensagemEmResposta({ id: item.id, texto: item.texto, autor_nome: ehMinha ? 'Você' : (contatoNome || 'Usuário') });
          inputRef.current?.focus();
        },
      },
    ];

    if (ehMinha) {
      opcoes.push({
        text: 'Editar',
        type: 'default',
        onPress: () => { setMensagemEmResposta(null); setMensagemEmEdicao({ id: item.id, texto: item.texto }); setTexto(item.texto); inputRef.current?.focus(); },
      });
      opcoes.push({
        text: 'Excluir',
        type: 'destructive',
        onPress: () => {
          showAlert({
            title: 'Excluir mensagem',
            message: 'Tem certeza?',
            buttons: [
              { text: 'Cancelar', type: 'cancel' },
              { text: 'Excluir', type: 'destructive', onPress: async () => { try { await excluirMensagemChat(chatId, item.id); } catch (error) { showAlert({ title: 'Erro', message: error.message, buttons: [{ text: 'OK', type: 'default' }] }); } } },
            ],
          });
        },
      });
    }

    opcoes.push({ text: 'Cancelar', type: 'cancel' });
    showAlert({ title: 'Opções da Mensagem', buttons: opcoes });
  }, [currentUser, chatId, contatoNome, showAlert]);

  // ===== ENVIO TEXTO =====
  const handleEnviar = useCallback(async () => {
    const textoTrim = texto.trim();
    if (!textoTrim || enviando) return;

    setEnviando(true);
    try {
      if (mensagemEmEdicao) {
        await editarMensagemChat(chatId, mensagemEmEdicao.id, textoTrim);
        cancelarEdicao();
      } else {
        await enviarMensagemChat(chatId, textoTrim, currentUser.uid, mensagemEmResposta);
        setTexto('');
        setMensagemEmResposta(null);
      }
    } catch (error) {
      showAlert({ title: 'Erro', message: error.message || 'Não foi possível enviar.', buttons: [{ text: 'OK', type: 'default' }] });
    } finally {
      setEnviando(false);
    }
  }, [texto, chatId, currentUser, enviando, mensagemEmEdicao, mensagemEmResposta, cancelarEdicao, showAlert]);

  // ===== RENDER MENSAGEM =====
  const renderMensagem = useCallback(({ item }) => {
    const ehMinha = item.autor_id === currentUser?.uid;
    const foiEditada = !!item.editadoEm;
    const temReply = !!item.reply_to;
    const temImagem = !!item.imagem_url;
    const temAudio = !!item.audio_url;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        style={[styles.balaoContainer, ehMinha ? styles.balaoMinha : styles.balaoOutro]}
      >
        <View style={[styles.balao, ehMinha ? styles.balaoMinhaFundo : styles.balaoOutroFundo]}>
          {temReply && (
            <View style={styles.replyContainer}>
              <View style={styles.replyBar} />
              <View style={styles.replyContent}>
                <Text style={[styles.replyAutor, { color: ehMinha ? COLORS.white : COLORS.primary }]}>
                  {item.reply_to.autor_nome}
                </Text>
                <Text style={[styles.replyTexto, { color: ehMinha ? 'rgba(255,255,255,0.8)' : COLORS.gray500 }]} numberOfLines={2}>
                  {item.reply_to.texto}
                </Text>
              </View>
            </View>
          )}
          {temImagem && (
            <View style={styles.imagemBalaoContainer}>
              <Image source={{ uri: item.imagem_url }} style={styles.imagemBalao} resizeMode="cover" />
            </View>
          )}
          {temAudio && (
            <View style={styles.audioBalaoContainer}>
              <FeedAudio audioUrl={item.audio_url} />
            </View>
          )}
          {item.texto ? (
            <Text style={[styles.balaoTexto, { color: ehMinha ? COLORS.white : COLORS.gray800 }]}>
              {item.texto}
            </Text>
          ) : null}
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

  // Decide o que mostrar no rodapé
  const temPreviewMidia = midiaPreview !== null && !enviando;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      {enviando && (
        <View style={styles.uploadingBar}>
          <ActivityIndicator size="small" color={COLORS.white} />
          <Text style={styles.uploadingText}>Enviando mídia...</Text>
        </View>
      )}

      <FlatList
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

      <View style={[styles.inputArea, { paddingBottom: Math.max(SPACING.sm, insets.bottom) }]}>
        {mensagemEmResposta && (
          <View style={styles.previewResposta}>
            <View style={styles.previewRespostaBar} />
            <View style={styles.previewRespostaContent}>
              <Text style={styles.previewRespostaLabel}>Respondendo a {mensagemEmResposta.autor_nome}</Text>
              <Text style={styles.previewRespostaTexto} numberOfLines={1}>{mensagemEmResposta.texto}</Text>
            </View>
            <TouchableOpacity onPress={cancelarResposta} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {mensagemEmEdicao && (
          <View style={styles.editandoBar}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.editandoTexto}>Editando mensagem...</Text>
            <TouchableOpacity onPress={cancelarEdicao} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color={COLORS.gray500} />
            </TouchableOpacity>
          </View>
        )}

        {mostrarMidia && !midiaPreview && !enviando && (
          <View style={styles.midiaContainer}>
            <GravadorAudio onAudioReady={handleAudioPronto} onRemove={() => setMostrarMidia(false)} />
            <TouchableOpacity style={styles.btnAnexarImagem} onPress={handleAdicionarImagem} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={22} color={COLORS.primary} />
              <Text style={styles.btnAnexarTexto}>Adicionar imagem</Text>
            </TouchableOpacity>
          </View>
        )}

        {temPreviewMidia && (
          <View style={styles.previewMidiaContainer}>
            {/* Thumbnail da imagem */}
            {midiaPreview.tipo === 'imagem' && (
              <View style={styles.previewImagemWrapper}>
                <Image source={{ uri: midiaPreview.uri }} style={styles.previewImagem} resizeMode="cover" />
              </View>
            )}
            {midiaPreview.tipo === 'audio' && (
              <View style={styles.previewAudioWrapper}>
                <Ionicons name="musical-note" size={24} color={COLORS.primary} />
                <Text style={styles.previewAudioTexto}>Áudio gravado</Text>
              </View>
            )}
            {/* Botões de ação */}
            <View style={styles.previewAcoes}>
              <TouchableOpacity style={styles.previewBtnDescartar} onPress={() => setMidiaPreview(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={32} color={COLORS.danger} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewBtnEnviar} onPress={enviarMidiaPreview} activeOpacity={0.7}>
                <Ionicons name="send" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input de texto (só aparece se não tiver preview de mídia) */}
        {!temPreviewMidia && (
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.btnAnexo} onPress={() => setMostrarMidia(!mostrarMidia)} activeOpacity={0.7}>
              <Ionicons name={mostrarMidia ? 'close' : 'add-circle-outline'} size={24} color={COLORS.gray500} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
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
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  listaContent: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  uploadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: SPACING.xs, gap: SPACING.sm },
  uploadingText: { color: COLORS.white, fontSize: FONTS.sizes.sm, fontWeight: '600' },

  balaoContainer: { marginBottom: SPACING.xs, maxWidth: '80%' },
  balaoMinha: { alignSelf: 'flex-end' },
  balaoOutro: { alignSelf: 'flex-start' },
  balao: { borderRadius: 16, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  balaoMinhaFundo: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  balaoOutroFundo: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  balaoTexto: { fontSize: FONTS.sizes.md, lineHeight: 20 },
  editadoTag: { fontSize: FONTS.sizes.xs, fontStyle: 'italic', marginTop: 2 },

  // Imagem edge-to-edge no balão (sem moldura)
  imagemBalaoContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  imagemBalao: {
    width: '100%',
    height: '100%',
  },

  // Container do player de áudio no balão (minimalista)
  audioBalaoContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: SPACING.xs,
  },

  replyContainer: { flexDirection: 'row', marginBottom: SPACING.xs, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 4, padding: SPACING.xs, overflow: 'hidden' },
  replyBar: { width: 4, borderRadius: 2, backgroundColor: COLORS.primary, marginRight: SPACING.sm },
  replyContent: { flex: 1 },
  replyAutor: { fontSize: FONTS.sizes.xs, fontWeight: 'bold', marginBottom: 1 },
  replyTexto: { fontSize: FONTS.sizes.xs, fontStyle: 'italic' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: FONTS.sizes.md, fontWeight: '600', color: COLORS.gray400, marginTop: SPACING.md },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.gray300, marginTop: SPACING.xs, textAlign: 'center' },

  inputArea: { backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray200 },

  previewResposta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, backgroundColor: COLORS.gray50, borderLeftWidth: 4, borderLeftColor: COLORS.primary, borderTopLeftRadius: RADIUS.md, borderTopRightRadius: RADIUS.md },
  previewRespostaBar: { display: 'none' },
  previewRespostaContent: { flex: 1, marginRight: SPACING.sm },
  previewRespostaLabel: { fontSize: FONTS.sizes.xs, fontWeight: 'bold', color: COLORS.primary },
  previewRespostaTexto: { fontSize: FONTS.sizes.xs, color: COLORS.gray500, fontStyle: 'italic', marginTop: 1 },

  editandoBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, backgroundColor: COLORS.primary + '08', gap: SPACING.sm },
  editandoTexto: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: '600' },

  midiaContainer: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: SPACING.sm },
  btnAnexarImagem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary + '08', borderRadius: RADIUS.full, paddingVertical: SPACING.sm, gap: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.primary + '30' },
  btnAnexarTexto: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.primary },

  // Preview de mídia (antes do envio)
  previewMidiaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  previewImagemWrapper: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImagem: {
    width: '100%',
    height: '100%',
  },
  previewAudioWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  previewAudioTexto: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  previewAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  previewBtnDescartar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnEnviar: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inputRow: { flexDirection: 'row', padding: SPACING.sm, alignItems: 'flex-end' },
  btnAnexo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.xs },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: FONTS.sizes.md, color: COLORS.gray800, maxHeight: 100, marginRight: SPACING.sm },
  btnEnviar: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnEnviarDisabled: { opacity: 0.5 },
});