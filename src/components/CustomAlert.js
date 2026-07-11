// CustomAlert - Componente de Alerta Personalizado
// Substitui o Alert.alert() nativo com o tema do Interceder
// Suporta: título, mensagem, ícone opcional, botões com tipos (default/cancel/destructive)

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

/**
 * Componente CustomAlert.
 * Recebe as props via AlertContext.
 *
 * @param {object}   props
 * @param {boolean}  props.visible        - Controla a visibilidade do modal
 * @param {string}   props.title          - Título do alerta
 * @param {string}   props.message        - Mensagem do alerta
 * @param {string}   [props.icon]         - Nome do Ionicons (opcional)
 * @param {string}   [props.iconColor]    - Cor do ícone (opcional, padrão COLORS.primary)
 * @param {Array}    props.buttons        - Array de { text, type, onPress }
 * @param {function} props.onClose        - Callback ao fechar (para limpar estado no contexto)
 */
export default function CustomAlert({
  visible,
  title,
  message,
  icon,
  iconColor,
  buttons = [],
  onClose,
}) {
  if (!visible) return null;

  // Separar buttons por tipo para ordenar: todos os default/undefined primeiro, depois destructive, depois cancel
  const botoesDefault = buttons.filter((b) => b.type === 'default' || !b.type);
  const cancelBtn = buttons.find((b) => b.type === 'cancel');
  const destructiveBtns = buttons.filter((b) => b.type === 'destructive');
  const outros = buttons.filter(
    (b) => b.type !== 'default' && b.type !== 'cancel' && b.type !== 'destructive' && b.type !== undefined
  );

  const orderedButtons = [
    ...botoesDefault,
    ...outros,
    ...destructiveBtns,
    ...(cancelBtn ? [cancelBtn] : []),
  ];

  const handlePress = (btn) => {
    if (btn?.onPress) {
      btn.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (cancelBtn) {
          handlePress(cancelBtn);
        } else if (onClose) {
          onClose();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Ícone opcional */}
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons
                name={icon}
                size={40}
                color={iconColor || COLORS.primary}
              />
            </View>
          )}

          {/* Título */}
          {title ? (
            <Text style={styles.title}>{title}</Text>
          ) : null}

          {/* Mensagem */}
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          {/* Botões */}
          <View style={styles.buttonsContainer}>
            {orderedButtons.map((btn, index) => {
              const isDestructive = btn.type === 'destructive';
              const isCancel = btn.type === 'cancel';
              const isPrimary = btn.type === 'default' || (!btn.type && orderedButtons.length === 1);

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isPrimary && styles.buttonPrimary,
                    isDestructive && styles.buttonDestructive,
                    isCancel && styles.buttonCancel,
                    index > 0 && styles.buttonMarginTop,
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isPrimary && styles.buttonTextPrimary,
                      isDestructive && styles.buttonTextDestructive,
                      isCancel && styles.buttonTextCancel,
                    ]}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  buttonsContainer: {
    width: '100%',
  },
  button: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMarginTop: {
    marginTop: SPACING.sm,
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonDestructive: {
    backgroundColor: COLORS.danger,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  buttonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  buttonTextPrimary: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  buttonTextDestructive: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  buttonTextCancel: {
    color: COLORS.gray500,
    fontWeight: '600',
  },
});