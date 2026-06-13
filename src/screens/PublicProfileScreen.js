// Tela de Perfil Público de Outro Utilizador
// Funcionalidades:
// - Exibir nome, e-mail e título ministerial
// - Seção de Reconhecimento Ministerial (endossos)
// - Botão de Endossar/Remover Endosso
// - Indicador visual de "Reconhecido pela Comunidade"

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { COLLECTIONS } from '../constants/firestore';
import { getUserProfile, alternarEndosso } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

// ============================================================
// Constantes
// ============================================================
const ENDOSSOS_MINIMOS_RECONHECIMENTO = 5;

const TITULOS_MINISTERIAIS = [
  { value: 'membro', label: 'Membro' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'missionario', label: 'Missionário' },
  { value: 'evangelista', label: 'Evangelista' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'pastor', label: 'Pastor' },
];

// ============================================================
// Tela de Perfil Público
// ============================================================
export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [endossando, setEndossando] = useState(false);
  const [imagemComErro, setImagemComErro] = useState(false);

  // Carregar perfil do utilizador
  useEffect(() => {
    const carregar = async () => {
      try {
        const dados = await getUserProfile(userId);
        if (!dados) {
          Alert.alert('Erro', 'Utilizador não encontrado.');
          navigation.goBack();
          return;
        }
        setProfile(dados);
        // Resetar estado de erro da imagem ao carregar um novo perfil
        setImagemComErro(false);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar o perfil.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [userId]);

  // Verificar se o utilizador atual já endossou
  const jaEndossou = profile?.endossos_uids?.includes(currentUser?.uid) || false;

  // ============================================================
  // REGRA DE OURO UNIFICADA (isReconhecido)
  // O peso da autoridade é mais importante que a quantidade:
  // - 5 endossos comuns (array >= 5)
  // - OU 1 Super Endosso (verificado_lideranca === true)
  // ============================================================
  const isReconhecido =
    (profile?.endossos_uids?.length || 0) >= 5 || profile?.verificado_lideranca === true;

  // Contagem real do array (sem bónus) para exibição numérica
  const contagemReal = profile?.endossos_uids?.length || 0;
  const ehMembro = profile?.titulo_ministerial === 'membro';
  const ehProprio = currentUser?.uid === userId;

  // Obter label do título ministerial
  const tituloLabel = TITULOS_MINISTERIAIS.find(
    (t) => t.value === profile?.titulo_ministerial
  )?.label || 'Membro';


  // ============================================================
  // Executar endosso com o tipo escolhido
  // ============================================================
  const executarEndosso = useCallback(async (tipoEndosso) => {
    setEndossando(true);
    try {
      await alternarEndosso(currentUser.uid, userId, !jaEndossou, tipoEndosso);

      // Atualizar estado local (otimista)
      setProfile((prev) => {
        if (!prev) return prev;
        const novosEndossos = jaEndossou
          ? (prev.endossos_uids || []).filter((uid) => uid !== currentUser.uid)
          : [...(prev.endossos_uids || []), currentUser.uid];

        const atualizacao = { ...prev, endossos_uids: novosEndossos };

        // Se é um Super Endosso, injeta verificado_lideranca: true
        // no estado local para que isReconhecido funcione
        // instantaneamente na UI, sem precisar recarregar.
        if (!jaEndossou && tipoEndosso === 'super') {
          atualizacao.verificado_lideranca = true;
        }

        if (!jaEndossou) {
          // Recarregar perfil do Firestore para obter estado real (verificado_lideranca, etc.)
          getUserProfile(userId).then((dadosAtualizados) => {
            if (dadosAtualizados) {
              setProfile((prevAtual) => ({
                ...prevAtual,
                ...dadosAtualizados,
              }));
            }
          }).catch(() => {
            // Fallback: mantém estado local otimista
          });
        }

        return atualizacao;
      });
    } catch (error) {
      console.error('[ERRO FIREBASE ENDOSSO]:', error);
      Alert.alert('Erro', error.message || 'Não foi possível processar o endosso.');
    } finally {
      setEndossando(false);
    }
  }, [currentUser, userId, jaEndossou]);

  // ============================================================
  // Verificação relâmpago de liderança + UI de escolha
  // ============================================================
  const handleEndossar = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Atenção', 'Faça login para endossar.');
      return;
    }

    // Se já endossou, vai direto para remover (sem escolha de tipo)
    if (jaEndossou) {
      await executarEndosso('normal');
      return;
    }

    // Verificação relâmpago: o utilizador atual é líder deste perfil?
    let ehLider = false;
    try {
      // Query: busca células onde currentUser é líder E perfilUid é membro
      const celulasQuery = query(
        collection(db, COLLECTIONS.CELULAS),
        where('lider_id', '==', currentUser.uid),
        where('membros_ids', 'array-contains', userId)
      );
      const celulasSnap = await getDocs(celulasQuery);
      ehLider = !celulasSnap.empty;
    } catch (queryError) {
      // Resiliência: se a query falhar, não impede o endosso normal
      console.warn('[VerificacaoLideranca] Erro na query:', queryError.message);
    }

    if (ehLider) {
      // É líder do membro → mostra opções de endosso
      Alert.alert(
        'Opções de Endosso',
        'Como líder deste membro, qual nível de endosso deseja conceder?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Endosso Normal',
            onPress: () => executarEndosso('normal'),
          },
          {
            text: 'Super Endosso (Verificado)',
            onPress: () => executarEndosso('super'),
          },
        ]
      );
    } else {
      // Não é líder → endosso normal direto
      await executarEndosso('normal');
    }
  }, [currentUser, userId, jaEndossou, executarEndosso]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Perfil não encontrado</Text>
        <TouchableOpacity
          style={styles.voltarBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.voltarBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* ============================================ */}
      {/* HEADER — Card / Quadro de Perfil (igual ao PerfilScreen) */}
      {/* ============================================ */}
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={styles.fotoWrapper}>
            {profile.foto_url && !imagemComErro ? (
              <Image
                source={{ uri: profile.foto_url }}
                style={styles.fotoPerfil}
                onError={() => setImagemComErro(true)}
              />
            ) : (
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>
                  {profile.nome?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.nomeRow}>
            <Text style={styles.nome}>{formatarNomeCurto(profile.nome) || 'Usuário'}</Text>
            {profile.isPremium === true && (
              <Text style={styles.seloPremium}>💎</Text>
            )}
          </View>

          {/* Tag de Título Ministerial com Verificação (isReconhecido) */}
          {!isReconhecido ? (
            <View style={[styles.tituloTag, styles.tituloTagNaoVerificado]}>
              <Text style={[styles.tituloTagText, styles.tituloTagTextNaoVerificado]}>
                {tituloLabel}
              </Text>
              <Text style={styles.tituloBadgeNaoVerificado}> ⚠️</Text>
            </View>
          ) : profile?.verificado_lideranca === true ? (
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

          {/* Badge de Membro Apoiador (Premium) */}
          {profile.isPremium === true && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>💎 Membro Apoiador</Text>
            </View>
          )}
        </View>
      </View>

      {/* ============================================ */}
      {/* RECONHECIMENTO MINISTERIAL */}
      {/* ============================================ */}
      {!ehMembro && (
        <View style={styles.endossosSection}>
          <Text style={styles.sectionTitle}>🙌 Reconhecimento Ministerial</Text>

          <View style={styles.endossosCard}>
            <View style={styles.endossosCountContainer}>
              <Text style={styles.endossosCountNumber}>{contagemReal}</Text>
              <Text style={styles.endossosCountLabel}>
                {contagemReal === 1 ? 'ponto de endosso' : 'pontos de endosso'} neste ministério
              </Text>
            </View>

            {/* Barra de progresso para reconhecimento */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: isReconhecido ? '100%' : `${Math.min((contagemReal / ENDOSSOS_MINIMOS_RECONHECIMENTO) * 100, 100)}%`,
                    backgroundColor: isReconhecido ? '#4CAF50' : COLORS.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressBarLabel}>
              {isReconhecido
                ? '✅ Ministério Reconhecido!'
                : `${ENDOSSOS_MINIMOS_RECONHECIMENTO - contagemReal} endosso(s) para ser reconhecido`}
            </Text>

            {/* Botão de Endossar (apenas se não for o próprio utilizador) */}
            {!ehProprio && currentUser && (
              <TouchableOpacity
                style={[
                  styles.endossarBtn,
                  jaEndossou && styles.endossarBtnRemover,
                  endossando && styles.endossarBtnDisabled,
                ]}
                onPress={handleEndossar}
                disabled={endossando}
                activeOpacity={0.85}
              >
                {endossando ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <>
                    <Text style={styles.endossarBtnIcon}>
                      {jaEndossou ? '❌' : '🙌'}
                    </Text>
                    <Text style={styles.endossarBtnText}>
                      {jaEndossou ? 'Remover Endosso' : 'Endossar Ministério'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!currentUser && (
              <View style={styles.loginParaEndossar}>
                <Text style={styles.loginParaEndossarText}>
                  🔒 Faça login para endossar ministérios.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ============================================ */}
      {/* ESTATÍSTICAS */}
      {/* ============================================ */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>📊 Estatísticas</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {profile.stats?.oracoes_feitas || 0}
            </Text>
            <Text style={styles.statLabel}>Orações Feitas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {profile.stats?.dias_seguidos || 0}
            </Text>
            <Text style={styles.statLabel}>Dias Seguidos</Text>
          </View>
        </View>
      </View>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
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
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  // Loading / Error
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
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.gray500,
    marginBottom: SPACING.md,
  },
  voltarBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  voltarBtnText: {
    color: COLORS.white,
    fontWeight: '600',
  },

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
  },
  fotoWrapper: { position: 'relative', marginBottom: SPACING.md },
  fotoPerfil: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', ...SHADOWS.md },
  avatarText: { color: COLORS.white, fontSize: 40, fontWeight: 'bold' },
  nomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  nome: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  seloPremium: {
    fontSize: 22,
  },
  // ── Título Ministerial: 3 Estados de Verificação ──
  tituloTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  // Não Verificado (cinza/aviso)
  tituloTagNaoVerificado: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  tituloTagTextNaoVerificado: {
    color: '#888',
    fontWeight: '600',
  },
  tituloBadgeNaoVerificado: {
    fontSize: FONTS.sizes.sm,
  },
  // Verificado pela Comunidade (azul)
  tituloTagVerificadoComunidade: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  tituloTagTextVerificadoComunidade: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  tituloBadgeVerificadoComunidade: {
    fontSize: FONTS.sizes.sm,
  },
  // Verificado pela Liderança (dourado/premium)
  tituloTagVerificadoLideranca: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  tituloTagTextVerificadoLideranca: {
    color: '#92400E',
    fontWeight: '800',
  },
  tituloBadgeVerificadoLideranca: {
    fontSize: FONTS.sizes.sm,
  },
  tituloTagText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  premiumBadgeText: {
    fontSize: FONTS.sizes.sm,
    color: '#F57F17',
    fontWeight: '700',
  },

  // Seções
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  },

  // Endossos
  endossosSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  endossosCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  endossosCountContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  endossosCountNumber: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  endossosCountLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.gray200,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  progressBarLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  endossarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    ...SHADOWS.sm,
  },
  endossarBtnRemover: {
    backgroundColor: COLORS.danger,
  },
  endossarBtnDisabled: {
    opacity: 0.7,
  },
  endossarBtnIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  endossarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  loginParaEndossar: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  loginParaEndossarText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },

  // Estatísticas
  statsSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  statNumber: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    textAlign: 'center',
  },
});
