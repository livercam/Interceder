// Tela Suporte - Formulário de Contato para Ajuda e Feedback
// Funcionalidades:
// - Formulário com nome, email, assunto e mensagem
// - Pré-preenchimento dos dados do usuário logado
// - Envio para a coleção 'suporte' no Firestore
// - Disponível para consumo do futuro dashboard administrativo web

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { enviarMensagemSuporte } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

// ============================================================
// Opções de Assunto
// ============================================================
const ASSUNTOS = [
  { label: '💡 Sugestão', value: 'sugestao' },
  { label: '🐛 Problema Técnico', value: 'problema_tecnico' },
  { label: '🙏 Oração', value: 'oracao' },
  { label: '📝 Denúncia', value: 'denuncia' },
  { label: '❓ Dúvida', value: 'duvida' },
  { label: '📬 Outro', value: 'outro' },
];

// ============================================================
// Tela de Suporte
// ============================================================
export default function SuporteScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();

  const [nome, setNome] = useState(userProfile?.nome || '');
  const [email, setEmail] = useState(user?.email || '');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEnviar = async () => {
    if (!nome.trim()) {
      showAlert({ title: 'Atenção', message: 'Preencha o seu nome.' });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      showAlert({ title: 'Atenção', message: 'Preencha um e-mail válido.' });
      return;
    }

    if (!assunto) {
      showAlert({ title: 'Atenção', message: 'Selecione um assunto.' });
      return;
    }

    if (!mensagem.trim() || mensagem.trim().length < 10) {
      showAlert({ title: 'Atenção', message: 'Escreva uma mensagem com pelo menos 10 caracteres.' });
      return;
    }

    setLoading(true);
    try {
      await enviarMensagemSuporte({
        nome: nome.trim(),
        email: email.trim(),
        assunto,
        mensagem: mensagem.trim(),
        user_uid: user?.uid || null,
      });

      showAlert({
        title: '✅ Mensagem enviada!',
        message: 'Obrigado pelo seu contato. Nossa equipe responderá em breve.',
        icon: 'checkmark-circle-outline',
        iconColor: '#10B981',
        buttons: [
          { text: 'OK', type: 'default', onPress: () => navigation.goBack() },
        ],
      });
    } catch (error) {
      showAlert({
        title: 'Erro',
        message: error.message || 'Não foi possível enviar sua mensagem. Tente novamente.',
        icon: 'alert-circle-outline',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={styles.headerEmoji}>🆘</Text>
          <Text style={styles.headerTitle}>Fale Conosco</Text>
          <Text style={styles.headerSubtitle}>
            Tem alguma dúvida, sugestão ou precisa de ajuda? Preencha o formulário abaixo e entraremos em contato.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome *</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.gray400}
              value={nome}
              onChangeText={setNome}
              editable={!loading}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail *</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.gray400}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Assunto *</Text>
            <View style={styles.assuntoGrid}>
              {ASSUNTOS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.assuntoChip,
                    assunto === item.value && styles.assuntoChipActive,
                  ]}
                  onPress={() => setAssunto(item.value)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.assuntoChipText,
                      assunto === item.value && styles.assuntoChipTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mensagem *</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva detalhadamente sua dúvida, sugestão ou problema..."
              placeholderTextColor={COLORS.gray400}
              value={mensagem}
              onChangeText={setMensagem}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.enviarBtn, loading && styles.enviarBtnDisabled]}
            onPress={handleEnviar}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.enviarBtnText}>📨 Enviar Mensagem</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Seu feedback é muito importante para melhorarmos a experiência de todos na comunidade Interceder.
          </Text>
        </View>

        <View style={{ height: SPACING.xxl }} />
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
    paddingBottom: SPACING.xxl,
  },

  headerSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerEmoji: {
    fontSize: 56,
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
    paddingHorizontal: SPACING.md,
  },

  formCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
  },
  textArea: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 120,
  },

  assuntoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  assuntoChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gray100,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  assuntoChipActive: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  assuntoChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    fontWeight: '500',
  },
  assuntoChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  enviarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  enviarBtnDisabled: {
    opacity: 0.7,
  },
  enviarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  infoSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    textAlign: 'center',
    lineHeight: 18,
  },
});