// Tela Login - Autenticação do Usuário
// Estilo "Comunitário Vibrante" com gradientes, inputs estilizados e botão chamativo

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { loginUser, registerUser } from '../services/authService';
import { signInWithGoogle } from '../services/googleAuthService';
import { useAlert } from '../contexts/AlertContext';

export default function LoginScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [notificacoesAceitas, setNotificacoesAceitas] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { showAlert } = useAlert();

  // Estados de erro inline
  const [erroNome, setErroNome] = useState('');
  const [erroEmail, setErroEmail] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [erroTermos, setErroTermos] = useState('');

  const handleSubmit = async () => {
    // Resetar erros
    setErroNome('');
    setErroEmail('');
    setErroSenha('');
    setErroTermos('');

    let temErro = false;

    if (!email.trim()) {
      setErroEmail('Preencha o email.');
      temErro = true;
    }

    if (!password.trim()) {
      setErroSenha('Preencha a senha.');
      temErro = true;
    } else if (password.length < 6) {
      setErroSenha('A senha deve ter pelo menos 6 caracteres.');
      temErro = true;
    }

    if (!isLogin && !nome.trim()) {
      setErroNome('Preencha o seu nome.');
      temErro = true;
    }

    if (!isLogin && !termosAceitos) {
      setErroTermos('Você precisa aceitar os Termos de Uso.');
      temErro = true;
    }

    if (temErro) return;

    setLoading(true);
    try {
      if (isLogin) {
        await loginUser(email.trim(), password);
      } else {
        await registerUser(email.trim(), password, nome.trim(), notificacoesAceitas);
      }
      // A navegação é tratada automaticamente pelo onAuthStateChanged
    } catch (error) {
      let mensagem = 'Ocorreu um erro. Tente novamente.';
      if (error.code === 'auth/user-not-found') {
        mensagem = 'Usuário não encontrado. Verifique o email.';
      } else if (error.code === 'auth/wrong-password') {
        mensagem = 'Senha incorreta. Tente novamente.';
      } else if (error.code === 'auth/email-already-in-use') {
        mensagem = 'Este email já está cadastrado.';
      } else if (error.code === 'auth/invalid-email') {
        mensagem = 'Email inválido.';
      } else if (error.code === 'auth/weak-password') {
        mensagem = 'A senha é muito fraca.';
      } else if (error.code === 'auth/invalid-credential') {
        mensagem = 'Email ou senha inválidos.';
      }
      showAlert({
        title: 'Erro',
        message: mensagem,
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // A navegação é tratada automaticamente pelo onAuthStateChanged
    } catch (error) {
      let mensagem = 'Ocorreu um erro ao autenticar com o Google.';
      if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('cancel')) {
        mensagem = 'Autenticação cancelada.';
      } else if (error.message?.includes('PLAY_SERVICES')) {
        mensagem = 'Google Play Services não está disponível.';
      } else if (error.message?.includes('NETWORK_ERROR')) {
        mensagem = 'Erro de rede. Verifique sua conexão.';
      }
      showAlert({
        title: 'Google',
        message: mensagem,
        icon: 'logo-google',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setNome('');
    setEmail('');
    setPassword('');
    setErroNome('');
    setErroEmail('');
    setErroSenha('');
    setErroTermos('');
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
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Interceder</Text>
          <Text style={styles.tagline}>
            {isLogin
              ? 'Entre na sua rede de oração'
              : 'Junte-se à comunidade de intercessão'}
          </Text>
        </View>

        {/* Card do Formulário */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            {isLogin ? 'Bem-vindo de volta' : 'Criar conta'}
          </Text>

          {/* Campo Nome (apenas no cadastro) */}
          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome completo</Text>
              <TextInput
                style={[styles.input, erroNome ? styles.inputError : null]}
                placeholder="Seu nome"
                placeholderTextColor={COLORS.gray400}
                value={nome}
                onChangeText={(text) => { setNome(text); setErroNome(''); }}
                autoCapitalize="words"
                editable={!loading}
              />
              {erroNome ? <Text style={styles.erroTexto}>{erroNome}</Text> : null}
            </View>
          )}

          {/* Campo Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, erroEmail ? styles.inputError : null]}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.gray400}
              value={email}
              onChangeText={(text) => { setEmail(text); setErroEmail(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            {erroEmail ? <Text style={styles.erroTexto}>{erroEmail}</Text> : null}
          </View>

          {/* Campo Senha */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.senhaInputRow}>
              <TextInput
                style={[styles.senhaInput, erroSenha ? styles.inputError : null]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={COLORS.gray400}
                value={password}
                onChangeText={(text) => { setPassword(text); setErroSenha(''); }}
                secureTextEntry={!mostrarSenha}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.senhaToggle}
                onPress={() => setMostrarSenha(!mostrarSenha)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={mostrarSenha ? 'eye-off' : 'eye'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {erroSenha ? <Text style={styles.erroTexto}>{erroSenha}</Text> : null}
          </View>

          {/* Checkboxes LGPD (apenas no cadastro) */}
          {!isLogin && (
            <View style={styles.lgpdSection}>
              {/* Checkbox 1 - Termos (Obrigatório) */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => { setTermosAceitos(!termosAceitos); setErroTermos(''); }}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.checkboxIcon}>
                  {termosAceitos ? '☑️' : '⬜'}
                </Text>
                <Text style={styles.checkboxLabel}>
                Li e concordo com os{' '}
                <Text
                  style={styles.checkboxLink}
                  onPress={() => navigation.navigate('TermosPrivacidade')}
                >
                  Termos de Uso e Política de Privacidade
                </Text>
              </Text>
              </TouchableOpacity>
              {erroTermos ? <Text style={styles.erroTexto}>{erroTermos}</Text> : null}

              {/* Checkbox 2 - Notificações (Opcional) */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNotificacoesAceitas(!notificacoesAceitas)}
                activeOpacity={0.7}
                disabled={loading}
              >
                <Text style={styles.checkboxIcon}>
                  {notificacoesAceitas ? '☑️' : '⬜'}
                </Text>
                <Text style={styles.checkboxLabel}>
                  Aceito receber notificações e comunicações do aplicativo
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botão Principal */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? 'Entrar' : 'Criar conta'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Esqueci minha senha (apenas no modo Login) */}
          {isLogin && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </TouchableOpacity>
          )}

          {/* Divisor "ou" */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Botão Continuar com Google */}
          <TouchableOpacity
            style={[styles.googleButton, (loading || googleLoading) && styles.googleButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color={COLORS.gray700} size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color="#A94438" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Continuar com o Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Alternar entre Login e Cadastro */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
            disabled={loading}
          >
            <Text style={styles.toggleText}>
              {isLogin
                ? 'Não tem conta? Cadastre-se'
                : 'Já tem conta? Faça login'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Rodapé */}
        <Text style={styles.footerText}>
          Ao continuar, você concorda com nossos termos de uso.
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
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: SPACING.md,
  },
  logoEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: FONTS.sizes.display,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primaryLight,
    textAlign: 'center',
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

  // Input de Senha com Toggle
  senhaInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
  },
  senhaInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
  },
  senhaToggle: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Esqueci minha senha
  forgotButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  forgotText: {
    color: COLORS.gray500,
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Alternar modo
  toggleButton: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  toggleText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  // LGPD - Checkboxes
  lgpdSection: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingTop: SPACING.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  checkboxIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  checkboxLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Divisor "ou"
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gray200,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    color: COLORS.gray400,
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },

  // Botão Google
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBF5',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingVertical: 12,
    ...SHADOWS.sm,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    marginRight: SPACING.sm,
  },
  googleButtonText: {
    color: COLORS.gray700,
    fontSize: FONTS.sizes.md,
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
