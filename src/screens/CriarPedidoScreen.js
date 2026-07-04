// CriarPedidoScreen — Tela de criação de pedido de oração
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import { criarPedido } from "../services/firestoreService";
import ActionHeader from "../components/ActionHeader";
import MediaToolbar from "../components/MediaToolbar";

var PRIMARY = "#A53F36";
var ORANGE = "#E87A4A";
var TEXT_PRIMARY = "#1E293B";
var TEXT_SECONDARY = "#94A3B8";
var BORDER = "#E2E8F0";

var CATEGORIAS = [
  { label: "Saúde", value: "saude", icon: "heart-circle-outline" },
  { label: "Família", value: "familia", icon: "people-outline" },
  { label: "Trabalho", value: "trabalho", icon: "briefcase-outline" },
  { label: "Finanças", value: "financas", icon: "wallet-outline" },
  { label: "Espiritual", value: "espiritual", icon: "eye-outline" },
];

var MAX_CHARS = 1000;

export default function CriarPedidoScreen({ navigation }) {
  var { user } = useAuth();
  var insets = useSafeAreaInsets();
  var [texto, setTexto] = useState("");
  var [categoria, setCategoria] = useState("saude");
  var [publicando, setPublicando] = useState(false);
  var [imagemUri, setImagemUri] = useState(null);

  var podePublicar = texto.trim().length >= 3 && !publicando;

  var handleCancelar = useCallback(() => {
    if (texto.trim() || imagemUri) {
      Alert.alert("Descartar alterações?", "Você tem conteúdo não salvo.", [
        { text: "Continuar editando", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [navigation, texto, imagemUri]);

  var handlePublicar = useCallback(async () => {
    if (!podePublicar) return;
    setPublicando(true);
    try {
      await criarPedido(
        texto.trim(), categoria, "publico", [],
        { uid: user.uid, nome: user.displayName || "Anônimo" },
        user.photoURL || null,
        imagemUri || null,
        null,
      );
      Alert.alert("✅ Pedido enviado", "Seu pedido de oração foi compartilhado.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert("Erro", err.message);
    } finally {
      setPublicando(false);
    }
  }, [podePublicar, texto, categoria, user, navigation, imagemUri]);

  var handlePickerImagem = useCallback(async () => {
    Alert.alert("Adicionar imagem", "Escolha:", [
      {
        text: "📷 Câmera",
        onPress: async () => {
          var p = await ImagePicker.requestCameraPermissionsAsync();
          if (!p.granted) { Alert.alert("", "Precisamos da câmera."); return; }
          var r = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8,
          });
          if (!r.canceled && r.assets?.[0]?.uri) setImagemUri(r.assets[0].uri);
        },
      },
      {
        text: "🖼️ Galeria",
        onPress: async () => {
          var p = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!p.granted) { Alert.alert("", "Precisamos da galeria."); return; }
          var r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8,
          });
          if (!r.canceled && r.assets?.[0]?.uri) setImagemUri(r.assets[0].uri);
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : insets.top}
    >
      <ActionHeader
        titulo="Criar Pedido"
        onCancelar={handleCancelar}
        onPublicar={handlePublicar}
        publicando={publicando}
        desabilitarPublicar={!podePublicar}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Ionicons name="heart-circle-outline" size={48} color={ORANGE} />
          <Text style={styles.heroTitle}>Compartilhe seu pedido</Text>
          <Text style={styles.heroSubtitle}>
            Sua comunidade está aqui para orar com você
          </Text>
        </View>

        <View style={styles.categoriasSection}>
          <Text style={styles.sectionLabel}>Escolha uma categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriasRow}
          >
            {CATEGORIAS.map((cat) => {
              var ativa = categoria === cat.value;
              return (
                <TouchableOpacity
                  key={cat.value}
                  style={[styles.categoriaBtn, ativa && styles.categoriaBtnAtiva]}
                  onPress={() => setCategoria(cat.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={cat.icon} size={22} color={ativa ? PRIMARY : TEXT_SECONDARY} />
                  <Text style={[styles.categoriaText, ativa && styles.categoriaTextAtiva]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.textoSection}>
          <TextInput
            style={styles.textInput}
            placeholder="Escreva aqui seu pedido de oração..."
            placeholderTextColor={TEXT_SECONDARY}
            multiline
            textAlignVertical="top"
            value={texto}
            onChangeText={setTexto}
            maxLength={MAX_CHARS}
          />
          <Text style={styles.charCounter}>
            {texto.length}/{MAX_CHARS}
          </Text>
        </View>

        {imagemUri && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: imagemUri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity
              style={styles.removePreviewBtn}
              onPress={() => setImagemUri(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={28} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.privacidadeRow}>
          <Ionicons name="lock-closed-outline" size={16} color={TEXT_SECONDARY} />
          <Text style={styles.privacidadeText}>
            Seu pedido será visível para a comunidade
          </Text>
        </View>

        <MediaToolbar
          onGravarAudio={() => {}}
          onAdicionarImagem={handlePickerImagem}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  heroSection: { alignItems: "center", marginBottom: 28 },
  heroTitle: { fontSize: 22, fontWeight: "600", color: ORANGE, marginTop: 12 },
  heroSubtitle: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, textAlign: "center", lineHeight: 20 },
  categoriasSection: { marginBottom: 20 },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: TEXT_PRIMARY, marginBottom: 12 },
  categoriasRow: { gap: 10, paddingRight: 20 },
  categoriaBtn: {
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 18, borderRadius: 16,
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#FFFFFF", gap: 6, minWidth: 80,
  },
  categoriaBtnAtiva: { borderColor: PRIMARY, backgroundColor: PRIMARY + "08" },
  categoriaText: { fontSize: 12, fontWeight: "600", color: TEXT_SECONDARY },
  categoriaTextAtiva: { color: PRIMARY },
  textoSection: { position: "relative", marginBottom: 16 },
  textInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36,
    fontSize: 16, color: TEXT_PRIMARY, minHeight: 150,
    textAlignVertical: "top", lineHeight: 24, backgroundColor: "#FAFAFA",
  },
  charCounter: { position: "absolute", bottom: 12, right: 16, fontSize: 12, color: TEXT_SECONDARY },
  previewContainer: { position: "relative", marginBottom: 16, borderRadius: 16, overflow: "hidden" },
  previewImage: { width: "100%", height: 200, borderRadius: 16, backgroundColor: "#F1F5F9" },
  removePreviewBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "#FFFFFF", borderRadius: 14 },
  privacidadeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  privacidadeText: { fontSize: 13, color: TEXT_SECONDARY, flex: 1 },
});