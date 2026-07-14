// App Interceder - Ponto de Entrada Principal
// Aplicativo Mobile de Rede de Oração e Comunhão em Células Digitais
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StyleSheet, Platform, Text, TextInput } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { AuthProvider } from './src/contexts/AuthContext';
import { AlertProvider } from './src/contexts/AlertContext';
import AppNavigator from './src/navigation/AppNavigator';
import { configureGoogleSignIn } from './src/services/googleAuthService';

// Aplicar a fonte Nunito globalmente para todos os Text e TextInput
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'Nunito_400Regular' };

TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = { fontFamily: 'Nunito_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_700Bold,
  });

  // ============================================================
  // Configurar Google Sign-In
  // ============================================================
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // ============================================================
  // Listener movido para AppNavigator.js
  // (navegação unificada com suporte a screen e link)
  // ============================================================

  // ============================================================
  // Estilizar a Barra de Navegação Nativa do Android
  // ============================================================
  useEffect(() => {
    async function configurarBarra() {
      if (Platform.OS === 'android') {
        try {
          // Verificação defensiva: alguns builds podem não expor os métodos
          if (typeof NavigationBar?.setBackgroundColorAsync === 'function') {
            await NavigationBar.setBackgroundColorAsync('#FFFFFF');
          }
          if (typeof NavigationBar?.setButtonStyleAsync === 'function') {
            await NavigationBar.setButtonStyleAsync('dark');
          }
        } catch (error) {
          console.log("Erro ao pintar a barra:", error);
        }
      }
    }
    configurarBarra();
  }, []);

  if (!fontsLoaded) {
    return null; // Tela fica vazia até as fontes carregarem (evita flash de fonte errada)
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
       <KeyboardProvider>
         <AuthProvider>
           <AlertProvider>
             <StatusBar style="light" />
             <AppNavigator />
           </AlertProvider>
         </AuthProvider>
       </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});