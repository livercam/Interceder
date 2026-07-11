// Navegação Principal - Proteção de Rotas com Firebase Auth
// Escuta o estado de autenticação via AuthContext e renderiza Login ou MainTabs

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import MuralScreen from '../screens/MuralScreen';
import CelulasScreen from '../screens/CelulasScreen';
import TestemunhosScreen from '../screens/TestemunhosScreen';
import PerfilScreen from '../screens/PerfilScreen';
import PedidoDetalhesScreen from '../screens/PedidoDetalhesScreen';
import MuralCelulaScreen from '../screens/MuralCelulaScreen';
import SalaIntercessaoScreen from '../screens/SalaIntercessaoScreen';
import ListaOracaoScreen from '../screens/ListaOracaoScreen';
import EditarPerfilScreen from '../screens/EditarPerfilScreen';
import FaqScreen from '../screens/FaqScreen';
import OfertandoScreen from '../screens/OfertandoScreen';
import MinhasPublicacoesScreen from '../screens/MinhasPublicacoesScreen';
import TestemunhoDetalhesScreen from '../screens/TestemunhoDetalhesScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import PaywallScreen from '../screens/PaywallScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import TermosPrivacidadeScreen from '../screens/TermosPrivacidadeScreen';
import NotificacoesScreen from '../screens/NotificacoesScreen';
import NovaMensagemApoioScreen from '../screens/NovaMensagemApoioScreen';
import GerenciarSolicitacoesScreen from '../screens/GerenciarSolicitacoesScreen';
import EditarCelulaScreen from '../screens/EditarCelulaScreen';
import Chat1x1Screen from '../screens/Chat1x1Screen';
import SuporteScreen from '../screens/SuporteScreen';
import WebViewScreen from '../screens/WebViewScreen';
import CustomSplashScreen from '../components/CustomSplashScreen';
import HeaderLogo from '../components/HeaderLogo';
import CriarPedidoScreen from '../screens/CriarPedidoScreen';
import CriarTestemunhoScreen from '../screens/CriarTestemunhoScreen';
import CriarCelulaScreen from '../screens/CriarCelulaScreen';

import { Ionicons } from '@expo/vector-icons';
import NotificationIcon from '../components/NotificationIcon';

import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONTS, SPACING, SHADOWS } from '../constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ============================================================
// Ícones das Abas (Ionicons — design premium)
// ============================================================
const TAB_ICONS = {
  Mural: { focused: 'home-sharp', unfocused: 'home-outline' },
  Células: { focused: 'people-sharp', unfocused: 'people-outline' },
  Testemunhos: { focused: 'chatbubbles-sharp', unfocused: 'chatbubbles-outline' },
  Perfil: { focused: 'person-sharp', unfocused: 'person-outline' },
};

function TabIcon({ routeName, focused, color, size }) {
  const iconConfig = TAB_ICONS[routeName];
  const iconName = iconConfig ? (focused ? iconConfig.focused : iconConfig.unfocused) : 'ellipse';

  return (
    <Ionicons
      name={iconName}
      size={size || 24}
      color={color}
    />
  );
}

// ============================================================
// Navegador de Abas Principal (autenticado)
// ============================================================
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <TabIcon
            routeName={route.name}
            focused={focused}
            color={color}
            size={size}
          />
        ),
        tabBarActiveTintColor: '#A94438',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarStyle: {
          ...styles.tabBar,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 6),
        },
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: COLORS.white,
        headerTitleAlign: 'center',
      })}
    >
      <Tab.Screen
        name="Mural"
        component={MuralScreen}
        options={{
          title: 'Mural',
          headerTitle: 'Mural de Oração',
          headerLeft: () => <HeaderLogo />,
          headerRight: () => <NotificationIcon />,
        }}
      />
      <Tab.Screen
        name="Células"
        component={CelulasScreen}
        options={{
          title: 'Células',
          headerTitle: 'Minhas Células',
        }}
      />
      <Tab.Screen
        name="Testemunhos"
        component={TestemunhosScreen}
        options={{
          title: 'Testemunhos',
          headerTitle: 'Testemunhos',
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={PerfilScreen}
        options={{
          title: 'Perfil',
          headerTitle: 'Meu Perfil',
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================================
// Tela de Carregamento (briefing antes da Splash)
// ============================================================
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.white} />
    </View>
  );
}

// ============================================================
// Função que processa o clique em notificação push
// ============================================================
function processarNotificacaoPush(data, navigationRef) {
  const link = data?.link;
  const screen = data?.screen;

  // Prioridade 1: link externo → abrir no navegador interno (WebViewScreen)
  if (link && link.startsWith('http')) {
    const titulo = data?.titulo_notificacao || data?.title || '';
    navigationRef.navigate('WebView', { url: link, titulo });
    return;
  }

  // Prioridade 2: screen interna definida no push
  if (screen) {
    switch (screen) {
      case 'MuralCelula':
        if (data?.celulaId) {
          navigationRef.navigate('MuralCelula', {
            celulaId: data.celulaId,
            celulaNome: data.celulaNome || 'Mural da Célula',
          });
        }
        return;

      case 'GerenciarMembrosCelula':
      case 'GerenciarSolicitacoes':
        if (data?.celulaId) {
          navigationRef.navigate('GerenciarSolicitacoes', {
            celulaId: data.celulaId,
          });
        }
        return;

      case 'PedidoDetalhes':
        if (data?.pedidoId) {
          navigationRef.navigate('PedidoDetalhes', {
            pedidoId: data.pedidoId,
          });
        }
        return;

      case 'TestemunhoDetalhes':
        if (data?.testemunhoId) {
          navigationRef.navigate('TestemunhoDetalhes', {
            testemunhoId: data.testemunhoId,
          });
        }
        return;

      case 'Perfil':
        navigationRef.navigate('Perfil');
        return;

      case 'Mural':
        navigationRef.navigate('Mural');
        return;

      case 'Celulas':
      case 'Células':
        navigationRef.navigate('Células');
        return;

      case 'Testemunhos':
        navigationRef.navigate('Testemunhos');
        return;

      case 'Notificacoes':
        navigationRef.navigate('Notificacoes');
        return;

      default:
        try {
          navigationRef.navigate(screen);
        } catch (e) {
          console.warn('[Push] Screen não encontrada:', screen, e.message);
        }
        return;
    }
  }

  // Prioridade 3: fallback — apenas abre o app
  console.log('[Push] Notificação sem screen nem link — apenas abriu o app.');
}

// ============================================================
// Navegador Principal com Proteção de Rotas
// ============================================================
export default function AppNavigator() {
  const { user, isLoading, emailVerified } = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useNavigationContainerRef();

  // ============================================================
  // Listener de Resposta a Notificações Push (Deep Linking)
  // Suporta: screen (navegação interna) e link (URL externa)
  // ============================================================
  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        const tentarNavegar = () => {
          if (!navigationRef.isReady()) {
            setTimeout(tentarNavegar, 100);
            return;
          }
          processarNotificacaoPush(data, navigationRef);
        };

        tentarNavegar();
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Verifica se é a primeira vez que o usuário abre o app
  useEffect(() => {
    const verificarPrimeiraVez = async () => {
      try {
        const valor = await AsyncStorage.getItem('@primeira_vez');
        setIsFirstLaunch(valor === null);
      } catch {
        setIsFirstLaunch(false);
      }
    };
    verificarPrimeiraVez();
  }, []);

  // ============================================================
  // Gerenciamento da Splash Screen Animada
  // ============================================================
  const exibirSplash = showSplash || isLoading || isFirstLaunch === null;

  if (exibirSplash && showSplash) {
    return (
      <CustomSplashScreen
        duration={2800}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  if (isLoading || isFirstLaunch === null) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          headerTitleAlign: 'center',
        }}
      >
        {user && !emailVerified ? (
          <>
            <Stack.Screen
              name="EmailVerification"
              component={EmailVerificationScreen}
              options={{ animationTypeForReplace: 'push' }}
            />
          </>
        ) : user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="PedidoDetalhes"
              component={PedidoDetalhesScreen}
              options={{
                headerShown: true,
                headerTitle: 'Detalhes do Pedido',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="MuralCelula"
              component={MuralCelulaScreen}
              options={({ route }) => ({
                headerShown: true,
                headerTitle: route.params?.celulaNome || 'Mural da Célula',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              })}
            />
            <Stack.Screen
              name="SalaIntercessao"
              component={SalaIntercessaoScreen}
              options={{
                headerShown: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="ListaOracao"
              component={ListaOracaoScreen}
              options={{
                headerShown: true,
                headerTitle: '📌 Minha Lista de Oração',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="EditarPerfil"
              component={EditarPerfilScreen}
              options={{
                headerShown: true,
                headerTitle: '✏️ Editar Perfil',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="Faq"
              component={FaqScreen}
              options={{
                headerShown: true,
                headerTitle: '❓ Dúvidas Frequentes',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="Ofertando"
              component={OfertandoScreen}
              options={{
                headerShown: true,
                headerTitle: '❤️ Ofertas',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="MinhasPublicacoes"
              component={MinhasPublicacoesScreen}
              options={{
                headerShown: true,
                headerTitle: '📂 Minhas Publicações',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="TestemunhoDetalhes"
              component={TestemunhoDetalhesScreen}
              options={{
                headerShown: true,
                headerTitle: 'Detalhes do Testemunho',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{
                headerShown: true,
                headerTitle: 'Perfil',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="Paywall"
              component={PaywallScreen}
              options={{
                headerShown: true,
                headerTitle: '👑 Membro Apoiador',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="Notificacoes"
              component={NotificacoesScreen}
              options={{
                headerShown: true,
                headerTitle: '🔔 Notificações',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="NovaMensagemApoio"
              component={NovaMensagemApoioScreen}
              options={{
                headerShown: true,
                headerTitle: '💬 Palavra de Apoio',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="GerenciarSolicitacoes"
              component={GerenciarSolicitacoesScreen}
              options={{
                headerShown: true,
                headerTitle: '🙋 Solicitações Pendentes',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="CriarPedido"
              component={CriarPedidoScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CriarTestemunho"
              component={CriarTestemunhoScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CriarCelula"
              component={CriarCelulaScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditarCelula"
              component={EditarCelulaScreen}
              options={{
                headerShown: true,
                headerTitle: '✏️ Editar Célula',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="WebView"
              component={WebViewScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
            
            <Stack.Screen
              name="Chat1x1"
              component={Chat1x1Screen}
              options={({ route }) => ({
                headerShown: true,
                headerTitle: route.params?.contatoNome || 'Chat',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              })}
            />
            <Stack.Screen
              name="Suporte"
              component={SuporteScreen}
              options={{
                headerShown: true,
                headerTitle: '🆘 Suporte',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
          </>
        ) : (
          <>
            {isFirstLaunch && (
              <Stack.Screen
                name="Onboarding"
                component={OnboardingScreen}
                options={{ animationTypeForReplace: 'pop' }}
              />
            )}
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ animationTypeForReplace: 'pop' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                headerShown: true,
                headerTitle: '🔐 Recuperar Senha',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
            <Stack.Screen
              name="TermosPrivacidade"
              component={TermosPrivacidadeScreen}
              options={{
                headerShown: true,
                headerTitle: 'Termos e Privacidade',
                headerStyle: styles.header,
                headerTitleStyle: styles.headerTitle,
                headerTintColor: COLORS.white,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    marginTop: SPACING.md,
    opacity: 0.8,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    paddingTop: 6,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  header: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.md,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
});