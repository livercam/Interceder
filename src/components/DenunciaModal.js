// Componente DenunciaModal - Modal Lateral com Animação Slide (Direita para Esquerda)
// Utilizado em PedidoDetalhesScreen, TestemunhoDetalhesScreen e MuralCelulaScreen
// Funcionalidades:
// - Animação Animated.timing com translateX
// - Lista de opções de denúncia com seleção única
// - Campo de texto opcional para descrição detalhada
// - Botões Cancelar e Enviar Denúncia

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { criarDenuncia } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const OPCOES_DENUNCIA = [
  { key: 'inadequado', label: '🚫 Conteúdo inadequado, profano ou ofensivo' },
  { key: 'odio', label: '📢 Discurso de ódio, intolerância religiosa ou discriminação' },
  { key: 'assedio', label: '👤 Assédio, bullying ou perseguição' },
  { key: 'falso', label: '❌ Falso testemunho, fraude ou golpe' },
  { key: 'spam', label: '🚫 Spam, links suspeitos ou publicidade indevida' },
  { key: 'outros', label: '⚙️ Outros motivos' },
];

export default function DenunciaModal({ visible, onClose, itemId, itemTipo }) {
  const { user } = useAuth();
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [motivoSelecionado, setMotivoSelecionado] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Animação de abertura/fecho
  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateX]);

  const handleFechar = () => {
    Animated.timing(translateX, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setMotivoSelecionado(null);
      setDescricao('');
      onClose();
    });
  };

  const handleEnviar = async () => {
    if (!user) {
      Alert.alert('Atenção', 'Faça login para denunciar.');
      return;
    }

    if (!motivoSelecionado) {
      Alert.alert('Selecione um motivo', 'Por favor, escolha uma opção de denúncia.');
      return;
    }

    setEnviando(true);
    try {
      await criarDenuncia({
        item_id: itemId,
        item_tipo: itemTipo,
        motivo_categoria: motivoSelecionado,
        descricao_detalhada: descricao.trim(),
        denunciante_id: user.uid,
      });

      Alert.alert(
        'Sucesso',
        'Obrigado. Nossa equipe de moderação irá analisar o conteúdo.'
      );

      handleFechar();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar a denúncia.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleFechar}
    >
      <View style={styles.overlay}>
        {/* Fundo semi-transparente clicável para fechar */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleFechar}
        />

        {/* Modal Lateral Animado */}
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateX }] },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Cabeçalho */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>🚨 Denunciar Conteúdo</Text>
              <TouchableOpacity
                style={styles.fecharBtn}
                onPress={handleFechar}
                activeOpacity={0.7}
              >
                <Text style={styles.fecharBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Lista de Opções */}
              <Text style={styles.sectionLabel}>Selecione o motivo:</Text>
              {OPCOES_DENUNCIA.map((opcao) => (
                <TouchableOpacity
                  key={opcao.key}
                  style={[
                    styles.opcaoItem,
                    motivoSelecionado === opcao.key && styles.opcaoItemSelecionado,
                  ]}
                  onPress={() => setMotivoSelecionado(opcao.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {motivoSelecionado === opcao.key && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.opcaoLabel,
                      motivoSelecionado === opcao.key && styles.opcaoLabelSelecionado,
                    ]}
                  >
                    {opcao.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Campo de Descrição Opcional */}
              <Text style={styles.sectionLabel}>
                Descrição detalhada <Text style={styles.opcionalText}>(opcional)</Text>
              </Text>
              <TextInput
                style={styles.descricaoInput}
                placeholder="Descreva brevemente o motivo da denúncia..."
                placeholderTextColor={COLORS.gray400}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </ScrollView>

            {/* Botões do Rodapé */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelarBtn}
                onPress={handleFechar}
                activeOpacity={0.7}
                disabled={enviando}
              >
                <Text style={styles.cancelarBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.enviarBtn,
                  (!motivoSelecionado || enviando) && styles.enviarBtnDisabled,
                ]}
                onPress={handleEnviar}
                activeOpacity={0.85}
                disabled={!motivoSelecionado || enviando}
              >
                {enviando ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.enviarBtnText}>Enviar Denúncia</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    right: 0,
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderBottomLeftRadius: RADIUS.xl,
    ...SHADOWS.lg,
    // Limitar verticalmente: abaixo do header e acima das bottom tabs
    top: 80,
    bottom: 70,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  fecharBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fecharBtnText: {
    fontSize: 16,
    color: COLORS.gray600,
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  sectionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  opcionalText: {
    fontWeight: '400',
    color: COLORS.gray400,
    fontSize: FONTS.sizes.xs,
  },
  opcaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  opcaoItemSelecionado: {
    backgroundColor: COLORS.primary + '12',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  opcaoLabel: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
    lineHeight: 20,
  },
  opcaoLabelSelecionado: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  descricaoInput: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    padding: SPACING.md,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray800,
    minHeight: 100,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    gap: SPACING.sm,
  },
  cancelarBtn: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    fontWeight: '600',
  },
  enviarBtn: {
    flex: 1.5,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarBtnDisabled: {
    opacity: 0.5,
  },
  enviarBtnText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.white,
    fontWeight: 'bold',
  },
});
