// Tela de Perfil Público v2 - Completo
// Mostra: foto, nome, cargo, biografia, células, pedidos, testemunhos,
// estatísticas, conquistas, endossos, última atividade

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
// Tela Principal
// ============================================================
export default function PublicProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [endossando, setEndossando] = useState(false);
  const [imagemComErro, setImagemComErro] = useState(false);
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* ===== HEADER ===== */}
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          {/* Avatar */}
          <View style={styles.fotoWrapper}>
            {profile.foto_url && !imagemComErro ? (
              <Image source={{ uri: profile.foto_url }} style={styles.fotoPerfil} onError={() => setImagemComErro(true)} />
            ) : (
              <View style={styles.avatarContainer}>
                <Text style={styles.avatarText}>{profile.nome?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
            )}
          </View>

          {/* Nome */}
          <View style={styles.nomeRow}>
            <Text style={styles.nome}>{formatarNomeCurto(profile.nome) || 'Usuário'}</Text>
            {profile.isPremium === true && <Text style={styles.seloPremium}>💎</Text>}
          </View>

          {/* Cargo */}
          {!isReconhecido ? (
            <View style={[styles.tituloTag, styles.tituloTagNaoVerificado]}>
              <Text style={[styles.tituloTagText, styles.tituloTagTextNaoVerificado]}>{tituloLabel}</Text>
              <Text style={{ fontSize: 12, marginLeft: 4 }}>⚠️</Text>
            </View>
          ) : profile?.verificado_lideranca === true ? (
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

          {/* Data de cadastro */}
          {dataMembro && (
            <Text style={styles.membroDesde}>Membro desde {formatDate(dataMembro)}</Text>
          )}
        </View>
      </View>

      {/* ===== BIOGRAFIA ===== */}
      {profile.biografia ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Sobre</Text>
          <View style={styles.card}>
            <Text style={styles.bioText}>{profile.biografia}</Text>
          </View>
        </View>
      ) : null}

      {/* ===== CONQUISTAS ===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏅 Conquistas</Text>
        <View style={styles.conquistasGrid}>
          {conquistas.map((c, i) => (
            <ConquistaBadge key={i} icone={c.icone} label={c.label} ativo={c.ativo} descricao={c.descricao} />
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
              <View style={[styles.progressFill, {
                width: isReconhecido ? '100%' : `${Math.min((contagemReal / ENDOSSOS_MINIMOS_RECONHECIMENTO) * 100, 100)}%`,
                backgroundColor: isReconhecido ? '#4CAF50' : COLORS.primary,
              }]} />
            </View>
            <Text style={styles.progressLabel}>
              {isReconhecido
                ? '✅ Ministério Reconhecido!'
                : `${ENDOSSOS_MINIMOS_RECONHECIMENTO - contagemReal} endosso(s) para reconhecimento`
              }
            </Text>

            {!ehProprio && currentUser && (
              <TouchableOpacity
                style={[styles.endossarBtn, jaEndossou && styles.endossarBtnRemover, endossando && { opacity: 0.7 }]}
                onPress={handleEndossar}
                disabled={endossando}
                activeOpacity={0.85}
              >
                {endossando ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>{jaEndossou ? '❌' : '🙌'}</Text>
                    <Text style={styles.endossarBtnText}>
                      {jaEndossou ? 'Remover Endosso' : 'Endossar Ministério'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {!currentUser && (
              <View style={styles.loginCard}>
                <Text style={{ color: COLORS.gray500, fontSize: 13 }}>🔒 Faça login para endossar</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.xxl },
  containerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONTS.sizes.md },

  // Header
  headerCard: { backgroundColor: '#F2D5C4', borderBottomWidth: 6, borderBottomColor: '#F8E0D4', ...SHADOWS.md, overflow: 'hidden' },
  headerContent: { alignItems: 'center', paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.lg },
  fotoWrapper: { position: 'relative', marginBottom: SPACING.md },
  fotoPerfil: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', ...SHADOWS.md },
  avatarText: { color: '#FFF', fontSize: 40, fontWeight: 'bold' },
  nomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  nome: { fontSize: FONTS.sizes.xxl, fontWeight: 'bold', color: COLORS.gray800 },
  seloPremium: { fontSize: 22 },
  membroDesde: { fontSize: FONTS.sizes.sm, color: COLORS.gray500, marginTop: SPACING.sm },

  // Título Ministerial
  tituloTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1 },
  tituloTagNaoVerificado: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  tituloTagTextNaoVerificado: { color: '#888', fontWeight: '600' },
  tituloTagVerificadoComunidade: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  tituloTagTextVerificadoComunidade: { color: '#1D4ED8', fontWeight: '700' },
  tituloTagVerificadoLideranca: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  tituloTagTextVerificadoLideranca: { color: '#92400E', fontWeight: '800' },
  tituloTagText: { fontSize: FONTS.sizes.sm, fontWeight: '700' },

  // Seções
  section: { marginHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: 'bold', color: COLORS.gray800, marginBottom: SPACING.sm },
  card: { backgroundColor: '#FFF', borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.md },

  // Bio
  bioText: { fontSize: FONTS.sizes.md, color: COLORS.gray600, lineHeight: 22 },

  // Conquistas
  conquistasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  conquistaBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, gap: 4 },
  conquistaAtiva: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC' },
  conquistaInativa: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB', opacity: 0.6 },
  conquistaIcone: { fontSize: 14 },
  conquistaLabel: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  conquistaLabelAtiva: { color: '#166534' },
  conquistaLabelInativa: { color: '#9CA3AF' },

  // Células
  celulasList: { gap: SPACING.sm },
  celulaCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#FFF', borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOWS.sm },
  celulaNome: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: COLORS.gray700 },

  // Itens (pedidos/testemunhos)
  itemCard: { backgroundColor: '#FFF', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  itemCategoria: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: '600', backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  itemGlorias: { fontSize: FONTS.sizes.xs, color: '#B45309', fontWeight: '600' },
  itemData: { fontSize: FONTS.sizes.xs, color: COLORS.gray400 },
  itemTexto: { fontSize: FONTS.sizes.sm, color: COLORS.gray600, lineHeight: 20 },

  // Estatísticas
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statBox: { flex: 1, minWidth: '45%', backgroundColor: '#FFF', borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.md },
  statNumero: { fontSize: FONTS.sizes.xxxl, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.gray500, marginTop: 4 },

  // Endossos
  endossoNumero: { fontSize: 40, fontWeight: 'bold', color: COLORS.primary },
  endossoLabel: { fontSize: FONTS.sizes.sm, color: COLORS.gray500, marginTop: SPACING.xs },
  progressBar: { height: 8, backgroundColor: COLORS.gray200, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: SPACING.xs },
  progressFill: { height: '100%', borderRadius: RADIUS.full },
  progressLabel: { fontSize: FONTS.sizes.xs, color: COLORS.gray500, textAlign: 'center', marginBottom: SPACING.md },
  endossarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 14, ...SHADOWS.sm },
  endossarBtnRemover: { backgroundColor: COLORS.danger },
  endossarBtnText: { color: '#FFF', fontSize: FONTS.sizes.md, fontWeight: 'bold' },
  loginCard: { backgroundColor: COLORS.gray50, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray200 },
});