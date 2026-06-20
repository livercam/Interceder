// ============================================================
// WebViewScreen — Navegador interno para links externos
// Mantém o usuário dentro do app com segurança
// ============================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Share,
  Clipboard,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WebViewScreen({ route, navigation }) {
  const { url, titulo } = route.params || {};
  const webViewRef = useRef(null);
  const [carregando, setCarregando] = useState(true);
  const [progresso, setProgresso] = useState(0);
  const [podeVoltar, setPodeVoltar] = useState(false);
  const insets = useSafeAreaInsets();

  const handleCompartilhar = useCallback(async () => {
    try {
      await Share.share({
        message: url,
        title: titulo || 'Compartilhar link',
      });
    } catch (e) {
      console.warn('[WebView] Erro ao compartilhar:', e.message);
    }
  }, [url, titulo]);

  const handleCopiarLink = useCallback(() => {
    Clipboard.setString(url);
    // Feedback visual simples
    Alert.alert('✅ Link copiado', 'O link foi copiado para a área de transferência.');
  }, [url]);

  if (!url) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="link-outline" size={48} color="#D1D5DB" />
        <Text style={styles.errorText}>Nenhuma URL fornecida</Text>
        <TouchableOpacity style={styles.btnVoltar} onPress={() => navigation.goBack()}>
          <Text style={styles.btnVoltarText}>Voltar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Barra Superior */}
      <View style={[styles.topBar, { paddingTop: insets.top > 0 ? 0 : 8 }]}>
        <TouchableOpacity style={styles.topBarBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>

        <View style={styles.topBarTitle}>
          <Text style={styles.topBarTitleText} numberOfLines={1}>
            {titulo || 'Navegador Interno'}
          </Text>
          <Text style={styles.topBarUrl} numberOfLines={1}>
            {url.replace('https://', '').replace('http://', '')}
          </Text>
        </View>

        <TouchableOpacity style={styles.topBarBtn} onPress={handleCompartilhar}>
          <Ionicons name="share-outline" size={22} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Barra de Progresso */}
      {carregando && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progresso * 100}%` }]} />
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setCarregando(true)}
        onLoadEnd={() => setCarregando(false)}
        onProgress={({ nativeEvent }) => setProgresso(nativeEvent.progress)}
        onNavigationStateChange={(navState) => setPodeVoltar(navState.canGoBack)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        allowsBackForwardNavigationGestures={true}
        // Segurança: bloquear navegação para URLs que não são http/https
        onShouldStartLoadWithRequest={(request) => {
          return request.url.startsWith('http://') || request.url.startsWith('https://');
        }}
      />

      {/* Barra Inferior */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomBarBtn, !podeVoltar && styles.bottomBarBtnDisabled]}
          onPress={() => webViewRef.current?.goBack()}
          disabled={!podeVoltar}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={podeVoltar ? '#1F2937' : '#D1D5DB'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarBtn} onPress={() => webViewRef.current?.reload()}>
          <Ionicons name="reload-outline" size={20} color="#1F2937" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomBarBtn} onPress={handleCopiarLink}>
          <Ionicons name="copy-outline" size={20} color="#1F2937" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomBarBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="home-outline" size={22} color="#A94438" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  btnVoltar: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#A94438',
    borderRadius: 8,
  },
  btnVoltarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    flex: 1,
    marginHorizontal: 8,
  },
  topBarTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  topBarUrl: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },

  // Progress
  progressContainer: {
    height: 3,
    backgroundColor: '#F3F4F6',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#A94438',
  },

  // WebView
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  bottomBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBarBtnDisabled: {
    opacity: 0.4,
  },
});