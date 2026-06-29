// MuralCelulaScreen — Pedidos de oração da célula
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, getCountFromServer, query } from 'firebase/firestore';
import { COLLECTIONS } from '../constants/firestore';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { db } from '../services/firebaseConfig';
import { listarPedidosDaCelula, denunciarPedido } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatarNomeCurto } from '../utils/formatters';

const getCatColor = (c) => ({ saude: '#EF4444', familia: '#3B82F6', financas: '#10B981', causas_impossiveis: '#F59E0B', gratidao: '#EC4899' }[c] || COLORS.gray400);
const getCatLabel = (c) => ({ saude: 'Saúde', familia: 'Família', financas: 'Finanças', causas_impossiveis: 'Causas Impossíveis', gratidao: 'Gratidão' }[c] || c);
const getTempo = (ts) => {
  if (!ts) return 'agora'; const d = ts.toDate ? ts.toDate() : new Date(ts); const agora = new Date();
  const min = Math.floor((agora - d) / 60000); if (min < 1) return 'agora'; if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60); if (h < 24) return `${h}h`; const dia = Math.floor(h / 24);
  if (dia < 30) return `${dia}d`; return d.toLocaleDateString('pt-BR');
};

const PedidoCard = React.memo(function PedidoCard({ pedido, onDenunciar }) {
  const nav = useNavigation(); const isResp = pedido.status === 'respondido'; const cor = getCatColor(pedido.categoria);
  return (
    <TouchableOpacity style={[s.card, isResp && s.cardResp]}
      onPress={() => isResp ? (pedido.testemunho_id ? nav.navigate('TestemunhoDetalhes', { testemunhoId: pedido.testemunho_id }) : Alert.alert('','Testemunho não encontrado.')) : nav.navigate('PedidoDetalhes', { pedidoId: pedido.id })}
      onLongPress={() => { if (!isResp) Alert.alert('Opções', null, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Denunciar', style: 'destructive', onPress: () => onDenunciar(pedido) }]); }}
      activeOpacity={0.85} delayLongPress={800}>
      <View style={s.cardHeader}>
        <TouchableOpacity style={s.autorRow} onPress={() => pedido.autor_id && nav.navigate('PublicProfile', { userId: pedido.autor_id })} activeOpacity={0.7}>
          {pedido.autor_foto_url ? <Image source={{ uri: pedido.autor_foto_url }} style={s.avatar} /> : <View style={s.avatar}><Text style={s.avatarText}>{pedido.autor_nome?.charAt(0)?.toUpperCase() || '?'}</Text></View>}
          <View style={s.autorInfo}><Text style={s.autorNome} numberOfLines={1}>{formatarNomeCurto(pedido.autor_nome)}</Text><Text style={s.autorTempo}>{getTempo(pedido.createdAt)}</Text></View>
        </TouchableOpacity>
        {isResp && <View style={s.badgeResp}><Text style={s.badgeRespText}>🎉 Respondido</Text></View>}
      </View>
      <View style={[s.catTag, { backgroundColor: cor + '18' }]}><View style={[s.catDot, { backgroundColor: cor }]} /><Text style={[s.catText, { color: cor }]}>{getCatLabel(pedido.categoria)}</Text></View>
      <Text style={s.cardTexto} numberOfLines={4} ellipsizeMode="tail">{pedido.texto}</Text>
      <View style={s.interRow}><View style={s.interItem}><Text style={s.interIcone}>🙏</Text><Text style={s.interCont}>{pedido.intercessores_count || 0}</Text></View><View style={s.interItem}><Text style={s.interIcone}>💬</Text><Text style={s.interCont}>{pedido.mensagens_count || 0}</Text></View></View>
    </TouchableOpacity>
  );
});

export default function MuralCelulaScreen({ route }) {
  const { celulaId } = route.params;
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const unsub = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    try { unsub.current = listarPedidosDaCelula(celulaId, (l) => { setPedidos(l); setLoading(false); }); }
    catch (e) { console.warn('[Mural]', e.message); setLoading(false); }
    return () => { if (unsub.current) unsub.current(); };
  }, [user, celulaId]);

  // Busca contagem real de mensagens para cada pedido
  const carregarContagens = useCallback(async (listaPedidos) => {
    if (!listaPedidos || listaPedidos.length === 0) return {};
    try {
      const resultados = await Promise.all(
        listaPedidos.map(async (pedido) => {
          if (pedido.status === 'respondido' && pedido.testemunho_id) {
            // Pedido respondido: conta mensagens do testemunho vinculado
            const q = query(collection(db, 'testemunhos', pedido.testemunho_id, 'mensagens_apoio'));
            const snap = await getCountFromServer(q);
            return { id: pedido.id, count: snap.data().count };
          }
          // Pedido normal: conta mensagens de apoio do próprio pedido
          const q = query(collection(db, 'pedidos_oracao', pedido.id, 'mensagens_apoio'));
          const snap = await getCountFromServer(q);
          return { id: pedido.id, count: snap.data().count };
        })
      );
      const mapa = {};
      resultados.forEach((r) => { mapa[r.id] = r.count; });
      return mapa;
    } catch (e) {
      console.warn('[Mural] Erro ao buscar contagens:', e.message);
      return {};
    }
  }, []);

  const [contagensMensagens, setContagensMensagens] = useState({});

  useEffect(() => {
    if (pedidos.length > 0) {
      carregarContagens(pedidos).then(setContagensMensagens);
    }
  }, [pedidos, carregarContagens]);

  const handleDenunciar = useCallback(async (p) => {
    if (!user) { Alert.alert('Atenção', 'Faça login.'); return; }
    Alert.alert('Denunciar', `Denunciar pedido de ${p.autor_nome}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Denunciar', style: 'destructive', onPress: async () => { try { await denunciarPedido(p.id, user.uid); Alert.alert('✅ Denúncia registrada'); } catch (e) { Alert.alert('Erro', e.message); } } },
    ]);
  }, [user]);

  if (loading) {
    return (<View style={s.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={s.loadingText}>Carregando pedidos...</Text></View>);
  }

  return (
    <View style={s.container}>
      <FlatList data={pedidos} renderItem={({ item }) => <PedidoCard pedido={{ ...item, mensagens_count: contagensMensagens[item.id] ?? item.mensagens_count ?? 0 }} onDenunciar={handleDenunciar} />}
        keyExtractor={(item) => item.id} contentContainerStyle={s.listContent} showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'} maxToRenderPerBatch={10} windowSize={7} initialNumToRender={8}
        ListEmptyComponent={<View style={s.emptyState}><Text style={s.emptyEmoji}>🙏</Text><Text style={s.emptyTitle}>Nenhum pedido na célula</Text><Text style={s.emptySubtitle}>Os pedidos de oração compartilhados com esta célula aparecerão aqui.</Text></View>}
      />
    </View>
  );
}


const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, color: COLORS.gray500, fontSize: FONTS.sizes.md },
  listContent: { padding: SPACING.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.md },
  cardResp: { backgroundColor: '#F0FFF0', borderWidth: 1.5, borderColor: '#4CAF50' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  autorRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.white, fontSize: FONTS.sizes.md, fontWeight: 'bold' },
  autorInfo: { marginLeft: 10, flex: 1 },
  autorNome: { fontSize: FONTS.sizes.md, fontWeight: '700', color: COLORS.gray800 },
  autorTempo: { fontSize: FONTS.sizes.xs, color: COLORS.gray400, marginTop: 2 },
  badgeResp: { backgroundColor: '#4CAF50', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  badgeRespText: { color: COLORS.white, fontSize: FONTS.sizes.xs, fontWeight: 'bold' },
  catTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, marginBottom: SPACING.sm },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  catText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  cardTexto: { fontSize: FONTS.sizes.md, color: COLORS.gray800, lineHeight: 22, marginBottom: SPACING.md },
  interRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: SPACING.sm },
  interItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  interIcone: { fontSize: 16 },
  interCont: { fontSize: FONTS.sizes.sm, color: COLORS.gray600, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xxl * 2 },
  emptyEmoji: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONTS.sizes.xl, fontWeight: 'bold', color: COLORS.gray700, marginBottom: SPACING.sm, textAlign: 'center' },
  emptySubtitle: { fontSize: FONTS.sizes.md, color: COLORS.gray500, textAlign: 'center', lineHeight: 22 },
});
