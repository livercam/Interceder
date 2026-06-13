// Tela Minhas Publicações - Gestão de Pedidos e Testemunhos do Utilizador
// Funcionalidades:
// - Duas abas: Pedidos e Testemunhos
// - Cartões com botões Editar e Apagar
// - Modal de edição inline
// - Confirmação antes de apagar

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import {
  buscarMinhasPublicacoes,
  editarPedido,
  editarTestemunho,
  apagarPedido,
  apagarTestemunho,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

// ============================================================
// Abas
// ============================================================
const ABAS = [
  { key: 'pedidos', label: '🙏 Pedidos' },
  { key: 'testemunhos', label: '🕊️ Testemunhos' },
];

// ============================================================
// Tela Principal
// ============================================================
export default function MinhasPublicacoesScreen({ navigation }) {
  const { user } = useAuth();
  const [abaAtiva, setAbaAtiva] = useState('pedidos');
  const [pedidos, setPedidos] = useState([]);
  const [testemunhos, setTestemunhos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal de edição
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState('');
  const [editandoTipo, setEditandoTipo] = useState(null); // 'pedido' | 'testemunho'
  const [salvando, setSalvando] = useState(false);

  // Carregar publicações
  const carregar = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const data = await buscarMinhasPublicacoes(user.uid);
      setPedidos(data.pedidos || []);
      setTestemunhos(data.testemunhos || []);
    } catch (error) {
      console.error('Erro ao carregar publicações:', error);
      Alert.alert('Erro', 'Não foi possível carregar as suas publicações.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ============================================================
  // Editar
  // ============================================================
  const handleAbrirEditar = (item, tipo) => {
    setEditandoItem(item);
    setEditandoTexto(item.texto || '');
    setEditandoTipo(tipo);
    setEditModalVisible(true);
  };

  const handleSalvarEdicao = async () => {
    if (!editandoTexto.trim()) {
      Alert.alert('Atenção', 'O texto não pode estar vazio.');
      return;
    }

    setSalvando(true);
    try {
      if (editandoTipo === 'pedido') {
        await editarPedido(editandoItem.id, editandoTexto);
      } else {
        await editarTestemunho(editandoItem.id, editandoTexto);
      }
      setEditModalVisible(false);
      setEditandoItem(null);
      setEditandoTexto('');
      setEditandoTipo(null);
      Alert.alert('✅ Atualizado!', 'Publicação editada com sucesso.');
      carregar(); // Recarregar lista
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível editar a publicação.');
    } finally {
      setSalvando(false);
    }
  };

  // ============================================================
  // Apagar
  // ============================================================
  const handleApagar = (item, tipo) => {
    const label = tipo === 'pedido' ? 'pedido' : 'testemunho';
    Alert.alert(
      `🗑️ Apagar ${label}`,
      `Tem certeza que deseja apagar este ${label}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (tipo === 'pedido') {
                await apagarPedido(item.id);
              } else {
                await apagarTestemunho(item.id);
              }
              Alert.alert('🗑️ Removido!', `${label.charAt(0).toUpperCase() + label.slice(1)} apagado com sucesso.`);
              carregar(); // Recarregar lista
            } catch (error) {
              Alert.alert('Erro', `Não foi possível apagar o ${label}.`);
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // Renderizar Cartão
  // ============================================================
  const renderItem = (item, tipo) => {
    const data = item.createdAt || item.criadoEm;
    const dataStr = data
      ? new Date(data.toDate ? data.toDate() : data).toLocaleDateString('pt-PT')
      : '';

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>
              {tipo === 'pedido' ? '🙏' : '🕊️'}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTipo}>
              {tipo === 'pedido' ? 'Pedido de Oração' : 'Testemunho'}
            </Text>
            <Text style={styles.cardData}>{dataStr}</Text>
          </View>
          <View style={[styles.statusTag, item.status === 'ativo' ? styles.statusAtivo : styles.statusModeracao]}>
            <Text style={[styles.statusText, item.status === 'ativo' ? styles.statusTextAtivo : styles.statusTextModeracao]}>
              {item.status === 'ativo' ? 'Ativo' : item.status === 'respondido' ? 'Respondido' : 'Moderação'}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTexto} numberOfLines={3}>
          {item.texto}
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleAbrirEditar(item, tipo)}
            activeOpacity={0.7}
          >
            <Text style={styles.editBtnText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleApagar(item, tipo)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteBtnText}>🗑️ Apagar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ============================================================
  // Render
  // ============================================================
  const listaAtual = abaAtiva === 'pedidos' ? pedidos : testemunhos;

  return (
    <View style={styles.container}>
      {/* Abas */}
      <View style={styles.tabBar}>
        {ABAS.map((aba) => (
          <TouchableOpacity
            key={aba.key}
            style={[styles.tab, abaAtiva === aba.key && styles.tabAtiva]}
            onPress={() => setAbaAtiva(aba.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, abaAtiva === aba.key && styles.tabTextAtiva]}>
              {aba.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando publicações...</Text>
        </View>
      ) : listaAtual.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{abaAtiva === 'pedidos' ? '🙏' : '🕊️'}</Text>
          <Text style={styles.emptyTitle}>
            Nenhum {abaAtiva === 'pedidos' ? 'pedido' : 'testemunho'} encontrado
          </Text>
          <Text style={styles.emptySubtitle}>
            {abaAtiva === 'pedidos'
              ? 'Publique um pedido no Mural de Oração.'
              : 'Compartilhe um testemunho na aba Testemunhos.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {listaAtual.map((item) => renderItem(item, abaAtiva === 'pedidos' ? 'pedido' : 'testemunho'))}
          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}

      {/* ============================================ */}
      {/* Modal de Edição */}
      {/* ============================================ */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✏️ Editar</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              {editandoTipo === 'pedido' ? 'Texto do Pedido' : 'Texto do Testemunho'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editandoTexto}
              onChangeText={setEditandoTexto}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!salvando}
              placeholder="Escreva o novo texto..."
              placeholderTextColor={COLORS.gray400}
            />

            <TouchableOpacity
              style={[styles.salvarBtn, salvando && styles.salvarBtnDisabled]}
              onPress={handleSalvarEdicao}
              disabled={salvando}
              activeOpacity={0.8}
            >
              {salvando ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.salvarBtnText}>💾 Salvar</Text>
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

  // Abas
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.xs,
    ...SHADOWS.md,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: RADIUS.md,
  },
  tabAtiva: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  tabTextAtiva: {
    color: COLORS.white,
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

  // Lista
  listContent: {
    padding: SPACING.lg,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  cardBadgeText: {
    fontSize: 18,
  },
  cardInfo: {
    flex: 1,
  },
  cardTipo: {
    fontSize: FONTS.sizes.sm,
    fontWeight: 'bold',
    color: COLORS.gray800,
  },
  cardData: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusAtivo: {
    backgroundColor: '#10B981' + '15',
  },
  statusModeracao: {
    backgroundColor: COLORS.danger + '15',
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  statusTextAtivo: {
    color: '#10B981',
  },
  statusTextModeracao: {
    color: COLORS.danger,
  },
  cardTexto: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray700,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },

  // Ações
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    paddingTop: SPACING.md,
  },
  editBtn: {
    flex: 1,
    backgroundColor: COLORS.primary + '10',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: COLORS.danger + '10',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.danger,
    fontWeight: '600',
  },

  // Estado Vazio
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: SPACING.lg,
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
  modalLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
  },
  modalInput: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 120,
    marginBottom: SPACING.md,
  },
  salvarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  salvarBtnDisabled: {
    opacity: 0.7,
  },
  salvarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
});
