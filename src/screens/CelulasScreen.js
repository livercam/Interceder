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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  criarCelula,
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
} from '../services/firestoreService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import DenunciaModal from '../components/DenunciaModal';
import KebabMenu from '../components/KebabMenu';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================
// Modal de Criação de Célula
// ============================================================
function CriarCelulaModal({ visible, onClose, onCriar }) {
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState('');
  const [horario, setHorario] = useState('');
  const [descricao, setDescricao] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [local, setLocal] = useState('');
  const [tipo, setTipo] = useState('publica'); // 'publica' ou 'fechada'
  const [loading, setLoading] = useState(false);

  const handleCriar = async () => {
    if (!nome.trim() || !horario.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o nome e o horário da célula.');
      return;
    }

    setLoading(true);
    try {
      await onCriar(nome.trim(), horario.trim(), {
        descricao: descricao.trim(),
        dia_semana: diaSemana.trim(),
        local: local.trim(),
        tipo,
      });
      setNome('');
      setHorario('');
      setDescricao('');
      setDiaSemana('');
      setLocal('');
      setTipo('publica');
      onClose();
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNome('');
    setHorario('');
    setDescricao('');
    setDiaSemana('');
    setLocal('');
    setTipo('publica');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Célula</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome da Célula *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Célula da Fé"
                placeholderTextColor={COLORS.gray400}
                value={nome}
                onChangeText={setNome}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Horário *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Quartas às 19h30"
                placeholderTextColor={COLORS.gray400}
                value={horario}
                onChangeText={setHorario}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Dia da Semana</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Quarta-feira"
                placeholderTextColor={COLORS.gray400}
                value={diaSemana}
                onChangeText={setDiaSemana}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Local</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Online / Rua das Flores, 123"
                placeholderTextColor={COLORS.gray400}
                value={local}
                onChangeText={setLocal}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Célula *</Text>
              <View style={styles.tipoSelector}>
                <TouchableOpacity
                  style={[styles.tipoOption, tipo === 'publica' && styles.tipoOptionAtivo]}
                  onPress={() => setTipo('publica')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tipoOptionIcon, tipo === 'publica' && styles.tipoOptionIconAtivo]}>🌐</Text>
                  <Text style={[styles.tipoOptionLabel, tipo === 'publica' && styles.tipoOptionLabelAtivo]}>Pública</Text>
                  <Text style={[styles.tipoOptionDesc, tipo === 'publica' && styles.tipoOptionDescAtivo]}>Entrada livre, sem aprovação</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tipoOption, tipo === 'fechada' && styles.tipoOptionAtivoFechada]}
                  onPress={() => setTipo('fechada')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tipoOptionIcon, tipo === 'fechada' && styles.tipoOptionIconAtivo]}>🔒</Text>
                  <Text style={[styles.tipoOptionLabel, tipo === 'fechada' && styles.tipoOptionLabelAtivo]}>Fechada</Text>
                  <Text style={[styles.tipoOptionDesc, tipo === 'fechada' && styles.tipoOptionDescAtivo]}>Requer aprovação do líder</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Descrição</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Descreva o propósito da célula..."
                placeholderTextColor={COLORS.gray400}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.criarBtn, loading && styles.criarBtnDisabled]}
              onPress={handleCriar}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.criarBtnText}>Criar Célula</Text>
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
// Modal de Adicionar/Editar Conteúdo de Ensino
// ============================================================
function AdicionarConteudoModal({ visible, onClose, onAdicionar, modoEdicao, conteudoEditar }) {
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [linkExterno, setLinkExterno] = useState('');
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
    }
  }, [modoEdicao, conteudoEditar, visible]);

  const handleSalvar = async () => {
    if (!titulo.trim()) {
      Alert.alert('Atenção', 'Preencha o título do estudo.');
      return;
    }

    setLoading(true);
    try {
      await onAdicionar(titulo.trim(), mensagem.trim(), linkExterno.trim());
      setTitulo('');
      setMensagem('');
      setLinkExterno('');
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
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
  if (l.includes('youtube.com') || l.includes('youtu.be')) return '🎥';
  if (l.includes('spotify.com') || l.includes('soundcloud') || l.includes('deezer')) return '🎧';
  if (l.includes('drive.google') || l.includes('.pdf') || l.includes('docs.')) return '📄';
  if (l.includes('instagram.com')) return '📱';
  return '🔗';
};

// ============================================================
// Tela de Detalhes da Célula
// ============================================================
function CelulaDetalhes({ celulaId, userUid, userTitulo, onVoltar }) {
  const navigation = useNavigation();
  const [celula, setCelula] = useState(null);
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConteudoModal, setShowConteudoModal] = useState(false);
  const [editandoConteudo, setEditandoConteudo] = useState(null);
  const [modalMembrosVisible, setModalMembrosVisible] = useState(false);
  const [showDenunciaModal, setShowDenunciaModal] = useState(false);
  const [menuKebabVisivel, setMenuKebabVisivel] = useState(false);

  const isLider = celula?.lider_id === userUid;
  const isCoLider = celula?.co_lideres_ids?.includes(userUid);
  const podeGerenciar = isLider || isCoLider;

  // Quantidade de solicitações pendentes para o badge
  const qtdSolicitacoes = celula?.solicitacoes_pendentes?.length || 0;

  // KebabMenu no header nativo
  useLayoutEffect(() => {
    const opcoesKebab = [];

    // 1ª opção: Solicitações (apenas para quem pode gerenciar)
    if (podeGerenciar) {
      opcoesKebab.push({
        texto: qtdSolicitacoes > 0
          ? `📋 Solicitações (${qtdSolicitacoes})`
          : '📋 Solicitações',
        aoPressionar: () =>
          navigation.navigate('GerenciarSolicitacoes', {
            celulaId: celula?.id,
          }),
      });

      // 2ª opção: Editar Célula (apenas para quem pode gerenciar)
      opcoesKebab.push({
        texto: '✏️ Editar Célula',
        aoPressionar: () =>
          navigation.navigate('EditarCelula', {
            celulaId: celula?.id,
          }),
      });
    }

    // 3ª opção: Sair da Célula
    opcoesKebab.push({
      texto: '🚪 Sair da Célula',
      destrutivo: true,
      aoPressionar: handleSair,
    });

    // 4ª opção: Excluir Célula (apenas líder)
    if (isLider) {
      opcoesKebab.push({
        texto: '🗑️ Excluir Célula',
        destrutivo: true,
        aoPressionar: handleApagarCelula,
      });
    }

    navigation.setOptions({
      headerRight: () => (
        <KebabMenu
          visivel={menuKebabVisivel}
          aoFechar={() => setMenuKebabVisivel(false)}
          opcoes={opcoesKebab}
          badge={podeGerenciar ? qtdSolicitacoes : 0}
        >
          <TouchableOpacity
            onPress={() => setMenuKebabVisivel(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 8, padding: 4 }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </KebabMenu>
      ),
    });
  }, [isLider, podeGerenciar, celula?.id, navigation, menuKebabVisivel, handleApagarCelula, handleSair, qtdSolicitacoes]);

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

  const handleAdicionarConteudo = async (titulo, mensagem, linkExterno) => {
    if (editandoConteudo) {
      // Modo edição: chama editarConteudoEnsino
      await editarConteudoEnsino(celulaId, editandoConteudo, {
        titulo,
        mensagem,
        link_externo: linkExterno,
      });
      setEditandoConteudo(null);
    } else {
      // Modo criação: chama adicionarConteudoEnsino com autorUid para notificar membros
      await adicionarConteudoEnsino(celulaId, titulo, mensagem, linkExterno, userUid);
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

    Alert.alert(
      'Saindo do aplicativo',
      'Você está prestes a abrir um link externo. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            try {
              const podeAbrir = await Linking.canOpenURL(url);
              if (podeAbrir) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Link inválido', 'Não foi possível abrir este link.');
              }
            } catch (error) {
              Alert.alert('Erro', 'Ocorreu um erro ao tentar abrir o link.');
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

  // Ordenar conteúdos do Feed do mais recente para o mais antigo
  const conteudos = (celula.conteudos_ensino || []).sort((a, b) => {
    const dataA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
    const dataB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
    return dataB - dataA; // Decrescente: mais recente primeiro
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header da Célula */}
      <View style={styles.detalhesHeader}>
        <TouchableOpacity onPress={onVoltar} style={styles.voltarBtn}>
          <Text style={styles.voltarText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.detalhesNomeRow}>
          <Text style={styles.detalhesNome}>{celula.nome}</Text>
          <View style={styles.detalhesAcoesRow}>
            <TouchableOpacity
              style={styles.conviteBtn}
              onPress={handleCompartilharConvite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.conviteBtnText}>🔗</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.membrosHeaderBtn}
              onPress={() => setModalMembrosVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.membrosHeaderBtnText}>👥</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.detalhesInfo}>
          {celula.dia_semana && (
            <Text style={styles.detalhesInfoText}>📅 {celula.dia_semana}</Text>
          )}
          <Text style={styles.detalhesInfoText}>⏰ {celula.horario}</Text>
          {celula.local && (
            <Text style={styles.detalhesInfoText}>📍 {celula.local}</Text>
          )}
        </View>
        {celula.descricao ? (
          <Text style={styles.detalhesDescricao}>{celula.descricao}</Text>
        ) : null}
      </View>

      {/* Botão Mural de Oração da Célula */}
      <TouchableOpacity
        style={styles.muralCelulaBtn}
        onPress={() =>
          navigation.navigate('MuralCelula', {
            celulaId: celula.id,
            celulaNome: celula.nome,
          })
        }
        activeOpacity={0.85}
      >
        <Text style={styles.muralCelulaBtnIcon}>🙏</Text>
        <View style={styles.muralCelulaBtnInfo}>
          <Text style={styles.muralCelulaBtnTitle}>Mural de Oração da Célula</Text>
          <Text style={styles.muralCelulaBtnSubtitle}>
            Veja os pedidos de oração compartilhados com esta célula
          </Text>
        </View>
        <Text style={styles.muralCelulaBtnArrow}>→</Text>
      </TouchableOpacity>

      {/* Feed (antigo Ensino da Palavra) */}
      <View style={styles.ensinoSection}>
        <View style={styles.ensinoHeader}>
          <Text style={styles.ensinoTitle}>📖 Feed</Text>
          <View style={styles.ensinoHeaderAcoes}>
            {!podeGerenciar && (
              <TouchableOpacity
                style={styles.denunciarFeedBtn}
                onPress={handleDenunciarFeed}
                activeOpacity={0.7}
              >
                <Text style={styles.denunciarFeedBtnText}>🚩</Text>
              </TouchableOpacity>
            )}
            {podeGerenciar && (
              <TouchableOpacity
                style={styles.atualizarEnsinoBtn}
                onPress={() => setShowConteudoModal(true)}
              >
                <Text style={styles.atualizarEnsinoBtnText}>➕ Novo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {conteudos.length > 0 ? (
          conteudos.map((conteudo) => {
            const icone = getIconePorLink(conteudo.link_externo);
            const tipoIcone = icone === '🎥' ? 'video' : icone === '🎧' ? 'audio' : icone === '📄' ? 'documento' : 'link';

            return (
              <View key={conteudo.id} style={[styles.feedCard, { borderLeftColor: tipoIcone === 'video' ? '#EF4444' : tipoIcone === 'audio' ? '#8B5CF6' : tipoIcone === 'documento' ? '#F59E0B' : '#3B82F6' }]}>
                {/* Header com ícone grande + título + ações */}
                <View style={styles.feedCardHeader}>
                  <View style={styles.feedCardIconArea}>
                    <Text style={styles.feedCardIcon}>{icone}</Text>
                  </View>
                  <View style={styles.feedCardTituloArea}>
                    <Text style={styles.feedCardTitulo} numberOfLines={2}>
                      {conteudo.titulo || 'Sem título'}
                    </Text>
                  </View>
                  {podeGerenciar && (
                    <View style={styles.feedCardAcoes}>
                      <TouchableOpacity
                        style={styles.feedCardBtnAcao}
                        onPress={() => handleAbrirEdicao(conteudo)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.feedCardBtnAcaoText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.feedCardBtnAcao}
                        onPress={() => {
                          Alert.alert('Excluir Conteúdo', 'Tem certeza que deseja apagar este material?', [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Excluir', style: 'destructive', onPress: async () => {
                              try { await removerConteudoEnsino(celulaId, conteudo); }
                              catch (error) { Alert.alert('Erro', 'Não foi possível excluir.'); }
                            }},
                          ]);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.feedCardBtnAcaoText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Mensagem (estilo quote) */}
                {conteudo.mensagem ? (
                  <View style={styles.feedCardMensagemArea}>
                    <Text style={styles.feedCardMensagemIcon}>📝</Text>
                    <Text style={styles.feedCardMensagem} numberOfLines={4}>
                      {conteudo.mensagem}
                    </Text>
                  </View>
                ) : null}

                {/* Botão de ação principal */}
                {conteudo.link_externo ? (
                  <TouchableOpacity
                    style={[styles.feedCardBtnPrincipal, {
                      backgroundColor: tipoIcone === 'video' ? '#EF4444' : tipoIcone === 'audio' ? '#8B5CF6' : tipoIcone === 'documento' ? '#F59E0B' : '#3B82F6',
                    }]}
                    onPress={() => handleAbrirLink(conteudo.link_externo)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.feedCardBtnPrincipalIcon}>
                      {tipoIcone === 'video' ? '▶️' : tipoIcone === 'audio' ? '🎵' : tipoIcone === 'documento' ? '📄' : '🔗'}
                    </Text>
                    <Text style={styles.feedCardBtnPrincipalText}>
                      {tipoIcone === 'video' ? 'Assistir' : tipoIcone === 'audio' ? 'Ouvir' : tipoIcone === 'documento' ? 'Ler' : 'Acessar'}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* Rodapé com data */}
                <View style={styles.feedCardFooter}>
                  <Text style={styles.feedCardData}>
                    {conteudo.criadoEm ? (() => {
                      const d = new Date(conteudo.criadoEm);
                      const agora = new Date();
                      const diffDias = Math.floor((agora - d) / (1000 * 60 * 60 * 24));
                      if (diffDias === 0) return 'Hoje';
                      if (diffDias === 1) return 'Ontem';
                      if (diffDias < 7) return `Há ${diffDias} dias`;
                      if (diffDias < 30) return `Há ${Math.floor(diffDias / 7)} sem`;
                      return d.toLocaleDateString('pt-BR');
                    })() : ''}
                  </Text>
                  <View style={styles.feedCardTipoBadge}>
                    <Text style={styles.feedCardTipoBadgeText}>
                      {tipoIcone === 'video' ? '🎬 Vídeo' : tipoIcone === 'audio' ? '🎧 Áudio' : tipoIcone === 'documento' ? '📄 Estudo' : '🔗 Link'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.semEnsino}>
            <Text style={styles.semEnsinoEmoji}>📚</Text>
            <Text style={styles.semEnsinoText}>
              Nenhum conteúdo publicado ainda.
            </Text>
            {podeGerenciar && (
              <Text style={styles.semEnsinoHint}>
                Toque em "Novo" para publicar o primeiro conteúdo.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Modal de Membros */}
      <Modal
        visible={modalMembrosVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalMembrosVisible(false)}
      >
        <View style={styles.modalMembrosOverlay}>
          <View style={styles.modalMembrosContainer}>
            <View style={styles.modalMembrosHeader}>
              <Text style={styles.modalMembrosTitle}>
                👥 Membros ({membros.length})
              </Text>
              <TouchableOpacity
                style={styles.modalMembrosCloseBtn}
                onPress={() => setModalMembrosVisible(false)}
              >
                <Text style={styles.modalMembrosCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {membros.map((membro) => {
                const ehLider = membro.uid === celula.lider_id;
                const ehCoLider = celula.co_lideres_ids?.includes(membro.uid);
                const podePromover = isLider && !ehLider && !ehCoLider;

                return (
                  <View key={membro.uid} style={styles.membroCard}>
                    <View style={styles.membroAvatar}>
                      <Text style={styles.membroAvatarText}>
                        {membro.nome?.charAt(0)?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.membroInfo}>
                      <Text style={styles.membroNome}>{membro.nome}</Text>
                      <Text style={styles.membroTitulo}>
                        {ehLider
                          ? '👑 Líder'
                          : ehCoLider
                          ? '⭐ Co-Líder'
                          : membro.titulo_ministerial || 'Membro'}
                      </Text>
                    </View>
                    {podePromover && (
                      <TouchableOpacity
                        style={styles.promoverBtn}
                        onPress={() => handlePromover(membro.uid, membro.nome)}
                      >
                        <Text style={styles.promoverBtnText}>⭐</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>


      <View style={{ height: SPACING.xxl }} />

      {/* Modal de Adicionar/Editar Conteúdo */}
      <AdicionarConteudoModal
        visible={showConteudoModal}
        onClose={handleFecharModalConteudo}
        onAdicionar={handleAdicionarConteudo}
        modoEdicao={!!editandoConteudo}
        conteudoEditar={editandoConteudo}
      />

      {/* Modal de Denúncia (Lateral Animado) */}
      <DenunciaModal
        visible={showDenunciaModal}
        onClose={() => setShowDenunciaModal(false)}
        itemId={celulaId}
        itemTipo="celula"
      />
    </ScrollView>
  );
}

// ============================================================
// Tela Principal de Células
// ============================================================
export default function CelulasScreen() {
  const [celulas, setCelulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCriarModal, setShowCriarModal] = useState(false);
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

  const handleCriarCelula = async (nome, horario, dadosAdicionais) => {
    await criarCelula(nome, horario, user.uid, dadosAdicionais);
  };

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
            onPress={() => setShowCriarModal(true)}
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

      <CriarCelulaModal
        visible={showCriarModal}
        onClose={() => setShowCriarModal(false)}
        onCriar={handleCriarCelula}
      />
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

  // Ensino - Mural de Conteúdos
  ensinoSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
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
  // Feed de Conteúdo (novo estilo)
  feedCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  feedCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
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
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
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
    borderRadius: RADIUS.md,
    paddingVertical: 10,
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
  },
  feedCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
