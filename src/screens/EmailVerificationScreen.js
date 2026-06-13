// Tela de Verificação de Email
// Exigida para novos usuários que se registram com email/senha
// O usuário só consegue acessar o app após confirmar o email

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  enviarVerificacaoEmail,
  logoutUser,
} from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

export default function EmailVerificationScreen() {
  const { refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const [reenviando, setReenviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [contagemRegressiva, setContagemRegressiva] = useState(0);
  const intervaloRef = useRef(null);

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current);
      }
    };
  }, []);

  // Contagem regressiva para reenvio (30 segundos)
  useEffect(() => {
    if (contagemRegressiva > 0) {
      intervaloRef.current = setInterval(() => {
        setContagemRegressiva((prev) => {
          if (prev <= 1) {
            clearInterval(intervaloRef.current);
            intervaloRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervaloRef.current) {
          clearInterval(intervaloRef.current);
          intervaloRef.current = null;
        }
      };
    }
  }, [contagemRegressiva]);

  const enviarEmail = async () => {
    setReenviando(true);
    try {
      await enviarVerificacaoEmail();
      setContagemRegressiva(30);
      showAlert({
        title: 'Email Enviado',
        message: 'Verifique sua caixa de entrada (e a pasta de spam).',
        icon: 'mail-open-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } catch (error) {
      showAlert({
        title: 'Erro',
        message: error.message || 'Não foi possível enviar o email de verificação.',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } finally {
      setReenviando(false);
    }
  };

  const handleVerificarAgora = async () => {
    setVerificando(true);
    try {
      const verificado = await refreshUser();
      if (verificado) {
        // Redirecionamento automático — não mostra alerta
      } else {
        showAlert({
          title: 'Ainda não verificado',
          message: 'Clique no link que enviamos para seu email e depois tente novamente.',
          icon: 'mail-unread-outline',
          buttons: [{ text: 'OK', type: 'default' }],
        });
      }
    } catch (error) {
      showAlert({
        title: 'Erro',
        message: error.message || 'Erro ao verificar o email.',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } finally {
      setVerificando(false);
    }
  };

  const handleSair = async () => {
    try {
      await logoutUser();
    } catch (error) {
      showAlert({
        title: 'Erro',
        message: 'Não foi possível sair.',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Ícone de Email */}
        <View style={styles.iconContainer}>
          <Ionicons name="mail-open-outline" size={80} color={COLORS.white} />
        </View>

        {/* Título */}
        <Text style={styles.titulo}>Verifique seu Email</Text>

        {/* Descrição */}
        <Text style={styles.descricao}>
          Enviamos um link de confirmação para o seu email.{'\n'}
          Clique no link para ativar sua conta e{'\n'}
          acessar todos os recursos do Interceder.
        </Text>

        {/* Instruções */}
        <View style={styles.instrucoesCard}>
          <View style={styles.instrucaoItem}>
            <Text style={styles.instrucaoNumero}>1</Text>
            <Text style={styles.instrucaoTexto}>
              Abra seu email (verifique também o spam)
            </Text>
          </View>
          <View style={styles.instrucaoItem}>
            <Text style={styles.instrucaoNumero}>2</Text>
            <Text style={styles.instrucaoTexto}>
              Clique no link "Verificar email"
            </Text>
          </View>
          <View style={styles.instrucaoItem}>
            <Text style={styles.instrucaoNumero}>3</Text>
            <Text style={styles.instrucaoTexto}>
              Volte e toque em "Já verifiquei"
            </Text>
          </View>
        </View>

        {/* Botão: Já verifiquei */}
        <TouchableOpacity
          style={[styles.buttonPrimary, verificando && styles.buttonDisabled]}
          onPress={handleVerificarAgora}
          disabled={verificando}
          activeOpacity={0.8}
        >
          {verificando ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.white} style={styles.buttonIcon} />
              <Text style={styles.buttonPrimaryText}>Já verifiquei</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Botão: Reenviar email */}
        <TouchableOpacity
          style={[styles.buttonSecondary, reenviando && styles.buttonDisabled]}
          onPress={enviarEmail}
          disabled={reenviando || contagemRegressiva > 0}
          activeOpacity={0.8}
        >
          {reenviando ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={20} color={COLORS.primary} style={styles.buttonIcon} />
              <Text style={styles.buttonSecondaryText}>
                {contagemRegressiva > 0
                  ? `Reenviar (${contagemRegressiva}s)`
                  : 'Reenviar email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Botão: Sair */}
        <TouchableOpacity
          style={styles.linkSair}
          onPress={handleSair}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.gray400} style={styles.buttonIcon} />
          <Text style={styles.linkSairText}>Sair e tentar mais tarde</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  titulo: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  descricao: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primaryLight,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  instrucoesCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    marginBottom: SPACING.xl,
    ...SHADOWS.lg,
  },
  instrucaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  instrucaoNumero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 28,
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  instrucaoTexto: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    lineHeight: 22,
  },
  buttonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    width: '100%',
    ...SHADOWS.md,
  },
  buttonPrimaryText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    width: '100%',
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  buttonSecondaryText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: SPACING.sm,
  },
  linkSair: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  linkSairText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    opacity: 0.8,
  },
});