// AlertContext - Contexto Global de Alertas Personalizados
// Substitui o Alert.alert() nativo por um modal estilizado com o tema do Interceder
// Uso: const { showAlert } = useAlert(); showAlert({ title, message, buttons, icon })

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import CustomAlert from '../components/CustomAlert';

const AlertContext = createContext(null);

/**
 * Provider do AlertContext.
 * Renderiza o CustomAlert globalmente e expõe a função showAlert.
 */
export function AlertProvider({ children }) {
  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    icon: null,
    iconColor: null,
    buttons: [],
  });
  const resolveRef = useRef(null);

  /**
   * Exibe um alerta personalizado.
   *
   * @param {object} options
   * @param {string} options.title        - Título do alerta
   * @param {string} options.message      - Mensagem do alerta
   * @param {string} [options.icon]       - Nome do Ionicons (opcional)
   * @param {string} [options.iconColor]  - Cor do ícone (opcional)
   * @param {Array}  [options.buttons]    - Array de { text, type, onPress }
   *   Tipos suportados: 'default' (primário), 'cancel' (outline), 'destructive' (vermelho)
   */
  const showAlert = useCallback(({ title, message, icon, iconColor, buttons = [] }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setAlertState({
        visible: true,
        title: title || '',
        message: message || '',
        icon: icon || null,
        iconColor: iconColor || null,
        buttons,
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    setAlertState((prev) => ({ ...prev, visible: false }));
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        icon={alertState.icon}
        iconColor={alertState.iconColor}
        buttons={alertState.buttons}
        onClose={handleClose}
      />
    </AlertContext.Provider>
  );
}

/**
 * Hook para consumir o AlertContext.
 * Retorna { showAlert }.
 *
 * Exemplo:
 *   const { showAlert } = useAlert();
 *   showAlert({
 *     title: 'Aviso',
 *     message: 'Deseja continuar?',
 *     icon: 'warning-outline',
 *     buttons: [
 *       { text: 'Cancelar', type: 'cancel' },
 *       { text: 'Confirmar', type: 'default', onPress: () => {} },
 *     ],
 *   });
 */
export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert deve ser usado dentro de um AlertProvider');
  }
  return context;
}