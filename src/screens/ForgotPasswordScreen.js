// Tela Recuperar Senha - Envio de link de redefinição via Firebase Auth
// Estilo consistente com a tela de Login

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Estado de erro inline
  const [erroEmail, setErroEmail] = useState('');

  const handleEnviarLink = async () => {
    setErroEmail('');

    if (!email.trim()) {
      setErroEmail('Digite o seu e-mail.');
      return;
    }

    setEnviando(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert(
        '✅ E-mail enviado!',
        'Verifique a sua caixa de entrada e também a pasta de spam para redefinir a sua senha.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      let mensagem = 'Ocorreu um erro. Tente novamente.';
      if (error.code === 'auth/user-not-found') {
        mensagem = 'Nenhuma conta encontrada com este e-mail.';
      } else if (error.code === 'auth/invalid-email') {
        mensagem = 'E-mail inválido. Verifique o endereço digitado.';
      } else if (error.code === 'auth/too-many-requests') {
        mensagem = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      }
      Alert.alert('Erro', mensagem);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Título */}
        <View style={styles.headerSection}>
          <Text style={styles.logoEmoji}>🔐</Text>
          <Text style={styles.appName}>Recuperar Senha</Text>
          <Text style={styles.tagline}>
            Digite o seu e-mail para receber um link de redefinição de senha.
          </Text>
        </View>

        {/* Card do Formulário */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Redefinir senha</Text>

          {/* Campo Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={[styles.input, erroEmail ? styles.inputError : null]}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.gray400}
              value={email}
              onChangeText={(text) => { setEmail(text); setErroEmail(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!enviando}
            />
            {erroEmail ? <Text style={styles.erroTexto}>{erroEmail}</Text> : null}
          </View>

          {/* Botão Enviar */}
          <TouchableOpacity
            style={[styles.button, enviando && styles.buttonDisabled]}
            onPress={handleEnviarLink}
            disabled={enviando}
            activeOpacity={0.8}
          >
            {enviando ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Enviar Link de Recuperação</Text>
            )}
          </TouchableOpacity>

          {/* Voltar ao Login */}
          <TouchableOpacity
            style={styles.voltarButton}
            onPress={() => navigation.goBack()}
            disabled={enviando}
          >
            <Text style={styles.voltarText}>Voltar ao Login</Text>
          </TouchableOpacity>
        </View>

        {/* Rodapé */}
        <Text style={styles.footerText}>
          O link de redefinição expira em 1 hora.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
  },

  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primaryLight,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
  },

  // Card do Formulário
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  formTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },

  // Inputs
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
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  erroTexto: {
    color: '#EF4444',
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
    marginLeft: 2,
  },

  // Botão
  button: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },

  // Voltar
  voltarButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  voltarText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  // Rodapé
  footerText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.xs,
    textAlign: 'center',
    marginTop: SPACING.lg,
    opacity: 0.8,
  },
});
