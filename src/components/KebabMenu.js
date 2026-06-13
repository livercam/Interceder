// KebabMenu - Dropdown contextual de 3 pontinhos (ellipsis-vertical)
// Abre um menu flutuante abaixo do ícone, estilo YouTube.
// Props:
//   opcoes: Array<{ texto: string, destrutivo?: boolean, aoPressionar: () => void }>
//   visivel: boolean
//   aoFechar: () => void
//   badge: number (opcional) - quantidade a exibir em badge vermelho
//   triggerRef: Ref do elemento trigger para posicionamento

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

// ============================================================
// Componente KebabMenu
// Uso básico:
//   const [menuVisivel, setMenuVisivel] = useState(false);
//   <KebabMenu
//     visivel={menuVisivel}
//     aoFechar={() => setMenuVisivel(false)}
//     badge={3}
//     opcoes={[
//       { texto: 'Editar', aoPressionar: () => {} },
//       { texto: 'Excluir', destrutivo: true, aoPressionar: () => {} },
//     ]}
//   >
//     <TouchableOpacity onPress={() => setMenuVisivel(true)}>
//       <Ionicons name="ellipsis-vertical" size={22} color={COLORS.gray700} />
//     </TouchableOpacity>
//   </KebabMenu>
// ============================================================
export default function KebabMenu({ children, opcoes = [], visivel, aoFechar, badge }) {
  const triggerRef = useRef(null);
  const [posicao, setPosicao] = useState({ top: 0, right: 0 });

  // Medir a posição do trigger para posicionar o dropdown
  const medirPosicao = () => {
    if (triggerRef.current) {
      triggerRef.current.measureInWindow((x, y, width, height) => {
        // Posiciona o dropdown abaixo do trigger, alinhado à direita
        setPosicao({
          top: y + height + 4, // 4px de gap
          right: Platform.OS === 'ios' ? 16 : 100 - width, // fallback simples
        });
      });
    }
  };

  useEffect(() => {
    if (visivel) {
      // Pequeno delay para garantir que o trigger já foi renderizado
      setTimeout(medirPosicao, 50);
    }
  }, [visivel]);

  return (
    <>
      {/* Trigger (ícone de 3 pontinhos) */}
      <View ref={triggerRef} collapsable={false}>
        <View>
          {children}
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Overlay transparente + Dropdown via Modal */}
      <Modal
        visible={visivel}
        transparent
        animationType="none"
        onRequestClose={aoFechar}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={aoFechar}
        >
          {/* Posicionador: ocupa a tela toda, o dropdown é absolute */}
          <View style={styles.posicionador}>
            <View
              style={[
                styles.dropdown,
                {
                  position: 'absolute',
                  top: posicao.top,
                  right: 16,
                },
              ]}
            >
              {opcoes.map((opcao, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.opcaoItem,
                    index < opcoes.length - 1 && styles.opcaoItemBorda,
                  ]}
                  onPress={() => {
                    aoFechar();
                    // Pequeno delay para o menu fechar antes da ação
                    setTimeout(opcao.aoPressionar, 100);
                  }}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      styles.opcaoTexto,
                      opcao.destrutivo && styles.opcaoTextoDestrutivo,
                    ]}
                  >
                    {opcao.texto}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  posicionador: {
    flex: 1,
    position: 'relative',
  },
  dropdown: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    minWidth: 180,
    ...SHADOWS.lg,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.gray100,
  },
  opcaoItem: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  opcaoItemBorda: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray100,
  },
  opcaoTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    fontWeight: '500',
  },
  opcaoTextoDestrutivo: {
    color: COLORS.danger,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: COLORS.white,
    zIndex: 20,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
});