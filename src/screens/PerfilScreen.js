// Tela Perfil - Gerenciamento do Perfil do Usuário
// Funcionalidades:
// - Exibir nome, e-mail e estatísticas (orações feitas, dias seguidos)
// - Menu de opções: Editar Perfil, Ofertas, FAQ
// - Design vibrante com tratamento de estados de carregamento

import React, { useCallback, useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../services/firebaseConfig';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { COLLECTIONS } from '../constants/firestore';
import { logoutUser } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import KebabMenu from '../components/KebabMenu';
import { formatarNomeCurto } from '../utils/formatters';

// ============================================================
// Componente de Selo de Confiança (Badge de Endossos)
// ============================================================
function SeloConfianca({ totalEndossos, endossadoPorAdmin }) {
  if (endossadoPorAdmin) {
    return (
      <View style={[styles.seloBase, styles.seloAdmin]}>
        <Text style={styles.seloAdminText}>✔️ Verificado pela Liderança</Text>
      </View>
    );
  }

  if (totalEndossos >= 50) {
    return (
      <View style={[styles.seloBase, styles.seloOuro]}>
        <Text style={styles.seloOuroText}>🏆 Líder Espiritual</Text>
      </View>
    );
  }

  if (totalEndossos >= 20) {
    return (
      <View style={[styles.seloBase, styles.seloPrata]}>
        <Text style={styles.seloPrataText}>🛡️ Coluna da Igreja</Text>
      </View>
    );
  }

  if (totalEndossos >= 5) {
    return (
      <View style={[styles.seloBase, styles.seloBronze]}>
        <Text style={styles.seloBronzeText}>🤝 Intercessor Acolhedor</Text>
      </View>
    );
  }

  return null;
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

  const [ehLider, setEhLider] = useState(false);
  const [carregandoLideranca, setCarregandoLideranca] = useState(true);
  const [imagemComErro, setImagemComErro] = useState(false);
  

  useEffect(() => {
    const verificarLideranca = async () => {
      if (!user?.uid) {
        setCarregandoLideranca(false);
        return;
      }
      try {
        const celulasQuery = query(
          collection(db, COLLECTIONS.CELULAS),
          where('lider_id', '==', user.uid)
        );
        const celulasSnap = await getDocs(celulasQuery);
        setEhLider(!celulasSnap.empty);
      } catch (error) {
        console.warn('[Perfil] Erro ao verificar liderança:', error.message);
        setEhLider(false);
      } finally {
        setCarregandoLideranca(false);
      }
    };
    verificarLideranca();
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
            onPress={async () => {
              try {
                await logoutUser();
              } catch {}
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.visitanteBtnLoginText}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.visitanteBtnCadastro}
            onPress={async () => {
              try {
                await logoutUser();
              } catch {}
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.visitanteBtnCadastroText}>Criar Conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stats = userProfile.stats || { oracoes_feitas: 0, dias_seguidos: 0 };

  const isReconhecido =
    (userProfile?.endossos_uids?.length || 0) >= 5 || userProfile?.verificado_lideranca === true;

  const contagemReal = userProfile?.endossos_uids?.length || 0;

  const tituloLabel = TITULOS_MINISTERIAIS.find(
    (t) => t.value === userProfile?.titulo_ministerial
  )?.label || 'Membro';

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
        {/* HEADER — Card / Quadro de Perfil */}
        <View style={styles.headerCard}>
          <View style={styles.headerContent}>
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
              {/* Ícone de câmera sobreposto */}
              {/* Only show camera badge if imagemComErro is false or if fotoPerfil exists */}
              {(!imagemComErro || fotoPerfil) && (
              <TouchableOpacity
                style={styles.cameraBadge}
                activeOpacity={0.8}
                onPress={() => {
                  // Futuro: abrir seletor de foto
                }}
              >
                <Ionicons name="camera" size={16} color={COLORS.primary} />
              </TouchableOpacity>
              )}
            </View>
            <View style={styles.nomeRow}>
              <Text style={styles.nome}>{formatarNomeCurto(userProfile.nome) || 'Usuário'}</Text>
              {userProfile.isPremium === true && (
                <Text style={styles.seloPremium}>💎</Text>
              )}
            </View>

            {!isReconhecido ? (
              <View style={[styles.tituloTag, styles.tituloTagNaoVerificado]}>
                <Text style={[styles.tituloTagText, styles.tituloTagTextNaoVerificado]}>
                  {tituloLabel}
                </Text>
                <Text style={styles.tituloBadgeNaoVerificado}> ⚠️</Text>
              </View>
            ) : userProfile?.verificado_lideranca === true ? (
              <View style={[styles.tituloTag, styles.tituloTagVerificadoLideranca]}>
                <Text style={[styles.tituloTagText, styles.tituloTagTextVerificadoLideranca]}>
                  {tituloLabel}
                </Text>
                <Text style={styles.tituloBadgeVerificadoLideranca}> 🛡️</Text>
              </View>
            ) : (
              <View style={[styles.tituloTag, styles.tituloTagVerificadoComunidade]}>
                <Text style={[styles.tituloTagText, styles.tituloTagTextVerificadoComunidade]}>
                  {tituloLabel}
                </Text>
                <Text style={styles.tituloBadgeVerificadoComunidade}> ✅</Text>
              </View>
            )}

            <SeloConfianca
              totalEndossos={contagemReal}
              endossadoPorAdmin={userProfile.endossado_por_admin === true}
            />

            {userProfile.isPremium === true && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>💎 Membro Apoiador</Text>
              </View>
            )}
          </View>
        </View>

        {/* ESTATÍSTICAS */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>📊 Estatísticas</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.oracoes_feitas}</Text>
              <Text style={styles.statLabel}>Orações Feitas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.minutos_semana || 0}</Text>
              <Text style={styles.statLabel}>Tempo de Oração</Text>
            </View>
          </View>
        </View>

        {/* MENU DE OPÇÕES */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>⚙️ Opções</Text>

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
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    position: 'relative',
  },
  fotoWrapper: { position: 'relative', marginBottom: SPACING.md },
  fotoPerfil: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.primary },
  avatarContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', ...SHADOWS.md },
  avatarText: { color: COLORS.white, fontSize: 48, fontWeight: 'bold' },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  nomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  nome: { fontSize: FONTS.sizes.xxl, fontWeight: 'bold', color: COLORS.gray800 },
  seloPremium: { fontSize: 22, marginLeft: SPACING.sm },
  premiumBadge: { backgroundColor: '#FEF3C7', borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginTop: SPACING.sm, borderWidth: 1, borderColor: '#F59E0B' },
  premiumBadgeText: { fontSize: FONTS.sizes.sm, color: '#92400E', fontWeight: '700' },

  // Título Ministerial
  tituloTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1.5 },
  tituloTagNaoVerificado: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  tituloTagTextNaoVerificado: { color: '#888', fontWeight: '600' },
  tituloBadgeNaoVerificado: { fontSize: FONTS.sizes.sm },
  tituloTagVerificadoComunidade: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  tituloTagTextVerificadoComunidade: { color: '#1D4ED8', fontWeight: '700' },
  tituloBadgeVerificadoComunidade: { fontSize: FONTS.sizes.sm },
  tituloTagVerificadoLideranca: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  tituloTagTextVerificadoLideranca: { color: '#92400E', fontWeight: '800' },
  tituloBadgeVerificadoLideranca: { fontSize: FONTS.sizes.sm },
  tituloTagText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },

  // Selos
  seloBase: { borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 1, marginTop: SPACING.sm, borderWidth: 1.5 },
  seloAdmin: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
  seloAdminText: { fontSize: FONTS.sizes.sm, color: '#065F46', fontWeight: '800' },
  seloOuro: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  seloOuroText: { fontSize: FONTS.sizes.sm, color: '#92400E', fontWeight: '800' },
  seloPrata: { backgroundColor: '#F1F5F9', borderColor: '#64748B' },
  seloPrataText: { fontSize: FONTS.sizes.sm, color: '#334155', fontWeight: '800' },
  seloBronze: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
  seloBronzeText: { fontSize: FONTS.sizes.sm, color: '#166534', fontWeight: '800' },

  // Seções
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: 'bold', color: COLORS.gray800, marginBottom: SPACING.md },

  // Estatísticas
  statsSection: { marginHorizontal: SPACING.lg, marginTop: SPACING.xl, marginBottom: SPACING.md },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.md },
  statNumber: { fontSize: FONTS.sizes.xxxl, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.xs },
  statLabel: { fontSize: FONTS.sizes.sm, color: COLORS.gray500, textAlign: 'center' },

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