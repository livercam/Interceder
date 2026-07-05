// CriarTestemunhoScreen — Tela de criação de testemunho
import React, { useState, useCallback } from 'react';
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
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { adicionarTestemunho, buscarMeusPedidos } from '../services/firestoreService';
import ActionHeader from '../components/ActionHeader';
import MediaToolbar from '../components/MediaToolbar';
import GravadorAudio from '../components/GravadorAudio';
import { uploadImagem } from '../services/uploadService';

const PRIMARY = '#A53F36';
const GREEN = '#10B981';
const TEXT_PRIMARY = '#1E293B';
const TEXT_SECONDARY = '#94A3B8';
const BORDER = '#E2E8F0';

const MAX_CHARS = 1500;

export default function CriarTestemunhoScreen({ navigation, route }) {
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [pedidoSelecionado, setPedidoSelecionado] = useState(route?.params?.pedidoSelecionado || null);

  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [imagemUri, setImagemUri] = useState(null);
  const [mostrarGravador, setMostrarGravador] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [mostrarSeletorPedidos, setMostrarSeletorPedidos] = useState(false);
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);

  const carregarPedidos = useCallback(async () => {
    if (!user) return;
    setCarregandoPedidos(true);
    try {
      const lista = await buscarMeusPedidos(user.uid);
      setMeusPedidos(lista);
    } catch (e) {
      console.warn(e.message);
    } finally {
      setCarregandoPedidos(false);
    }
  }, [user]);

  const podePublicar = texto.trim().length >= 3 && !publicando;

  const handleCancelar = useCallback(() => {
    if (texto.trim() || imagemUri) {
      Alert.alert('Descartar alterações?', 'Você tem conteúdo não salvo.', [
        { text: 'Continuar editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  }, [navigation, texto, imagemUri]);

  const handlePublicar = useCallback(async () => {
    if (!podePublicar) return;
    setPublicando(true);
    try {
      const imagemFinal = imagemUri ? await uploadImagem(imagemUri, user, "testemunhos") : null;
      const userData = {
        uid: user.uid,
        nome: user.displayName || 'Irmão(ã)',
        displayName: user.displayName || 'Irmão(ã)',
        photoURL: user.photoURL || null,
        cargo: userProfile?.titulo_ministerial || 'membro',
      };
      await adicionarTestemunho(
        userData,
        texto.trim(),
        pedidoSelecionado?.id || null,
        pedidoSelecionado?.categoria || null,
        imagemFinal,
        audioUrl,
      );
      Alert.alert('🎉 Glória a Deus!', 'Seu testemunho foi compartilhado.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Erro', err.message);
    } finally {
      setPublicando(false);
    }
  }, [podePublicar, texto, pedidoSelecionado, user, navigation, imagemUri, audioUrl]);

  const handlePickerImagem = useCallback(async () => {
    Alert.alert('Adicionar imagem', 'Escolha:', [
      {
        text: '📷 Câmera',
        onPress: async () => {
          const p = await ImagePicker.requestCameraPermissionsAsync();
          if (!p.granted) { Alert.alert('', 'Precisamos da câmera.'); return; }
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
          });
          if (!r.canceled && r.assets?.[0]?.uri) setImagemUri(r.assets[0].uri);
        },
      },
      {
        text: '🖼️ Galeria',
        onPress: async () => {
          const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!p.granted) { Alert.alert('', 'Precisamos da galeria.'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
          });
          if (!r.canceled && r.assets?.[0]?.uri) setImagemUri(r.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, []);
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
    >
      <ActionHeader
        titulo="Criar Testemunho"
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
          <Ionicons name="gift-outline" size={48} color={GREEN} />
          <Text style={styles.heroTitle}>Deus agiu!</Text>
          <Text style={styles.heroSubtitle}>
            Compartilhe como Deus respondeu às orações
          </Text>
        </View>

        {pedidoSelecionado && (
          <TouchableOpacity style={styles.vincularCard} activeOpacity={0.7}>
            <View style={styles.vincularLeft}>
              <Ionicons name="link-outline" size={20} color={GREEN} />
              <View style={styles.vincularInfo}>
                <Text style={styles.vincularTitle}>Vincular a um pedido respondido</Text>
                <Text style={styles.vincularSubtitle}>
                  {pedidoSelecionado.texto?.substring(0, 60)}...
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        )}

        {!pedidoSelecionado && (
          <TouchableOpacity
            style={styles.vincularCard}
            activeOpacity={0.7}
            onPress={() => {
              carregarPedidos(); setMostrarSeletorPedidos(true);
            }}
          >
            <View style={styles.vincularLeft}>
              <Ionicons name="link-outline" size={20} color={GREEN} />
              <View style={styles.vincularInfo}>
                <Text style={styles.vincularTitle}>Vincular a um pedido respondido</Text>
                <Text style={styles.vincularSubtitle}>
                  Toque para selecionar um pedido de oração
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        )}

        <View style={styles.textoSection}>
          <TextInput
            style={styles.textInput}
            placeholder="Conte como Deus respondeu ao seu pedido..."
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

        {mostrarGravador && !audioUrl && (
          <View style={styles.audioContainer}>
            <GravadorAudio
              onAudioReady={(dados) => { setAudioUrl(typeof dados === "string" ? dados : dados.uri); setMostrarGravador(false); }}
              onRemove={() => { setAudioUrl(null); }}
            />
          </View>
        )}

        {audioUrl && (
          <View style={styles.audioContainer}>
            <View style={{flexDirection:"row",alignItems:"center",backgroundColor:"#F0FDF4",borderRadius:12,padding:12,gap:8}}><Ionicons name="musical-note" size={20} color="#065F46" /><Text style={{flex:1,fontSize:14,color:"#065F46",fontWeight:"600"}}>Audio adicionado</Text><TouchableOpacity onPress={() => setAudioUrl(null)}><Ionicons name="close-circle" size={24} color="#EF4444" /></TouchableOpacity></View>
          </View>
        )}

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
            Seu testemunho será visível para a comunidade
          </Text>
        </View>

        <MediaToolbar
          onGravarAudio={() => setMostrarGravador(true)}
          onAdicionarImagem={handlePickerImagem}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={mostrarSeletorPedidos} transparent animationType="slide" onRequestClose={() => setMostrarSeletorPedidos(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar pedido</Text>
              <TouchableOpacity onPress={() => setMostrarSeletorPedidos(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            {carregandoPedidos ? (
              <ActivityIndicator size="large" color={PRIMARY} style={{marginVertical: 40}} />
            ) : meusPedidos.length === 0 ? (
              <View style={{padding: 24, alignItems: 'center'}}>
                <Text style={{fontSize: 16, color: '#94A3B8', textAlign: 'center'}}>
                  Nenhum pedido ativo encontrado. Crie um pedido no Mural primeiro.
                </Text>
              </View>
            ) : (
              <FlatList
                data={meusPedidos}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pedidoOption}
                    onPress={() => { setPedidoSelecionado(item); setMostrarSeletorPedidos(false); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="link-outline" size={20} color={GREEN} />
                    <View style={{flex: 1, marginLeft: 12}}>
                      <Text style={styles.pedidoOptionText} numberOfLines={2}>{item.texto}</Text>
                      <Text style={styles.pedidoOptionCat}>{item.categoria}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
                style={{maxHeight: 400}}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24 },
  heroSection: { alignItems: 'center', marginBottom: 28 },
  heroTitle: { fontSize: 22, fontWeight: '600', color: GREEN, marginTop: 12 },
  heroSubtitle: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  vincularCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1FAE5',
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  vincularLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  vincularInfo: { flex: 1 },
  vincularTitle: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 4 },
  vincularSubtitle: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  textoSection: { position: 'relative', marginBottom: 16 },
  textInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 36,
    fontSize: 16, color: TEXT_PRIMARY, minHeight: 150,
    textAlignVertical: 'top', lineHeight: 24, backgroundColor: '#FAFAFA',
  },
  charCounter: { position: 'absolute', bottom: 12, right: 16, fontSize: 12, color: TEXT_SECONDARY },
  previewContainer: { position: 'relative', marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  previewImage: { width: '100%', height: 200, borderRadius: 16, backgroundColor: '#F1F5F9' },
  removePreviewBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFFFFF', borderRadius: 14 },
  privacidadeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  privacidadeText: { fontSize: 13, color: TEXT_SECONDARY, flex: 1 },
  audioContainer: { marginBottom: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  pedidoOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pedidoOptionText: { fontSize: 14, color: '#1E293B', fontWeight: '500', lineHeight: 20 },
  pedidoOptionCat: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
