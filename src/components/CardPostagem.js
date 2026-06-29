// CardPostagem — Casca Comum (Header + Miolo + Footer)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { formatarNomeCurto } from '../utils/formatters';
import FeedImagem from './FeedImagem';
import FeedVideo from './FeedVideo';
import FeedAudio from './FeedAudio';
import FeedLink from './FeedLink';
import FeedTexto from './FeedTexto';

const getTempoRelativo = (ts) => {
  if (!ts) return 'agora';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const agora = new Date();
  const min = Math.floor((agora - d) / 60000);
  const h = Math.floor((agora - d) / 3600000);
  const dia = Math.floor((agora - d) / 86400000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  if (h < 24) return `${h}h`;
  if (dia < 30) return `${dia}d`;
  return d.toLocaleDateString('pt-BR');
};

const MioloPostagem = ({ postagem }) => {
  const { texto, tipo_postagem, anexo } = postagem;
  switch (tipo_postagem) {
    case 'imagem':
      return <FeedImagem imagemUrl={anexo?.uri || ''} texto={texto} />;
    case 'video':
      const videoTitulo = anexo?.dadosExtras?.titulo || '';
      const tituloLimpo = videoTitulo.replace(/ 🎬[A-Za-z0-9_-]{11}$/, '');
      return <FeedVideo videoUrl={anexo?.uri || ''} videoId={anexo?.dadosExtras?.video_id || ''} titulo={tituloLimpo} texto={texto} />;
    case 'audio':
      const audioTitulo = anexo?.dadosExtras?.tituloPersonalizado || anexo?.dadosExtras?.titulo || 'Áudio';
      return <FeedAudio audioUrl={anexo?.uri || ''} titulo={audioTitulo} texto={texto} />;
    case 'link':
      return <FeedLink url={anexo?.dadosExtras?.url || ''} titulo={anexo?.dadosExtras?.titulo || ''} descricao={anexo?.dadosExtras?.descricao || ''} imagemUrl={anexo?.dadosExtras?.imagemUrl || ''} texto={texto} />;
    case 'texto':
      return <FeedTexto texto={texto} />;
    default:
      return texto ? <FeedTexto texto={texto} /> : null;
  }
};

export default function CardPostagem({ postagem, userId, onPressPerfil, onLike, onComment, onShare, onEditar, onExcluir }) {
  const { autor_nome, autor_foto_url, autor_id, createdAt } = postagem;
  const ehAutor = userId && autor_id && userId === autor_id;

  const handleMenu = () => {
    if (!ehAutor) return;
    Alert.alert('Opções da postagem', null, [
      { text: '✏️ Editar', onPress: () => onEditar?.(postagem) },
      { text: '🗑️ Excluir', style: 'destructive', onPress: () => onExcluir?.(postagem) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View style={s.cardContainer}>
      <View style={s.cardHeader}>
        <TouchableOpacity style={s.userInfo} onPress={() => onPressPerfil?.(autor_id)} activeOpacity={0.7}>
          {autor_foto_url ? (
            <Image source={{ uri: autor_foto_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>{autor_nome?.charAt(0)?.toUpperCase() || '?'}</Text>
            </View>
          )}
          <View>
            <Text style={s.userName} numberOfLines={1}>{formatarNomeCurto(autor_nome || 'Usuário')}</Text>
            <Text style={s.postTime}>{getTempoRelativo(createdAt)}</Text>
          </View>
        </TouchableOpacity>
        {ehAutor && (
          <TouchableOpacity onPress={handleMenu} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
          </TouchableOpacity>
        )}
      </View>

      <MioloPostagem postagem={postagem} />

      <View style={s.cardFooter}>
        <TouchableOpacity style={s.actionButton} onPress={() => onLike?.(postagem)} activeOpacity={0.7}>
          <Ionicons name="heart-outline" size={20} color="#65676B" />
          <Text style={s.actionText}>Curtir</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionButton} onPress={() => onComment?.(postagem)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={20} color="#65676B" />
          <Text style={s.actionText}>Comentar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionButton} onPress={() => onShare?.(postagem)} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color="#65676B" />
          <Text style={s.actionText}>Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1C1E21' },
  postTime: { fontSize: 13, color: '#65676B', marginTop: 2 },
  captionText: { fontSize: 15, color: '#050505', lineHeight: 22, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#E4E6EB', paddingTop: 12, marginTop: 4 },
  actionButton: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 6 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#65676B', marginLeft: 6 },
});
