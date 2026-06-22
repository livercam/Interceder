// Tela Perfil - Gerenciamento do Perfil do Usuário
// Funcionalidades:
// - Exibir nome, e-mail e estatísticas (orações feitas, dias seguidos)
// - Menu de opções: Editar Perfil, Ofertas, FAQ
// - Design vibrante com tratamento de estados de carregamento

import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { logoutUser } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import KebabMenu from '../components/KebabMenu';
import { formatarNomeCurto } from '../utils/formatters';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// ============================================================
// Helper para montar lista de distintivos (exceto título ministerial)
// ============================================================
function getDistintivos(userProfile, contagemReal) {
  const lista = [];

  const total = contagemReal;
  if (userProfile?.endossado_por_admin) {
    lista.push({ emoji: '✔️', dica: 'Verificado pela Liderança', cor: '#10B981' });
  } else if (total >= 50) {
    lista.push({ emoji: '🏆', dica: 'Líder Espiritual', cor: '#F59E0B' });
  } else if (total >= 20) {
    lista.push({ emoji: '🛡️', dica: 'Coluna da Igreja', cor: '#64748B' });
  } else if (total >= 5) {
    lista.push({ emoji: '🤝', dica: 'Intercessor Acolhedor', cor: '#22C55E' });
  }

  if (userProfile?.isPremium === true) {
    lista.push({ emoji: '💎', dica: 'Membro Apoiador', cor: '#F59E0B' });
  }

  return lista;
}

const TITULOS_MINISTERIAIS = [
  { value: 'membro', label: 'Membro' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'missionario', label: 'Missionário' },
  { value: 'evangelista', label: 'Evangelista' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'pastor', label: 'Pastor' },
];

export default function PerfilScreen({ navigation }) {
  const { user, userProfile, isLoading } = useAuth();

  // Foto de perfil: Firestore > Auth > null
  const fotoPerfil = userProfile?.foto_url || user?.photoURL || null;
  const { showAlert } = useAlert();

  const [imagemComErro, setImagemComErro] = useState(false);
  const [fotoModalVisivel, setFotoModalVisivel] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  // ============================================================
  // Selecionar foto da câmera ou galeria
  // ============================================================
  const handleSelecionarFoto = useCallback(async (tipo) => {
    setFotoModalVisivel(false);

    try {
      let result;

      if (tipo === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar foto.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uriOriginal = result.assets[0].uri;

      // Comprimir para no máximo 400x400 com qualidade 70%
      setEnviandoFoto(true);
      const manipResult = await ImageManipulator.manipulateAsync(
        uriOriginal,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Upload para Firebase Storage
      const response = await fetch(manipResult.uri);
      const blob = await response.blob();

      const nomeArquivo = `perfis/${user.uid}.jpg`;
      const storageRef = ref(storage, nomeArquivo);
      await uploadBytes(storageRef, blob);

      const fotoUrl = await getDownloadURL(storageRef);

      // Salvar no Firestore
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        foto_url: fotoUrl,
      }, { merge: true });

      // Atualizar imagem na tela
      setImagemComErro(false);
      Alert.alert('✅ Foto atualizada!', 'Sua foto de perfil foi alterada com sucesso.');
    } catch (error) {
      console.warn('[Foto] Erro:', error.message);
      Alert.alert('Erro', 'Não foi possível atualizar a foto. Tente novamente.');
    } finally {
      setEnviandoFoto(false);
    }
  }, [user?.uid]);

  const handleLogout = useCallback(() => {
    showAlert({
      title: 'Sair',
      message: 'Tem certeza que deseja sair?',
      icon: 'log-out-outline',
      buttons: [
        { text: 'Cancelar', type: 'cancel' },
        {
          text: 'Sair',
          type: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
            } catch (error) {
              showAlert({
                title: 'Erro',
                message: 'Não foi possível sair.',
                icon: 'alert-circle-outline',
                buttons: [{ text: 'OK', type: 'default' }],
              });
            }
          },
        },
      ],
    });
  }, [showAlert]);


  const handleMostrarDistintivo = useCallback((dica) => {
    Alert.alert('🏅 Conquista', dica);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!user || !userProfile) {
    return (
      <View style={styles.visitanteContainer}>
        <View style={styles.visitanteContent}>
          <View style={styles.visitanteLogoContainer}>
            <Text style={styles.visitanteLogo}>🙏</Text>
          </View>
          <Text style={styles.visitanteTitulo}>Interceder</Text>
          <Text style={styles.visitanteDescricao}>
            Você está no modo visitante.{'\n'}Crie sua conta para interceder,
            publicar e participar de células!
          </Text>
          <TouchableOpacity
            style={styles.visitanteBtnLogin}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.visitanteBtnLoginText}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.visitanteBtnCadastro}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.visitanteBtnCadastroText}>Criar Conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = userProfile.stats || {
    oracoes_feitas: 0,
    oracoes_hoje: 0,
    minutos_semana: 0,
    testemunhos: 0,
    endossos_recebidos: 0,
  };

  const isReconhecido =
    (stats.endossos_recebidos || 0) >= 5 || userProfile?.verificado_lideranca === true;

  const contagemReal = stats.endossos_recebidos || 0;

  const tituloLabel = TITULOS_MINISTERIAIS.find(
    (t) => t.value === userProfile?.titulo_ministerial
  )?.label || 'Membro';

  const distintivos = getDistintivos(userProfile, contagemReal);

  // ============================================================
  // KebabMenu no header (nativo)
  // ============================================================
  const [menuPerfilVisivel, setMenuPerfilVisivel] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <KebabMenu
          visivel={menuPerfilVisivel}
          aoFechar={() => setMenuPerfilVisivel(false)}
          opcoes={[
            {
              texto: 'Editar Perfil',
              aoPressionar: () => navigation.navigate('EditarPerfil'),
            },
            {
              texto: '🆘 Suporte',
              aoPressionar: () => navigation.navigate('Suporte'),
            },
            {
              texto: 'FAQ / Dúvidas',
              aoPressionar: () => navigation.navigate('Faq'),
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setMenuPerfilVisivel(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 8, padding: 4 }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </KebabMenu>
      ),
    });
  }, [navigation, menuPerfilVisivel]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER — Card / Quadro de Perfil em duas colunas */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            {/* Coluna Esquerda: Foto + Nome + Título */}
            <View style={styles.headerLeft}>
              <View style={styles.fotoWrapper}>
                {fotoPerfil && !imagemComErro ? (
                  <Image
                    source={{ uri: fotoPerfil }}
                    style={styles.fotoPerfil}
                    onError={() => setImagemComErro(true)}
                  />
                ) : (
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                      {userProfile.nome?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                {(!imagemComErro || fotoPerfil) && (
                <TouchableOpacity
                  style={styles.cameraBadge}
                  activeOpacity={0.8}
                  onPress={() => setFotoModalVisivel(true)}
                  disabled={enviandoFoto}
                >
                  <Ionicons name="camera" size={14} color={COLORS.primary} />
                </TouchableOpacity>
                )}
              </View>
              <View style={styles.nomeRow}>
                <Text style={styles.nome}>{formatarNomeCurto(userProfile.nome) || 'Usuário'}</Text>
                {userProfile.isPremium === true && (
                  <Text style={styles.seloPremium}>💎</Text>
                )}
              </View>

              {/* Título Ministerial (badge horizontal - estilo PublicProfile) */}
              {!isReconhecido ? (
                <View style={[styles.tituloTag, styles.tituloTagNaoVerificado]}>
                  <Text style={[styles.tituloTagText, styles.tituloTagTextNaoVerificado]}>{tituloLabel}</Text>
                  <Text style={{ fontSize: 12, marginLeft: 4 }}>⚠️</Text>
                </View>
              ) : userProfile?.verificado_lideranca === true ? (
                <View style={[styles.tituloTag, styles.tituloTagVerificadoLideranca]}>
                  <Text style={[styles.tituloTagText, styles.tituloTagTextVerificadoLideranca]}>{tituloLabel}</Text>
                  <Text style={{ fontSize: 12, marginLeft: 4 }}>🛡️</Text>
                </View>
              ) : (
                <View style={[styles.tituloTag, styles.tituloTagVerificadoComunidade]}>
                  <Text style={[styles.tituloTagText, styles.tituloTagTextVerificadoComunidade]}>{tituloLabel}</Text>
                  <Text style={{ fontSize: 12, marginLeft: 4 }}>✅</Text>
                </View>
              )}
            </View>

            {/* Coluna Direita: Distintivos empilhados verticalmente */}
            {distintivos.length > 0 && (
              <View style={styles.headerRight}>
                {distintivos.map((dist, index) => (
                  <TouchableOpacity key={index} style={styles.distintivoCol} onPress={() => handleMostrarDistintivo(dist.dica)} activeOpacity={0.7}>
                    <View style={[styles.distintivo, { backgroundColor: dist.cor + '20', borderColor: dist.cor }]}>
                      <Text style={styles.distintivoEmoji}>{dist.emoji}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ESTATÍSTICAS COMPACTAS */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🙏</Text>
            <Text style={styles.statNumber}>{stats.oracoes_feitas}</Text>
            <Text style={styles.statLabel}>orações</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={styles.statNumber}>{stats.minutos_semana || 0}</Text>
            <Text style={styles.statLabel}>min</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🕊️</Text>
            <Text style={styles.statNumber}>{stats.testemunhos || 0}</Text>
            <Text style={styles.statLabel}>test.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statNumber, { color: '#C2410C' }]}>{stats.oracoes_hoje || 0}</Text>
            <Text style={styles.statLabel}>hoje</Text>
          </View>
        </View>

        {/* MENU DE OPÇÕES */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>⚙️ Opções</Text>
          <View style={{ height: SPACING.sm }} />

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemPremium]}
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemIcon}>👑</Text>
            <View style={styles.menuItemInfo}>
              <Text style={styles.menuItemTitlePremium}>
                {userProfile.isPremium === true
                  ? '💎 Selo de Verificação Ativo'
                  : 'Obter Selo de Verificação'}
              </Text>
              <Text style={styles.menuItemDesc}>
                {userProfile.isPremium === true
                  ? 'És um Membro Apoiador. Obrigado!'
                  : 'Torne-se um Membro Apoiador'}
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('Ofertando')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemIcon}>❤️</Text>
            <View style={styles.menuItemInfo}>
              <Text style={styles.menuItemTitle}>Ofertas / Contribuir</Text>
              <Text style={styles.menuItemDesc}>
                Apoie o ministério com sua oferta
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MinhasPublicacoes')}
            activeOpacity={0.85}
          >
            <Text style={styles.menuItemIcon}>📂</Text>
            <View style={styles.menuItemInfo}>
              <Text style={styles.menuItemTitle}>Meus Pedidos e Testemunhos</Text>
              <Text style={styles.menuItemDesc}>
                Gerencie suas publicações
              </Text>
            </View>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>

        </View>

        {/* MINHA LISTA DE ORAÇÃO */}
        <TouchableOpacity
          style={styles.listaOracaoBtn}
          onPress={() => navigation.navigate('ListaOracao')}
          activeOpacity={0.85}
        >
          <Text style={styles.listaOracaoBtnIcon}>📌</Text>
          <View style={styles.listaOracaoBtnInfo}>
            <Text style={styles.listaOracaoBtnTitle}>Minha Lista de Oração</Text>
            <Text style={styles.listaOracaoBtnDesc}>
              Pedidos salvos para orar depois
            </Text>
          </View>
          <Text style={styles.listaOracaoBtnArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
          <Text style={styles.logoutLinkText}>🚪 Sair da Conta</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL: Escolher foto (Câmera ou Galeria) */}
      {/* ============================================================ */}
      <Modal
        visible={fotoModalVisivel}
        transparent
        animationType="fade"
        onRequestClose={() => setFotoModalVisivel(false)}
      >
        <View style={styles.fotoModalOverlay}>
          <View style={styles.fotoModalContainer}>
            <Text style={styles.fotoModalTitulo}>📸 Alterar Foto</Text>

            {enviandoFoto ? (
              <View style={styles.fotoModalCarregando}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.fotoModalCarregandoText}>Enviando foto...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.fotoModalOpcao}
                  onPress={() => handleSelecionarFoto('camera')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.fotoModalOpcaoText}>Tirar Foto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fotoModalOpcao}
                  onPress={() => handleSelecionarFoto('galeria')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.fotoModalOpcaoText}>Escolher da Galeria</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fotoModalCancelar}
                  onPress={() => setFotoModalVisivel(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.fotoModalCancelarText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.xxl },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONTS.sizes.md },

  // Header — Card / Quadro de Perfil
  headerCard: {
    marginHorizontal: 0,
    marginTop: 0,
    backgroundColor: '#F2D5C4',
    borderBottomWidth: 6,
    borderBottomColor: '#F8E0D4',
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Foto
  fotoWrapper: { position: 'relative', marginBottom: SPACING.sm },
  fotoPerfil: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', ...SHADOWS.md },
  avatarText: { color: COLORS.white, fontSize: 40, fontWeight: 'bold' },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },

  // Nome
  nomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  nome: { fontSize: FONTS.sizes.xl, fontWeight: 'bold', color: COLORS.gray800 },
  seloPremium: { fontSize: 18, marginLeft: SPACING.xs },

  // Título Ministerial (badge horizontal - estilo PublicProfile)
  tituloTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  tituloTagNaoVerificado: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  tituloTagTextNaoVerificado: { color: '#6B7280', fontWeight: '600' },
  tituloTagVerificadoComunidade: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  tituloTagTextVerificadoComunidade: { color: '#1D4ED8', fontWeight: '700' },
  tituloTagVerificadoLideranca: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  tituloTagTextVerificadoLideranca: { color: '#92400E', fontWeight: '800' },
  tituloTagText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },

  // Distintivos
  headerRight: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingLeft: SPACING.md,
  },
  distintivoCol: {
    alignItems: 'center',
  },
  distintivo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  distintivoEmoji: {
    fontSize: 22,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Estatísticas Compactas
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    ...SHADOWS.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  statNumber: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.gray200,
  },

  // Menu de Opções
  menuSection: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md },
  menuItem: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  menuItemIcon: { fontSize: 28, marginRight: SPACING.md },
  menuItemInfo: { flex: 1 },
  menuItemTitle: { fontSize: FONTS.sizes.md, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 2 },
  menuItemDesc: { fontSize: FONTS.sizes.sm, color: COLORS.gray500 },
  menuItemArrow: { fontSize: 28, color: COLORS.gray400, fontWeight: '300', marginLeft: SPACING.sm },

  // Premium
  menuItemPremium: { borderWidth: 1.5, borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  menuItemTitlePremium: { fontSize: FONTS.sizes.md, fontWeight: 'bold', color: '#92400E', marginBottom: 2 },

  // Lista de Oração
  listaOracaoBtn: { marginHorizontal: SPACING.lg, marginBottom: SPACING.md, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', ...SHADOWS.md },
  listaOracaoBtnIcon: { fontSize: 28, marginRight: SPACING.md },
  listaOracaoBtnInfo: { flex: 1 },
  listaOracaoBtnTitle: { fontSize: FONTS.sizes.md, fontWeight: 'bold', color: COLORS.gray800, marginBottom: 2 },
  listaOracaoBtnDesc: { fontSize: FONTS.sizes.sm, color: COLORS.gray500 },
  listaOracaoBtnArrow: { fontSize: 28, color: COLORS.gray400, fontWeight: '300', marginLeft: SPACING.sm },

  // Logout (link)
  logoutLink: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    marginTop: SPACING.md,
  },
  logoutLinkText: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },

  // Modal Foto
  fotoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  fotoModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
  },
  fotoModalTitulo: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  fotoModalCarregando: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.md,
  },
  fotoModalCarregandoText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
  },
  fotoModalOpcao: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    backgroundColor: '#F9FAFB',
  },
  fotoModalOpcaoText: {
    fontSize: FONTS.sizes.md,
    color: '#1F2937',
    fontWeight: '600',
  },
  fotoModalCancelar: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: SPACING.sm,
  },
  fotoModalCancelarText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },

  // Visitante
  visitanteContainer: { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  headerSection: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.lg },
  visitanteContent: { alignItems: 'center', maxWidth: 360, width: '100%' },
  visitanteLogoContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
  visitanteLogo: { fontSize: 48 },
  visitanteTitulo: { fontSize: FONTS.sizes.xxxl, fontWeight: 'bold', color: COLORS.white, marginBottom: SPACING.md },
  visitanteDescricao: { fontSize: FONTS.sizes.md, color: COLORS.white, opacity: 0.8, textAlign: 'center', lineHeight: 24, marginBottom: SPACING.xl },
  visitanteBtnLogin: { width: '100%', backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOWS.md },
  visitanteBtnLoginText: { color: COLORS.primary, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
  visitanteBtnCadastro: { width: '100%', backgroundColor: 'transparent', borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  visitanteBtnCadastroText: { color: COLORS.white, fontSize: FONTS.sizes.lg, fontWeight: 'bold' },
});