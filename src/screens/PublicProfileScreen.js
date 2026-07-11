// Tela de Perfil Público v3 - Jornada Espiritual e Conectividade
// Design Pixel Perfect: fundo desfocado, sobreposição branca, avatar com selo,
// botões empilhados à esquerda + vibe card à direita

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { COLLECTIONS } from '../constants/firestore';
import { getUserProfile, alternarEndosso } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

const ENDOSSOS_MINIMOS_RECONHECIMENTO = 5;

const TITULOS_MINISTERIAIS = [
  { value: 'membro', label: 'Membro' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'missionario', label: 'Missionário' },
  { value: 'evangelista', label: 'Evangelista' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'pastor', label: 'Pastor' },
];

// Mapa de Vibes para exibição no perfil público
const VIBE_MAP = {
  oracao: { icone: '🛐', label: 'Em Oração' },
  estudo: { icone: '📖', label: 'Focado na Palavra' },
  servir: { icone: '🙌', label: 'Servindo' },
  celula: { icone: '🤝', label: 'Em Célula' },
};

// ============================================================
// Helpers
// ============================================================
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function formatDataRelativa(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const agora = new Date();
  const diffDias = Math.floor((agora - d) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) return 'hoje';
  if (diffDias === 1) return 'ontem';
  if (diffDias < 7) return `há ${diffDias} dias`;
  if (diffDias < 30) return `há ${Math.floor(diffDias / 7)} semana(s)`;
  if (diffDias < 365) return `há ${Math.floor(diffDias / 30)} mes(es)`;
  return `há ${Math.floor(diffDias / 365)} ano(s)`;
}

function calcularDiasDesde(data) {
  if (!data) return 0;
  const d = data.toDate ? data.toDate() : new Date(data);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================
// Componente de Badge/Conquista
// ============================================================
function ConquistaBadge({ icone, label, ativo, descricao }) {
  return (
    <View style={[styles.conquistaBadge, ativo ? styles.conquistaAtiva : styles.conquistaInativa]}>
      <Text style={styles.conquistaIcone}>{icone}</Text>
      <Text style={[styles.conquistaLabel, ativo ? styles.conquistaLabelAtiva : styles.conquistaLabelInativa]}>
        {label}
      </Text>
    </View>
  );
}

// ============================================================
// Componente de Pílula de Interesse
// ============================================================
function InteressePill({ label }) {
  return (
    <View style={styles.interessePill}>
      <Text style={styles.interessePillText}>{label}</Text>
    </View>
  );
}

// ============================================================
// Tela Principal
// ============================================================
export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [endossando, setEndossando] = useState(false);
  const [imagemComErro, setImagemComErro] = useState(false);
  const [bgImagemComErro, setBgImagemComErro] = useState(false);
  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  const [testemunhos, setTestemunhos] = useState([]);
  const [celulas, setCelulas] = useState([]);
  const [totalIntercessoes, setTotalIntercessoes] = useState(0);

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
        setImagemComErro(false);
        setBgImagemComErro(false);

        // Carregar dados adicionais em paralelo
        const promises = [];

        // Últimos 3 pedidos do usuário
        promises.push(
          (async () => {
            const q = query(
              collection(db, 'pedidos_oracao'),
              where('autor_id', '==', userId),
              orderBy('createdAt', 'desc'),
              limit(3)
            );
            const snap = await getDocs(q);
            setUltimosPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          })()
        );

        // Testemunhos do usuário
        promises.push(
          (async () => {
            const q = query(
              collection(db, 'testemunhos'),
              where('autor_id', '==', userId),
              orderBy('criadoEm', 'desc'),
              limit(3)
            );
            const snap = await getDocs(q);
            setTestemunhos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          })()
        );

        // Células do usuário
        if (dados.celulas_inscritas?.length > 0) {
          promises.push(
            (async () => {
              const q = query(
                collection(db, 'celulas'),
                where('__name__', 'in', dados.celulas_inscritas.slice(0, 10))
              );
              const snap = await getDocs(q);
              setCelulas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            })()
          );
        }

        await Promise.allSettled(promises);
      } catch (error) {
        console.error('[PublicProfile] Erro:', error);
        Alert.alert('Erro', 'Não foi possível carregar o perfil.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [userId]);

  const statsDataFull = profile?.stats || {};
  const jaEndossou = profile?.endossos_uids?.includes(currentUser?.uid) || false;

  const isReconhecido =
    (statsDataFull.endossos_recebidos || 0) >= 5 || profile?.verificado_lideranca === true;

  const contagemReal = statsDataFull.endossos_recebidos || 0;
  const ehMembro = profile?.titulo_ministerial === 'membro';
  const ehProprio = currentUser?.uid === userId;

  const tituloLabel = TITULOS_MINISTERIAIS.find(
    (t) => t.value === profile?.titulo_ministerial
  )?.label || 'Membro';

  // Dados da Vibe
  const vibeData = profile?.vibe_atual ? VIBE_MAP[profile.vibe_atual] : null;

  // Computar conquistas
  const conquistas = useMemo(() => {
    const stats = profile?.stats || {};
    const totalPedidos = stats.oracoes_feitas || 0;
    const totalTestemunhosFeitos = testemunhos.length || 0;
    const diasMembro = calcularDiasDesde(profile?.criadoEm || profile?.createdAt);
    return [
      {
        icone: '🙏',
        label: '10 Pedidos',
        ativo: totalPedidos >= 10,
        descricao: `${totalPedidos} pedido(s) feito(s)`,
      },
      {
        icone: '🕊️',
        label: 'Testemunhos',
        ativo: totalTestemunhosFeitos >= 1,
        descricao: `${totalTestemunhosFeitos} testemunho(s)`,
      },
      {
        icone: '💎',
        label: 'Apoiador',
        ativo: profile?.isPremium === true,
        descricao: profile?.isPremium ? 'Premium ativo' : 'Premium inativo',
      },
      {
        icone: '🔥',
        label: '30 Dias',
        ativo: diasMembro >= 30,
        descricao: `${diasMembro} dia(s) de comunidade`,
      },
      {
        icone: '👑',
        label: 'Reconhecido',
        ativo: isReconhecido,
        descricao: `${contagemReal} endosso(s)`,
      },
      {
        icone: '🏠',
        label: 'Célula',
        ativo: celulas.length > 0,
        descricao: `${celulas.length} célula(s)`,
      },
    ];
  }, [profile, testemunhos.length, celulas.length, isReconhecido, contagemReal]);

  const executarEndosso = useCallback(async (tipoEndosso) => {
    setEndossando(true);
    try {
      await alternarEndosso(currentUser.uid, userId, !jaEndossou, tipoEndosso);
      setProfile((prev) => {
        if (!prev) return prev;
        const novosEndossos = jaEndossou
          ? (prev.endossos_uids || []).filter((uid) => uid !== currentUser.uid)
          : [...(prev.endossos_uids || []), currentUser.uid];
        const atualizacao = { ...prev, endossos_uids: novosEndossos };
        if (!jaEndossou && tipoEndosso === 'super') {
          atualizacao.verificado_lideranca = true;
        }
        if (!jaEndossou) {
          getUserProfile(userId).then((dadosAtualizados) => {
            if (dadosAtualizados) {
              setProfile((prevAtual) => ({ ...prevAtual, ...dadosAtualizados }));
            }
          }).catch(() => {});
        }
        return atualizacao;
      });
    } catch (error) {
      console.error('[ERRO ENDOSSO]:', error);
      Alert.alert('Erro', error.message || 'Não foi possível processar o endosso.');
    } finally {
      setEndossando(false);
    }
  }, [currentUser, userId, jaEndossou]);

  const handleEndossar = useCallback(async () => {
    if (!currentUser) {
      Alert.alert('Atenção', 'Faça login para endossar.');
      return;
    }
    if (jaEndossou) {
      await executarEndosso('normal');
      return;
    }
    let ehLider = false;
    try {
      const celulasQuery = query(
        collection(db, COLLECTIONS.CELULAS),
        where('lider_id', '==', currentUser.uid),
        where('membros_ids', 'array-contains', userId)
      );
      const celulasSnap = await getDocs(celulasQuery);
      ehLider = !celulasSnap.empty;
    } catch (queryError) {
      console.warn('[VerificacaoLideranca] Erro:', queryError.message);
    }
    if (ehLider) {
      Alert.alert(
        'Opções de Endosso',
        'Como líder deste membro, qual nível de endosso deseja conceder?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Endosso Normal', onPress: () => executarEndosso('normal') },
          { text: 'Super Endosso (Verificado)', onPress: () => executarEndosso('super') },
        ]
      );
    } else {
      await executarEndosso('normal');
    }
  }, [currentUser, userId, jaEndossou, executarEndosso]);

  if (loading) {
    return (
      <View style={styles.containerLoading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.containerLoading}>
        <Text style={{ fontSize: FONTS.sizes.lg, color: COLORS.gray500 }}>Perfil não encontrado</Text>
      </View>
    );
  }

  const statsData = profile.stats || {};
  const dataMembro = profile.criadoEm || profile.createdAt || profile.criado_em;
  const qtdPedidos = statsData.oracoes_feitas || 0;
  const qtdIntercessoes = statsData.oracoes_hoje || 0;
  const qtdTestemunhos = statsData.testemunhos || 0;

  const temFotoBg = profile.foto_url && !bgImagemComErro;

  return (
    <View style={styles.container}>
      {/* ===== FUNDO DESFOCADO ===== */}
      {temFotoBg ? (
        <Image
          source={{ uri: profile.foto_url }}
          style={styles.backgroundBlur}
          blurRadius={20}
          onError={() => setBgImagemComErro(true)}
        />
      ) : (
        <View style={[styles.backgroundBlur, { backgroundColor: '#334155' }]} />
      )}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== CONTAINER BRANCO PRINCIPAL ===== */}
        <View style={styles.mainCard}>
          {/* ===== AVATAR ===== */}
          <View style={styles.avatarSection}>
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
              {/* Selo de Verificado */}
              {isReconhecido && (
                <View style={styles.seloVerificado}>
                  <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                </View>
              )}
            </View>

            {/* Nome */}
            <Text style={styles.nome}>
              {formatarNomeCurto(profile.nome) || 'Usuário'}
              {profile.isPremium === true ? ' 💎' : ''}
            </Text>

            {/* Título Ministerial */}
            <Text style={styles.tituloMinisterial}>{tituloLabel}</Text>
          </View>

          {/* ===== STATISTICS ===== */}
          <View style={styles.statsHeaderSection}>
            <Text style={styles.statsSectionLabel}>ESTATÍSTICAS</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color={COLORS.gray500} />
                <Text style={styles.statItemText}>0 Seguidores</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Ionicons name="person-outline" size={16} color={COLORS.gray500} />
                <Text style={styles.statItemText}>0 Seguindo</Text>
              </View>
            </View>
          </View>

          {/* ===== BIOGRAFIA ===== */}
          {profile.biografia ? (
            <View style={styles.bioSection}>
              <Text style={styles.bioSectionLabel}>SOBRE</Text>
              <Text style={styles.bioText}>{profile.biografia}</Text>
            </View>
          ) : null}

          {/* ===== BOTÕES + MINHA VIBE (ROW) ===== */}
          <View style={styles.acoesVibeRow}>
            {/* Coluna Esquerda - Botões */}
            <View style={styles.acoesColuna}>
              <TouchableOpacity
                style={styles.btnSeguir}
                activeOpacity={0.85}
                onPress={() => Alert.alert('Em breve', 'Funcionalidade de seguir será implementada em breve.')}
              >
                <Text style={styles.btnSeguirText}>SEGUIR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnMensagem}
                activeOpacity={0.85}
                onPress={() => Alert.alert('Em breve', 'Funcionalidade de mensagem será implementada em breve.')}
              >
                <Text style={styles.btnMensagemText}>MENSAGEM</Text>
              </TouchableOpacity>
            </View>

            {/* Coluna Direita - Minha Vibe (card quadrado) */}
            {vibeData && (
              <View style={styles.vibeCardQuadrado}>
                <Text style={styles.vibeCardIconeGrande}>{vibeData.icone}</Text>
                <Text style={styles.vibeCardLabelPequeno}>{vibeData.label}</Text>
              </View>
            )}
          </View>

          {/* ===== TAGS DE INTERESSE ===== */}
          {profile.interesses?.length > 0 && (
            <View style={styles.interessesSection}>
              <Text style={styles.sectionTitle}>Tags de Interesse</Text>
              <View style={styles.interessesRow}>
                {profile.interesses.map((tag, idx) => (
                  <InteressePill key={idx} label={tag} />
                ))}
              </View>
            </View>
          )}

          {/* ===== CONQUISTAS ===== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏅 Conquistas</Text>
            <View style={styles.conquistasGrid}>
              {conquistas.map((c, i) => (
                <ConquistaBadge
                  key={i}
                  icone={c.icone}
                  label={c.label}
                  ativo={c.ativo}
                  descricao={c.descricao}
                />
              ))}
            </View>
          </View>

          {/* ===== CÉLULAS ===== */}
          {celulas.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏠 Células</Text>
              <View style={styles.celulasList}>
                {celulas.map((cel) => (
                  <View key={cel.id} style={styles.celulaCard}>
                    <Ionicons name="home" size={18} color={COLORS.primary} />
                    <Text style={styles.celulaNome}>{cel.nome}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ===== ÚLTIMOS PEDIDOS ===== */}
          {ultimosPedidos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🙏 Últimos Pedidos</Text>
              {ultimosPedidos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.itemCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('PedidoDetalhes', { pedidoId: p.id })}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemCategoria}>{p.categoria || 'Geral'}</Text>
                    <Text style={styles.itemData}>{formatDataRelativa(p.createdAt)}</Text>
                  </View>
                  <Text style={styles.itemTexto} numberOfLines={2}>
                    {p.texto || '(sem texto)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ===== TESTEMUNHOS ===== */}
          {testemunhos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🕊️ Testemunhos</Text>
              {testemunhos.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.itemCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('TestemunhoDetalhes', { testemunhoId: t.id })}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemGlorias}>🙌 {t.glorias || 0}</Text>
                    <Text style={styles.itemData}>{formatDataRelativa(t.criadoEm)}</Text>
                  </View>
                  <Text style={styles.itemTexto} numberOfLines={2}>
                    {t.texto || '(sem texto)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ===== ESTATÍSTICAS ===== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Estatísticas</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumero}>{qtdPedidos}</Text>
                <Text style={styles.statLabel}>Pedidos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumero}>{qtdTestemunhos}</Text>
                <Text style={styles.statLabel}>Testemunhos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumero}>{contagemReal}</Text>
                <Text style={styles.statLabel}>Endossos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumero}>{qtdIntercessoes}</Text>
                <Text style={styles.statLabel}>Intercessões</Text>
              </View>
            </View>
          </View>

          {/* ===== RECONHECIMENTO ===== */}
          {!ehMembro && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🙌 Reconhecimento Ministerial</Text>
              <View style={styles.card}>
                <View style={{ alignItems: 'center', marginBottom: SPACING.md }}>
                  <Text style={styles.endossoNumero}>{contagemReal}</Text>
                  <Text style={styles.endossoLabel}>
                    {contagemReal === 1 ? 'ponto de endosso' : 'pontos de endosso'}
                  </Text>
                </View>

                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: isReconhecido
                          ? '100%'
                          : `${Math.min((contagemReal / ENDOSSOS_MINIMOS_RECONHECIMENTO) * 100, 100)}%`,
                        backgroundColor: isReconhecido ? '#4CAF50' : COLORS.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {isReconhecido
                    ? '✅ Ministério Reconhecido!'
                    : `${ENDOSSOS_MINIMOS_RECONHECIMENTO - contagemReal} endosso(s) para reconhecimento`}
                </Text>

                {!ehProprio && currentUser && (
                  <TouchableOpacity
                    style={[
                      styles.endossarBtn,
                      jaEndossou && styles.endossarBtnRemover,
                      endossando && { opacity: 0.7 },
                    ]}
                    onPress={handleEndossar}
                    disabled={endossando}
                    activeOpacity={0.85}
                  >
                    {endossando ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>
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
                  <View style={styles.loginCard}>
                    <Text style={{ color: COLORS.gray500, fontSize: 13 }}>
                      🔒 Faça login para endossar
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  containerLoading: {
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

  // ===== FUNDO DESFOCADO =====
  backgroundBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },

  // ===== CONTAINER BRANCO PRINCIPAL =====
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 120,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: SPACING.lg,
    minHeight: 600,
  },

  // ===== AVATAR SECTION =====
  avatarSection: {
    alignItems: 'center',
    marginTop: -45,
  },
  fotoWrapper: {
    position: 'relative',
    alignSelf: 'center',
  },
  fotoPerfil: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: 'bold',
  },
  seloVerificado: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  nome: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray800,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  tituloMinisterial: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // ===== STATISTICS =====
  statsHeaderSection: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  statsSectionLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.gray400,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statItemText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.gray300,
    marginHorizontal: SPACING.md,
  },

  // ===== BIOGRAFIA =====
  bioSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  bioSectionLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: COLORS.gray400,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  bioText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray700,
    lineHeight: 22,
    textAlign: 'left',
  },

  // ===== AÇÕES + VIBE ROW =====
  acoesVibeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
  },
  acoesColuna: {
    flex: 1,
    marginRight: SPACING.md,
    justifyContent: 'center',
  },
  btnSeguir: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  btnSeguirText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  btnMensagem: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMensagemText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // ===== VIBE CARD QUADRADO =====
  vibeCardQuadrado: {
    width: 110,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '05',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  vibeCardIconeGrande: {
    fontSize: 36,
    marginBottom: SPACING.xs,
  },
  vibeCardLabelPequeno: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.gray600,
    textAlign: 'center',
  },

  // ===== INTERESSES =====
  interessesSection: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  interessesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  interessePill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    backgroundColor: 'transparent',
  },
  interessePillText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
  },

  // ===== SEÇÕES =====
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },

  // ===== CONQUISTAS =====
  conquistasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  conquistaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  conquistaAtiva: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  conquistaInativa: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  conquistaIcone: { fontSize: 14 },
  conquistaLabel: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  conquistaLabelAtiva: { color: '#166534' },
  conquistaLabelInativa: { color: '#9CA3AF' },

  // ===== CÉLULAS =====
  celulasList: { gap: SPACING.sm },
  celulaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  celulaNome: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.gray700 },

  // ===== ITENS =====
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  itemCategoria: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: '600',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemGlorias: { fontSize: FONTS.sizes.xs, color: '#B45309', fontWeight: '600' },
  itemData: { fontSize: FONTS.sizes.xs, color: COLORS.gray400 },
  itemTexto: { fontSize: FONTS.sizes.sm, color: COLORS.gray600, lineHeight: 20 },

  // ===== ESTATÍSTICAS GRID =====
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  statNumero: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray500,
    marginTop: 4,
  },

  // ===== ENDOSSOS =====
  endossoNumero: { fontSize: 40, fontWeight: 'bold', color: COLORS.primary },
  endossoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.gray500, marginTop: SPACING.xs },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray200,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: { height: '100%', borderRadius: RADIUS.full },
  progressLabel: {
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
  endossarBtnRemover: { backgroundColor: COLORS.danger },
  endossarBtnText: { color: '#FFF', fontSize: FONTS.sizes.md, fontWeight: 'bold' },
  loginCard: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
});