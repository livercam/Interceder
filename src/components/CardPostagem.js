// CardPostagem — Casca Comum (Header + Miolo + Footer)
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
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

// ============================================================
// Badges Temporais Dinâmicos
// ============================================================
const getStatusEvento = (dataIso) => {
  if (!dataIso) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataEvento = new Date(dataIso);
  dataEvento.setHours(0, 0, 0, 0);

  if (dataEvento < hoje) return { texto: 'Evento Passado', cor: '#64748B', bg: '#F1F5F9' };
  if (dataEvento.getTime() === hoje.getTime()) return { texto: 'Dia do Evento', cor: '#059669', bg: '#D1FAE5' };
  return { texto: 'Próximo evento', cor: '#A53F36', bg: '#FEE2E2' };
};

// Modal personalizado para o menu de opções
function MenuOpcoesModal({ visivel, aoFechar, opcoes }) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={aoFechar}>
      <TouchableOpacity style={s.menuBackdrop} activeOpacity={1} onPress={aoFechar}>
        <View style={s.menuContainer}>
          <View style={s.menuContent}>
            {opcoes.map((opcao, index) => {
              const ehCancelar = opcao.texto === '✕ Cancelar';
              return (
                <TouchableOpacity
                  key={index}
                  style={s.menuItem}
                  onPress={() => { aoFechar(); opcao.aoPressionar?.(); }}
                  activeOpacity={0.6}
                >
                  <Text style={[s.menuItemText, opcao.destrutivo && s.menuItemDestrutivo, ehCancelar && s.menuItemCancelar]}>
                    {opcao.texto}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const MioloPostagem = ({ postagem, isFixado }) => {
  const { texto, tipo_postagem, anexo } = postagem;
  if (tipo_postagem === 'evento') return null;
  switch (tipo_postagem) {
    case 'imagem': return <FeedImagem imagemUrl={anexo?.uri || ''} texto={texto} />;
    case 'video':
      const videoTitulo = anexo?.dadosExtras?.titulo || '';
      const tituloLimpo = videoTitulo.replace(/ 🎬[A-Za-z0-9_-]{11}$/, '');
      return <FeedVideo videoUrl={anexo?.uri || ''} videoId={anexo?.dadosExtras?.video_id || ''} titulo={tituloLimpo} texto={texto} />;
    case 'audio':
      const audioTitulo = anexo?.dadosExtras?.tituloPersonalizado || anexo?.dadosExtras?.titulo || 'Áudio';
      return <FeedAudio audioUrl={anexo?.uri || ''} titulo={audioTitulo} texto={texto} />;
    case 'link': return <FeedLink url={anexo?.dadosExtras?.url || ''} titulo={anexo?.dadosExtras?.titulo || ''} descricao={anexo?.dadosExtras?.descricao || ''} imagemUrl={anexo?.dadosExtras?.imagemUrl || ''} texto={texto} />;
    case 'texto': return <FeedTexto texto={texto} />;
    default: return texto ? <FeedTexto texto={texto} /> : null;
  }
};

// Componente de Evento com capa, badges e contador de interesse
const CardEventoBanner = ({ postagem, isFixado, userId, onToggleInteresse }) => {
  const dados = postagem.anexo?.dadosExtras || {};
  const titulo = dados.titulo_evento || 'Evento';
  const dataTexto = dados.data_evento_texto || '';
  const hora = dados.hora_evento || '';
  const capaUrl = dados.capa_evento_url || '';
  const dataIso = dados.data_iso || '';
  const interessadosIds = dados.interessados_ids || [];
  const jaTemInteresse = userId && interessadosIds.includes(userId);
  const statusBadge = getStatusEvento(dataIso);

  return (
    <View>
      {/* Tag Fixada */}
      {isFixado && (
        <View style={s.fixadoTag}>
          <Ionicons name="pin" size={12} color="#A53F36" />
          <Text style={s.fixadoTagText}>FIXADO</Text>
        </View>
      )}

      {/* Capa do Evento */}
      {capaUrl ? (
        <View style={s.capaEventoWrapper}>
          <Image source={{ uri: capaUrl }} style={s.capaEventoImage} resizeMode="cover" />
          {statusBadge && (
            <View style={[s.statusBadgeOverlay, { backgroundColor: statusBadge.bg }]}>
              <Text style={[s.statusBadgeText, { color: statusBadge.cor }]}>{statusBadge.texto}</Text>
            </View>
          )}
        </View>
      ) : statusBadge ? (
        <View style={[s.statusBadgeInline, { backgroundColor: statusBadge.bg, alignSelf: 'flex-start', marginBottom: 8 }]}>
          <Text style={[s.statusBadgeText, { color: statusBadge.cor }]}>{statusBadge.texto}</Text>
        </View>
      ) : null}

      {/* Informações do Evento */}
      <View style={s.eventoContainer}>
        <View style={s.eventoLeft}>
          <Text style={s.eventoTitulo}>{titulo}</Text>
          {dataTexto ? (
            <View style={s.eventoInfoRow}>
              <Ionicons name="calendar-outline" size={14} color="#A53F36" />
              <Text style={s.eventoInfoText}>{dataTexto}</Text>
            </View>
          ) : null}
          {hora ? (
            <View style={s.eventoInfoRow}>
              <Ionicons name="time-outline" size={14} color="#A53F36" />
              <Text style={s.eventoInfoText}>{hora}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.eventoIconBox}>
          <Ionicons name="calendar" size={28} color="#A53F36" />
        </View>
      </View>

      {/* Botão de Interesse */}
      {onToggleInteresse && (
        <TouchableOpacity
          style={[s.interesseBtn, jaTemInteresse && s.interesseBtnAtivo]}
          onPress={() => onToggleInteresse(postagem.id)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={jaTemInteresse ? "star" : "star-outline"}
            size={18}
            color={jaTemInteresse ? "#FFF" : "#A53F36"}
          />
          <Text style={[s.interesseBtnText, jaTemInteresse && s.interesseBtnTextAtivo]}>
            {jaTemInteresse ? 'Tenho Interesse' : 'Tenho Interesse'}
          </Text>
          {interessadosIds.length > 0 && (
            <Text style={[s.interesseCount, jaTemInteresse && s.interesseCountAtivo]}>
              {interessadosIds.length}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function CardPostagem({ postagem, userId, isFixado, onFixar, onToggleInteresse, onPressPerfil, onLike, onComment, onShare, onEditar, onExcluir }) {
  const { autor_nome, autor_foto_url, autor_id, createdAt, tipo_postagem } = postagem;
  const ehAutor = userId && autor_id && userId === autor_id;
  const ehEvento = tipo_postagem === 'evento';

  const [menuVisivel, setMenuVisivel] = useState(false);
  const [opcoesMenu, setOpcoesMenu] = useState([]);

  const abrirMenu = () => {
    const ops = [];
    ops.push({ texto: `📌 ${isFixado ? 'Desfixar' : 'Fixar'}`, aoPressionar: () => onFixar?.(postagem.id) });
    if (ehAutor) {
      ops.push({ texto: '✏️ Editar', aoPressionar: () => onEditar?.(postagem) });
      ops.push({ texto: '🗑️ Excluir', destrutivo: true, aoPressionar: () => onExcluir?.(postagem) });
    }
    ops.push({ texto: '✕ Cancelar', aoPressionar: () => {} });
    setOpcoesMenu(ops);
    setMenuVisivel(true);
  };

  return (
    <View style={[s.cardContainer, ehEvento && s.cardContainerEvento]}>
      <MenuOpcoesModal visivel={menuVisivel} aoFechar={() => setMenuVisivel(false)} opcoes={opcoesMenu} />

      {ehEvento ? (
        <>
          <CardEventoBanner postagem={postagem} isFixado={isFixado} userId={userId} onToggleInteresse={onToggleInteresse} />
          <TouchableOpacity style={s.eventoKebab} onPress={abrirMenu} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          {isFixado && (
            <View style={s.fixadoTag}>
              <Ionicons name="pin" size={12} color="#A53F36" />
              <Text style={s.fixadoTagText}>FIXADO</Text>
            </View>
          )}
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
            <TouchableOpacity onPress={abrirMenu} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
            </TouchableOpacity>
          </View>
          <MioloPostagem postagem={postagem} isFixado={isFixado} />
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
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: { backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, position: 'relative' },
  cardContainerEvento: { paddingBottom: 12, paddingTop: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1C1E21' },
  postTime: { fontSize: 13, color: '#65676B', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#E4E6EB', paddingTop: 12, marginTop: 4 },
  actionButton: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 6 },
  actionText: { fontSize: 14, fontWeight: '600', color: '#65676B', marginLeft: 6 },

  // Tag Fixada
  fixadoTag: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  fixadoTagText: { color: '#A53F36', fontWeight: 'bold', fontSize: 12, marginLeft: 4 },

  // Capa do Evento
  capaEventoWrapper: { position: 'relative', marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  capaEventoImage: { width: '100%', height: 140, borderRadius: 12 },

  // Status Badge
  statusBadgeOverlay: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeInline: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  // Informações do Evento
  eventoContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventoLeft: { flex: 1, marginRight: 12 },
  eventoTitulo: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  eventoInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eventoInfoText: { color: '#64748B', fontSize: 14, marginLeft: 6 },
  eventoIconBox: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(165, 63, 54, 0.1)', justifyContent: 'center', alignItems: 'center' },
  eventoKebab: { position: 'absolute', top: 8, right: 8, zIndex: 10 },

  // Botão de Interesse
  interesseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, borderColor: '#A53F36', backgroundColor: '#FFF' },
  interesseBtnAtivo: { backgroundColor: '#A53F36', borderColor: '#A53F36' },
  interesseBtnText: { fontSize: 13, fontWeight: '600', color: '#A53F36', marginLeft: 6 },
  interesseBtnTextAtivo: { color: '#FFF' },
  interesseCount: { fontSize: 12, color: '#A53F36', fontWeight: '700', marginLeft: 4, backgroundColor: 'rgba(165,63,54,0.1)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  interesseCountAtivo: { color: '#FFF', backgroundColor: 'rgba(255,255,255,0.2)' },

  // Menu Modal
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContainer: { width: '80%', maxWidth: 320 },
  menuContent: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', flexDirection: 'column' },
  menuItem: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  menuItemText: { fontSize: 16, fontWeight: '600', color: '#1E293B' },
  menuItemDestrutivo: { color: '#EF4444' },
  menuItemCancelar: { color: '#64748B', fontWeight: '500' },
});