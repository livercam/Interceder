// Tela de Mensagem de Apoio
// Funcionalidades:
// - TextInput multilinhas limpo e espaçoso
// - KeyboardAvoidingView com behavior="padding"
// - Botão "Enviar para o Feed"
// - Ao enviar, grava como mensagem de apoio na subcoleção do pedido original
// - Após salvar, mostra feedback de sucesso e volta ao Mural

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { adicionarMensagemApoio } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import GravadorAudio from '../components/GravadorAudio';

export default function NovaMensagemApoioScreen({ route, navigation }) {
  const { pedidoId, pedidoAutor } = route.params;
  const { user } = useAuth();

  const [texto, setTexto] = useState('');
  const [audioUrl, setAudioUrl] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (!texto.trim() && !audioUrl) {
      Alert.alert('Atenção', 'Escreva uma mensagem ou grave um áudio.');
      return;
    }

    if (!user) {
      Alert.alert('Atenção', 'Faça login para enviar mensagens.');
      return;
    }

    console.log('[NovaMensagem] Enviando com audioUrl:', audioUrl);
    setEnviando(true);
    try {
      const mensagemData = {
        autor_id: user.uid,
        autor_nome: user.displayName || 'Anônimo',
        texto: texto.trim(),
        audio_url: audioUrl || null,
        replyTo_id: null,
        replyTo_autor: null,
        mentions: [],
      };

      await adicionarMensagemApoio(pedidoId, mensagemData);

      Alert.alert(
        '🙏 Mensagem enviada!',
        `A sua palavra de apoio para ${pedidoAutor} foi registada com sucesso.`,
        [
          {
            text: 'Voltar ao Mural',
            onPress: () => {
              // Navegar de volta para o Mural (stack principal)
              navigation.navigate('Main');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 70}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>💬</Text>
          <Text style={styles.headerTitle}>Palavra de Apoio</Text>
          <Text style={styles.headerSubtitle}>
            Envie uma mensagem de encorajamento para{' '}
            <Text style={styles.headerDestaque}>{pedidoAutor}</Text>
          </Text>
        </View>

        {/* Input de Mensagem */}
        <View style={styles.inputCard}>
          <TextInput
            style={styles.textInput}
            placeholder="Escreva aqui a sua mensagem de apoio..."
            placeholderTextColor={COLORS.gray400}
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={500}
            textAlignVertical="top"
            editable={!enviando}
            autoFocus
          />
          <Text style={styles.charCount}>{texto.length}/500</Text>
        </View>

        {/* Gravador de Áudio */}
        <View style={styles.audioSection}>
          <GravadorAudio
            onAudioReady={(data) => { console.log('[Audio] GravadorAudio pronto:', data.uri); setAudioUrl(data.uri); }}
            onRemove={() => { setAudioUrl(null); }}
          />
        </View>

        {/* Botão Enviar */}
        <TouchableOpacity
          style={[
            styles.enviarBtn,
            ((!texto.trim() && !audioUrl) || enviando) && styles.enviarBtnDisabled,
          ]}
          onPress={handleEnviar}
          disabled={(!texto.trim() && !audioUrl) || enviando}
          activeOpacity={0.85}
        >
          {enviando ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Text style={styles.enviarBtnIcon}>✉️</Text>
              <Text style={styles.enviarBtnText}>Enviar</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },

  // Cabeçalho
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.lg,
  },
  headerDestaque: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Input
  inputCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  textInput: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    lineHeight: 24,
    minHeight: 180,
    maxHeight: 300,
    padding: 0,
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'right',
    marginTop: SPACING.sm,
  },

  // Gravador de Áudio
  audioSection: {
    marginBottom: SPACING.md,
  },

  // Botão Enviar
  enviarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xl,
    ...SHADOWS.md,
  },
  enviarBtnDisabled: {
    opacity: 0.5,
  },
  enviarBtnIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  enviarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
});
