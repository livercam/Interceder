// FeedLink — Link card + caption abaixo
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function FeedLink({ url, titulo, descricao, imagemUrl, texto }) {
  const [faviconErro, setFaviconErro] = React.useState(false);
  const dominio = React.useMemo(() => {
    if (!url) return '';
    try { return new URL(url).hostname; }
    catch { return url; }
  }, [url]);

  const faviconUrl = React.useMemo(() => {
    if (imagemUrl) return imagemUrl;
    if (!dominio) return null;
    return `https://www.google.com/s2/favicons?domain=${dominio}&sz=64`;
  }, [imagemUrl, dominio]);

  // Reset erro quando muda o domínio
  React.useEffect(() => { setFaviconErro(false); }, [dominio]);

  const navigation = useNavigation();
  const mostrarIcone = !faviconUrl || faviconErro;

  const abrirLink = () => {
    if (!url) return;
    let link = url.trim();
    if (!link.startsWith('http://') && !link.startsWith('https://')) link = 'https://' + link;
    navigation.navigate('WebView', { url: link, titulo: titulo || dominio || 'Link' });
  };

  return (
    <View>
      <TouchableOpacity style={s.linkCard} onPress={abrirLink} activeOpacity={0.85}>
        <View style={s.linkImage}>
          {mostrarIcone ? (
            <Ionicons name="link" size={28} color="#B0B3B8" />
          ) : (
            <Image source={{ uri: faviconUrl }} style={{ width: 90, height: 90 }} resizeMode="contain" onError={() => setFaviconErro(true)} />
          )}
        </View>
        <View style={s.linkContent}>
          <Text style={s.linkTitle} numberOfLines={1}>{titulo || 'Link'}</Text>
          <Text style={s.linkDescription} numberOfLines={2}>{descricao || url || ''}</Text>
          <Text style={s.linkDomain} numberOfLines={1}>{dominio || ''}</Text>
        </View>
      </TouchableOpacity>
      {texto ? <Text style={s.captionText}>{texto}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  linkCard: {
    flexDirection: 'row', borderWidth: 1, borderColor: '#E4E6EB',
    borderRadius: 12, overflow: 'hidden', marginBottom: 12,
    backgroundColor: '#F7F8FA',
  },
  linkImage: {
    width: 100, height: '100%', minHeight: 100,
    backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center',
  },
  linkContent: { flex: 1, padding: 12, justifyContent: 'center' },
  linkTitle: { fontSize: 15, fontWeight: 'bold', color: '#1C1E21', marginBottom: 4 },
  linkDescription: { fontSize: 13, color: '#65676B', lineHeight: 18, marginBottom: 6 },
  linkDomain: { fontSize: 12, color: '#8D949E', textTransform: 'lowercase' },
  captionText: { fontSize: 15, color: '#050505', lineHeight: 22, marginBottom: 0 },
});
