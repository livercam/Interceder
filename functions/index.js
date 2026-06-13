// ============================================================
// Cloud Functions v2 — Interceder Push Notifications
//
// MIGRADO: Expo Push API → Firebase Admin SDK (FCM HTTP v1)
// Service Account via require()
//
// ATENÇÃO: Nada de fs, path, ou async/await no escopo global.
// Toda lógica assíncrona deve estar DENTRO das funções.
// ============================================================

const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');

// ============================================================
// INICIALIZAÇÃO SÍNCRONA: Firebase Admin
// ============================================================
// O Firebase Functions gerencia o service-account.json automaticamente
// quando usamos `firebase deploy`. O arquivo precisa estar na pasta functions/
// e o Admin SDK encontra as credenciais por conta própria.
// Não usamos fs.readFileSync nem path — isso trava o deploy.
// ============================================================

admin.initializeApp();
const db = admin.firestore();

// ============================================================
// UTILITÁRIO: Enviar lote de push notifications via FCM v1
// ============================================================

async function enviarPushLote(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log('[Push] Nenhum token para enviar.');
    return;
  }

  const messages = tokens.map((token) => ({
    token,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'high',
      },
    },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')])
    ),
  }));

  try {
    const response = await admin.messaging().sendEach(messages);

    console.log(`[Push] ${response.successCount} enviada(s), ${response.failureCount} falha(s).`);

    if (response.failureCount > 0) {
      const tokensParaRemover = new Set();

      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          const code = resp.error?.code || '';
          if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || code.includes('registration-token-not-registered')) {
            console.warn(`[Push] Token inválido [${index}]: ${code}`);
            tokensParaRemover.add(tokens[index]);
          }
        }
      });

      if (tokensParaRemover.size > 0) {
        const batch = db.batch();
        const usersSnap = await db
          .collection('users')
          .where('expo_push_token', 'in', Array.from(tokensParaRemover))
          .get();

        usersSnap.forEach((doc) => batch.update(doc.ref, { expo_push_token: null }));
        await batch.commit();
        console.log(`[Push] ${tokensParaRemover.size} tokens removidos.`);
      }
    }
  } catch (error) {
    console.error('[Push] Erro no lote FCM:', error.message);
  }
}

// ============================================================
// FUNÇÃO HTTP: enviarPush
// Chamada pelo app mobile via fetch()
// POST /enviarPush  { token, title, body, data }
// ============================================================

exports.enviarPush = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const { token, title, body, data } = req.body || {};

  if (!token || !title || !body) {
    res.status(400).json({ error: 'token, title e body são obrigatórios.' });
    return;
  }

  try {
    const message = {
      token,
      notification: { title, body },
      android: { priority: 'high', notification: { channelId: 'default', sound: 'default', priority: 'high' } },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')])),
    };

    const messageId = await admin.messaging().send(message);
    console.log(`[enviarPush] OK: ${messageId}`);
    res.status(200).json({ success: true, messageId });
  } catch (error) {
    console.error('[enviarPush] Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GATILHO 1: Pedido de Oração em Célula
// ============================================================

exports.onPedidoCelulaCriado = onDocumentCreated(
  'pedidos_oracao/{pedidoId}',
  async (event) => {
    const pedido = event.data?.data();
    if (!pedido || pedido.privacidade !== 'celula') return;

    const autorId = pedido.autor_id;
    const celulasDestino = pedido.celulas_destino || [];
    if (celulasDestino.length === 0) return;

    const tokens = [];
    const visitados = new Set();

    for (const celulaId of celulasDestino) {
      if (visitados.has(celulaId)) continue;
      visitados.add(celulaId);

      try {
        const celSnap = await db.collection('celulas').doc(celulaId).get();
        if (!celSnap.exists) continue;

        const membros = (celSnap.data().membros_ids || []).filter((id) => id !== autorId);
        if (membros.length === 0) continue;

        const usersSnap = await db.collection('users').where('__name__', 'in', membros).get();
        usersSnap.forEach((d) => {
          const u = d.data();
          if (u.expo_push_token && u.push_notificacoes_activas !== false) {
            tokens.push(u.expo_push_token);
          }
        });
      } catch (err) {
        console.error(`[onPedidoCelula] Erro célula ${celulaId}:`, err.message);
      }
    }

    const unicos = [...new Set(tokens)];
    if (unicos.length > 0) {
      const nome = pedido.autor_nome || 'Alguém';
      const txt = (pedido.texto || '').substring(0, 120);
      await enviarPushLote(unicos, '📿 Novo pedido de oração', `${nome}: "${txt}"`, {
        screen: 'MuralCelula', tipo: 'pedido_celula', celulaId: celulasDestino[0],
      });
    }
  }
);

// ============================================================
// GATILHO 2: Feed de Ensino na Célula
// ============================================================

exports.onFeedCelulaCriado = onDocumentCreated(
  'celulas/{celulaId}/conteudos_ensino/{conteudoId}',
  async (event) => {
    const { celulaId } = event.params;
    const conteudo = event.data?.data();
    if (!conteudo) return;

    try {
      const celSnap = await db.collection('celulas').doc(celulaId).get();
      if (!celSnap.exists) return;

      const celula = celSnap.data();
      const membrosIds = celula.membros_ids || [];
      if (membrosIds.length === 0) return;

      const usersSnap = await db.collection('users').where('__name__', 'in', membrosIds).get();
      const tokens = [];
      usersSnap.forEach((d) => {
        const u = d.data();
        if (u.expo_push_token && u.push_notificacoes_activas !== false) tokens.push(u.expo_push_token);
      });

      if (tokens.length > 0) {
        const nomeCelula = celula.nome || 'Célula';
        const titulo = conteudo.titulo || 'Novo conteúdo';
        await enviarPushLote(tokens, `📖 Feed: ${nomeCelula}`, titulo, {
          screen: 'MuralCelula', celulaId, celulaNome: nomeCelula, tipo: 'celula_feed',
        });
      }
    } catch (err) {
      console.error('[onFeedCelula] Erro:', err.message);
    }
  }
);

// ============================================================
// GATILHO 3a: Mensagem de Apoio em Pedido
// ============================================================

exports.onMensagemApoioPedido = onDocumentCreated(
  'pedidos_oracao/{pedidoId}/mensagens_apoio/{msgId}',
  async (event) => {
    const { pedidoId } = event.params;
    const msg = event.data?.data();
    if (!msg) return;

    try {
      const pedSnap = await db.collection('pedidos_oracao').doc(pedidoId).get();
      if (!pedSnap.exists) return;
      const autorId = pedSnap.data().autor_id;
      if (autorId === msg.autor_id) return;

      const userSnap = await db.collection('users').doc(autorId).get();
      if (!userSnap.exists) return;

      const user = userSnap.data();
      if (!user.expo_push_token || user.push_notificacoes_activas === false) return;

      const nome = msg.autor_nome || 'Alguém';
      await enviarPushLote([user.expo_push_token], '💬 Mensagem de apoio', `${nome} escreveu no seu pedido.`, {
        screen: 'PedidoDetalhes', pedidoId, tipo: 'apoio',
      });
    } catch (err) {
      console.error('[onMsgPedido] Erro:', err.message);
    }
  }
);

// ============================================================
// GATILHO 3b: Mensagem de Apoio em Testemunho
// ============================================================

exports.onMensagemApoioTestemunho = onDocumentCreated(
  'testemunhos/{testemunhoId}/mensagens_apoio/{msgId}',
  async (event) => {
    const { testemunhoId } = event.params;
    const msg = event.data?.data();
    if (!msg) return;

    try {
      const tesSnap = await db.collection('testemunhos').doc(testemunhoId).get();
      if (!tesSnap.exists) return;
      const autorId = tesSnap.data().autor_id;
      if (autorId === msg.autor_id) return;

      const userSnap = await db.collection('users').doc(autorId).get();
      if (!userSnap.exists) return;

      const user = userSnap.data();
      if (!user.expo_push_token || user.push_notificacoes_activas === false) return;

      const nome = msg.autor_nome || 'Alguém';
      await enviarPushLote([user.expo_push_token], '💬 Mensagem de apoio', `${nome} escreveu no seu testemunho.`, {
        screen: 'TestemunhoDetalhes', testemunhoId, tipo: 'apoio_testemunho',
      });
    } catch (err) {
      console.error('[onMsgTestemunho] Erro:', err.message);
    }
  }
);

// ============================================================
// FUNÇÃO HTTP: enviarSuporte (Formulário de Contato)
// ============================================================

exports.enviarSuporte = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const { nome, email, assunto, mensagem, user_uid } = req.body || {};

  if (!nome || !nome.trim() || !email || !email.includes('@') || !assunto || !mensagem || mensagem.trim().length < 10) {
    res.status(400).json({ error: 'Campos obrigatórios: nome, email, assunto, mensagem (min 10 chars).' });
    return;
  }

  try {
    const docRef = await db.collection('suporte').add({
      nome: nome.trim(),
      email: email.trim(),
      assunto,
      mensagem: mensagem.trim(),
      user_uid: user_uid || null,
      lida: false,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Suporte] Criado: ${docRef.id}`);
    res.status(200).json({ id: docRef.id, message: 'Mensagem enviada!' });
  } catch (error) {
    console.error('[Suporte] Erro:', error.message);
    res.status(500).json({ error: 'Erro interno.' });
  }
});