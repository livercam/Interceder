// Serviço de Notificações Push (Firebase Cloud Functions + FCM v1)
// 
// MIGRADO: Expo Push API → Firebase Admin SDK via Cloud Function
// 
// Fluxo:
// 1. O app gera o token FCM via Firebase Messaging SDK (nativo)
// 2. Para enviar, chama a Cloud Function /enviarPush que usa
//    Firebase Admin SDK (FCM HTTP v1) com Service Account
// 3. Os gatilhos automáticos (onPedidoCelulaCriado, etc.)
//    estão nas Cloud Functions e já usam admin.messaging()

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// URL da Cloud Function de push
const PUSH_FUNCTION_URL = 'https://us-central1-interceder-ef0cd.cloudfunctions.net/enviarPush';

/**
 * Regista o dispositivo para receber notificações push.
 * 
 * Fluxo:
 * 1. Verifica se é um dispositivo físico
 * 2. Solicita permissão ao utilizador
 * 3. Gera o token FCM via expo-notifications
 * 4. Configura o canal de notificação para Android
 * 
 * @returns {Promise<string|null>} - O token FCM em string, ou null se não for possível registar
 */
export async function registrarParaPushNotificationsAsync() {
  let token = null;

  // ============================================================
  // 1. Verificar se é dispositivo físico
  // ============================================================
  if (!Device.isDevice) {
    console.log('[PushNotification] Dispositivo não suportado (emulador/simulador).');
    return null;
  }

  // ============================================================
  // 2. Verificar/solicitar permissão
  // ============================================================
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PushNotification] Permissão de notificação negada.');
    return null;
  }

  // ============================================================
  // 3. Gerar token FCM via expo-notifications (nativo)
  //    O Expo gerencia a ponte nativa com o Firebase Messaging
  //    automaticamente. O google-services.json é usado em build.
  // ============================================================
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    token = tokenData.data;
    console.log('[PushNotification] Token FCM gerado com sucesso via expo-notifications');
  } catch (error) {
    console.warn('[PushNotification] Erro ao gerar token FCM:', error.message);
    return null;
  }

  // ============================================================
  // 4. Configurar canal Android (obrigatório para Android 8+)
  // ============================================================
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificações',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

/**
 * Envia uma notificação push via Cloud Function (Firebase Admin SDK).
 * 
 * @param {string} fcmToken - Token FCM do destinatário
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 * @param {object} [data={}] - Dados adicionais (ex: { pedidoId })
 * @returns {Promise<object|null>} - Resposta da Cloud Function
 */
export async function enviarNotificacaoPush(fcmToken, title, body, data = {}) {
  if (!fcmToken) {
    console.warn('[PushNotification] Token não fornecido. Notificação não enviada.');
    return null;
  }

  try {
    const response = await fetch(PUSH_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: fcmToken,
        title,
        body,
        data,
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('[PushNotification] Notificação enviada com sucesso via FCM v1');
      return result;
    } else {
      console.warn('[PushNotification] Erro da Cloud Function:', result.error || response.status);
      return null;
    }
  } catch (error) {
    console.warn('[PushNotification] Erro ao enviar notificação:', error.message);
    return null;
  }
}