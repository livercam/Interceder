// Tela Células - Grupos de Comunhão com Mural de Conteúdos
// Funcionalidades:
// - Visão geral: "Minhas Células" ou "Células para Explorar"
// - Botão Criar (+) para líderes (titulo_ministerial !== 'membro')
// - Detalhes da célula com mural de conteúdos de ensino
// - Gerenciamento de membros e promoção a co-líder
// - Abertura de links externos via Linking (YouTube, Spotify, etc.)

import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Linking,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  listarCelulas,
  inscreverNaCelula,
  adicionarConteudoEnsino,
  editarConteudoEnsino,
  removerConteudoEnsino,
  promoverParaCoLider,
  sairDaCelula,
  apagarCelula,
  getUserProfile,
  buscarCelulaPorCodigoConvite,
  entrarPorCodigoConvite,
  fixarConteudoEnsino,
  toggleInteresseEvento,
} from '../services/firestoreService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import DenunciaModal from '../components/DenunciaModal';
import { AudioModule } from 'expo-audio';
import KebabMenu from '../components/KebabMenu';
import { uploadAsync } from 'expo-file-system/legacy';
import CardPostagem from '../components/CardPostagem';
import ModalCriacaoPostagem from '../components/ModalCriacaoPostagem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// Modal de Adicionar/Editar Conteúdo de Ensino
// ============================================================
function AdicionarConteudoModal({ visible, onClose, onAdicionar, modoEdicao, conteudoEditar }) {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [linkExterno, setLinkExterno] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Preencher campos quando estiver em modo de edição
  useEffect(() => {
    if (modoEdicao && conteudoEditar) {
      setTitulo(conteudoEditar.titulo || '');
      setMensagem(conteudoEditar.mensagem || '');
      setLinkExterno(conteudoEditar.link_externo || '');
    } else {
      setTitulo('');
      setMensagem('');
      setLinkExterno('');
      setAudioUrl('');
    }
  }, [modoEdicao, conteudoEditar, visible]);

  const handleSalvar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Preencha o título do estudo.');
      return;
    }

    setLoading(true);
    try {
      await onAdicionar(titulo.trim(), mensagem.trim(), linkExterno.trim(), audioUrl);
      setTitulo('');
      setMensagem('');
      setLinkExterno('');
      setAudioUrl('');
      onClose();
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitulo('');
    setMensagem('');
    setLinkExterno('');
    setAudioUrl('');
    onClose();
  };

  const ehEdicao = modoEdicao && conteudoEditar;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {ehEdicao ? '✏️ Editar Feed' : '📖 Novo Feed'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Título *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: O Poder da Oração"
                placeholderTextColor={COLORS.gray400}
                value={titulo}
                onChangeText={setTitulo}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mensagem / Resumo</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Escreva um resumo ou mensagem do estudo..."
                placeholderTextColor={COLORS.gray400}
                value={mensagem}
                onChangeText={setMensagem}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Link (YouTube, Spotify, etc.)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={COLORS.gray400}
                value={linkExterno}
                onChangeText={setLinkExterno}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Gravador de Áudio */}
            {!ehEdicao && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>🎤 Mensagem de Voz (opcional)</Text>
                <GravadorAudio
                  onAudioReady={(url) => setAudioUrl(url)}
                  onRemove={() => setAudioUrl('')}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.criarBtn, loading && styles.criarBtnDisabled]}
              onPress={handleSalvar}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.criarBtnText}>
                  {ehEdicao ? '💾 Salvar Alterações' : 'Publicar'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// Utilitário: classificar ícone por tipo de link
// ============================================================
const getIconePorLink = (link) => {
  if (!link) return '📖';
  const l = link.toLowerCase();
  // Extensões de imagem
  if (l.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/)) return '🖼️';
  if (l.includes('youtube.com') || l.includes('youtu.be')) return '🎥';
  if (l.includes('spotify.com') || l.includes('soundcloud') || l.includes('deezer')) return '🎧';
  if (l.includes('drive.google') || l.includes('.pdf') || l.includes('docs.')) return '📄';
  if (l.includes('instagram.com')) return '📱';
  // Firebase Storage: verifica extensão depois do domínio
  if (l.includes('firebasestorage.googleapis.com')) {
    if (l.match(/\.(jpg|jpeg|png|gif|webp|bmp)/)) return '🖼️';
    if (l.includes('audio/') || l.includes('.m4a') || l.includes('.mp3') || l.includes('.wav')) return '🎧';
    return '🔗';
  }
  return '🔗';
};

// ============================================================
// Tela de Detalhes da Célula (Redesign Moderno)
// ============================================================
function CelulaDetalhes({ celulaId, userUid, userTitulo, onVoltar }) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [celula, setCelula] = useState(null);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConteudoModal, setShowConteudoModal] = useState(false);
  const [editandoConteudo, setEditandoConteudo] = useState(null);
  const [modalMembrosVisible, setModalMembrosVisible] = useState(false);
  const [showDenunciaModal, setShowDenunciaModal] = useState(false);
  const [menuKebabVisivel, setMenuKebabVisivel] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('Posts');

  const isLider = celula?.lider_id === userUid;
  const isCoLider = celula?.co_lideres_ids?.includes(userUid);
  const podeGerenciar = isLider || isCoLider;

  const [audioTocando, setAudioTocando] = useState(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    return () => { if (audioPlayerRef.current) { audioPlayerRef.current.remove(); } };
  }, []);

  const handlePlayAudio = useCallback((id, url) => {
    if (audioTocando === id) {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      setAudioTocando(null);
    } else {
      if (audioPlayerRef.current) audioPlayerRef.current.remove();
      try {
        const p = new AudioModule.AudioPlayer({ uri: url }, 500, false, 0);
        audioPlayerRef.current = p;
        p.play();
        setAudioTocando(id);
      } catch(e) { console.warn(e.message); }
    }
  }, [audioTocando]);

  // Quantidade de solicitações pendentes para o badge
  const qtdSolicitacoes = celula?.solicitacoes_pendentes?.length || 0;

  // Escuta a célula em tempo real (onSnapshot)
  useEffect(() => {
    const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
    const unsubscribe = onSnapshot(celulaRef, (docSnap) => {
      if (docSnap.exists()) {
        setCelula({ id: docSnap.id, ...docSnap.data() });
      } else {
        setCelula(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [celulaId]);

  // Carregar dados dos membros (recarrega quando membros_ids mudar)
  useEffect(() => {
    if (!celula?.membros_ids) return;
    const carregarMembros = async () => {
      const membrosData = await Promise.all(
        celula.membros_ids.map(async (uid) => {
          const perfil = await getUserProfile(uid);
          return perfil ? { uid, ...perfil } : { uid, nome: 'Usuário' };
        })
      );
      setMembros(membrosData);
    };
    carregarMembros();
  }, [celula?.membros_ids]);

  const handlePostarFeed = useCallback(async (dadosPostagem) => {
    const { texto, tipo_postagem, anexo } = dadosPostagem;
    const textoLimpo = (texto || '').trim();

    // Tratamento especial para Evento com upload de capa
    if (tipo_postagem === 'evento' && anexo?.dadosExtras) {
      const { titulo_evento, data_evento_texto, data_iso, hora_evento, capa_evento_uri } = anexo.dadosExtras;
      const tituloEvento = titulo_evento || 'Evento';
      let capaEventoUrl = '';

      // Upload da imagem de capa se existir
      if (capa_evento_uri && capa_evento_uri !== 'p') {
        try {
          const token = await user.getIdToken();
          const nomeArquivo = `evento_capa_${Date.now()}.jpg`;
          const urlStorage = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o?name=eventos%2F${celulaId}%2F${nomeArquivo}`;
          await uploadAsync(urlStorage, capa_evento_uri, {
            httpMethod: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
          });
          capaEventoUrl = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/eventos%2F${celulaId}%2F${nomeArquivo}?alt=media`;
        } catch (uploadError) {
          console.warn('[Celulas] Erro ao fazer upload da capa do evento:', uploadError.message);
        }
      }

      const dadosEvento = JSON.stringify({
        titulo_evento: tituloEvento,
        data_evento_texto: data_evento_texto || '',
        data_iso: data_iso || '',
        hora_evento: hora_evento || '',
        capa_evento_url: capaEventoUrl,
        interessados_ids: [],
      });
      await adicionarConteudoEnsino(celulaId, `📅 ${tituloEvento}`, dadosEvento, '', userUid);
      setShowConteudoModal(false);
      return;
    }
    let titulo = textoLimpo.split('\n')[0]?.substring(0, 60) || '';
    let linkFinal = '';

    try {
      if (tipo_postagem === 'imagem' && anexo?.uri && anexo.uri !== 'p') {
        // Upload da imagem selecionada
        const token = await user.getIdToken();
        const nomeArquivo = `feed_${Date.now()}.jpg`;
        const urlStorage = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o?name=feed%2F${celulaId}%2F${nomeArquivo}`;
        await uploadAsync(urlStorage, anexo.uri, {
          httpMethod: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
        });
        linkFinal = `https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o/feed%2F${celulaId}%2F${nomeArquivo}?alt=media`;
        titulo = titulo || '📷 Foto';
      } else if (tipo_postagem === 'link' && anexo?.dadosExtras?.url) {
        linkFinal = anexo.dadosExtras.url;
        const tituloLink = anexo?.dadosExtras?.titulo || '';
        titulo = tituloLink || titulo || '🔗 Link';
      } else if (tipo_postagem === 'audio' && anexo?.uri) {
        linkFinal = anexo.uri;
        const tituloPersonalizado = anexo?.dadosExtras?.tituloPersonalizado || anexo?.dadosExtras?.titulo || '';
        titulo = tituloPersonalizado || titulo || '🎤 Áudio';
      } else if (tipo_postagem === 'video' && anexo?.dadosExtras?.video_id) {
        const vid = anexo.dadosExtras.video_id;
        const urlOriginal = anexo?.dadosExtras?.url || '';
        // Salva a URL original do YouTube como link_externo (para getIconePorLink detectar)
        linkFinal = urlOriginal || `https://youtu.be/${vid}`;
        titulo = (anexo?.dadosExtras?.titulo || titulo) ? `${anexo?.dadosExtras?.titulo || titulo} 🎬${vid}` : `🎬${vid}`;
      } else {
        titulo = titulo || 'Nova postagem';
      }

      await adicionarConteudoEnsino(celulaId, titulo, textoLimpo, linkFinal, userUid);
      setShowConteudoModal(false);
    } catch (error) {
      console.warn('[Celulas] Erro ao criar postagem feed:', error.message);
      Alert.alert('Erro', error.message || 'Não foi possível criar a postagem.');
    }
  }, [celulaId, userUid, user]);

  const handleAdicionarConteudo = async (titulo, mensagem, linkExterno, audioUrl) => {
    const linkFinal = audioUrl || linkExterno;

    if (editandoConteudo) {
      // Modo edição: chama editarConteudoEnsino
      await editarConteudoEnsino(celulaId, editandoConteudo, {
        titulo,
        mensagem,
        link_externo: linkFinal,
      });
      setEditandoConteudo(null);
    } else {
      // Modo criação: chama adicionarConteudoEnsino com autorUid para notificar membros
      await adicionarConteudoEnsino(celulaId, titulo, mensagem, linkFinal, userUid);
    }
    // onSnapshot atualizará automaticamente
  };

  const handleAbrirEdicao = (conteudo) => {
    setEditandoConteudo(conteudo);
    setShowConteudoModal(true);
  };

  const handleFecharModalConteudo = () => {
    setShowConteudoModal(false);
    setEditandoConteudo(null);
  };

  const handleAbrirLink = (url) => {
    if (!url) return;

    // Garantir que o link tenha protocolo https://
    let link = url.trim();
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      link = 'https://' + link;
    }

    Alert.alert(
      'Saindo do aplicativo',
      'Você está prestes a abrir um link externo. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            try {
              await Linking.openURL(link);
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível abrir o link. Verifique se o link é válido.');
            }
          },
        },
      ]
    );
  };

  const handlePromover = async (membroUid, membroNome) => {
    Alert.alert(
      'Promover a Co-Líder',
      `Deseja promover ${membroNome} a co-líder desta célula?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Promover',
          onPress: async () => {
            try {
              await promoverParaCoLider(celulaId, membroUid);
              Alert.alert('✅ Promovido!', `${membroNome} agora é co-líder.`);
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível promover.');
            }
          },
        },
      ]
    );
  };

  const handleApagarCelula = () => {
    Alert.alert(
      '🚨 Excluir Célula?',
      'Esta ação não pode ser desfeita e removerá todos os membros.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await apagarCelula(celulaId);
              Alert.alert('🗑️ Célula excluída', 'A célula foi removida com sucesso.');
              onVoltar();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir a célula.');
            }
          },
        },
      ]
    );
  };

  // Denunciar Feed da Célula (abre modal lateral)
  const handleDenunciarFeed = useCallback(() => {
    setShowDenunciaModal(true);
  }, []);

  const handleCompartilharConvite = async () => {
    const codigo = celula.codigo_convite || '---';
    const mensagem = `🙏 *Convite para Célula - ${celula.nome}*\n\n` +
      `📅 ${celula.dia_semana || 'A combinar'} | ⏰ ${celula.horario}\n` +
      `📍 ${celula.local || 'A combinar'}\n\n` +
      `Use o código: *${codigo}*\n\n` +
      `Baixe o app Interceder e entre na célula! 🙌`;

    try {
      await Share.share({
        message: mensagem,
        title: `Convite - ${celula.nome}`,
      });
    } catch (error) {
      // Utilizador cancelou o compartilhamento, ignorar
    }
  };

  const handleSair = () => {
    Alert.alert(
      'Sair da Célula',
      'Tem certeza que deseja sair desta célula?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await sairDaCelula(celulaId, userUid);
              onVoltar();
            } catch (error) {
              // Exibe a mensagem de erro da regra de negócio (ex: líder solitário)
              Alert.alert('⛔ Não foi possível sair', error.message);
            }
          },
        },
      ]
    );
  };

  // Handler para fixar/desfixar postagem (MUST be before early returns)
  const handleFixarPostagem = useCallback(async (postId) => {
    if (!celula) return;
    try {
      const novoFixado = celula?.post_fixado_id === postId ? '' : postId;
      await fixarConteudoEnsino(celulaId, novoFixado);
    } catch (error) {
      console.warn('[CelulaDetalhes] Erro ao fixar postagem:', error.message);
      Alert.alert('Erro', 'Não foi possível fixar a postagem.');
    }
  }, [celulaId, celula?.post_fixado_id]);

  // Handler para alternar interesse em evento
  const handleToggleInteresse = useCallback(async (postId) => {
    if (!user?.uid) return;
    try {
      await toggleInteresseEvento(celulaId, postId, user.uid);
    } catch (error) {
      console.warn('[CelulaDetalhes] Erro ao alternar interesse:', error.message);
    }
  }, [celulaId, user?.uid]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!celula) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyTitle}>Célula não encontrada</Text>
      </View>
    );
  }

  // Ordenar conteúdos do Feed: item fixado no topo, depois por data decrescente
  const conteudos = (celula.conteudos_ensino || []).sort((a, b) => {
    const aFixado = a.id === celula?.post_fixado_id;
    const bFixado = b.id === celula?.post_fixado_id;
    if (aFixado) return -1;
    if (bFixado) return 1;
    const dataA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
    const dataB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
    return dataB - dataA; // Decrescente: mais recente primeiro
  });

  // Separar eventos e posts para roteamento de abas
  const listaEventos = [];
  const listaPosts = [];
  conteudos.forEach((conteudo) => {
    let isEvento = false;
    try {
      const parsed = JSON.parse(conteudo.mensagem || '{}');
      if (parsed && parsed.titulo_evento !== undefined) isEvento = true;
    } catch (e) {}
    if (isEvento) listaEventos.push(conteudo);
    if (!isEvento || conteudo.id === celula?.post_fixado_id) listaPosts.push(conteudo);
  });

  // Dados do líder para o avatar
  const liderData = membros.find((m) => m.uid === celula?.lider_id);
  const nomeLider = liderData?.nome || user?.displayName || 'Líder';
  const fotoLider = liderData?.foto_url || liderData?.photoURL || user?.photoURL || null;

  // URL da capa com fallback para múltiplos nomes de campo
  const capaUrl = celula.capa_url || celula.urlCapaFinal || celula.imagem_url || celula.url_capa || null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
      {/* ============================================ */}
      {/* HERO SECTION - Capa + Header Sobreposto */}
      {/* ============================================ */}
      <View style={styles.capaWrapper}>
        {/* Renderização defensiva: só exibe Image se capa_url for uma string válida */}
        {(celula?.capa_url && typeof celula.capa_url === 'string' && celula.capa_url.trim() !== '') ? (
          <Image
            source={{ uri: celula.capa_url }}
            style={[styles.capaImage, { backgroundColor: '#ccc' }]}
            resizeMode="cover"
            onError={(e) => console.log('[CelulaDetalhes] Erro ao carregar capa:', e.nativeEvent.error)}
          />
        ) : (
          <View style={[styles.capaPlaceholder, { backgroundColor: '#E2E8F0' }]} />
        )}

        {/* Header Sobreposto na Capa */}
        <View style={[styles.capaHeaderOverlay, { top: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={onVoltar}
            style={styles.capaHeaderBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <KebabMenu
            visivel={menuKebabVisivel}
            aoFechar={() => setMenuKebabVisivel(false)}
            opcoes={(() => {
              const ops = [];
              if (podeGerenciar) {
                ops.push({
                  texto: qtdSolicitacoes > 0 ? `📋 Solicitações (${qtdSolicitacoes})` : '📋 Solicitações',
                  aoPressionar: () => navigation.navigate('GerenciarSolicitacoes', { celulaId: celula?.id }),
                });
                ops.push({
                  texto: '✏️ Editar Célula',
                  aoPressionar: () => navigation.navigate('EditarCelula', { celulaId: celula?.id }),
                });
              }
              if (!podeGerenciar) {
                ops.push({
                  texto: '🚩 Denunciar Célula',
                  aoPressionar: handleDenunciarFeed,
                });
              }
              ops.push({ texto: '🚪 Sair da Célula', destrutivo: true, aoPressionar: handleSair });
              if (isLider) {
                ops.push({ texto: '🗑️ Excluir Célula', destrutivo: true, aoPressionar: handleApagarCelula });
              }
              return ops;
            })()}
            badge={podeGerenciar ? qtdSolicitacoes : 0}
          >
            <TouchableOpacity
              onPress={() => setMenuKebabVisivel(true)}
              style={styles.capaHeaderBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </KebabMenu>
        </View>
      </View>

      {/* ============================================ */}
      {/* PERFIL - Avatar, Título e Info (Sobrepondo Capa) */}
      {/* ============================================ */}
      <View style={styles.perfilContainer}>
        {/* Avatar Circular */}
        <View style={styles.avatarWrapper}>
          {fotoLider ? (
            <Image source={{ uri: fotoLider }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {nomeLider?.charAt(0)?.toUpperCase() || '👤'}
              </Text>
            </View>
          )}
        </View>

        {/* Bloco de Título e Botão Compartilhar */}
        <View style={styles.tituloRow}>
          <View style={styles.tituloInfo}>
            <Text style={styles.celulaTitulo}>{celula.nome}</Text>
            <Text style={styles.celulaSubtitle}>
              {celula.membros_ids?.length || 0} membros
              {celula.dia_semana || celula.horario
                ? ` • Encontros: ${celula.dia_semana || ''}${celula.dia_semana && celula.horario ? ' às ' : ''}${celula.horario || ''}`
                : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.compartilharBtn} onPress={handleCompartilharConvite} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={16} color="#A53F36" />
            <Text style={styles.compartilharBtnText}>Compartilhar</Text>
          </TouchableOpacity>
        </View>

        {/* Descrição */}
        {celula.descricao ? (
          <Text style={styles.celulaDescricao}>{celula.descricao}</Text>
        ) : null}
      </View>

      {/* ============================================ */}
      {/* NAVEGAÇÃO EM ABAS (Tabs Locais) */}
      {/* ============================================ */}
      <View style={styles.abasContainer}>
        {['Posts', 'Membros', 'Eventos', 'Pedidos'].map((aba) => (
          <TouchableOpacity
            key={aba}
            style={[styles.abaItem, abaAtiva === aba && styles.abaItemAtiva]}
            onPress={() => setAbaAtiva(aba)}
            activeOpacity={0.7}
          >
            <Text style={[styles.abaText, abaAtiva === aba && styles.abaTextAtiva]}>
              {aba === 'Posts' ? 'Posts' : aba}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ============================================ */}
      {/* ÁREA DE CONTEÚDO CONDICIONAL */}
      {/* ============================================ */}
      <View style={styles.conteudoArea}>
        {abaAtiva === 'Posts' && (
          <View style={styles.postsSection}>
            {listaPosts.length > 0 ? (
              listaPosts.map((conteudo) => {
                const linkExterno = conteudo.link_externo || '';
                const icone = linkExterno ? getIconePorLink(linkExterno) : '📝';
                const tipoIcone = icone === '📝' ? 'texto' : icone === '🖼️' ? 'imagem' : icone === '🎥' ? 'video' : icone === '🎧' ? 'audio' : 'link';
                const textoPostagem = conteudo.mensagem || '';
                const tituloPost = conteudo.titulo || '';
                let videoId = '';
                if (tipoIcone === 'video') {
                  const m = tituloPost.match(/🎬([A-Za-z0-9_-]{11})/);
                  videoId = m ? m[1] : '';
                }
                // Detectar se é um evento (mensagem contém JSON com dados de evento)
                let isEvento = false;
                let dadosEvento = null;
                try {
                  const parsed = JSON.parse(textoPostagem);
                  if (parsed && parsed.titulo_evento !== undefined) {
                    isEvento = true;
                    dadosEvento = parsed;
                  }
                } catch (e) { /* não é JSON, ignorar */ }

                const postagemAdaptada = {
                  id: conteudo.id,
                  autor_nome: user?.displayName || 'Líder',
                  autor_foto_url: user?.photoURL || null,
                  autor_id: user?.uid || '',
                  createdAt: conteudo.criadoEm ? new Date(conteudo.criadoEm).toISOString() : new Date(),
                  texto: textoPostagem,
                  tipo_postagem: isEvento ? 'evento' : tipoIcone,
                  anexo: isEvento
                    ? { tipo: 'evento', dadosExtras: { titulo_evento: dadosEvento?.titulo_evento, data_evento_texto: dadosEvento?.data_evento_texto || dadosEvento?.data_evento, data_iso: dadosEvento?.data_iso || '', hora_evento: dadosEvento?.hora_evento, capa_evento_url: dadosEvento?.capa_evento_url || '', interessados_ids: dadosEvento?.interessados_ids || [] } }
                    : tipoIcone !== 'texto' && linkExterno ? { tipo: tipoIcone, uri: linkExterno, dadosExtras: { url: linkExterno, video_id: videoId, titulo: tituloPost, descricao: textoPostagem } } : null,
                };
                return (
                  <CardPostagem
                    key={conteudo.id}
                    postagem={postagemAdaptada}
                    userId={user?.uid}
                    isFixado={conteudo.id === celula?.post_fixado_id}
                    onFixar={() => handleFixarPostagem(conteudo.id)}
                    onToggleInteresse={isEvento ? () => handleToggleInteresse(conteudo.id) : undefined}
                    onPressPerfil={() => {}}
                    onLike={() => {}}
                    onComment={() => {}}
                    onShare={() => {}}
                    onEditar={() => handleAbrirEdicao(conteudo)}
                    onExcluir={async () => {
                      Alert.alert('Excluir postagem', 'Tem certeza?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Excluir', style: 'destructive', onPress: async () => {
                          try { await removerConteudoEnsino(celulaId, conteudo); }
                          catch (error) { Alert.alert('Erro', 'Não foi possível excluir.'); }
                        }},
                      ]);
                    }}
                  />
                );
              })
            ) : (
              <View style={styles.semConteudo}>
                <Text style={styles.semConteudoEmoji}>📚</Text>
                <Text style={styles.semConteudoText}>Nenhum conteúdo publicado ainda.</Text>
                {podeGerenciar && (
                  <Text style={styles.semConteudoHint}>Toque em "Novo" para publicar o primeiro conteúdo.</Text>
                )}
              </View>
            )}
          </View>
        )}

        {abaAtiva === 'Membros' && (
          <View style={styles.membrosSection}>
            <Text style={styles.membrosSectionTitle}>👥 Membros ({membros.length})</Text>
            {membros.map((membro) => {
              const ehLider = membro.uid === celula.lider_id;
              const ehCoLider = celula.co_lideres_ids?.includes(membro.uid);
              const podePromover = isLider && !ehLider && !ehCoLider;
              const fotoMembro = membro.foto_url || membro.photoURL || null;
              return (
                <View key={membro.uid} style={styles.membroCardModerno}>
                  <View style={styles.membroAvatarModerno}>
                    {fotoMembro ? (
                      <Image source={{ uri: fotoMembro }} style={styles.membroAvatarImage} />
                    ) : (
                      <Text style={styles.membroAvatarText}>{membro.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
                    )}
                  </View>
                  <View style={styles.membroInfoModerno}>
                    <Text style={styles.membroNomeModerno}>{membro.nome}</Text>
                    <Text style={styles.membroTituloModerno}>
                      {ehLider ? '👑 Líder' : ehCoLider ? '⭐ Co-Líder' : membro.titulo_ministerial || 'Membro'}
                    </Text>
                  </View>
                  {podePromover && (
                    <TouchableOpacity style={styles.promoverBtnModerno} onPress={() => handlePromover(membro.uid, membro.nome)}>
                      <Text style={styles.promoverBtnText}>⭐</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {abaAtiva === 'Eventos' && (
          <View style={styles.postsSection}>
            {listaEventos.length > 0 ? (
              listaEventos.map((conteudo) => {
                const textoPostagem = conteudo.mensagem || '';
                let dadosEvento = null;
                try {
                  const parsed = JSON.parse(textoPostagem);
                  if (parsed && parsed.titulo_evento !== undefined) dadosEvento = parsed;
                } catch (e) {}

                const postagemAdaptada = {
                  id: conteudo.id,
                  autor_nome: user?.displayName || 'Líder',
                  autor_foto_url: user?.photoURL || null,
                  autor_id: user?.uid || '',
                  createdAt: conteudo.criadoEm ? new Date(conteudo.criadoEm).toISOString() : new Date(),
                  texto: textoPostagem,
                  tipo_postagem: 'evento',
                  anexo: { tipo: 'evento', dadosExtras: { titulo_evento: dadosEvento?.titulo_evento, data_evento_texto: dadosEvento?.data_evento_texto || dadosEvento?.data_evento, data_iso: dadosEvento?.data_iso || '', hora_evento: dadosEvento?.hora_evento, capa_evento_url: dadosEvento?.capa_evento_url || '', interessados_ids: dadosEvento?.interessados_ids || [] } },
                };
                return (
                  <CardPostagem
                    key={conteudo.id}
                    postagem={postagemAdaptada}
                    userId={user?.uid}
                    isFixado={conteudo.id === celula?.post_fixado_id}
                    onFixar={() => handleFixarPostagem(conteudo.id)}
                    onToggleInteresse={() => handleToggleInteresse(conteudo.id)}
                    onPressPerfil={() => {}}
                    onLike={() => {}}
                    onComment={() => {}}
                    onShare={() => {}}
                    onEditar={() => handleAbrirEdicao(conteudo)}
                    onExcluir={async () => {
                      Alert.alert('Excluir evento', 'Tem certeza?', [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Excluir', style: 'destructive', onPress: async () => {
                          try { await removerConteudoEnsino(celulaId, conteudo); }
                          catch (error) { Alert.alert('Erro', 'Não foi possível excluir.'); }
                        }},
                      ]);
                    }}
                  />
                );
              })
            ) : (
              <View style={styles.eventosEmpty}>
                <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
                <Text style={styles.eventosEmptyText}>Nenhum evento</Text>
                <Text style={styles.eventosEmptySubtext}>Os eventos da célula aparecerão aqui.</Text>
              </View>
            )}
          </View>
        )}

        {abaAtiva === 'Pedidos' && (
          <TouchableOpacity
            style={styles.muralOracaoBtn}
            onPress={() =>
              navigation.navigate('MuralCelula', {
                celulaId: celula.id,
                celulaNome: celula.nome,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.muralOracaoBtnIcon}>🙏</Text>
            <View style={styles.muralOracaoBtnInfo}>
              <Text style={styles.muralOracaoBtnTitle}>Mural de Oração da Célula</Text>
              <Text style={styles.muralOracaoBtnSubtitle}>
                Veja os pedidos de oração compartilhados com esta célula
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#A53F36" />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: SPACING.xl }} />

      {/* ============================================ */}
      {/* MODAIS */}
      {/* ============================================ */}

      {/* Modal de Criação de Postagem (Novo Feed) */}
      <ModalCriacaoPostagem
        visible={showConteudoModal && !editandoConteudo}
        onFechar={handleFecharModalConteudo}
        onPostar={handlePostarFeed}
      />

      {/* Modal de Edição de Conteúdo (legado) */}
      {editandoConteudo && (
        <AdicionarConteudoModal
          visible={showConteudoModal}
          onClose={handleFecharModalConteudo}
          onAdicionar={handleAdicionarConteudo}
          modoEdicao={true}
          conteudoEditar={editandoConteudo}
        />
      )}

      {/* Modal de Denúncia (Lateral Animado) */}
      <DenunciaModal
        visible={showDenunciaModal}
        onClose={() => setShowDenunciaModal(false)}
        itemId={celulaId}
        itemTipo="celula"
      />
    </ScrollView>

      {/* FAB Fixo de Criação de Postagem/Evento */}
      {podeGerenciar && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowConteudoModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Tela Principal de Células
// ============================================================
export default function CelulasScreen() {
  const navigation = useNavigation();
  const [celulas, setCelulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celulaDetalhesId, setCelulaDetalhesId] = useState(null);
  const [pesquisa, setPesquisa] = useState('');
  const [showConviteModal, setShowConviteModal] = useState(false);
  const [codigoConvite, setCodigoConvite] = useState('');
  const [entrandoConvite, setEntrandoConvite] = useState(false);
  const [solicitacoesEnviadas, setSolicitacoesEnviadas] = useState([]);
  const unsubscribeRef = useRef(null);

  // Estado reativo global via AuthContext
  const { user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();

  // Animação do FAB
  const fabAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;

    // Escutar células em tempo real
    unsubscribeRef.current = listarCelulas((celulasAtualizadas) => {
      setCelulas(celulasAtualizadas);
      setLoading(false);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user]);

  // Animação suave do FAB — visível apenas para quem é reconhecido
  // (5+ endossos OU verificado_lideranca === true)
  useEffect(() => {
    const isReconhecido =
      (userProfile?.endossos_uids?.length || 0) >= 5 || userProfile?.verificado_lideranca === true;

    if (isReconhecido) {
      Animated.spring(fabAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(fabAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [userProfile?.endossos_uids, userProfile?.verificado_lideranca, fabAnim]);

  // Filtro de pesquisa (por nome, dia da semana, local ou descrição)
  const termoPesquisa = pesquisa.trim().toLowerCase();
  const pesquisaAtiva = termoPesquisa.length > 0;
  const celulasFiltradas = useMemo(() => {
    if (!termoPesquisa) return celulas;
    return celulas.filter((c) =>
      c.nome?.toLowerCase().includes(termoPesquisa) ||
      c.dia_semana?.toLowerCase().includes(termoPesquisa) ||
      c.local?.toLowerCase().includes(termoPesquisa) ||
      c.descricao?.toLowerCase().includes(termoPesquisa)
    );
  }, [celulas, termoPesquisa]);

  const userCelulasIds = userProfile?.celulas_inscritas || [];
  const minhasCelulas = celulasFiltradas.filter((c) => userCelulasIds.includes(c.id));
  const celulasParaExplorar = celulasFiltradas.filter((c) => !userCelulasIds.includes(c.id));

  const podeCriar = (userProfile?.endossos_uids?.length || 0) >= 5 || userProfile?.verificado_lideranca === true;

  const handleInscrever = async (celulaId) => {
    try {
      // A função inscreverNaCelula já trata a lógica de célula pública vs fechada
      // Precisamos saber o tipo para dar o feedback correto
      const celula = celulas.find((c) => c.id === celulaId);
      const tipo = celula?.tipo || 'publica';

      await inscreverNaCelula(celulaId, user.uid);

      if (tipo === 'fechada') {
        // Estado instantâneo: oculta o botão e mostra "Pedido enviado" imediatamente
        setSolicitacoesEnviadas((prev) => [...prev, celulaId]);
        Alert.alert('✅ Solicitação enviada!', 'Aguarde a aprovação do líder.');
      } else {
        Alert.alert('✅ Inscrito!', 'Você agora faz parte desta célula.');
      }
    } catch (error) {
      // A função inscreverNaCelula já lança mensagens específicas
      Alert.alert('Atenção', error.message || 'Não foi possível se inscrever.');
    }
  };

  const handleEntrarComConvite = async () => {
    const codigo = codigoConvite.trim().toUpperCase();
    if (!codigo) {
      Alert.alert('Atenção', 'Digite o código de convite.');
      return;
    }

    setEntrandoConvite(true);
    try {
      const celula = await buscarCelulaPorCodigoConvite(codigo);
      if (!celula) {
        Alert.alert('Convite inválido', 'Código não encontrado. Verifique e tente novamente.');
        return;
      }

      // Verificar se o usuário já está na célula
      const userCelulasIds = userProfile?.celulas_inscritas || [];
      if (userCelulasIds.includes(celula.id)) {
        Alert.alert('Você já está nesta célula!', 'Você já faz parte desta célula.');
        setShowConviteModal(false);
        setCodigoConvite('');
        return;
      }

      await entrarPorCodigoConvite(celula.id, user.uid);
      Alert.alert('✅ Bem-vindo!', `Você entrou na célula "${celula.nome}".`);
      setShowConviteModal(false);
      setCodigoConvite('');
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível entrar na célula.');
    } finally {
      setEntrandoConvite(false);
    }
  };

  // Se está vendo detalhes de uma célula
  if (celulaDetalhesId) {
    return (
      <CelulaDetalhes
        celulaId={celulaDetalhesId}
        userUid={user?.uid}
        userTitulo={userProfile?.titulo_ministerial}
        onVoltar={() => setCelulaDetalhesId(null)}
      />
    );
  }

  // Loading
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando células...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ============================================ */}
        {/* BARRA DE PESQUISA */}
        {/* ============================================ */}
        <View style={styles.pesquisaContainer}>
          <Text style={styles.pesquisaIcon}>🔍</Text>
          <TextInput
            style={styles.pesquisaInput}
            placeholder="Pesquisar células por nome, dia, local..."
            placeholderTextColor={COLORS.gray400}
            value={pesquisa}
            onChangeText={setPesquisa}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {pesquisa.length > 0 && (
            <TouchableOpacity
              style={styles.pesquisaLimpar}
              onPress={() => setPesquisa('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.pesquisaLimparText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ============================================ */}
        {/* BOTÃO TENHO UM CONVITE — escondido durante a pesquisa */}
        {/* ============================================ */}
        {!pesquisaAtiva && (
          <TouchableOpacity
            style={styles.conviteEntradaBtn}
            onPress={() => setShowConviteModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.conviteEntradaBtnIcon}>🎫</Text>
            <View style={styles.conviteEntradaBtnInfo}>
              <Text style={styles.conviteEntradaBtnTitle}>Tenho um Convite</Text>
              <Text style={styles.conviteEntradaBtnSubtitle}>
                Insira o código recebido para entrar numa célula
              </Text>
            </View>
            <Text style={styles.conviteEntradaBtnArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ============================================ */}
        {/* MINHAS CÉLULAS — escondido durante a pesquisa */}
        {/* ============================================ */}
        {!pesquisaAtiva && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📌 Minhas Células</Text>
          {minhasCelulas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>
                Você ainda não está em nenhuma célula.
              </Text>
              <Text style={styles.emptyHint}>
                Explore as células disponíveis abaixo e inscreva-se!
              </Text>
            </View>
          ) : (
            minhasCelulas.map((celula) => (
              <TouchableOpacity
                key={celula.id}
                style={styles.celulaCard}
                onPress={() => setCelulaDetalhesId(celula.id)}
                activeOpacity={0.7}
              >
                <View style={styles.celulaCardHeader}>
                  <Text style={styles.celulaNome}>{celula.nome}</Text>
                  <View style={styles.celulaTagsRow}>
                    {celula.tipo === 'fechada' ? (
                      <View style={styles.privacidadeTagFechada}>
                        <Text style={styles.privacidadeTagFechadaText}>🔒 Fechada</Text>
                      </View>
                    ) : (
                      <View style={styles.privacidadeTagPublica}>
                        <Text style={styles.privacidadeTagPublicaText}>🌐 Pública</Text>
                      </View>
                    )}
                    {celula.destaque_tipo &&
                      ['top1', 'top2', 'top3'].includes(celula.destaque_tipo) && (
                        <View style={styles.destaqueTag}>
                          <Text style={styles.destaqueTagText}>
                            {celula.destaque_tipo === 'top1' ? '👑 Top 1' :
                             celula.destaque_tipo === 'top2' ? '🥈 Top 2' :
                             '🥉 Top 3'}
                          </Text>
                        </View>
                      )}
                    {celula.lider_id === user?.uid && (
                      <View style={styles.liderTag}>
                        <Text style={styles.liderTagText}>👑 Líder</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.celulaHorario}>⏰ {celula.horario}</Text>
                {celula.dia_semana ? (
                  <Text style={styles.celulaDia}>📅 {celula.dia_semana}</Text>
                ) : null}
                <View style={styles.celulaFooter}>
                  <Text style={styles.celulaMembros}>
                    👥 {celula.membros_ids?.length || 0} membros
                  </Text>
                  <Text style={styles.celulaVerMais}>Ver detalhes →</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          </View>
        )}

        {/* ============================================ */}
        {/* CÉLULAS PARA EXPLORAR — sempre visível (com filtro se pesquisa ativa) */}
        {/* ============================================ */}
        {celulasParaExplorar.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {pesquisaAtiva ? '🔍 Resultados da Pesquisa' : '🔍 Células para Explorar'}
            </Text>
            {celulasParaExplorar.map((celula) => (
              <View key={celula.id} style={styles.celulaCard}>
                <View style={styles.celulaCardHeader}>
                  <Text style={styles.celulaNome}>{celula.nome}</Text>
                  <View style={styles.celulaTagsRow}>
                    {celula.tipo === 'fechada' ? (
                      <View style={styles.privacidadeTagFechada}>
                        <Text style={styles.privacidadeTagFechadaText}>🔒 Fechada</Text>
                      </View>
                    ) : (
                      <View style={styles.privacidadeTagPublica}>
                        <Text style={styles.privacidadeTagPublicaText}>🌐 Pública</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.celulaHorario}>⏰ {celula.horario}</Text>
                {celula.dia_semana ? (
                  <Text style={styles.celulaDia}>📅 {celula.dia_semana}</Text>
                ) : null}
                {celula.descricao ? (
                  <Text style={styles.celulaDescricao} numberOfLines={2}>
                    {celula.descricao}
                  </Text>
                ) : null}
                  <View style={styles.celulaFooter}>
                    <Text style={styles.celulaMembros}>
                      👥 {celula.membros_ids?.length || 0} membros
                    </Text>
                    {celula.tipo === 'fechada' && solicitacoesEnviadas.includes(celula.id) ? (
                      <View style={styles.pedidoEnviadoBadge}>
                        <Text style={styles.pedidoEnviadoText}>✅ Pedido enviado</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.inscreverBtn}
                        onPress={() => handleInscrever(celula.id)}
                      >
                        <Text style={styles.inscreverBtnText}>Inscrever-se</Text>
                      </TouchableOpacity>
                    )}
                  </View>
              </View>
            ))}
          </View>
        )}

        {/* Mensagem se não há células */}
        {celulas.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>Nenhuma célula ainda</Text>
            <Text style={styles.emptySubtitle}>
              {podeCriar
                ? 'Seja o primeiro a criar uma célula!'
                : 'Em breve novas células serão abertas.'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Botão Criar Célula (apenas para líderes) com animação suave */}
      {podeCriar && (
        <Animated.View
          style={[
            styles.fabContainer,
            {
              opacity: fabAnim,
              transform: [
                {
                  scale: fabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CriarCelula')}
            activeOpacity={0.8}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ============================================ */}
      {/* MODAL DE CONVITE */}
      {/* ============================================ */}
      <Modal
        visible={showConviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowConviteModal(false);
          setCodigoConvite('');
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎫 Entrar com Convite</Text>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    setShowConviteModal(false);
                    setCodigoConvite('');
                  }}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Código de Convite</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: CEL-A3F8K2"
                  placeholderTextColor={COLORS.gray400}
                  value={codigoConvite}
                  onChangeText={(text) => setCodigoConvite(text.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!entrandoConvite}
                />
              </View>

              <TouchableOpacity
                style={[styles.criarBtn, entrandoConvite && styles.criarBtnDisabled]}
                onPress={handleEntrarComConvite}
                disabled={entrandoConvite}
                activeOpacity={0.8}
              >
                {entrandoConvite ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.criarBtnText}>Entrar na Célula</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray500,
    fontSize: FONTS.sizes.md,
  },

  // Barra de Pesquisa
  pesquisaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.sm,
  },
  pesquisaIcon: {
    fontSize: 16,
    marginRight: SPACING.sm,
  },
  pesquisaInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
  },
  pesquisaLimpar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pesquisaLimparText: {
    fontSize: 12,
    color: COLORS.gray500,
    fontWeight: 'bold',
  },

  // Botão "Tenho um Convite"
  conviteEntradaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.secondary + '40',
    borderStyle: 'dashed',
    ...SHADOWS.sm,
  },
  conviteEntradaBtnIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  conviteEntradaBtnInfo: {
    flex: 1,
  },
  conviteEntradaBtnTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: 2,
  },
  conviteEntradaBtnSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    lineHeight: 16,
  },
  conviteEntradaBtnArrow: {
    fontSize: 20,
    color: COLORS.gray400,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },

  // Seções
  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },

  // Card de Célula
  celulaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  celulaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  celulaTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  celulaNome: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    flex: 1,
  },
  privacidadeTagPublica: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  privacidadeTagPublicaText: {
    fontSize: FONTS.sizes.xs,
    color: '#1565C0',
    fontWeight: '600',
  },
  privacidadeTagFechada: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  privacidadeTagFechadaText: {
    fontSize: FONTS.sizes.xs,
    color: '#E65100',
    fontWeight: '600',
  },
  destaqueTag: {
    backgroundColor: COLORS.secondary + '25',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  destaqueTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.secondary,
    fontWeight: '700',
  },
  liderTag: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  liderTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.accent,
    fontWeight: '600',
  },
  celulaHorario: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    marginBottom: 2,
  },
  celulaDia: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    marginBottom: 2,
  },
  celulaDescricao: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  celulaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    paddingTop: SPACING.sm,
  },
  celulaMembros: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  celulaVerMais: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  inscreverBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  inscreverBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  // Badge "Pedido enviado"
  pedidoEnviadoBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  pedidoEnviadoText: {
    color: '#2E7D32',
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },

  // Card vazio
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    textAlign: 'center',
  },

  // Estado vazio geral
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
  },

  // ============================================================
  // DETALHES - Design Moderno (CelulaDetalhes)
  // ============================================================

  // Hero Section
  capaWrapper: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  capaImage: {
    width: '100%',
    height: 220,
  },
  capaPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#E2E8F0',
  },
  capaHeaderOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  capaHeaderBtn: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Perfil Container (sobrepõe a capa)
  perfilContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    marginTop: -45,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#64748B',
  },

  // Título
  tituloRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  tituloInfo: {
    flex: 1,
    marginRight: 12,
  },
  celulaTitulo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  celulaSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 20,
  },
  compartilharBtn: {
    borderWidth: 1.5,
    borderColor: '#A53F36',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compartilharBtnText: {
    color: '#A53F36',
    fontWeight: '600',
    fontSize: 13,
  },
  celulaDescricao: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginTop: 16,
  },

  // Abas (Tabs)
  abasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  abaItem: {
    paddingBottom: 12,
  },
  abaItemAtiva: {
    borderBottomWidth: 3,
    borderBottomColor: '#A53F36',
  },
  abaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  abaTextAtiva: {
    color: '#A53F36',
    fontWeight: 'bold',
  },

  // Área de Conteúdo
  conteudoArea: {
    backgroundColor: '#FAF5F0',
    minHeight: 200,
    paddingHorizontal: 0,
    paddingTop: 12,
  },

  // Posts
  postsSection: {
    backgroundColor: '#FAF5F0',
    paddingHorizontal: 16,
  },
  postsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postsHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  novoPostBtn: {
    backgroundColor: '#A53F36',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  novoPostBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  denunciaBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  denunciaBtnText: {
    fontSize: 15,
  },
  semConteudo: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  semConteudoEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  semConteudoText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  semConteudoHint: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },

  // Membros (dentro dos detalhes)
  membrosSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  membrosSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  membroCardModerno: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  membroAvatarModerno: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#A53F36',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  membroAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  membroInfoModerno: {
    flex: 1,
  },
  membroNomeModerno: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  membroTituloModerno: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  promoverBtnModerno: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Eventos (placeholder)
  eventosEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  eventosEmptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 12,
  },
  eventosEmptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },

  // Mural de Oração (na aba Pedidos)
  muralOracaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A53F36' + '12',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#A53F36' + '30',
  },
  muralOracaoBtnIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  muralOracaoBtnInfo: {
    flex: 1,
  },
  muralOracaoBtnTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#A53F36',
    marginBottom: 2,
  },
  muralOracaoBtnSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // FAB Container (animado)
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  fabText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
    marginTop: -2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: COLORS.gray500,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
  },
  textArea: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 80,
  },
  criarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  criarBtnDisabled: {
    opacity: 0.7,
  },
  criarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },

  // Detalhes da Célula
  detalhesHeader: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  voltarBtn: {
    marginBottom: SPACING.sm,
  },
  voltarText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  detalhesNomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  detalhesNome: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    flex: 1,
  },
  detalhesAcoesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conviteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  conviteBtnText: {
    fontSize: 18,
  },
  membrosHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  membrosHeaderBtnText: {
    fontSize: 18,
  },
  detalhesInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  detalhesInfoText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  detalhesDescricao: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray600,
    lineHeight: 22,
  },

  // Ensino - Mural de Conteúdos (largura total)
  ensinoSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: 0,
    borderRadius: 0,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  ensinoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ensinoTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  ensinoHeaderAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  denunciarFeedBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.danger + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  denunciarFeedBtnText: {
    fontSize: 16,
  },
  atualizarEnsinoBtn: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  atualizarEnsinoBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Feed de Conteúdo (largura total)
  feedCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: 0,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    ...SHADOWS.sm,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  feedCardIconArea: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.gray50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  feedCardIcon: {
    fontSize: 22,
  },
  feedCardTituloArea: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  feedCardTitulo: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: COLORS.gray800,
    lineHeight: 22,
  },
  feedCardAcoes: {
    flexDirection: 'row',
    gap: 4,
  },
  feedCardBtnAcao: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedCardBtnAcaoText: {
    fontSize: 13,
  },
  feedCardMensagemArea: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray50,
    borderRadius: 0,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary + '40',
  },
  feedCardMensagemIcon: {
    fontSize: 14,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  feedCardMensagem: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 20,
  },
  feedCardBtnPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    paddingVertical: 12,
    gap: 8,
    marginBottom: SPACING.sm,
  },
  feedCardBtnPrincipalIcon: {
    fontSize: 16,
  },
  feedCardBtnPrincipalText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',

  audioPlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    gap: 10,
  },
  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioInfoArea: {
    flex: 1,
    gap: 4,
  },
  audioInfoText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  audioProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  },
  feedCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  feedCardData: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
  },
  feedCardTipoBadge: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  feedCardTipoBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  semEnsino: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  semEnsinoEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  semEnsinoText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    textAlign: 'center',
  },
  semEnsinoHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray400,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Botão Mural de Oração da Célula
  muralCelulaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
  },
  muralCelulaBtnIcon: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  muralCelulaBtnInfo: {
    flex: 1,
  },
  muralCelulaBtnTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  muralCelulaBtnSubtitle: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    lineHeight: 16,
  },
  muralCelulaBtnArrow: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginLeft: SPACING.sm,
  },

  // Membros
  membrosSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
    marginBottom: SPACING.md,
  },
  membrosTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },
  membroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  membroAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  membroAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  membroInfo: {
    flex: 1,
  },
  membroNome: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  membroTitulo: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  promoverBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoverBtnText: {
    fontSize: 18,
  },

  // Modal de Membros
  modalMembrosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalMembrosContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
    minHeight: '40%',
  },
  modalMembrosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  modalMembrosTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  modalMembrosCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMembrosCloseText: {
    fontSize: 16,
    color: COLORS.gray500,
    fontWeight: 'bold',
  },

  // Seletor de Tipo (Pública / Fechada)
  tipoSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tipoOption: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    alignItems: 'center',
  },
  tipoOptionAtivo: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  tipoOptionAtivoFechada: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  tipoOptionIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  tipoOptionIconAtivo: {
    opacity: 1,
  },
  tipoOptionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray500,
    marginBottom: 2,
  },
  tipoOptionLabelAtivo: {
    color: COLORS.primary,
  },
  tipoOptionDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'center',
  },
  tipoOptionDescAtivo: {
    color: COLORS.gray600,
  },

});
