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

// Limite máximo de tokens por chamada ao FCM
const CHUNK_SIZE = 500;

/**
 * Envia push notifications em lote via FCM v1.
 * Suporta imageUrl na notificação e link nos dados.
 */
async function enviarPushLote(tokens, title, body, data = {}, imageUrl = null) {
  if (!tokens || tokens.length === 0) {
    console.log('[Push] Nenhum token para enviar.');
    return;
  }

  // Montar objeto notification com imageUrl opcional
  const notifPayload = { title, body };
  if (imageUrl) {
    notifPayload.imageUrl = imageUrl;
  }

  const messages = tokens.map((token) => ({
    token,
    notification: notifPayload,
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: 'high',
        ...(imageUrl ? { imageUrl } : {}),
      },
    },
    data: Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')])
    ),
  }));

  let totalSuccess = 0;
  let totalFailure = 0;
  const totalTokensParaRemover = new Set();
  const totalChunks = Math.ceil(messages.length / CHUNK_SIZE);

  // Dividir em lotes de CHUNK_SIZE para respeitar o limite do FCM
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    const chunkTokens = tokens.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;

    console.log(`[Push] Enviando lote ${chunkIndex}/${totalChunks} (${chunk.length} mensagens)...`);

    try {
      const response = await admin.messaging().sendEach(chunk);

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      if (response.failureCount > 0) {
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const code = resp.error?.code || '';
            if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' || code.includes('registration-token-not-registered')) {
              console.warn(`[Push] Token inválido [${i + index}]: ${code}`);
              totalTokensParaRemover.add(chunkTokens[index]);
            }
          }
        });
      }
    } catch (error) {
      console.error(`[Push] Erro no lote ${chunkIndex}/${totalChunks}:`, error.message);
      totalFailure += chunk.length;
    }
  }

  console.log(`[Push] Total: ${totalSuccess} enviada(s), ${totalFailure} falha(s) em ${totalChunks} lote(s).`);

  // Remover tokens inválidos encontrados em todos os lotes
  if (totalTokensParaRemover.size > 0) {
    try {
      const batch = db.batch();
      const tokensArray = Array.from(totalTokensParaRemover);

      // Firestore suporta no máximo 10 itens em 'in', então dividimos em sub-lotes
      for (let i = 0; i < tokensArray.length; i += 10) {
        const subTokens = tokensArray.slice(i, i + 10);
        const usersSnap = await db
          .collection('users')
          .where('fcm_token', 'in', subTokens)
          .get();

        usersSnap.forEach((doc) => batch.update(doc.ref, { fcm_token: null }));
      }

      await batch.commit();
      console.log(`[Push] ${totalTokensParaRemover.size} tokens inválidos removidos.`);
    } catch (error) {
      console.error('[Push] Erro ao remover tokens inválidos:', error.message);
    }
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
          if (u.fcm_token && u.push_notificacoes_activas !== false) {
            tokens.push(u.fcm_token);
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

    // Extração segura dos novos campos
    const tipo = conteudo.tipo_postagem || 'texto';
    const texto = conteudo.mensagem || conteudo.texto || '';
    const textoTrucado = texto ? texto.substring(0,50)+(texto.length>50?'...':'') : '';
    console.log('[onFeedCelula] celulaId=' + celulaId + ' tipo=' + tipo + ' texto=' + (textoTrucado||'(vazio)') );

    try {
      // ... busca de membros e tokens inalterada ...

      if (tokens.length > 0) {
        const nomeCelula = celula.nome || 'Célula';
        let tituloNotif, corpoNotif;

        switch (tipo) {
          case 'audio':  tituloNotif = '🎙️ Novo áudio em ' + nomeCelula; corpoNotif = textoTrucado || 'Toque para ouvir a mensagem.'; break;
          case 'video':  tituloNotif = '🎥 Novo vídeo em ' + nomeCelula; corpoNotif = textoTrucado || 'Toque para assistir ao vídeo.'; break;
          case 'imagem': tituloNotif = '📷 Nova foto em ' + nomeCelula; corpoNotif = textoTrucado || 'Toque para ver a imagem.'; break;
          case 'link':   tituloNotif = '🔗 Novo link em ' + nomeCelula; corpoNotif = textoTrucado || 'Toque para acessar o conteúdo.'; break;
          default:       tituloNotif = '📖 Nova reflexão em ' + nomeCelula; corpoNotif = textoTrucado || 'Toque para ler a postagem.'; break;
        }

        await enviarPushLote(tokens, tituloNotif, corpoNotif, {
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
      if (!user.fcm_token || user.push_notificacoes_activas === false) return;

      const nome = msg.autor_nome || 'Alguém';
      await enviarPushLote([user.fcm_token], '💬 Mensagem de apoio', `${nome} escreveu no seu pedido.`, {
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
      if (!user.fcm_token || user.push_notificacoes_activas === false) return;

      const nome = msg.autor_nome || 'Alguém';
      await enviarPushLote([user.fcm_token], '💬 Mensagem de apoio', `${nome} escreveu no seu testemunho.`, {
        screen: 'TestemunhoDetalhes', testemunhoId, tipo: 'apoio_testemunho',
      });
    } catch (err) {
      console.error('[onMsgTestemunho] Erro:', err.message);
    }
  }
);

// ============================================================
// FUNÇÃO HTTP: enviarPushPromocional
// Chamada pelo painel administrativo (Vite)
// POST /enviarPushPromocional  { tokens[], title, body, imageUrl, link }
// ============================================================

exports.enviarPushPromocional = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const { tokens, title, body, imageUrl, link, screen } = req.body || {};

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    res.status(400).json({ error: 'tokens (array) é obrigatório.' });
    return;
  }

  if (!title || !body) {
    res.status(400).json({ error: 'title e body são obrigatórios.' });
    return;
  }

  try {
    console.log(`[enviarPushPromocional] Iniciando envio para ${tokens.length} token(s). Título: "${title}"`);

    // Montar data com link e screen se fornecidos
    const dataPayload = {};
    if (link) {
      dataPayload.link = link;
    }
    if (screen) {
      dataPayload.screen = screen;
    }

    await enviarPushLote(tokens, title, body, dataPayload, imageUrl || null);

    console.log('[enviarPushPromocional] Envio concluído com sucesso.');
    res.status(200).json({ success: true, total: tokens.length });
  } catch (error) {
    console.error('[enviarPushPromocional] Erro:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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