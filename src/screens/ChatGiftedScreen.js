// Tela de Chat 1x1 com react-native-gifted-chat
// InputToolbar DESATIVADO — barra de digitação customizada no rodapé
// para fugir dos bugs de offset no Android

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Platform, TextInput, Text } from 'react-native';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requestRecordingPermissionsAsync, setAudioModeAsync, AudioModule } from 'expo-audio';
import { uploadAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import FeedAudio from '../components/FeedAudio';
import {
  enviarMensagemChat,
  ouvirMensagensChat,
  editarMensagemChat,
  excluirMensagemChat,
  marcarMensagensComoLidas,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

export default function ChatGiftedScreen({ route }) {
  const { chatId, contatoNome } = route.params;
  const { user: currentUser } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [mensagens, setMensagens] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const [textoDigitado, setTextoDigitado] = useState('');
  const [audioPreview, setAudioPreview] = useState(null);

  const gravadorRef = useRef(null);
  const timerGravRef = useRef(null);

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      if (timerGravRef.current) clearInterval(timerGravRef.current);
      if (gravadorRef.current) {
        try { gravadorRef.current = null; } catch (e) {}
      }
    };
  }, []);

  // Listener do Firestore - mapeia para o formato do GiftedChat
  useEffect(() => {
    const unsubscribe = ouvirMensagensChat(chatId, (msgs) => {
      const giftedMsgs = msgs.map((msg) => ({
        _id: msg.id,
        text: msg.texto || '',
        createdAt: msg.criadoEm?.toDate ? msg.criadoEm.toDate() : new Date(),
        user: {
          _id: msg.autor_id,
        },
        image: msg.imagem_url || null,
        audio: msg.audio_url || null,
      }));
      setMensagens(giftedMsgs);
    });

    if (currentUser) {
      marcarMensagensComoLidas(chatId, currentUser.uid);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      } else if (unsubscribe instanceof Promise || (unsubscribe && typeof unsubscribe.then === 'function')) {
        unsubscribe.then((unsubFn) => {
          if (typeof unsubFn === 'function') {
            unsubFn();
          }
        }).catch(() => {});
      }
    };
  }, [chatId, currentUser]);

  // ===== LÓGICA DE GRAVAÇÃO =====
  const iniciarGravacao = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showAlert({ title: 'Permissão', message: 'Precisamos de acesso ao microfone.', buttons: [{ text: 'OK', type: 'default' }] });
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      const cfg = {
        extension: '.m4a',
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 24000,
        android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
        ios: { outputFormat: '1', audioQuality: 0, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
      };
      const r = new AudioModule.AudioRecorder(cfg);
      gravadorRef.current = r;
      await r.prepareToRecordAsync(cfg);
      if (!gravadorRef.current) return;
      r.record();
      setGravando(true);
      setTempoGravacao(0);
      timerGravRef.current = setInterval(() => setTempoGravacao((p) => p + 1), 1000);
    } catch (e) {
      console.warn('[Gravacao]', e.message);
      gravadorRef.current = null;
    }
  }, [showAlert]);

  const pararGravacao = useCallback(async () => {
    const r = gravadorRef.current;
    if (!r) return;
    gravadorRef.current = null;
    if (timerGravRef.current) {
      clearInterval(timerGravRef.current);
      timerGravRef.current = null;
    }
    setGravando(false);
    try { await r.stop(); } catch (e) {}
    try { await setAudioModeAsync({ allowsRecording: false }); } catch (e) {}
    const uri = r.uri;
    if (!uri) return;
    setAudioPreview({ uri, tipo: 'audio', duracao: tempoGravacao });
  }, [tempoGravacao]);

  // ===== UPLOAD DE MÍDIA =====
  const fazerUploadMidia = useCallback(async (preview) => {
    if (!preview || enviando) return;
    setEnviando(true);

    try {
      const token = await currentUser.getIdToken();
      console.log('[Upload] Iniciando:', preview.tipo, preview.uri.substring(0, 50));

      const isImagem = preview.tipo === 'imagem';
      const extensao = isImagem ? '.jpg' : '.m4a';
      const mimeType = isImagem ? 'image/jpeg' : 'audio/mp4';
      const pasta = isImagem ? 'chat_imagens' : 'chat_audios';

      const nomeArquivo = `${isImagem ? 'img' : 'aud'}_${Date.now()}${extensao}`;
      const pathStorage = `${pasta}%2F${chatId}%2F${nomeArquivo}`;
      const urlUpload = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o?name=${pathStorage}`;

      const uploadResult = await uploadAsync(urlUpload, preview.uri, {
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
        },
      });

      if (uploadResult.status !== 200 && uploadResult.status !== 201) {
        console.error('[Upload] FALHA NO FIREBASE:', uploadResult.body);
        throw new Error(`O Firebase Storage recusou o envio (Status ${uploadResult.status}).`);
      }

      const urlFinal = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/${pathStorage}?alt=media`;

      if (isImagem) {
        await enviarMensagemChat(chatId, '', currentUser.uid, null, urlFinal, null);
      } else {
        await enviarMensagemChat(chatId, '', currentUser.uid, null, null, urlFinal);
      }
    } catch (error) {
      console.error('[Upload Catch]', error);
      showAlert({ title: 'Erro de Upload', message: error.message, buttons: [{ text: 'OK', type: 'default' }] });
    } finally {
      setEnviando(false);
    }
  }, [chatId, currentUser, enviando, showAlert]);

  // ===== SELEÇÃO DE IMAGEM =====
  const handleAdicionarImagem = useCallback(() => {
    showAlert({
      title: 'Adicionar imagem',
      buttons: [
        { text: '📷 Câmera', type: 'default', onPress: async () => {
          const p = await ImagePicker.requestCameraPermissionsAsync();
          if (!p.granted) { showAlert({ title: 'Permissão', message: 'Precisamos da câmera.', buttons: [{ text: 'OK', type: 'default' }] }); return; }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
          if (!r.canceled && r.assets?.[0]?.uri) fazerUploadMidia({ uri: r.assets[0].uri, tipo: 'imagem' });
        }},
        { text: '🖼️ Galeria', type: 'default', onPress: async () => {
          const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!p.granted) { showAlert({ title: 'Permissão', message: 'Precisamos da galeria.', buttons: [{ text: 'OK', type: 'default' }] }); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
          if (!r.canceled && r.assets?.[0]?.uri) fazerUploadMidia({ uri: r.assets[0].uri, tipo: 'imagem' });
        }},
        { text: 'Cancelar', type: 'cancel' },
      ],
    });
  }, [showAlert, fazerUploadMidia]);

  // ===== ON SEND =====
  const onSend = useCallback(async (messages = []) => {
    if (!messages.length || enviando) return;
    const [msg] = messages;
    const texto = msg.text?.trim();
    if (!texto) return;

    setEnviando(true);
    try {
      await enviarMensagemChat(chatId, texto, currentUser.uid, null, null, null);
    } catch (error) {
      console.error('[Erro onSend]', error);
      showAlert({ title: 'Erro', message: error.message || 'Não foi possível enviar.', buttons: [{ text: 'OK', type: 'default' }] });
    } finally {
      setEnviando(false);
    }
  }, [chatId, currentUser, enviando, showAlert]);

  const enviarTextoCustomizado = useCallback(() => {
    if (textoDigitado.trim().length === 0 || enviando) return;
    onSend([{ text: textoDigitado.trim() }]);
    setTextoDigitado('');
  }, [textoDigitado, enviando, onSend]);

  // ===== HARD DELETE =====
  const deletarMensagemDefinitivamente = useCallback(async (msg) => {
    try {
      const token = await currentUser.getIdToken();
      const midiaUrl = msg.image || msg.audio;
      if (midiaUrl && midiaUrl.includes('firebasestorage.googleapis.com')) {
        const pathEncoded = midiaUrl.split('/o/')[1]?.split('?alt=media')[0];
        if (pathEncoded) {
          const urlDelete = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/${pathEncoded}`;
          const response = await fetch(urlDelete, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
          if (!response.ok && response.status !== 404) console.warn('[Delete] Storage:', response.status);
        }
      }
      await excluirMensagemChat(chatId, msg._id);
    } catch (error) {
      console.error('[Erro Hard Delete]', error);
      showAlert({ title: 'Erro', message: 'Não foi possível excluir a mensagem.', buttons: [{ text: 'OK', type: 'default' }] });
    }
  }, [chatId, currentUser, showAlert]);

  const solicitarConfirmacaoExclusao = useCallback((message) => {
    showAlert({
      title: 'Apagar mensagem',
      message: 'Esta ação não pode ser desfeita. Deseja continuar?',
      buttons: [
        { text: 'Cancelar', type: 'cancel' },
        { text: 'Apagar Definitivamente', type: 'destructive', onPress: () => deletarMensagemDefinitivamente(message) }
      ]
    });
  }, [deletarMensagemDefinitivamente, showAlert]);

  // ===== RENDER AUDIO =====
  const renderMessageAudio = useCallback((props) => {
    if (!props.currentMessage.audio) return null;
    return (
      <View style={{ padding: 5, minWidth: 180 }}>
        <FeedAudio audioUrl={props.currentMessage.audio} />
      </View>
    );
  }, []);

  // ===== RENDER BUBBLE (Versão Estável) =====
  const renderBubble = useCallback((props) => {
    const isMyMessage = props.currentMessage.user._id === currentUser.uid;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Bubble {...props} />
        {isMyMessage && (
          <TouchableOpacity
            onPress={() => solicitarConfirmacaoExclusao(props.currentMessage)}
            style={{ padding: 4, marginLeft: 4 }}
          >
            <Ionicons name="ellipsis-vertical-sharp" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [currentUser, solicitarConfirmacaoExclusao]);

  if (!currentUser) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'android' ? 30 : 0}
    >
      {/* 1. Área de Mensagens */}
      <View style={{ flex: 1 }}>
        <GiftedChat
          messages={mensagens}
          user={{ _id: currentUser.uid }}
          renderInputToolbar={() => null}
          renderMessageAudio={renderMessageAudio}
          renderBubble={renderBubble}
          keyboardShouldPersistTaps="handled"
          bottomOffset={Platform.OS === 'ios' ? insets.bottom : 0}
        />
      </View>

      {/* 2. Nossa Barra Customizada */}
      <View style={{
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
        paddingHorizontal: 8,
        paddingVertical: 6,
        paddingBottom: Platform.OS === 'ios' ? insets.bottom + 6 : insets.bottom + 10,
      }}>
        {audioPreview ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setAudioPreview(null)} style={{ padding: 8 }}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </TouchableOpacity>
            <View style={{ flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, padding: 8, minHeight: 40, justifyContent: 'center' }}>
              <FeedAudio audioUrl={audioPreview.uri} />
            </View>
            <TouchableOpacity onPress={() => { fazerUploadMidia(audioPreview); setAudioPreview(null); }} disabled={enviando} style={{ padding: 8, marginLeft: 4 }}>
              <Ionicons name="send" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 4 }}>
              <TouchableOpacity onPress={handleAdicionarImagem} activeOpacity={0.7} style={{ padding: 4, marginRight: 4 }}>
                <Ionicons name="camera-outline" size={26} color="#8E8E93" />
              </TouchableOpacity>
              <TouchableOpacity onPress={gravando ? pararGravacao : iniciarGravacao} activeOpacity={0.7} style={{ padding: 4 }}>
                <Ionicons name={gravando ? "stop-circle" : "mic"} size={26} color={gravando ? "#EF4444" : "#8E8E93"} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: '#F2F2F7',
                borderRadius: 20,
                paddingTop: Platform.OS === 'ios' ? 10 : 8,
                paddingBottom: Platform.OS === 'ios' ? 10 : 8,
                paddingHorizontal: 16,
                fontSize: 16,
                minHeight: 40,
                maxHeight: 120,
                color: '#000',
              }}
              multiline
              placeholder="Digite uma mensagem..."
              placeholderTextColor="#8E8E93"
              value={textoDigitado}
              onChangeText={setTextoDigitado}
            />
            {textoDigitado.trim().length > 0 && (
              <View style={{ height: 40, justifyContent: 'center', alignItems: 'center', marginLeft: 8 }}>
                <TouchableOpacity onPress={enviarTextoCustomizado} disabled={enviando} style={{ padding: 4 }}>
                  <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 16 }}>Enviar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}