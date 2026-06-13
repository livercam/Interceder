// Tela Gerenciar Solicitações - Gestão de Pedidos de Entrada em Células Fechadas
// Funcionalidades:
// - Lista todos os pedidos pendentes de uma célula
// - Botões Aprovar e Negar com feedback visual
// - Lógica segura: só remove da UI após confirmação do Firestore
// - Navegação via deep link ou botão na tela de detalhes da célula

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
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  getCelula,
  getUserProfile,
  aprovarSolicitacaoCelula,
} from '../services/firestoreService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function GerenciarSolicitacoesScreen({ route, navigation }) {
  const { celulaId } = route.params || {};
  const { user } = useAuth();

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(null); // UID sendo processado
  const [celulaNome, setCelulaNome] = useState('');

  // ============================================================
  // Carregar solicitações pendentes da célula
  // ============================================================
  const carregarSolicitacoes = useCallback(async () => {
    setCarregando(true);
    try {
      // Se celulaId foi fornecida (deep link ou navegação direta), carrega só dessa célula
      if (celulaId) {
        const celula = await getCelula(celulaId);
        if (!celula) {
          setSolicitacoes([]);
          setCelulaNome('');
          return;
        }

        setCelulaNome(celula.nome || '');

        const pendentesUids = celula.solicitacoes_pendentes || [];

        if (pendentesUids.length === 0) {
          setSolicitacoes([]);
          return;
        }

        // Buscar dados de cada solicitante em paralelo
        const perfis = await Promise.all(
          pendentesUids.map((uid) => getUserProfile(uid))
        );

        const dados = pendentesUids.map((uid, index) => ({
          uid,
          ...(perfis[index] || { nome: 'Carregando...', avatar: null }),
        }));

        setSolicitacoes(dados);
        return;
      } else {
        // Sem celulaId: buscar todas as células onde o user é líder
        const celulasQuery = query(
          collection(db, COLLECTIONS.CELULAS),
          where('lider_id', '==', user.uid)
        );
        const celulasSnap = await getDocs(celulasQuery);

        if (celulasSnap.empty) {
          setSolicitacoes([]);
          setCelulaNome('');
          return;
        }

        // Recolher todos os UIDs pendentes de todas as células
        const pendentesMap = {}; // uid -> { nomeCelula, celulaId }
        for (const docSnap of celulasSnap.docs) {
          const celula = docSnap.data();
          const pendentes = celula.solicitacoes_pendentes || [];
          pendentes.forEach((uid) => {
            if (!pendentesMap[uid]) {
              pendentesMap[uid] = [];
            }
            pendentesMap[uid].push({
              celulaId: docSnap.id,
              celulaNome: celula.nome || 'Célula',
            });
          });
        }

        const pendentesUids = Object.keys(pendentesMap);
        if (pendentesUids.length === 0) {
          setSolicitacoes([]);
          return;
        }

        // Buscar dados de cada solicitante
        const perfis = await Promise.all(
          pendentesUids.map((uid) => getUserProfile(uid))
        );

        const dados = pendentesUids.map((uid, index) => ({
          uid,
          celulas: pendentesMap[uid],
          ...(perfis[index] || { nome: 'Carregando...', avatar: null }),
        }));

        setSolicitacoes(dados);
        setCelulaNome('Todas as Células');
        return;
      }
    } catch (error) {
      console.warn('[GerenciarSolicitacoes] Erro ao carregar:', error?.message || 'Erro desconhecido');
      Alert.alert('Erro', 'Não foi possível carregar as solicitações.');
    } finally {
      setCarregando(false);
    }
  }, [celulaId]);

  useEffect(() => {
    carregarSolicitacoes();
  }, [carregarSolicitacoes]);

  // ============================================================
  // Aprovar solicitação (com segurança: só remove da UI após sucesso)
  // Suporta modo multi-células (quando celulaId não é fornecida)
  // ============================================================
  const handleAprovar = async (solicitanteUid, nomeSolicitante, celulasDoSolicitante) => {
    setProcessando(solicitanteUid);
    try {
      if (celulaId) {
        // Modo célula única (deep link ou navegação direta)
        await aprovarSolicitacaoCelula(celulaId, solicitanteUid, true);
        setSolicitacoes((prev) => prev.filter((s) => s.uid !== solicitanteUid));
        Alert.alert('✅ Aprovado!', `${nomeSolicitante} agora é membro da célula.`);
      } else {
        // Modo multi-células: aprovar em todas as células onde solicitou
        const celulas = celulasDoSolicitante || [];
        for (const celula of celulas) {
          await aprovarSolicitacaoCelula(celula.celulaId, solicitanteUid, true);
        }
        setSolicitacoes((prev) => prev.filter((s) => s.uid !== solicitanteUid));
        const nomesCelulas = celulas.map((c) => c.celulaNome).join(', ');
        Alert.alert('✅ Aprovado!', `${nomeSolicitante} foi aprovado em: ${nomesCelulas}.`);
      }
    } catch (error) {
      // Mantém o utilizador na lista — não remove da UI
      console.warn('[GerenciarSolicitacoes] Erro ao aprovar:', error.message);
      Alert.alert('Erro', 'Não foi possível aprovar. Tente novamente.');
    } finally {
      setProcessando(null);
    }
  };

  // ============================================================
  // Negar solicitação (com segurança: só remove da UI após sucesso)
  // Suporta modo multi-células (quando celulaId não é fornecida)
  // ============================================================
  const handleNegar = (solicitanteUid, nomeSolicitante, celulasDoSolicitante) => {
    const mensagem = celulaId
      ? `Tem certeza que deseja negar a entrada de ${nomeSolicitante}?`
      : `Tem certeza que deseja negar a entrada de ${nomeSolicitante} em todas as células que solicitou?`;

    Alert.alert(
      'Negar Solicitação',
      mensagem,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Negar',
          style: 'destructive',
          onPress: async () => {
            setProcessando(solicitanteUid);
            try {
              if (celulaId) {
                // Modo célula única
                await aprovarSolicitacaoCelula(celulaId, solicitanteUid, false);
                setSolicitacoes((prev) => prev.filter((s) => s.uid !== solicitanteUid));
                Alert.alert('Solicitação negada', `${nomeSolicitante} foi removido(a) da lista.`);
              } else {
                // Modo multi-células: negar em todas
                const celulas = celulasDoSolicitante || [];
                for (const celula of celulas) {
                  await aprovarSolicitacaoCelula(celula.celulaId, solicitanteUid, false);
                }
                setSolicitacoes((prev) => prev.filter((s) => s.uid !== solicitanteUid));
                Alert.alert('Solicitação negada', `${nomeSolicitante} foi removido(a) de todas as células.`);
              }
            } catch (error) {
              // Mantém o utilizador na lista — não remove da UI
              console.warn('[GerenciarSolicitacoes] Erro ao negar:', error.message);
              Alert.alert('Erro', 'Não foi possível negar. Tente novamente.');
            } finally {
              setProcessando(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          🙋 Solicitações Pendentes
        </Text>
        {celulaNome ? (
          <Text style={styles.headerSubtitle}>
            {celulaNome}
          </Text>
        ) : null}
      </View>

      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando solicitações...</Text>
        </View>
      ) : solicitacoes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={styles.emptyTitle}>Nenhuma solicitação pendente</Text>
          <Text style={styles.emptySubtitle}>
            Quando alguém pedir para entrar na célula, aparecerá aqui.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {solicitacoes.map((solicitante) => (
            <View key={solicitante.uid} style={styles.solicitacaoCard}>
              {/* Avatar e Nome */}
              <View style={styles.solicitacaoInfo}>
                {solicitante.avatar ? (
                  <Image
                    source={{ uri: solicitante.avatar }}
                    style={styles.solicitacaoAvatar}
                  />
                ) : (
                  <View style={styles.solicitacaoAvatarFallback}>
                    <Text style={styles.solicitacaoAvatarText}>
                      {solicitante.nome?.charAt(0)?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.solicitacaoTextos}>
                  <Text style={styles.solicitacaoNome} numberOfLines={1}>
                    {solicitante.nome || 'Irmão(ã)'}
                  </Text>
                  {solicitante.titulo_ministerial && (
                    <Text style={styles.solicitacaoCargo}>
                      {solicitante.titulo_ministerial === 'diacono' ? 'Diácono' :
                       solicitante.titulo_ministerial === 'missionario' ? 'Missionário' :
                       solicitante.titulo_ministerial === 'evangelista' ? 'Evangelista' :
                       solicitante.titulo_ministerial === 'presbitero' ? 'Presbítero' :
                       solicitante.titulo_ministerial === 'pastor' ? 'Pastor' :
                       solicitante.titulo_ministerial === 'administrador' ? 'Administrador' :
                       'Membro'}
                    </Text>
                  )}
                </View>
              </View>

              {/* Botões Aprovar / Negar */}
              <View style={styles.solicitacaoBotoes}>
                <TouchableOpacity
                  style={[styles.btnAprovar, processando === solicitante.uid && styles.btnDisabled]}
                  onPress={() => handleAprovar(solicitante.uid, solicitante.nome, solicitante.celulas)}
                  disabled={processando === solicitante.uid}
                  activeOpacity={0.8}
                >
                  {processando === solicitante.uid ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.btnAprovarText}>✅ Aprovar</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnNegar, processando === solicitante.uid && styles.btnDisabled]}
                  onPress={() => handleNegar(solicitante.uid, solicitante.nome, solicitante.celulas)}
                  disabled={processando === solicitante.uid}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnNegarText}>❌ Negar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
    ...SHADOWS.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.gray500,
    fontSize: FONTS.sizes.md,
  },

  // Estado vazio
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
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
    lineHeight: 22,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  // Card de cada solicitação
  solicitacaoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.md,
  },
  solicitacaoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  solicitacaoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: SPACING.md,
  },
  solicitacaoAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  solicitacaoAvatarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  solicitacaoTextos: {
    flex: 1,
  },
  solicitacaoNome: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  solicitacaoCargo: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    marginTop: 2,
  },
  solicitacaoBotoes: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btnAprovar: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnAprovarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  btnNegar: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnNegarText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
