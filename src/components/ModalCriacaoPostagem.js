// ModalCriacaoPostagem — Modal Meia-Tela (Bottom Sheet)
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, Image, ScrollView, Keyboard, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import GravadorAudio from './GravadorAudio';

const extrairIDdoYouTube = (url) => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/gi;
  const match = regex.exec(url); return match ? match[1] : null;
};

const PreviewLink = ({ url, onRemove }) => {
  const [dom, setDom] = useState(''); const [fav, setFav] = useState(null);
  React.useEffect(() => {
    if (url && url.trim()) { try { const u = new URL(url); setDom(u.hostname); setFav(`https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`); } catch { setDom(url.replace(/^https?:\/\//,'')); setFav(null); } }
  }, [url]);
  return (<View style={s.previewLinkContainer}><Image source={{ uri: fav }} style={{ width: 90, height: 90, backgroundColor: '#F7F8FA', borderRadius: 8 }} resizeMode="contain" /><View style={s.previewLinkInfo}><Text style={s.previewLinkTitulo} numberOfLines={1}>{dom || 'Link'}</Text><Text style={s.previewLinkDominio} numberOfLines={1}>{dom || 'Link'}</Text></View><TouchableOpacity style={s.btnRemoverAnexoAbsoluto} onPress={onRemove} activeOpacity={0.7}><Ionicons name="close-circle" size={24} color={COLORS.error} /></TouchableOpacity></View>);
};

export default function ModalCriacaoPostagem({ visible, onFechar, onPostar }) {
  const { user, userProfile } = useAuth(); const insets = useSafeAreaInsets();
  const [tecladoAltura, setTecladoAltura] = useState(0);
  const [texto, setTexto] = useState(''); const [anexo, setAnexo] = useState({ tipo: null, uri: null, dadosExtras: null }); const [linkUrl, setLinkUrl] = useState('');

  // Estado para Evento
  const [tituloEvento, setTituloEvento] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horaEvento, setHoraEvento] = useState('');
  const [capaEventoUri, setCapaEventoUri] = useState(null);

  useEffect(() => { const s = Keyboard.addListener('keyboardDidShow', (e) => setTecladoAltura(e.endCoordinates.height)); const h = Keyboard.addListener('keyboardDidHide', () => setTecladoAltura(0)); return () => { s.remove(); h.remove(); }; }, []);

  const reset = useCallback(() => { setTexto(''); setAnexo({ tipo: null, uri: null, dadosExtras: null }); setLinkUrl(''); setTituloEvento(''); setDataEvento(''); setHoraEvento(''); }, []);
  const fechar = useCallback(() => { reset(); onFechar(); }, [onFechar, reset]);
  const removerAnexo = useCallback(() => { setAnexo({ tipo: null, uri: null, dadosExtras: null }); if (anexo.tipo === 'link') setLinkUrl(''); }, [anexo.tipo]);

  const handlePickerImagem = useCallback(async () => {
    Alert.alert('Selecionar imagem', 'Escolha:', [
      { text: '📷 Câmera', onPress: async () => { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { Alert.alert('','Precisamos da câmera.'); return; } const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4,3], quality: 0.8 }); if (!r.canceled && r.assets?.[0]?.uri) setAnexo({ tipo: 'imagem', uri: r.assets[0].uri, dadosExtras: {} }); }},
      { text: '🖼️ Galeria', onPress: async () => { const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) { Alert.alert('','Precisamos da galeria.'); return; } const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4,3], quality: 0.8 }); if (!r.canceled && r.assets?.[0]?.uri) setAnexo({ tipo: 'imagem', uri: r.assets[0].uri, dadosExtras: {} }); }},
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, []);

  const selTipo = useCallback((t) => {
    // Se selecionar evento, limpa anexo e ativa modo evento
    if (t === 'evento') {
      setAnexo({ tipo: 'evento', uri: null, dadosExtras: {} });
      return;
    }
    if (t === 'imagem') { handlePickerImagem(); }
    else if (t === 'video') setAnexo({ tipo: 'video', uri: null, dadosExtras: { video_id: '' } });
    else if (t === 'audio') setAnexo({ tipo: 'audio', uri: null, dadosExtras: null });
    else if (t === 'link') setAnexo({ tipo: 'link', uri: null, dadosExtras: { url: '' } });
  }, [handlePickerImagem]);

  const audioReady = useCallback((d) => { setAnexo({ tipo: 'audio', uri: d.uri, dadosExtras: d }); }, []);

  // Seletor de imagem para capa do evento
  const selecionarCapaEvento = useCallback(async () => {
    Alert.alert('Selecionar capa do evento', 'Escolha:', [
      { text: '📷 Câmera', onPress: async () => { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { Alert.alert('','Precisamos da câmera.'); return; } const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16,9], quality: 0.8 }); if (!r.canceled && r.assets?.[0]?.uri) setCapaEventoUri(r.assets[0].uri); }},
      { text: '🖼️ Galeria', onPress: async () => { const p = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!p.granted) { Alert.alert('','Precisamos da galeria.'); return; } const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16,9], quality: 0.8 }); if (!r.canceled && r.assets?.[0]?.uri) setCapaEventoUri(r.assets[0].uri); }},
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, []);

  const renderAnexo = () => {
    if (!anexo.tipo) return null;

    // Renderização especial para Evento
    if (anexo.tipo === 'evento') {
      return (
        <View style={s.anexoContainer}>
          <Text style={s.inputLabel}>📅 Título do Evento</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: Próximo encontro"
            placeholderTextColor="#B0B3B8"
            value={tituloEvento}
            onChangeText={setTituloEvento}
          />
          <Text style={s.inputLabel}>📆 Data (texto para exibição)</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: 24 de Maio de 2025 (Sábado)"
            placeholderTextColor="#B0B3B8"
            value={dataEvento}
            onChangeText={setDataEvento}
          />
          <Text style={s.inputLabel}>⏰ Horário</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: 19:30"
            placeholderTextColor="#B0B3B8"
            value={horaEvento}
            onChangeText={setHoraEvento}
          />

          {/* Upload de Capa do Evento */}
          <Text style={s.inputLabel}>🖼️ Imagem de Capa (opcional)</Text>
          {capaEventoUri ? (
            <View style={s.anexoPreviewImageWrapper}>
              <Image source={{ uri: capaEventoUri }} style={s.imagemPreview} resizeMode="cover" />
              <TouchableOpacity style={s.btnRemoverAnexoAbsoluto} onPress={() => setCapaEventoUri(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={28} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.anexoPlaceholderImage} onPress={selecionarCapaEvento} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={48} color={COLORS.gray300} />
              <Text style={s.anexoPlaceholderText}>Adicionar capa</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    switch (anexo.tipo) {
      case 'imagem':
        return (<View style={s.anexoPreviewContainer}><View style={s.anexoPreviewImageWrapper}>
          {anexo.uri && anexo.uri !== 'p' ? (<><Image source={{ uri: anexo.uri }} style={s.imagemPreview} resizeMode="cover" /><TouchableOpacity style={s.btnTrocarImagem} onPress={handlePickerImagem} activeOpacity={0.7}><Ionicons name="camera-outline" size={20} color="#FFF" /></TouchableOpacity></>) : (<TouchableOpacity style={s.anexoPlaceholderImage} onPress={handlePickerImagem} activeOpacity={0.7}><Ionicons name="image-outline" size={48} color={COLORS.gray300} /><Text style={s.anexoPlaceholderText}>Selecionar imagem</Text></TouchableOpacity>)}
          <TouchableOpacity style={s.btnRemoverAnexoAbsoluto} onPress={removerAnexo} activeOpacity={0.7}><Ionicons name="close-circle" size={28} color={COLORS.error} /></TouchableOpacity>
        </View></View>);
      case 'video':
        const vid = anexo?.dadosExtras?.video_id || ''; const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null;
        return (<View style={s.anexoPreviewContainer}>
          <TextInput style={s.inputLink} placeholder="Link do YouTube..." placeholderTextColor="#B0B3B8" value={anexo.dadosExtras?.url || ''} onChangeText={(v) => { const id = extrairIDdoYouTube(v); setAnexo((p) => ({ ...p, dadosExtras: { ...(p.dadosExtras||{}), url: v, video_id: id || '' } })); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" />
          {thumb ? (<><TextInput style={s.inputTituloLink} placeholder="Título (opcional)" placeholderTextColor="#B0B3B8" value={anexo.dadosExtras?.titulo||''} onChangeText={(v) => setAnexo((p) => ({ ...p, dadosExtras: { ...(p.dadosExtras||{}), url: p.dadosExtras?.url||'', video_id: p.dadosExtras?.video_id||'', titulo: v } }))} /><View style={s.anexoPreviewImageWrapper}><Image source={{ uri: thumb }} style={s.imagemPreview} resizeMode="cover" /><View style={s.overlayPlay}><Ionicons name="play-circle" size={48} color="#FFF" /></View><TouchableOpacity style={s.btnRemoverAnexoAbsoluto} onPress={removerAnexo} activeOpacity={0.7}><Ionicons name="close-circle" size={28} color={COLORS.error} /></TouchableOpacity></View></>) : null}
        </View>);
      case 'audio':
        return (<View style={s.anexoContainer}><GravadorAudio onAudioReady={audioReady} onRemove={audioRemove} />{anexo.uri ? (<TextInput style={s.inputTituloAudio} placeholder="Título (opcional)" placeholderTextColor="#B0B3B8" value={anexo.dadosExtras?.tituloPersonalizado||''} onChangeText={(v) => setAnexo((p) => ({ ...p, dadosExtras: { ...(p.dadosExtras||{}), tituloPersonalizado: v } }))} />) : null}</View>);
      case 'link':
        return (<View style={s.anexoContainer}><TextInput style={s.inputLink} placeholder="Cole o link..." placeholderTextColor="#B0B3B8" value={linkUrl} onChangeText={(v) => { setLinkUrl(v); setAnexo((p) => ({ ...p, dadosExtras: { ...(p.dadosExtras||{}), url: v } })); }} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done" />{linkUrl.trim() ? (<><PreviewLink url={linkUrl} onRemove={removerAnexo} /><TextInput style={s.inputTituloLink} placeholder="Título (opcional)" placeholderTextColor="#B0B3B8" value={anexo.dadosExtras?.titulo||''} onChangeText={(v) => setAnexo((p) => ({ ...p, dadosExtras: { ...(p.dadosExtras||{}), url: p.dadosExtras?.url||linkUrl, titulo: v } }))} /></>) : null}</View>);
      default: return null;
    }
  };

  const audioRemove = useCallback(() => { setAnexo({ tipo: null, uri: null, dadosExtras: null }); }, []);

  const postar = useCallback(() => {
    // Validação de Evento
    if (anexo.tipo === 'evento') {
      if (!tituloEvento.trim()) {
        Alert.alert('Atenção', 'Preencha o título do evento.');
        return;
      }
      onPostar({
        texto: tituloEvento.trim(),
        tipo_postagem: 'evento',
        anexo: {
          tipo: 'evento',
          dadosExtras: {
            titulo_evento: tituloEvento.trim(),
            data_evento_texto: dataEvento.trim(),
            data_iso: '',  // Será computado no backend ou pode ser digitado separadamente
            hora_evento: horaEvento.trim(),
            capa_evento_uri: capaEventoUri || '',
          },
        },
      });
      reset();
      return;
    }

    if (!texto.trim() && !anexo.tipo) return;
    onPostar({ texto: texto.trim(), tipo_postagem: anexo.tipo || 'texto', anexo: anexo.tipo ? { ...anexo } : null });
    reset();
  }, [texto, anexo, onPostar, reset, tituloEvento, dataEvento, horaEvento]);


  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={fechar} statusBarTranslucent>
      <View style={[s.modalOverlay, tecladoAltura > 0 && { paddingBottom: tecladoAltura }]}>
        <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={fechar} />
        <View style={[s.modalConteudo, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={s.headerRow}>
            <View style={s.userInfo}>
              {user?.photoURL || userProfile?.foto_url ? <Image source={{ uri: user?.photoURL || userProfile?.foto_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarPlaceholder]}><Text style={s.avatarText}>{userProfile?.nome?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}</Text></View>}
              <View><Text style={s.userName}>{userProfile?.nome || user?.displayName || 'Você'}</Text><Text style={s.userRole}>Compartilhe com a célula</Text></View>
            </View>
            <TouchableOpacity onPress={fechar} activeOpacity={0.7}><Ionicons name="close" size={24} color="#65676B" /></TouchableOpacity>
          </View>
          <ScrollView style={s.scrollBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Input de texto escondido para Evento, pois usamos campos específicos */}
            {anexo.tipo !== 'evento' && (
              <TextInput style={s.inputTexto} multiline placeholder="No que você está pensando?" placeholderTextColor="#B0B3B8" value={texto} onChangeText={setTexto} textAlignVertical="top" />
            )}
            {renderAnexo()}
          </ScrollView>
          <View style={s.toolbar}>
            <View style={s.iconesRow}>
              {[{ t: 'imagem', i: 'image-outline' }, { t: 'video', i: 'videocam-outline' }, { t: 'audio', i: 'mic-outline' }, { t: 'link', i: 'link-outline' }, { t: 'evento', i: 'calendar-outline' }].map((item) => (
                <TouchableOpacity key={item.t} onPress={() => selTipo(item.t)} activeOpacity={0.7}>
                  <Ionicons name={item.i} size={26} color={anexo.tipo === item.t ? COLORS.primary : '#65676B'} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.btnPostar, (!texto.trim() && !anexo.tipo) && s.btnPostarDisabled]}
              onPress={postar}
              activeOpacity={0.8}
              disabled={!texto.trim() && !anexo.tipo}
            >
              <Text style={s.btnPostarTexto}>Publicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const s = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }, backdropTouch: { flex: 1 },
  modalConteudo: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 24, maxHeight: '70%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 }, avatarPlaceholder: { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }, userName: { fontSize: 16, fontWeight: '700', color: '#1C1E21' }, userRole: { fontSize: 13, color: '#65676B', marginTop: 2 },
  scrollBody: { maxHeight: 260 }, inputTexto: { fontSize: 18, color: '#050505', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  anexoContainer: { backgroundColor: '#F7F8FA', borderRadius: 16, borderWidth: 1, borderColor: '#E4E6EB', padding: 12, marginBottom: 16 },
  anexoPreviewContainer: { marginBottom: 16 }, anexoPreviewImageWrapper: { position: 'relative', borderRadius: 16, overflow: 'hidden' },
  anexoPlaceholderImage: { height: 180, borderRadius: 16, backgroundColor: '#F7F8FA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E4E6EB', borderStyle: 'dashed' },
  anexoPlaceholderText: { marginTop: 8, fontSize: 14, color: '#65676B' }, imagemPreview: { width: '100%', height: 180, borderRadius: 16 },
  btnTrocarImagem: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  overlayPlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  btnRemoverAnexoAbsoluto: { position: 'absolute', top: 8, right: 8, backgroundColor: '#FFF', borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  inputLink: { borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#050505', marginBottom: 10, backgroundColor: '#FFF' },
  previewLinkContainer: { borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, overflow: 'hidden', flexDirection: 'row', height: 90, position: 'relative' },
  previewLinkImagem: { width: 90, height: '100%', backgroundColor: '#F7F8FA', justifyContent: 'center', alignItems: 'center' },
  previewLinkInfo: { flex: 1, padding: 10, justifyContent: 'center' }, previewLinkTitulo: { fontSize: 14, fontWeight: '700', color: '#1C1E21', marginBottom: 4 },
  previewLinkDescricao: { fontSize: 12, color: '#65676B', lineHeight: 18, marginBottom: 4 }, previewLinkDominio: { fontSize: 11, color: '#B0B3B8' },
  inputTituloAudio: { borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#050505', marginTop: 10, backgroundColor: '#FFF' },
  inputTituloLink: { borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#050505', marginTop: 10, backgroundColor: '#FFF' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#E4E6EB', paddingTop: 12, marginTop: 4 },
  iconesRow: { flexDirection: 'row', gap: 20 }, btnPostar: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20 },
  btnPostarDisabled: { backgroundColor: '#B0B3B8' }, btnPostarTexto: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  // Estilos adicionais para inputs do evento
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#65676B', marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#E4E6EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#050505', marginBottom: 10, backgroundColor: '#FFF' },
});
