
// Serviço Firestore - Operações CRUD para Pedidos de Oração
// Inclui validação Regex, listagem em tempo real, intercessão e denúncia

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { COLLECTIONS, DENUNCIAS_LIMITE } from '../constants/firestore';
import { enviarNotificacaoPush } from './notificationService';

// URL base da Cloud Function (substituir pela URL real após deploy)
// Exemplo: https://us-central1-<project-id>.cloudfunctions.net/enviarSuporte
const FUNCAO_SUPORTE_URL = '__FUNCAO_SUPORTE_URL__';

// ============================================================
// VALIDAÇÃO - Regex para palavras ofensivas (Camada 1 - Local)
// ============================================================
// Lista básica de termos bloqueados. Pode ser expandida conforme necessidade.
const PALAVRAS_BLOQUEADAS = [
  /palavrao1/gi,
  /palavrao2/gi,
  /termo_ofensivo/gi,
  /puta/gi,
  /caralho/gi,
  /foda[_-]?se/gi,
  /porra/gi,
  /merda/gi,
  /bosta/gi,
  /cus[st]?a[o0]/gi,
  /vad[iy]a/gi,
  /piranha/gi,
  /filho[_-]?da[_-]?puta/gi,
  /arrombado/gi,
  /desgra[cç]a/gi,
];

/**
 * Valida se o texto contém palavras ofensivas.
 * @param {string} texto - Texto a ser validado
 * @returns {boolean} - true se contém conteúdo ofensivo
 */
const contemPalavraOfensiva = (texto) => {
  return PALAVRAS_BLOQUEADAS.some((regex) => regex.test(texto));
};

// ============================================================
// USERS
// ============================================================

export const createUserProfile = async (uid, userData) => {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    uid,
    ...userData,
    titulo_ministerial: 'membro',
    celulas_inscritas: [],
    endossos_uids: [],
    stats: {
      oracoes_feitas: 0,
      oracoes_hoje: 0,
      minutos_semana: 0,
      ultima_oracao_data: '',
      ultima_oracao_semana: '',
      testemunhos: 0,
      endossos_recebidos: 0,
      seguidores_count: 0,
      seguindo_count: 0,
    },
    is_admin: false,
    push_notificacoes_activas: true,
    biografia: '',
    vibe_atual: '',
    interesses: [],
    createdAt: serverTimestamp(),
  });
};

export const getUserProfile = async (uid) => {
  const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return docSnap.exists() ? docSnap.data() : null;
};

export const updateUserProfile = async (uid, data) => {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), data, { merge: true });
};

/**
 * Salva o token de notificação push do utilizador no Firestore.
 * O token é armazenado no campo fcm_token para compatibilidade
 * com as Cloud Functions que já usam fcm_token.
 *
 * @param {string} userId - UID do utilizador
 * @param {string} token - Token FCM
 */
export const salvarPushToken = async (userId, token) => {
  await setDoc(doc(db, COLLECTIONS.USERS, userId), {
    fcm_token: token,
    expo_push_token: token, // fallback para usuários antigos
  }, { merge: true });
};

// ============================================================
// SEGUIR / SEGUIDORES (Sistema de Grafo Social)
// ============================================================

/**
 * Verifica se um utilizador já segue outro.
 * Busca o documento na subcoleção "seguindo" do utilizador atual.
 *
 * @param {string} meuUid - UID do utilizador atual
 * @param {string} perfilUid - UID do perfil alvo
 * @returns {Promise<boolean>} - true se já estiver seguindo
 */
export const verificarSeSegue = async (meuUid, perfilUid) => {
  if (!meuUid || !perfilUid) return false;
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.USERS, meuUid, 'seguindo', perfilUid));
    return docSnap.exists();
  } catch (error) {
    console.warn('[verificarSeSegue] Erro:', error.message);
    return false;
  }
};

/**
 * Alterna o estado de seguir/deixar de seguir um utilizador.
 * Usa runTransaction para garantir atomicidade das operações.
 *
 * Regras:
 * - Não pode seguir a si mesmo.
 * - Se NÃO estiver seguindo: cria doc em subcoleções, incrementa contadores.
 * - Se JÁ estiver seguindo: deleta doc em subcoleções, decrementa contadores.
 *
 * Estrutura no Firestore:
 * - users/{meuUid}/seguindo/{perfilUid} (documento vazio ou com metadados)
 * - users/{perfilUid}/seguidores/{meuUid} (documento vazio ou com metadados)
 * - users/{meuUid}.stats.seguindo_count (increment/decrement)
 * - users/{perfilUid}.stats.seguidores_count (increment/decrement)
 *
 * @param {string} meuUid - UID do utilizador atual (quem está a seguir)
 * @param {string} perfilUid - UID do perfil alvo (quem será seguido/deixado de seguir)
 * @returns {Promise<boolean>} - true se passou a seguir, false se deixou de seguir
 * @throws {Error} - Se tentar seguir a si mesmo
 */
export const toggleSeguirUsuario = async (meuUid, perfilUid) => {
  if (meuUid === perfilUid) {
    throw new Error('Você não pode seguir a si mesmo.');
  }

  let novoStatus = false;

  await runTransaction(db, async (transaction) => {
    const seguindoRef = doc(db, COLLECTIONS.USERS, meuUid, 'seguindo', perfilUid);
    const seguidoresRef = doc(db, COLLECTIONS.USERS, perfilUid, 'seguidores', meuUid);
    const meuRef = doc(db, COLLECTIONS.USERS, meuUid);
    const perfilRef = doc(db, COLLECTIONS.USERS, perfilUid);

    const [seguindoSnap, meuSnap, perfilSnap] = await Promise.all([
      transaction.get(seguindoRef),
      transaction.get(meuRef),
      transaction.get(perfilRef),
    ]);

    if (!meuSnap.exists() || !perfilSnap.exists()) {
      throw new Error('Utilizador não encontrado.');
    }

    const jaSegue = seguindoSnap.exists();

    if (jaSegue) {
      // Ação: DEIXAR DE SEGUIR
      transaction.delete(seguindoRef);
      transaction.delete(seguidoresRef);
      transaction.update(meuRef, {
        'stats.seguindo_count': increment(-1),
      });
      transaction.update(perfilRef, {
        'stats.seguidores_count': increment(-1),
      });
      novoStatus = false;
    } else {
      // Ação: SEGUIR
      transaction.set(seguindoRef, {
        seguido_em: new Date().toISOString(),
      });
      transaction.set(seguidoresRef, {
        segue_desde: new Date().toISOString(),
      });
      transaction.update(meuRef, {
        'stats.seguindo_count': increment(1),
      });
      transaction.update(perfilRef, {
        'stats.seguidores_count': increment(1),
      });
      novoStatus = true;
    }
  });

  // Notificação de novo seguidor (fora da transação para não afetar atomicidade)
  if (novoStatus) {
    try {
      await criarNotificacao(
        perfilUid,
        'Novo Seguidor! 🎉',
        'Alguém começou a acompanhar sua jornada.',
        'novo_seguidor',
        meuUid
      );
    } catch (notifError) {
      console.warn('[toggleSeguirUsuario] Erro ao notificar seguidor:', notifError.message);
    }
  }

  return novoStatus;
};

// ============================================================
// CHAT 1x1 (Sistema de Mensagens Diretas)
// ============================================================

/**
 * Inicia ou recupera um chat entre dois utilizadores.
 * Gera um ID determinístico ordenando os UIDs alfabeticamente.
 *
 * Estrutura no Firestore:
 * - chats/{chatId} (documento principal)
 *   - participantes: [meuUid, alvoUid]
 *   - dados_participantes: { [uid]: { nome, foto } }
 *   - ultima_mensagem: string (vazia inicialmente)
 *   - timestamp_atualizacao: serverTimestamp()
 *
 * @param {string} meuUid - UID do utilizador atual
 * @param {string} alvoUid - UID do utilizador alvo
 * @param {object} meusDados - { nome: string, foto: string|null }
 * @param {object} alvoDados - { nome: string, foto: string|null }
 * @returns {Promise<string>} - ID do chat (existente ou recém-criado)
 */
export const iniciarChat = async (meuUid, alvoUid, meusDados, alvoDados) => {
  if (meuUid === alvoUid) {
    throw new Error('Você não pode iniciar um chat consigo mesmo.');
  }

  // Gera ID determinístico: ordena UIDs e junta com "_"
  const chatId = [meuUid, alvoUid].sort().join('_');

  try {
    const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      // Cria o documento do chat com dados desnormalizados dos participantes
      await setDoc(chatRef, {
        participantes: [meuUid, alvoUid],
        dados_participantes: {
          [meuUid]: {
            nome: meusDados.nome || '',
            foto: meusDados.foto || null,
          },
          [alvoUid]: {
            nome: alvoDados.nome || '',
            foto: alvoDados.foto || null,
          },
        },
        ultima_mensagem: '',
        timestamp_atualizacao: serverTimestamp(),
        criado_em: serverTimestamp(),
      });
    }

    return chatId;
  } catch (error) {
    console.error('[iniciarChat] Erro:', error);
    throw new Error('Não foi possível iniciar o chat.');
  }
};

// ============================================================
// MENSAGENS DO CHAT 1x1
// ============================================================

/**
 * Envia uma mensagem e atualiza o resumo do chat em batch.
 * Usa writeBatch para garantir atomicidade: mensagem + resumo do chat.
 *
 * @param {string} chatId - ID do chat
 * @param {string} texto - Texto da mensagem
 * @param {string} autorId - UID do autor
 * @returns {Promise<string>} - ID da mensagem criada
 */
export const enviarMensagemChat = async (chatId, texto, autorId, mensagemRespondida = null, imagem_url = null, audio_url = null) => {
  const batch = writeBatch(db);

  // 1. Monta dados da mensagem
  const textoLimpo = texto ? texto.trim() : '';
  const dadosMensagem = {
    texto: textoLimpo,
    autor_id: autorId,
    criadoEm: serverTimestamp(),
    lida: false,
    status: 'enviado',
  };

  if (imagem_url) {
    dadosMensagem.imagem_url = imagem_url;
  }

  if (audio_url) {
    dadosMensagem.audio_url = audio_url;
  }

  // Se for resposta para outra mensagem, adiciona reply_to
  if (mensagemRespondida) {
    dadosMensagem.reply_to = {
      id: mensagemRespondida.id || '',
      texto: mensagemRespondida.texto || '',
      autor_nome: mensagemRespondida.autor_nome || '',
    };
  }

  // 2. Adiciona mensagem na subcoleção
  const mensagensRef = collection(db, COLLECTIONS.CHATS, chatId, 'mensagens');
  const novaMsgRef = doc(mensagensRef);
  batch.set(novaMsgRef, dadosMensagem);

  // 3. Atualiza resumo do chat (com flag de nao lida para o destinatario)
  const resumo = textoLimpo || (imagem_url ? '📷 Foto' : '') || (audio_url ? '🎤 Áudio' : '');
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  batch.update(chatRef, {
    ultima_mensagem: resumo,
    ultima_mensagem_lida: false,
    timestamp_atualizacao: serverTimestamp(),
  });

  await batch.commit();
  return novaMsgRef.id;
};

/**
 * Escuta as mensagens de um chat em tempo real.
 * Retorna ordenado por criadoEm decrescente para uso com FlatList inverted.
 *
 * @param {string} chatId - ID do chat
 * @param {function} callback - Função chamada com a lista de mensagens
 * @returns {function} - Função para cancelar a inscrição (unsubscribe)
 */
export const ouvirMensagensChat = (chatId, callback) => {
  const q = query(
    collection(db, COLLECTIONS.CHATS, chatId, 'mensagens'),
    orderBy('criadoEm', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const mensagens = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(mensagens);
  }, (error) => {
    console.warn('[ouvirMensagensChat] Erro:', error.message);
    callback([]);
  });
};

/**
 * Edita o texto de uma mensagem existente no chat.
 * Adiciona flag editadoEm para indicar que foi modificada.
 * Também atualiza ultima_mensagem no documento pai do chat.
 *
 * @param {string} chatId - ID do chat
 * @param {string} mensagemId - ID da mensagem
 * @param {string} novoTexto - Novo texto
 */
export const editarMensagemChat = async (chatId, mensagemId, novoTexto) => {
  const batch = writeBatch(db);

  // 1. Atualiza a mensagem com novo texto e flag editadoEm
  const msgRef = doc(db, COLLECTIONS.CHATS, chatId, 'mensagens', mensagemId);
  batch.update(msgRef, {
    texto: novoTexto.trim(),
    editadoEm: serverTimestamp(),
  });

  // 2. Atualiza resumo do chat
  const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
  batch.update(chatRef, {
    ultima_mensagem: novoTexto.trim(),
    timestamp_atualizacao: serverTimestamp(),
  });

  await batch.commit();
};

/**
 * Exclui (deleta) uma mensagem do chat.
 * Atualiza ultima_mensagem no documento pai para '🚫 Mensagem excluída'.
 *
 * @param {string} chatId - ID do chat
 * @param {string} mensagemId - ID da mensagem
 */
export const excluirMensagemChat = async (chatId, mensagemId) => {
  try {
    console.log('[Exclusão] 1. Iniciando processo. Chat:', chatId, 'Msg:', mensagemId);
    const msgRef = doc(db, COLLECTIONS.CHATS, chatId, 'mensagens', mensagemId);
    const msgSnap = await getDoc(msgRef);

    if (!msgSnap.exists()) {
      console.log('[Exclusão] ERRO: Mensagem não encontrada no banco de dados.');
      throw new Error('A mensagem não existe ou já foi apagada.');
    }

    const msgData = msgSnap.data();
    const midiaUrl = msgData.imagem_url || msgData.audio_url;

    // Passo A: Hard Delete no Storage (Se houver mídia)
    if (midiaUrl) {
      try {
        console.log('[Exclusão] 2. Apagando mídia do Storage:', midiaUrl);
        const storage = getStorage();
        const arquivoRef = ref(storage, midiaUrl);
        await deleteObject(arquivoRef);
        console.log('[Exclusão] 2.1 Mídia obliterada do Storage.');
      } catch (storageErr) {
        console.warn('[Exclusão] 2.1 Erro no Storage (pode já estar apagado):', storageErr.message);
      }
    } else {
      console.log('[Exclusão] 2. Nenhuma mídia anexa para apagar. Seguindo para o texto.');
    }

    // Passo B: Deletar o documento diretamente (Sem Batch para evitar colapso do WebChannel)
    console.log('[Exclusão] 3. Apagando documento do Firestore...');
    await deleteDoc(msgRef);
    console.log('[Exclusão] 3.1 Documento apagado com sucesso.');

    // Passo C: Atualizar a última mensagem do Chat
    console.log('[Exclusão] 4. Atualizando resumo do chat pai...');
    const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
    await updateDoc(chatRef, {
      ultima_mensagem: '🚫 Mensagem excluída',
      timestamp_atualizacao: serverTimestamp(),
    });
    console.log('[Exclusão] 4.1 Resumo atualizado. Processo finalizado com SUCESSO!');

  } catch (error) {
    console.error('[Erro Crítico Excluir Mensagem]', error);
    throw new Error('Não foi possível excluir a mensagem no servidor. Tente novamente.');
  }
};

/**
 * Escuta os chats do utilizador em tempo real.
 * Filtra por participantes array-contains e ordena por timestamp_atualizacao.
 *
 * @param {string} meuUid - UID do utilizador atual
 * @param {function} callback - Função chamada com a lista de chats
 * @returns {function} - Função para cancelar a inscrição (unsubscribe)
 */
export const ouvirMeusChats = (meuUid, callback) => {
  const q = query(
    collection(db, COLLECTIONS.CHATS),
    where('participantes', 'array-contains', meuUid),
    orderBy('timestamp_atualizacao', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(chats);
  }, (error) => {
    console.warn('[ouvirMeusChats] Erro:', error.message);
    callback([]);
  });
};

/**
 * Marca todas as mensagens não lidas de um chat como lidas.
 * Atualiza lida=true nas mensagens onde autor_id != meuUid.
 * Também marca ultima_mensagem_lida=true no documento pai.
 *
 * @param {string} chatId - ID do chat
 * @param {string} meuUid - UID do utilizador atual
 */
export const marcarMensagensComoLidas = async (chatId, meuUid) => {
  try {
    console.log('[marcarMensagensComoLidas] Iniciando chat:', chatId, 'usuario:', meuUid);
    // Busca TODAS as mensagens nao lidas (sem filtrar por autor_id, pois o != requer indice composto)
    const q = query(
      collection(db, COLLECTIONS.CHATS, chatId, 'mensagens'),
      where('lida', '==', false),
      limit(50)
    );
    const snapshot = await getDocs(q);
    console.log('[marcarMensagensComoLidas] Nao lidas encontradas:', snapshot.size);

    if (snapshot.empty) {
      // Mesmo sem mensagens, marca o chat como lido
      await updateDoc(doc(db, COLLECTIONS.CHATS, chatId), { ultima_mensagem_lida: true });
      return;
    }

    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      // So marca como lida se nao for do proprio usuario
      if (msg.autor_id !== meuUid) {
        batch.update(docSnap.ref, { lida: true, status: 'visualizado' });
      }
    });

    // Marca o chat pai como lido
    const chatRef = doc(db, COLLECTIONS.CHATS, chatId);
    batch.update(chatRef, { ultima_mensagem_lida: true });

    await batch.commit();
    console.log('[marcarMensagensComoLidas] Commit realizado');
  } catch (error) {
    console.warn('[marcarMensagensComoLidas] Erro:', error.message);
  }
};

/**
 * Escuta em tempo real o total de mensagens não lidas do usuário.
 * Conta quantos chats possuem ultima_mensagem_lida === false.
 *
 * @param {string} meuUid - UID do utilizador
 * @param {function} callback - Função chamada com o número total de não lidas
 * @returns {function} - Função para cancelar a inscrição
 */
export const ouvirTotalMensagensNaoLidas = (meuUid, callback) => {
  const q = query(
    collection(db, COLLECTIONS.CHATS),
    where('participantes', 'array-contains', meuUid),
    where('ultima_mensagem_lida', '==', false)
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.size);
  }, (error) => {
    console.warn('[ouvirTotalMensagensNaoLidas] Erro:', error.message);
    callback(0);
  });
};

// ============================================================
// PEDIDOS DE ORAÇÃO
// ============================================================

/**
 * Cria um novo pedido de oração.
 * Inclui validação Regex para bloquear palavras ofensivas antes do envio.
 *
 * @param {string} texto - Texto do pedido
 * @param {string} categoria - Categoria do pedido
 * @param {string} privacidade - 'publico' ou 'celula'
 * @param {Array<string>} celulasDestino - Array de IDs das células de destino (se privacidade for 'celula')
 * @param {object} autor - Objeto do autor { uid, nome }
 * @returns {Promise<string>} - ID do pedido criado
 */
export const criarPedido = async (
  texto,
  categoria,
  privacidade,
  celulasDestino,
  autor,
  autorFotoUrl = null,
  anexoImagemUrl = null,
  anexoAudioUrl = null,
) => {
  // Trava de segurança: apenas utilizadores autenticados podem criar pedidos
  if (!autor || !autor.uid || !autor.nome) {
    throw new Error('Apenas usuários cadastrados podem criar pedidos.');
  }

  // Validação Regex - Camada 1 (Local)
  if (contemPalavraOfensiva(texto)) {
    throw new Error('Seu pedido contém palavras inadequadas. Por favor, revise o texto.');
  }

  if (!texto || texto.trim().length < 3) {
    throw new Error('O pedido deve ter pelo menos 3 caracteres.');
  }

  if (privacidade === 'celula' && (!celulasDestino || celulasDestino.length === 0)) {
    throw new Error('Selecione pelo menos uma célula para compartilhar o pedido.');
  }

  const pedidoData = {
    autor_id: autor.uid,
    autor_nome: autor.nome,
    autor_foto_url: autorFotoUrl || null,
    autor_cargo: autor.cargo || 'membro',
    autor_premium: autor.isPremium === true || autor.isPremium === 'true' || false,
    autor_whatsapp: autor.whatsapp || null,
    autor_endossos_count: autor.endossosCount || 0,
    autor_verificado_lideranca: autor.verificadoLideranca === true,
    texto: texto.trim(),
    categoria,
    privacidade,
    celulas_destino: privacidade === 'celula' ? celulasDestino : [],
    intercessores_count: 0,
    status: 'ativo',
    denuncias_uids: [],
    mensagens_count: 0,
    anexo_imagem_url: anexoImagemUrl || null,
    anexo_audio_url: anexoAudioUrl || null,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.PEDIDOS_ORACAO), pedidoData);
  return docRef.id;
};

/**
 * Escuta os pedidos públicos em tempo real.
 * Retorna pedidos com privacidade === 'publico' e status === 'ativo' ou 'respondido'.
 * Pedidos de célula foram movidos para listarPedidosDaCelula.
 * A expiração foi alterada de 7 para 30 dias.
 *
 * @param {function} callback - Função chamada com a lista de pedidos públicos
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarPedidos = (callback) => {
  // Calcular data limite: 30 dias atrás (1 mês)
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const q = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('status', 'in', ['ativo', 'respondido']),
    where('privacidade', '==', 'publico'),
    where('createdAt', '>=', dataLimite),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const pedidos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(pedidos);
  });
};

/**
 * Escuta os pedidos de oração de uma célula específica em tempo real.
 * Retorna pedidos onde privacidade === 'celula' E celulas_destino contém o celulaId.
 * Usa o operador array-contains do Firestore.
 *
 * @param {string} celulaId - ID da célula
 * @param {function} callback - Função chamada com a lista de pedidos da célula
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarPedidosDaCelula = (celulaId, callback) => {
  // Calcular data limite: 30 dias atrás (1 mês)
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const q = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('status', 'in', ['ativo', 'respondido']),
    where('privacidade', '==', 'celula'),
    where('celulas_destino', 'array-contains', celulaId),
    where('createdAt', '>=', dataLimite),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const pedidos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(pedidos);
  });
};

/**
 * Incrementa o contador de intercessões de forma atómica.
 * Visitantes (sem userUid) podem interceder anonimamente:
 * - O contador do pedido é sempre incrementado
 * - As estatísticas do utilizador só são atualizadas se houver userUid
 * - Bloqueia duplicados: se o userId já estiver em intercessores_uids, retorna erro
 *
 * @param {string} pedidoId - ID do pedido
 * @param {string|null} userUid - UID do utilizador (null para visitantes)
 * @throws {Error} - Se o utilizador já intercedeu por este pedido
 */
export const intercederPorPedido = async (pedidoId, userUid, minutosOrados = 1) => {
  // Visitantes podem interceder sem verificação de duplicado
  if (!userUid) {
    await updateDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId), {
      intercessores_count: increment(1),
    });
    return;
  }

  // Verificar se o utilizador já intercedeu
  const pedidoRef = doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId);
  const pedidoSnap = await getDoc(pedidoRef);

  if (!pedidoSnap.exists()) {
    throw new Error('Pedido não encontrado.');
  }

  const intercessores = pedidoSnap.data().intercessores_uids || [];
  if (intercessores.includes(userUid)) {
    throw new Error('Já intercedeste por este pedido.');
  }

  // Incrementa o contador e adiciona o UID ao array
  await updateDoc(pedidoRef, {
    intercessores_count: increment(1),
    intercessores_uids: arrayUnion(userUid),
  });

  // ============================================================
  // ESTATÍSTICAS DE ORAÇÃO (Gamificação)
  // Nota: registrarEstatisticasOracao já incrementa oracoes_feitas,
  //       oracoes_hoje e minutos_semana com lógica de reset diário/semanal.
  //       NÃO duplicar com outro increment() aqui.
  // ============================================================
  try {
    await registrarEstatisticasOracao(userUid, minutosOrados);
  } catch (statsError) {
    // Resiliência: falha nas estatísticas não deve impedir a intercessão
    console.warn('[Estatísticas] Erro ao atualizar:', statsError.message);
  }

  // ============================================================
  // GATILHO DE NOTIFICAÇÃO (Intercessão)
  // ============================================================
  try {
    const pedidoData = pedidoSnap.data();
    const autorPedidoId = pedidoData.autor_id;

    // Só notificar se o autor do pedido for diferente de quem intercedeu
    if (autorPedidoId && autorPedidoId !== userUid) {
      // Notificação In-App
      await criarNotificacao(
        autorPedidoId,
        'Alguém está intercedendo por você! ❤️',
        'Uma pessoa orou pelo seu pedido.',
        'intercessao',
        pedidoId
      );

      // Notificação Push (se tiver token)
      const autorSnap = await getDoc(doc(db, COLLECTIONS.USERS, autorPedidoId));
      if (autorSnap.exists()) {
        const pushToken = autorSnap.data().fcm_token || autorSnap.data().expo_push_token;
        if (pushToken) {
          await enviarNotificacaoPush(
            pushToken,
            'Alguém está intercedendo por você! ❤️',
            'Uma pessoa orou pelo seu pedido.',
            { pedidoId }
          );
        }
      }
    }
  } catch (notifError) {
    // Resiliência: falha nas notificações não deve impedir a intercessão
    console.warn('[Notificação] Erro ao notificar sobre intercessão:', notifError.message);
  }
};

/**
 * Adiciona uma denúncia ao pedido.
 * Se o utilizador já denunciou, retorna um erro.
 * Se atingir 3 denúncias distintas, muda o status para 'em_moderacao'.
 *
 * @param {string} pedidoId - ID do pedido
 * @param {string} userUid - UID do usuário que está denunciando
 * @throws {Error} - Se o utilizador já denunciou este pedido
 */
export const denunciarPedido = async (pedidoId, userUid) => {
  const pedidoRef = doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId);

  // Verificar se o utilizador já denunciou
  const pedidoSnap = await getDoc(pedidoRef);
  if (!pedidoSnap.exists()) {
    throw new Error('Pedido não encontrado.');
  }

  const denuncias = pedidoSnap.data().denuncias_uids || [];
  if (denuncias.includes(userUid)) {
    throw new Error('Já denunciaste este pedido.');
  }

  // Adiciona o UID ao array de denúncias
  await updateDoc(pedidoRef, {
    denuncias_uids: arrayUnion(userUid),
  });

  // Verifica se atingiu o limite de denúncias
  const denunciasAtualizadas = [...denuncias, userUid];
  if (denunciasAtualizadas.length >= DENUNCIAS_LIMITE) {
    // Altera o status para 'em_moderacao'
    await updateDoc(pedidoRef, {
      status: 'em_moderacao',
    });
  }
};

/**
 * Obtém um pedido específico pelo ID.
 */
export const getPedido = async (pedidoId) => {
  const docSnap = await getDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// ============================================================
// CÉLULAS
// ============================================================

/**
 * Cria uma nova célula no Firestore.
 * O criador torna-se o líder, e o array membros_ids inicia com o seu UID.
 *
 * @param {string} nome - Nome da célula
 * @param {string} horario - Horário dos encontros
 * @param {string} userUid - UID do criador (líder)
 * @param {object} dadosAdicionais - Dados opcionais (descricao, dia_semana, local, etc.)
 * @returns {Promise<string>} - ID da célula criada
 */
/**
 * Gera um código de convite único para uma célula.
 * Formato: CEL + 6 caracteres alfanuméricos maiúsculos (ex: CEL-A3F8K2)
 */
function gerarCodigoConvite() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let codigo = 'CEL-';
  for (let i = 0; i < 6; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return codigo;
}

export const criarCelula = async (nome, horario, userUid, dadosAdicionais = {}) => {
  const codigoConvite = gerarCodigoConvite();

  const celulaData = {
    nome,
    horario,
    lider_id: userUid,
    co_lideres_ids: [],
    membros_ids: [userUid],
    conteudos_ensino: [],
    descricao: dadosAdicionais.descricao || '',
    dia_semana: dadosAdicionais.dia_semana || '',
    local: dadosAdicionais.local || '',
    tipo: dadosAdicionais.tipo || 'publica', // 'publica' ou 'fechada'
    capa_url: dadosAdicionais.capa_url || null, // URL da foto de capa
    solicitacoes_pendentes: [], // UIDs de quem pediu para entrar (célula fechada)
    codigo_convite: codigoConvite, // Código único para convites
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.CELULAS), celulaData);

  // Atualizar o documento do líder com a célula criada
  await setDoc(doc(db, COLLECTIONS.USERS, userUid), {
    celulas_inscritas: arrayUnion(docRef.id),
  }, { merge: true });

  return docRef.id;
};

/**
 * Edita os dados de uma célula existente.
 * Apenas o líder pode editar (validação adicional pode ser feita na tela).
 *
 * @param {string} celulaId - ID da célula
 * @param {object} dados - Dados a atualizar { nome, horario, descricao, dia_semana, local, tipo }
 */
export const editarCelula = async (celulaId, dados) => {
  const atualizacao = {};
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.horario !== undefined) atualizacao.horario = dados.horario;
  if (dados.descricao !== undefined) atualizacao.descricao = dados.descricao;
  if (dados.dia_semana !== undefined) atualizacao.dia_semana = dados.dia_semana;
  if (dados.local !== undefined) atualizacao.local = dados.local;
  if (dados.tipo !== undefined) atualizacao.tipo = dados.tipo;
  if (dados.capa_url !== undefined) atualizacao.capa_url = dados.capa_url;

  await updateDoc(doc(db, COLLECTIONS.CELULAS, celulaId), atualizacao);
};

/**
 * Busca uma célula pelo código de convite.
 * @param {string} codigo - Código de convite (ex: CEL-A3F8K2)
 * @returns {Promise<object|null>} - Dados da célula ou null
 */
export const buscarCelulaPorCodigoConvite = async (codigo) => {
  const q = query(
    collection(db, COLLECTIONS.CELULAS),
    where('codigo_convite', '==', codigo.trim().toUpperCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

/**
 * Entra numa célula através de código de convite.
 * Ignora o tipo da célula (pública/fechada) — o código de convite
 * é uma chave de acesso direto que adiciona o utilizador
 * imediatamente a membros_ids e celulas_inscritas.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} userUid - UID do utilizador
 * @throws {Error} - Se o utilizador já for membro
 */
export const entrarPorCodigoConvite = async (celulaId, userUid) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const celula = celulaSnap.data();
  const membros = celula.membros_ids || [];

  if (membros.includes(userUid)) {
    throw new Error('Já és membro desta célula.');
  }

  // Adiciona o utilizador à célula (ignora tipo — código de convite é acesso direto)
  await updateDoc(celulaRef, {
    membros_ids: arrayUnion(userUid),
    // Se estava em solicitacoes_pendentes, remove (caso tenha pedido antes)
    solicitacoes_pendentes: arrayRemove(userUid),
  });

  // Adiciona a célula nas inscritas do utilizador
  await setDoc(doc(db, COLLECTIONS.USERS, userUid), {
    celulas_inscritas: arrayUnion(celulaId),
  }, { merge: true });
};

/**
 * Escuta todas as células disponíveis em tempo real.
 *
 * @param {function} callback - Função chamada com a lista de células
 * @returns {function} - Função para cancelar a inscrição
 */
/**
 * Função de ordenação de células por destaque.
 * Regras:
 * - Se destaque_validade existir e for menor que a data atual, ignora o destaque.
 * - Ordem: top1 > top2 > top3 > restante (ordenado por nº de membros, decrescente).
 * - As chaves são minúsculas (padrao, top1, top2, top3) conforme salvo pelo painel web.
 */
const ordenarCelulasPorDestaque = (celulas) => {
  const agora = new Date();

  // Separa células com destaque válido das demais
  const comDestaque = [];
  const semDestaque = [];

  celulas.forEach((celula) => {
    const validade = celula.destaque_validade?.toDate
      ? celula.destaque_validade.toDate()
      : celula.destaque_validade || null;

    // Se tem destaque_tipo e a validade não expirou
    if (
      celula.destaque_tipo &&
      ['top1', 'top2', 'top3'].includes(celula.destaque_tipo) &&
      (!validade || validade > agora)
    ) {
      comDestaque.push(celula);
    } else {
      semDestaque.push(celula);
    }
  });

  // Ordenar destaques: top1 → top2 → top3
  const ordemDestaque = { top1: 1, top2: 2, top3: 3 };
  comDestaque.sort((a, b) => ordemDestaque[a.destaque_tipo] - ordemDestaque[b.destaque_tipo]);

  // Ordenar restante por número de membros (decrescente)
  semDestaque.sort((a, b) => (b.membros_ids?.length || 0) - (a.membros_ids?.length || 0));

  return [...comDestaque, ...semDestaque];
};

export const listarCelulas = (callback) => {
  const q = query(
    collection(db, COLLECTIONS.CELULAS),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const celulas = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Aplica ordenação por destaque
    callback(ordenarCelulasPorDestaque(celulas));
  });
};

/**
 * Busca células ativas onde destaque_tipo === 'padrao' e cuja validade
 * seja nula ou esteja no futuro.
 * Usado para auto-inscrição de novos usuários no registo.
 *
 * @returns {Promise<Array<{id: string}>>} - Lista de IDs das células padrão
 */
export const buscarCelulasPadrao = async () => {
  const agora = new Date();

  const q = query(
    collection(db, COLLECTIONS.CELULAS),
    where('destaque_tipo', '==', 'padrao')
  );

  const snapshot = await getDocs(q);

  const celulasPadrao = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((celula) => {
      // Se não tem validade, é válida para sempre
      if (!celula.destaque_validade) return true;

      const validade = celula.destaque_validade.toDate
        ? celula.destaque_validade.toDate()
        : celula.destaque_validade;

      // Válida apenas se a validade ainda não passou
      return validade > agora;
    });

  return celulasPadrao;
};

/**
 * Obtém uma célula específica pelo ID.
 *
 * @param {string} celulaId - ID da célula
 * @returns {Promise<object|null>}
 */
export const getCelula = async (celulaId) => {
  const docSnap = await getDoc(doc(db, COLLECTIONS.CELULAS, celulaId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

/**
 * Inscreve um usuário numa célula.
 * Se a célula for pública, adiciona diretamente aos membros.
 * Se a célula for fechada, coloca o UID em solicitacoes_pendentes
 * para aprovação do líder/co-líder.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} userUid - UID do usuário
 * @throws {Error} - Se a célula não for encontrada
 */
export const inscreverNaCelula = async (celulaId, userUid) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const celula = celulaSnap.data();
  const tipo = celula.tipo || 'publica';

  if (tipo === 'fechada') {
    // Célula fechada: colocar em solicitacoes_pendentes
    const pendentes = celula.solicitacoes_pendentes || [];
    if (pendentes.includes(userUid)) {
      throw new Error('Já solicitaste entrada nesta célula. Aguarda a aprovação do líder.');
    }
    if ((celula.membros_ids || []).includes(userUid)) {
      throw new Error('Já és membro desta célula.');
    }

    await updateDoc(celulaRef, {
      solicitacoes_pendentes: arrayUnion(userUid),
    });

    // ============================================================
    // NOTIFICAÇÃO PUSH para líder e co-líderes
    // ============================================================
    try {
      // Buscar dados do solicitante para incluir o nome na notificação
      const solicitanteSnap = await getDoc(doc(db, COLLECTIONS.USERS, userUid));
      const nomeSolicitante = solicitanteSnap.exists()
        ? (solicitanteSnap.data().nome || 'Alguém')
        : 'Alguém';

      // Reunir UIDs do líder e co-líderes
      const uidsNotificar = [celula.lider_id, ...(celula.co_lideres_ids || [])].filter(Boolean);

      // Buscar tokens push em paralelo
      const usersSnap = await Promise.all(
        uidsNotificar.map((uid) => getDoc(doc(db, COLLECTIONS.USERS, uid)))
      );

      const promessasNotif = [];

      for (let i = 0; i < uidsNotificar.length; i++) {
        const uid = uidsNotificar[i];
        const userData = usersSnap[i]?.data();

        // Notificação In-App
        promessasNotif.push(
          criarNotificacao(
            uid,
            '🙏 Novo pedido de entrada!',
            `${nomeSolicitante} quer participar da célula "${celula.nome}".`,
            'celula_solicitacao',
            celulaId
          )
        );

        // Notificação Push com deep link para a tela de gestão de membros
        const pushToken = userData?.fcm_token || userData?.expo_push_token;
        if (pushToken) {
          promessasNotif.push(
            enviarNotificacaoPush(
              pushToken,
              '🙏 Novo pedido de entrada!',
              `${nomeSolicitante} quer participar da célula "${celula.nome}".`,
              {
                screen: 'GerenciarMembrosCelula',
                celulaId,
                celulaNome: celula.nome,
                tipo: 'celula_solicitacao',
              }
            )
          );
        }
      }

      // Disparar em paralelo (não bloqueante)
      await Promise.all(promessasNotif);
    } catch (notifError) {
      console.warn('[Notificação] Erro ao notificar líder sobre solicitação:', notifError.message);
    }
  } else {
    // Célula pública: adiciona diretamente
    await setDoc(doc(db, COLLECTIONS.USERS, userUid), {
      celulas_inscritas: arrayUnion(celulaId),
    }, { merge: true });
    await updateDoc(celulaRef, {
      membros_ids: arrayUnion(userUid),
    });
  }
};

/**
 * Aprova ou rejeita uma solicitação de entrada numa célula fechada.
 * Apenas o líder ou co-líder pode aprovar/rejeitar.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} solicitanteUid - UID de quem solicitou
 * @param {boolean} aprovar - true para aprovar, false para rejeitar
 */
export const aprovarSolicitacaoCelula = async (celulaId, solicitanteUid, aprovar) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const userRef = doc(db, COLLECTIONS.USERS, solicitanteUid);

  if (aprovar) {
    // Usa transação para garantir atomicidade: só adiciona como membro
    // se o utilizador ainda estiver na lista de pendentes
    await runTransaction(db, async (transaction) => {
      const celulaSnap = await transaction.get(celulaRef);
      if (!celulaSnap.exists()) {
        throw new Error('Célula não encontrada.');
      }

      const celula = celulaSnap.data();
      const pendentes = celula.solicitacoes_pendentes || [];

      // Verificar se o utilizador ainda está na lista de pendentes
      if (!pendentes.includes(solicitanteUid)) {
        throw new Error('Esta solicitação já foi processada.');
      }

      // Verificar se o utilizador já é membro
      const membros = celula.membros_ids || [];
      if (membros.includes(solicitanteUid)) {
        throw new Error('Este utilizador já é membro da célula.');
      }

      // Atualizar célula: adiciona como membro e remove das pendentes
      transaction.update(celulaRef, {
        membros_ids: arrayUnion(solicitanteUid),
        solicitacoes_pendentes: arrayRemove(solicitanteUid),
      });

      // Adicionar a célula nas inscritas do usuário
      // Usa set com merge: true para ser imune a documentos inexistentes
      // (ex: utilizador fantasma que pediu e depois teve a conta deletada)
      transaction.set(
        userRef,
        { celulas_inscritas: arrayUnion(celulaId) },
        { merge: true }
      );
    });

    // ============================================================
    // NOTIFICAÇÃO DE APROVAÇÃO para o solicitante
    // ============================================================
    try {
      const celulaSnapNotif = await getDoc(celulaRef);
      if (celulaSnapNotif.exists()) {
        const nomeCelula = celulaSnapNotif.data().nome || 'Célula';
        await criarNotificacao(
          solicitanteUid,
          'Solicitação Aceita! 🎉',
          `O líder aprovou o seu pedido para participar da célula ${nomeCelula}. Seja bem-vindo!`,
          'celula',
          celulaId
        );
      }
    } catch (notifError) {
      console.warn('[Notificação] Erro ao notificar aprovação:', notifError.message);
    }
  } else {
    // Rejeição: apenas remove das pendentes (também com transação para segurança)
    await runTransaction(db, async (transaction) => {
      const celulaSnap = await transaction.get(celulaRef);
      if (!celulaSnap.exists()) {
        throw new Error('Célula não encontrada.');
      }

      const celula = celulaSnap.data();
      const pendentes = celula.solicitacoes_pendentes || [];

      if (!pendentes.includes(solicitanteUid)) {
        throw new Error('Esta solicitação já foi processada.');
      }

      transaction.update(celulaRef, {
        solicitacoes_pendentes: arrayRemove(solicitanteUid),
      });
    });

    // ============================================================
    // NOTIFICAÇÃO DE RECUSA para o solicitante
    // ============================================================
    try {
      const celulaSnapNotif = await getDoc(celulaRef);
      if (celulaSnapNotif.exists()) {
        const nomeCelula = celulaSnapNotif.data().nome || 'Célula';
        await criarNotificacao(
          solicitanteUid,
          'Pedido de Inscrição',
          `Infelizmente o seu pedido para entrar na célula ${nomeCelula} não pôde ser aceito no momento.`,
          'celula',
          celulaId
        );
      }
    } catch (notifError) {
      console.warn('[Notificação] Erro ao notificar recusa:', notifError.message);
    }
  }
};

/**
 * Fixa uma postagem no topo do feed da célula.
 * Apenas UMA postagem pode estar fixada por vez — o campo post_fixado_id
 * é atualizado diretamente no documento da célula.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} postId - ID do conteúdo de ensino a fixar
 */
export const fixarConteudoEnsino = async (celulaId, postId) => {
  await updateDoc(doc(db, COLLECTIONS.CELULAS, celulaId), {
    post_fixado_id: postId,
  });
};

/**
 * Alterna a curtida (like) de um usuário em uma postagem do feed da célula.
 * Como os posts ficam dentro do array conteudos_ensino, esta função lê o array,
 * encontra o item pelo id, alterna o userId no array curtidas_ids e salva
 * substituindo o objeto antigo pelo novo (arrayRemove + arrayUnion).
 *
 * @param {string} celulaId - ID da célula
 * @param {object} postagemOriginal - O objeto completo da postagem
 * @param {string} userId - UID do usuário
 * @returns {Promise<boolean>} - true se adicionou like, false se removeu
 */
export const toggleCurtidaPostagem = async (celulaId, postagemId, userId) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) return;

  const conteudos = celulaSnap.data().conteudos_ensino || [];
  const index = conteudos.findIndex((c) => c.id === postagemId);
  if (index === -1) return;

  const postagem = conteudos[index];
  const curtidas = postagem.curtidas_ids || [];
  const jaCurtiu = curtidas.includes(userId);

  if (jaCurtiu) {
    postagem.curtidas_ids = curtidas.filter((id) => id !== userId);
  } else {
    postagem.curtidas_ids = [...curtidas, userId];
  }

  conteudos[index] = postagem;

  // ÚNICO updateDoc com array completo — evita flickers de snapshot
  await updateDoc(celulaRef, { conteudos_ensino: conteudos });

  return !jaCurtiu;
};

/**
 * Alterna o interesse (RSVP) de um usuário em um evento de célula.
 * Como os eventos são serializados como JSON no campo mensagem dentro do array
 * conteudos_ensino, esta função lê o array atual, encontra o item pelo postId,
 * atualiza o array interessados_ids no JSON e salva o array completo de volta.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} postId - ID do conteúdo de ensino (evento)
 * @param {string} userId - UID do usuário
 * @returns {Promise<boolean>} - true se adicionou interesse, false se removeu
 */
export const toggleInteresseEvento = async (celulaId, postId, userId) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const celula = celulaSnap.data();
  const conteudos = celula.conteudos_ensino || [];
  const index = conteudos.findIndex((c) => c.id === postId);

  if (index === -1) {
    throw new Error('Conteúdo não encontrado.');
  }

  const conteudo = conteudos[index];
  let dadosEvento;

  try {
    dadosEvento = JSON.parse(conteudo.mensagem || '{}');
  } catch (e) {
    throw new Error('Conteúdo não é um evento válido.');
  }

  if (!dadosEvento.titulo_evento) {
    throw new Error('Conteúdo não é um evento.');
  }

  const interessados = dadosEvento.interessados_ids || [];
  const jaTemInteresse = interessados.includes(userId);

  if (jaTemInteresse) {
    dadosEvento.interessados_ids = interessados.filter((id) => id !== userId);
  } else {
    dadosEvento.interessados_ids = [...interessados, userId];
  }

  conteudos[index] = {
    ...conteudo,
    mensagem: JSON.stringify(dadosEvento),
  };

  await updateDoc(celulaRef, {
    conteudos_ensino: conteudos,
  });

  return !jaTemInteresse;
};

/**
 * Adiciona um novo conteúdo de ensino ao array conteudos_ensino da célula.
 * Cada conteúdo é um objeto com id, titulo, mensagem, link_externo e criadoEm.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} titulo - Título do estudo
 * @param {string} mensagem - Mensagem/resumo do estudo
 * @param {string} linkExterno - Link externo (YouTube, Spotify, etc.)
 */
/**
 * Adiciona um novo conteúdo de ensino ao array conteudos_ensino da célula.
 * Cada conteúdo é um objeto com id, titulo, mensagem, link_externo e criadoEm.
 * Após adicionar, dispara notificações In-App e Push para todos os membros da célula
 * (exceto o líder/co-líder que publicou, se o userUid for fornecido).
 *
 * @param {string} celulaId - ID da célula
 * @param {string} titulo - Título do estudo
 * @param {string} mensagem - Mensagem/resumo do estudo
 * @param {string} linkExterno - Link externo (YouTube, Spotify, etc.)
 * @param {string|null} autorUid - UID de quem publicou (para não notificar a si mesmo)
 */
export const adicionarConteudoEnsino = async (celulaId, titulo, mensagem, linkExterno, autorUid = null) => {
  await updateDoc(doc(db, COLLECTIONS.CELULAS, celulaId), {
    conteudos_ensino: arrayUnion({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      titulo: (titulo || '').substring(0, 120),
      mensagem: (mensagem || '').substring(0, 500),
      link_externo: linkExterno || '',
      criadoEm: new Date().toISOString(),
    }),
  });

  try {
    const celulaSnap = await getDoc(doc(db, COLLECTIONS.CELULAS, celulaId));
    if (!celulaSnap.exists()) return;
    const celula = celulaSnap.data();
    const membrosIds = celula.membros_ids || [];
    const uidsParaNotificar = autorUid ? membrosIds.filter((uid) => uid !== autorUid) : membrosIds;
    if (uidsParaNotificar.length === 0) return;
    const usersSnap = await Promise.all(uidsParaNotificar.map((uid) => getDoc(doc(db, COLLECTIONS.USERS, uid))));
    const corpoNotif = (titulo || mensagem)
      ? ((titulo || '').substring(0, 60) + ((titulo && mensagem) ? ' — ' : '') + (mensagem || '').substring(0, 80)).substring(0, 150)
      : 'Nova postagem de mídia na célula!';
    const promessas = [];
    for (let i = 0; i < uidsParaNotificar.length; i++) {
      const membroUid = uidsParaNotificar[i];
      const userData = usersSnap[i]?.data();
      promessas.push(criarNotificacao(membroUid, '📖 Feed: ' + celula.nome, corpoNotif, 'celula_feed', celulaId));
    }
    await Promise.all(promessas);
  } catch (notifError) {
    console.warn('[Notificação] Erro ao notificar:', notifError.message);
  }
};

/**
 * Escuta as mensagens de apoio de um pedido em tempo real.
 *
 * @param {string} pedidoId - ID do pedido de oração
 * @param {function} callback - Função chamada com a lista de mensagens
 * @returns {function} - Função para cancelar a inscrição
 */

/**
 * Adiciona uma mensagem de apoio a um pedido.
 * Salva em uma subcoleção 'mensagens_apoio' dentro do documento do pedido.
 *
 * @param {string} pedidoId - ID do pedido de oração
 * @param {object} mensagem - Objeto { autor_id, autor_nome, texto, replyTo_id, replyTo_autor, mentions }
 * @returns {Promise<string>} - ID da mensagem criada
 */
export const adicionarMensagemApoio = async (pedidoId, mensagem) => {
  const mensagemData = {
    ...mensagem,
    criadoEm: serverTimestamp(),
  };
  const docRef = await addDoc(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId, 'mensagens_apoio'),
    mensagemData
  );
  return docRef.id;
};
export const listarMensagensApoio = (pedidoId, callback) => {
  const q = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId, 'mensagens_apoio'),
    orderBy('criadoEm', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const mensagens = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(mensagens);
  });
};

/**
 * Exclui uma mensagem de apoio da subcoleção mensagens_apoio de um pedido.
 *
 * @param {string} pedidoId - ID do pedido de oração
 * @param {string} mensagemId - ID da mensagem a ser excluída
 */
export const excluirMensagemApoio = async (pedidoId, mensagemId) => {
  await deleteDoc(
    doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId, 'mensagens_apoio', mensagemId)
  );
};

/**
 * Busca utilizadores cujo username comece com o termo fornecido.
 * Usado para sugestões de @menção no input de comentários.
 * Retorna no máximo 10 resultados para otimização.
 *
 * @param {string} termo - Termo a pesquisar (ex: "joao" para encontrar @joaosilva384)
 * @returns {Promise<Array<{uid: string, nome: string, username: string}>>}
 */
export const buscarUsuariosPorUsername = async (termo) => {
  if (!termo || termo.length < 1) return [];

  const termoLower = termo.toLowerCase();

  // Firestore não suporta "starts with" nativamente em queries.
  // Usamos >= e < para simular prefix search no campo username.
  const start = termoLower;
  const end = termoLower + '\uf8ff';

  const q = query(
    collection(db, COLLECTIONS.USERS),
    where('username', '>=', start),
    where('username', '<', end),
    limit(10)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    nome: doc.data().nome,
    username: doc.data().username,
  }));
};

/**
 * Adiciona um comentário a uma postagem do feed da célula.
 * Como os posts ficam dentro do array conteudos_ensino, esta função
 * lê o array, encontra o item pelo id, adiciona o comentário no array
 * comentarios e substitui o objeto antigo pelo novo (arrayRemove + arrayUnion).
 *
 * @param {string} celulaId - ID da célula
 * @param {object} postagemOriginal - O objeto completo da postagem
 * @param {string} textoComentario - Texto do comentário
 * @param {string} autorId - UID do autor do comentário
 * @param {string} autorNome - Nome do autor do comentário
 * @param {string|null} autorFoto - URL da foto do autor do comentário
 * @returns {Promise<string>} - ID do comentário criado
 */
export const adicionarComentarioPostagem = async (celulaId, postagemId, textoComentario, autorId, autorNome, autorFoto = null) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const conteudos = celulaSnap.data().conteudos_ensino || [];
  const index = conteudos.findIndex((c) => c.id === postagemId);
  if (index === -1) {
    throw new Error('Postagem não encontrada.');
  }

  const postagem = conteudos[index];
  const comentarios = postagem.comentarios || [];

  const novoComentario = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    autor_id: autorId,
    autor_nome: autorNome,
    autor_foto_url: autorFoto || null,
    texto: (textoComentario || '').trim().substring(0, 500),
    criadoEm: new Date().toISOString(),
  };

  postagem.comentarios = [...comentarios, novoComentario];
  conteudos[index] = postagem;

  // ÚNICO updateDoc com array completo
  await updateDoc(celulaRef, { conteudos_ensino: conteudos });

  return novoComentario.id;
};

/**
 * Remove um conteúdo de ensino do array conteudos_ensino da célula.
 * Antes de excluir do Firestore, varre as URLs armazenadas nos campos
 * link_externo e mensagem (JSON de evento) e apaga os arquivos do
 * Firebase Storage para evitar arquivos órfãos.
 *
 * @param {string} celulaId - ID da célula
 * @param {object} conteudoItem - O objeto completo do conteúdo a ser removido
 */
export const removerConteudoEnsino = async (celulaId, conteudoItem) => {
  // ============================================================
  // LIMPEZA DO STORAGE: apagar arquivos órfãos
  // ============================================================
  try {
    const storage = getStorage();
    const urlsParaApagar = [];

    // 1. Verifica link_externo (fotos normais, áudios, etc.)
    if (conteudoItem.link_externo && conteudoItem.link_externo.includes('firebasestorage.googleapis.com')) {
      urlsParaApagar.push(conteudoItem.link_externo);
    }

    // 2. Verifica mensagem JSON (eventos com capa_evento_url)
    try {
      const parsedMsg = JSON.parse(conteudoItem.mensagem || '{}');
      if (parsedMsg.capa_evento_url && parsedMsg.capa_evento_url.includes('firebasestorage.googleapis.com')) {
        urlsParaApagar.push(parsedMsg.capa_evento_url);
      }
    } catch (e) {
      // Não é JSON, ignorar
    }

    // 3. Deleta cada arquivo encontrado (com try/catch individual para resiliência)
    for (const url of urlsParaApagar) {
      try {
        const arquivoRef = ref(storage, url);
        await deleteObject(arquivoRef);
        console.log('[Storage] Arquivo deletado com sucesso:', url);
      } catch (storageError) {
        // Se o arquivo já não existir (404), apenas loga warning
        console.warn('[Storage] Erro ao deletar arquivo (pode já ter sido apagado):', storageError.message);
      }
    }
  } catch (error) {
    // Falha na limpeza do Storage não deve impedir a exclusão do Firestore
    console.warn('[Storage] Erro ao processar remoção de arquivos:', error.message);
  }

  // ============================================================
  // EXCLUSÃO DO FIRESTORE (lógica original)
  // ============================================================
  await updateDoc(doc(db, COLLECTIONS.CELULAS, celulaId), {
    conteudos_ensino: arrayRemove(conteudoItem),
  });
};

/**
 * Edita um conteúdo de ensino existente no array conteudos_ensino da célula.
 * Como o Firestore não permite atualizar um objeto específico dentro de um array,
 * puxamos o array atual, encontramos o item pelo id, substituímos pelos dados novos
 * e fazemos updateDoc com o array completo substituído.
 *
 * @param {string} celulaId - ID da célula
 * @param {object} conteudoAntigo - O objeto original (precisa ter o campo id)
 * @param {object} conteudoNovo - O objeto com os dados atualizados (deve manter o mesmo id)
 */
export const editarConteudoEnsino = async (celulaId, conteudoAntigo, conteudoNovo) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const celula = celulaSnap.data();
  const conteudos = celula.conteudos_ensino || [];

  // Encontrar o índice do item pelo id
  const index = conteudos.findIndex((c) => c.id === conteudoAntigo.id);

  if (index === -1) {
    throw new Error('Conteúdo não encontrado no array.');
  }

  // Substituir pelos dados novos, mantendo o mesmo id e criadoEm
  conteudos[index] = {
    ...conteudoNovo,
    id: conteudoAntigo.id,
    criadoEm: conteudoAntigo.criadoEm,
  };

  // Atualizar o array completo
  await updateDoc(celulaRef, {
    conteudos_ensino: conteudos,
  });
};

/**
 * Promove um membro a co-líder de uma célula.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} membroUid - UID do membro a ser promovido
 */
export const promoverParaCoLider = async (celulaId, membroUid) => {
  await updateDoc(doc(db, COLLECTIONS.CELULAS, celulaId), {
    co_lideres_ids: arrayUnion(membroUid),
  });
};

/**
 * Apaga uma célula do Firestore (apenas o líder pode chamar).
 * As regras de segurança do Firebase devem verificar auth.uid == lider_id.
 *
 * @param {string} celulaId - ID da célula a ser excluída
 */
export const apagarCelula = async (celulaId) => {
  await deleteDoc(doc(db, COLLECTIONS.CELULAS, celulaId));
};

/**
 * Sai de uma célula (remove inscrição) com regra de negócio para líderes.
 *
 * Regras:
 * - Se o usuário for o LÍDER e NÃO houver co-líderes: bloqueia com erro.
 * - Se o usuário for o LÍDER e houver co-líderes: passa o bastão para o primeiro co-líder.
 * - Se o usuário for apenas MEMBRO: remove normalmente.
 *
 * @param {string} celulaId - ID da célula
 * @param {string} userUid - UID do usuário
 * @throws {Error} - Se o líder tentar sair sem substituto
 */
export const sairDaCelula = async (celulaId, userUid) => {
  const celulaRef = doc(db, COLLECTIONS.CELULAS, celulaId);
  const celulaSnap = await getDoc(celulaRef);

  if (!celulaSnap.exists()) {
    throw new Error('Célula não encontrada.');
  }

  const celula = celulaSnap.data();
  const membros = celula.membros_ids || [];
  const coLideres = celula.co_lideres_ids || [];
  const ehLider = celula.lider_id === userUid;

  // ============================================================
  // REGRA DE NEGÓCIO: Líder solitário não pode sair
  // ============================================================
  if (ehLider && coLideres.length === 0) {
    throw new Error(
      'Você é o único líder. Promova outro membro a co-líder antes de sair, ou exclua a célula.'
    );
  }

  // ============================================================
  // LÍDER com co-líderes: passa o bastão
  // ============================================================
  if (ehLider && coLideres.length > 0) {
    const novoLiderId = coLideres[0];
    const novosCoLideres = coLideres.filter((id) => id !== userUid);
    const novosMembros = membros.filter((id) => id !== userUid);

    await updateDoc(celulaRef, {
      lider_id: novoLiderId,
      membros_ids: novosMembros,
      co_lideres_ids: novosCoLideres,
    });
  } else {
    // ============================================================
    // MEMBRO comum: remove normalmente
    // ============================================================
    const novosMembros = membros.filter((id) => id !== userUid);
    const novosCoLideres = coLideres.filter((id) => id !== userUid);

    await updateDoc(celulaRef, {
      membros_ids: novosMembros,
      co_lideres_ids: novosCoLideres,
    });
  }

  // ============================================================
  // Atualiza o documento do usuário (remove célula das inscritas)
  // ============================================================
  const userRef = doc(db, COLLECTIONS.USERS, userUid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const user = userSnap.data();
    const novasCelulas = (user.celulas_inscritas || []).filter((id) => id !== celulaId);
    await setDoc(userRef, {
      celulas_inscritas: novasCelulas,
    }, { merge: true });
  }
};

// ============================================================
// FINANCEIRO (Transparência em Tempo Real)
// ============================================================

/**
 * Escuta em tempo real o documento financeiro global.
 * O documento esperado está em: configuracoes/financeiro
 * Campos: custo_servidor (number), total_arrecadado_mes (number)
 *
 * @param {function} callback - Função chamada com os dados financeiros a cada atualização
 * @returns {function} Função para cancelar a inscrição (unsubscribe)
 */
export const getFinanceiroSnapshot = (callback) => {
  const docRef = doc(db, COLLECTIONS.CONFIGURACOES, 'financeiro');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        // Documento não existe: retorna valores padrão
        callback({
          custo_servidor: 250.0,
          total_arrecadado_mes: 0,
          chave_pix: 'interceder@oficinaoracao.com.br',
          nome_beneficiario: 'Rede Interceder',
        });
      }
    },
    (error) => {
      console.error('Erro no onSnapshot financeiro:', error);
      callback(null);
    }
  );
};

/**
 * Adiciona ou remove um pedido da lista de oração pessoal do utilizador.
 *
 * @param {string} userId - UID do utilizador
 * @param {string} pedidoId - ID do pedido
 * @param {'salvar'|'remover'} acao - 'salvar' para adicionar, 'remover' para tirar
 */
export const toggleSalvarPedido = async (userId, pedidoId, acao) => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);

  if (acao === 'salvar') {
    await setDoc(userRef, {
      pedidos_salvos: arrayUnion(pedidoId),
    }, { merge: true });
  } else if (acao === 'remover') {
    await setDoc(userRef, {
      pedidos_salvos: arrayRemove(pedidoId),
    }, { merge: true });
  }
};

/**
 * Verifica se um username está disponível (não está em uso por outro utilizador).
 *
 * @param {string} username - O username a verificar
 * @param {string} [excluirUid] - UID do utilizador atual para excluir da verificação
 * @returns {Promise<boolean>} - true se disponível, false se já estiver em uso
 */
export const verificarUsernameDisponivel = async (username, excluirUid) => {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const q = query(usersRef, where('username', '==', username));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return true;

  // Se encontrou resultados, verifica se é o próprio utilizador
  if (excluirUid) {
    const isProprio = snapshot.docs.some((doc) => doc.id === excluirUid);
    if (isProprio) return true;
  }

  return false;
};

// ============================================================
// TESTEMUNHOS
// ============================================================

/**
 * Adiciona um novo testemunho à coleção testemunhos.
 * Desnormaliza os dados do autor (nome, avatar) para ficarem salvos para sempre no documento.
 *
 * @param {object} user - Objeto do utilizador completo (deve conter uid, nome/nome, avatar)
 * @param {string} texto - Texto do testemunho
 * @param {string|null} pedidoVinculadoId - ID do pedido de oração vinculado (opcional)
 * @returns {Promise<string>} - ID do testemunho criado
 */
export const adicionarTestemunho = async (user, texto, pedidoVinculadoId = null, pedidoVinculadoCategoria = null, anexoImagemUrl = null, anexoAudioUrl = null) => {
  const testemunhoData = {
    autor_id: user.uid,
    autor_nome: user.nome || user.displayName || 'Irmão(ã)',
    autor_foto_url: user.photoURL || user.foto_url || null,
    autor_cargo: user.cargo || 'membro',
    autor_premium: user.isPremium === true || user.isPremium === 'true' || false,
    autor_avatar: user.avatar || user.photoURL || null,
    autor_endossos_count: user.endossosCount || 0,
    autor_verificado_lideranca: user.verificadoLideranca === true,
    texto: texto.trim(),
    pedido_vinculado_id: pedidoVinculadoId,
    pedido_vinculado_categoria: pedidoVinculadoCategoria,
    glorias: 0,
    status: 'ativo',
    anexo_imagem_url: anexoImagemUrl || null,
    anexo_audio_url: anexoAudioUrl || null,
    criadoEm: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.TESTEMUNHOS), testemunhoData);

  // Se o testemunho foi vinculado a um pedido, marca o pedido como 'respondido'
  // e salva o ID do testemunho para navegação direta a partir do card do mural
  if (pedidoVinculadoId) {
    await updateDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoVinculadoId), {
      status: 'respondido',
      testemunho_id: docRef.id,
    });

    // ============================================================
    // RECOMPENSA EMOCIONAL: Notificar intercessores
    // ============================================================
    notificarIntercessores(pedidoVinculadoId, docRef.id, user.uid).catch((err) => {
      console.warn('[Notificação] Erro ao notificar intercessores:', err.message);
    });
  }

  // ============================================================
  // ATUALIZAR STATS: Incrementa contador de testemunhos do autor
  // ============================================================
  try {
    await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
      'stats.testemunhos': increment(1),
    }, { merge: true });
  } catch (statsError) {
    console.warn('[Stats] Erro ao incrementar testemunhos:', statsError.message);
  }

  return docRef.id;
};

/**
 * Notifica todos os intercessores de um pedido que ele virou testemunho.
 * Executa em background (não bloqueia o fluxo principal).
 *
 * @param {string} pedidoId - ID do pedido original
 * @param {string} testemunhoId - ID do novo testemunho
 * @param {string} autorId - UID do autor do testemunho (para ignorar na notificação)
 */
async function notificarIntercessores(pedidoId, testemunhoId, autorId) {
  // Buscar o pedido original para obter a lista de intercessores
  const pedidoSnap = await getDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId));
  if (!pedidoSnap.exists()) return;

  const intercessoresUids = pedidoSnap.data().intercessores_uids || [];

  // Se não há intercessores, não faz nada
  if (intercessoresUids.length === 0) return;

  // Filtrar o próprio autor (não notificar a si mesmo)
  const uidsParaNotificar = intercessoresUids.filter((uid) => uid !== autorId);
  if (uidsParaNotificar.length === 0) return;

  // Buscar tokens push de todos os intercessores em paralelo
  const usersSnap = await Promise.all(
    uidsParaNotificar.map((uid) => getDoc(doc(db, COLLECTIONS.USERS, uid)))
  );

  // Preparar arrays de promessas para disparo em lote
  const promessas = [];

  for (let i = 0; i < uidsParaNotificar.length; i++) {
    const intercessorUid = uidsParaNotificar[i];
    const userData = usersSnap[i]?.data();

    // Notificação In-App
    promessas.push(
      criarNotificacao(
        intercessorUid,
        'Sua oração fez a diferença! 🙏',
        'Um pedido pelo qual você intercedeu acabou de virar um testemunho.',
        'testemunho',
        testemunhoId
      )
    );

    // Notificação Push (se tiver token)
    const pushToken = userData?.fcm_token || userData?.expo_push_token;
    if (pushToken) {
      promessas.push(
        enviarNotificacaoPush(
          pushToken,
          'Sua oração fez a diferença! 🙏',
          'Um pedido pelo qual você intercedeu acabou de virar um testemunho.',
          { testemunhoId }
        )
      );
    }
  }

  // Disparar todas as notificações em paralelo
  await Promise.all(promessas);
};

/**
 * Incrementa o contador de glórias de um testemunho.
 * Bloqueia duplicados: se o userId já estiver em celebradores_uids, retorna erro.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {string} userId - UID do utilizador que está a celebrar
 * @throws {Error} - Se o utilizador já celebrou este testemunho
 */
export const celebrarTestemunho = async (testemunhoId, userId) => {
  if (!userId) {
    throw new Error('Faça login para celebrar.');
  }

  const testemunhoRef = doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId);
  const testemunhoSnap = await getDoc(testemunhoRef);

  if (!testemunhoSnap.exists()) {
    throw new Error('Testemunho não encontrado.');
  }

  const celebradores = testemunhoSnap.data().celebradores_uids || [];
  if (celebradores.includes(userId)) {
    throw new Error('Já celebraste este testemunho.');
  }

  await updateDoc(testemunhoRef, {
    glorias: increment(1),
    celebradores_uids: arrayUnion(userId),
  });
};

/**
 * Escuta os testemunhos em tempo real (apenas ativos).
 * Filtra testemunhos dos últimos 90 dias para reduzir a quantidade de dados carregados.
 *
 * @param {function} callback - Função chamada com a lista de testemunhos
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarTestemunhos = (callback) => {
  // Calcular data limite: 90 dias atrás
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 90);

  const q = query(
    collection(db, COLLECTIONS.TESTEMUNHOS),
    where('status', '==', 'ativo'),
    where('criadoEm', '>=', dataLimite),
    orderBy('criadoEm', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const testemunhos = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(testemunhos);
  });
};

/**
 * Busca os pedidos de oração de um utilizador específico.
 * Usado para popular o seletor de vínculo no modal de criação de testemunho.
 *
 * @param {string} userId - UID do utilizador
 * @returns {Promise<Array<{id: string, texto: string}>>}
 */
export const buscarMeusPedidos = async (userId) => {
  // Query simplificada: apenas filtro por autor_id para evitar exigência de índice composto
  const q = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('autor_id', '==', userId)
  );

  const snapshot = await getDocs(q);
  console.log(`[buscarMeusPedidos] Encontrados ${snapshot.docs.length} pedidos para userId=${userId}`);

  // Filtra inativos via JavaScript para evitar índice composto no Firestore
  const dados = snapshot.docs.map((doc) => ({
    id: doc.id,
    texto: doc.data().texto,
    categoria: doc.data().categoria,
    status: doc.data().status,
  }));

  return dados.filter((p) => p.status === 'ativo');
};

// ============================================================
// GESTÃO DE PUBLICAÇÕES DO UTILIZADOR
// ============================================================

/**
 * Busca todos os pedidos e testemunhos de um utilizador.
 *
 * @param {string} userId - UID do utilizador
 * @returns {Promise<{pedidos: Array, testemunhos: Array}>}
 */
export const buscarMinhasPublicacoes = async (userId) => {
  // Buscar pedidos
  const pedidosQuery = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('autor_id', '==', userId)
  );
  const pedidosSnap = await getDocs(pedidosQuery);
  const pedidos = pedidosSnap.docs.map((doc) => ({
    id: doc.id,
    tipo: 'pedido',
    ...doc.data(),
  }));

  // Buscar testemunhos
  const testemunhosQuery = query(
    collection(db, COLLECTIONS.TESTEMUNHOS),
    where('autor_id', '==', userId)
  );
  const testemunhosSnap = await getDocs(testemunhosQuery);
  const testemunhos = testemunhosSnap.docs.map((doc) => ({
    id: doc.id,
    tipo: 'testemunho',
    ...doc.data(),
  }));

  return { pedidos, testemunhos };
};

/**
 * Atualiza o texto de um pedido de oração.
 *
 * @param {string} pedidoId - ID do pedido
 * @param {string} novoTexto - Novo texto
 */
export const editarPedido = async (pedidoId, novoTexto) => {
  await updateDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId), {
    texto: novoTexto.trim(),
  });
};

/**
 * Atualiza o texto de um testemunho.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {string} novoTexto - Novo texto
 */
export const editarTestemunho = async (testemunhoId, novoTexto) => {
  await updateDoc(doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId), {
    texto: novoTexto.trim(),
  });
};

/**
 * Remove um pedido de oração do Firestore.
 *
 * @param {string} pedidoId - ID do pedido
 */
export const apagarPedido = async (pedidoId) => {
  await deleteDoc(doc(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoId));
};

/**
 * Remove um testemunho do Firestore.
 *
 * @param {string} testemunhoId - ID do testemunho
 */
export const apagarTestemunho = async (testemunhoId) => {
  await deleteDoc(doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId));
};

// ============================================================
// TESTEMUNHOS - Denúncia e Mensagens de Apoio
// ============================================================

/**
 * Adiciona uma denúncia a um testemunho.
 * Se o utilizador já denunciou, retorna um erro.
 * Se atingir 3 denúncias distintas, muda o status para 'em_moderacao'.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {string} userUid - UID do utilizador que está a denunciar
 * @throws {Error} - Se o utilizador já denunciou este testemunho
 */
export const denunciarTestemunho = async (testemunhoId, userUid) => {
  const testemunhoRef = doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId);

  const testemunhoSnap = await getDoc(testemunhoRef);
  if (!testemunhoSnap.exists()) {
    throw new Error('Testemunho não encontrado.');
  }

  const denuncias = testemunhoSnap.data().denuncias_uids || [];
  if (denuncias.includes(userUid)) {
    throw new Error('Já denunciaste este testemunho.');
  }

  await updateDoc(testemunhoRef, {
    denuncias_uids: arrayUnion(userUid),
  });

  const denunciasAtualizadas = [...denuncias, userUid];
  if (denunciasAtualizadas.length >= DENUNCIAS_LIMITE) {
    await updateDoc(testemunhoRef, {
      status: 'em_moderacao',
    });
  }
};

/**
 * Adiciona uma mensagem de apoio a um testemunho.
 * Salva em uma subcoleção 'mensagens_apoio' dentro do documento do testemunho.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {object} mensagem - Objeto { autor_id, autor_nome, texto }
 * @returns {Promise<string>} - ID da mensagem criada
 */
export const adicionarMensagemApoioTestemunho = async (testemunhoId, mensagem) => {
  const mensagemData = {
    ...mensagem,
    criadoEm: new Date().toISOString(),
  };
  const docRef = await addDoc(
    collection(db, COLLECTIONS.TESTEMUNHOS, testemunhoId, 'mensagens_apoio'),
    mensagemData
  );
  return docRef.id;
};

/**
 * Escuta as mensagens de apoio de um testemunho em tempo real.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {function} callback - Função chamada com a lista de mensagens
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarMensagensApoioTestemunho = (testemunhoId, callback) => {
  const q = query(
    collection(db, COLLECTIONS.TESTEMUNHOS, testemunhoId, 'mensagens_apoio'),
    orderBy('criadoEm', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const mensagens = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(mensagens);
  });
};

/**
 * Exclui uma mensagem de apoio da subcoleção mensagens_apoio de um testemunho.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @param {string} mensagemId - ID da mensagem a ser excluída
 */
export const excluirMensagemApoioTestemunho = async (testemunhoId, mensagemId) => {
  await deleteDoc(
    doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId, 'mensagens_apoio', mensagemId)
  );
};

/**
 * Obtém um testemunho específico pelo ID.
 *
 * @param {string} testemunhoId - ID do testemunho
 * @returns {Promise<object|null>}
 */
export const getTestemunho = async (testemunhoId) => {
  const docSnap = await getDoc(doc(db, COLLECTIONS.TESTEMUNHOS, testemunhoId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

// ============================================================
// ENDOSSOS (Sistema Avançado de Confiança)
// ============================================================

/**
 * Verifica se dois utilizadores têm vínculo (mesma célula ou interagiram).
 * @param {string} meuUid
 * @param {string} perfilUid
 * @returns {Promise<boolean>}
 */
async function verificarVinculo(meuUid, perfilUid) {
  // 1. Verificar se participam da mesma célula
  const celulasQuery = query(
    collection(db, COLLECTIONS.CELULAS),
    where('membros_ids', 'array-contains', meuUid)
  );
  const celulasSnap = await getDocs(celulasQuery);
  for (const celulaDoc of celulasSnap.docs) {
    const membros = celulaDoc.data().membros_ids || [];
    if (membros.includes(perfilUid)) {
      return true;
    }
  }

  // 2. Verificar se um comentou num pedido do outro
  // Busca pedidos do perfilUid e verifica se meuUid comentou
  const pedidosQuery = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('autor_id', '==', perfilUid)
  );
  const pedidosSnap = await getDocs(pedidosQuery);
  for (const pedidoDoc of pedidosSnap.docs) {
    const mensagensSnap = await getDocs(
      collection(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoDoc.id, 'mensagens_apoio')
    );
    for (const msgDoc of mensagensSnap.docs) {
      if (msgDoc.data().autor_id === meuUid) {
        return true;
      }
    }
  }

  // 3. Verificar se o perfilUid comentou nos pedidos do meuUid
  const meusPedidosQuery = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('autor_id', '==', meuUid)
  );
  const meusPedidosSnap = await getDocs(meusPedidosQuery);
  for (const pedidoDoc of meusPedidosSnap.docs) {
    const mensagensSnap = await getDocs(
      collection(db, COLLECTIONS.PEDIDOS_ORACAO, pedidoDoc.id, 'mensagens_apoio')
    );
    for (const msgDoc of mensagensSnap.docs) {
      if (msgDoc.data().autor_id === perfilUid) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Alterna o endosso entre utilizadores com validações avançadas.
 *
 * Regras:
 * 1. Vínculo obrigatório: mesma célula ou interação em pedidos.
 * 2. Limite diário de 3 endossos por utilizador.
 * 3. Cooldown de 30 dias para remover endosso.
 * 4. Se o endossante for admin, marca endossado_por_admin: true.
 * 5. Se tipoEndosso for 'super', marca verificado_lideranca: true.
 *
 * @param {string} meuUid - UID de quem está a endossar
 * @param {string} perfilUid - UID de quem será endossado
 * @param {boolean} endossar - true para endossar, false para remover
 * @param {string} [tipoEndosso='normal'] - 'normal' ou 'super'
 * @throws {Error} - Com mensagens descritivas para cada validação
 */
export const alternarEndosso = async (meuUid, perfilUid, endossar, tipoEndosso = 'normal') => {
  if (meuUid === perfilUid) {
    throw new Error('Não podes endossar a ti mesmo.');
  }

  const meuRef = doc(db, COLLECTIONS.USERS, meuUid);
  const perfilRef = doc(db, COLLECTIONS.USERS, perfilUid);

  // Buscar dados de ambos os utilizadores
  const [meuSnap, perfilSnap] = await Promise.all([
    getDoc(meuRef),
    getDoc(perfilRef),
  ]);

  if (!meuSnap.exists() || !perfilSnap.exists()) {
    throw new Error('Utilizador não encontrado.');
  }

  const meuData = meuSnap.data();
  const perfilData = perfilSnap.data();

  if (endossar) {
    // ============================================================
    // REGRA 1: Vínculo Obrigatório
    // ============================================================
    const temVinculo = await verificarVinculo(meuUid, perfilUid);
    if (!temVinculo) {
      throw new Error(
        'Você precisa interagir com este irmão ou participar da mesma célula para endossá-lo.'
      );
    }

    // ============================================================
    // REGRA 2: Validação de Papel (É Líder Geral?)
    // ============================================================
    const celulasLiderQuery = query(
      collection(db, COLLECTIONS.CELULAS),
      where('lider_id', '==', meuUid),
      limit(1)
    );
    const celulasLiderSnap = await getDocs(celulasLiderQuery);
    const isLider = !celulasLiderSnap.empty;

    // ============================================================
    // REGRA 3: Trava de Segurança do Super Endosso
    // ============================================================
    if (tipoEndosso === 'super') {
      // Verificar jurisdição: o líder só pode super-endossar membros das suas células
      const jurisdicaoQuery = query(
        collection(db, COLLECTIONS.CELULAS),
        where('lider_id', '==', meuUid),
        where('membros_ids', 'array-contains', perfilUid),
        limit(1)
      );
      const jurisdicaoSnap = await getDocs(jurisdicaoQuery);

      if (jurisdicaoSnap.empty) {
        throw new Error('Você não é líder desse usuário.');
      }
    }

    // ============================================================
    // REGRA 4: Limites Diários com Reset
    // ============================================================
    const hoje = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const dataUltimoEndosso = meuData.data_ultimo_endosso || '';

    // Se a última data de endosso não é hoje, assume contagens como 0
    const resetar = dataUltimoEndosso !== hoje;
    const endossosComunsHoje = resetar ? 0 : (meuData.endossos_comuns_hoje || 0);
    const superEndossosHoje = resetar ? 0 : (meuData.super_endossos_hoje || 0);

    if (tipoEndosso === 'super') {
      // Super Endosso — apenas líderes podem fazer
      if (!isLider) {
        throw new Error('Apenas líderes de célula podem fazer Super Endossos.');
      }
      if (superEndossosHoje >= 5) {
        throw new Error('Você atingiu o limite de 5 Super Endossos por dia.');
      }
    } else {
      // Endosso Normal
      if (isLider) {
        if (endossosComunsHoje >= 5) {
          throw new Error('Você atingiu o limite de 5 endossos normais por dia.');
        }
      } else {
        if (endossosComunsHoje >= 3) {
          throw new Error('Você atingiu o limite de 3 endossos por dia.');
        }
      }
    }

    // ============================================================
    // Verificar se já endossou (evitar duplicado)
    // Verifica TANTO no array endossos_uids QUANTO nos timestamps
    // para cobrir utilizadores legado que podem ter o UID no array
    // mas sem timestamp, ou vice-versa.
    // ============================================================
    const endossosUids = perfilData.endossos_uids || [];
    const endossosTimestamps = perfilData.endossos_timestamps || {};

    if (endossosUids.includes(meuUid) || endossosTimestamps[meuUid]) {
      throw new Error('Você já endossou este irmão.');
    }

    // ============================================================
    // Executar endosso
    // ============================================================
    const agora = new Date().toISOString();
    const isAdmin = meuData.is_admin === true;

    // ============================================================
    // PAYLOAD DO ALVO (quem RECEBE o endosso — perfilRef)
    // ⚠️ REGRA hasOnly: SÓ pode conter:
    //    - endossos_uids
    //    - endossos_timestamps
    //    - verificado_lideranca
    // QUALQUER outro campo (endossos_pesos, endossado_por_admin,
    // updatedAt, etc.) causa 'Missing or insufficient permissions'.
    // ============================================================
    const payloadAlvo = {
      endossos_uids: arrayUnion(meuUid),
      [`endossos_timestamps.${meuUid}`]: agora,
    };

    // Só marca verificado_lideranca se o tipoEndosso for 'super'
    // (campo permitido pela regra hasOnly)
    if (tipoEndosso === 'super') {
      payloadAlvo.verificado_lideranca = true;
    }

    // Log de diagnóstico do payload do alvo
    console.log('[DEBUG PAYLOAD ALVO CHAVES]:', Object.keys(payloadAlvo));

    await updateDoc(perfilRef, payloadAlvo);

    // ============================================================
    // ATUALIZAR STATS: Incrementa endossos_recebidos do perfil alvo
    // Operação separada para não conflitar com a regra hasOnly
    // ============================================================
    try {
      await setDoc(perfilRef, {
        'stats.endossos_recebidos': increment(1),
      }, { merge: true });
    } catch (statsError) {
      console.warn('[Stats] Erro ao incrementar endossos_recebidos:', statsError.message);
    }

    // ============================================================
    // PAYLOAD DO REMETENTE (quem ENVIA o endosso — meuRef)
    // ATENÇÃO: Este updateDoc é num documento DIFERENTE (meuRef),
    // portanto NÃO é afetado pela regra hasOnly do perfil endossado.
    // Aqui salvamos os contadores diários do endossante.
    // ============================================================
    const payloadRemetente = {
      data_ultimo_endosso: hoje,
    };

    if (tipoEndosso === 'super') {
      payloadRemetente.super_endossos_hoje = superEndossosHoje + 1;
      // Mantém o contador de endossos comuns inalterado
      payloadRemetente.endossos_comuns_hoje = endossosComunsHoje;
    } else {
      payloadRemetente.endossos_comuns_hoje = endossosComunsHoje + 1;
      // Mantém o contador de super endossos inalterado
      payloadRemetente.super_endossos_hoje = superEndossosHoje;
    }

    console.log('[DEBUG PAYLOAD REMETENTE CHAVES]:', Object.keys(payloadRemetente));

    await updateDoc(meuRef, payloadRemetente);
  } else {
    // ============================================================
    // REGRA 4 - Parte B: Cooldown de 30 dias para remover
    // ============================================================
    const endossosTimestamps = perfilData.endossos_timestamps || {};
    const timestampEndosso = endossosTimestamps[meuUid];

    if (timestampEndosso) {
      const dataEndosso = new Date(timestampEndosso);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);

      if (dataEndosso > dataLimite) {
        const diasRestantes = Math.ceil(
          (dataEndosso.getTime() - dataLimite.getTime()) / (1000 * 60 * 60 * 24)
        );
        throw new Error(
          `Ainda faltam ${diasRestantes} dias para poderes remover este endosso (cooldown de 30 dias).`
        );
      }
    }

    // ============================================================
    // Remover endosso — payload também restrito aos campos permitidos
    // ============================================================
    const perfilUpdate = {
      endossos_uids: arrayRemove(meuUid),
    };
    perfilUpdate[`endossos_timestamps.${meuUid}`] = null; // Limpar timestamp

    console.log('[Endosso Remover Payload] Campos a atualizar:', Object.keys(perfilUpdate));

    await updateDoc(perfilRef, perfilUpdate);
  }
};

// ============================================================
// DENÚNCIAS (Sistema Abrangente de Moderação)
// ============================================================

/**
 * Cria um documento de denúncia na coleção global 'denuncias'.
 * Suporta denúncias de pedidos, testemunhos e células.
 *
 * @param {object} dados - Objeto com os dados da denúncia
 * @param {string} dados.item_id - ID do item denunciado (pedido, testemunho ou célula)
 * @param {string} dados.item_tipo - Tipo do item ('pedido', 'testemunho' ou 'celula')
 * @param {string} dados.motivo_categoria - Categoria do motivo selecionado
 * @param {string} dados.descricao_detalhada - Descrição detalhada (opcional)
 * @param {string} dados.denunciante_id - UID do utilizador que denunciou
 * @returns {Promise<string>} - ID do documento de denúncia criado
 */
export const criarDenuncia = async (dados) => {
  const denunciaData = {
    item_id: dados.item_id,
    item_tipo: dados.item_tipo,
    motivo_categoria: dados.motivo_categoria,
    descricao_detalhada: dados.descricao_detalhada || '',
    denunciante_id: dados.denunciante_id,
    data_criacao: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.DENUNCIAS), denunciaData);
  return docRef.id;
};

// ============================================================
// SUPORTE (Formulário de Contato)
// ============================================================

/**
 * Envia uma mensagem de suporte para a coleção 'suporte' no Firestore.
 * O conteúdo ficará disponível para o dashboard administrativo web.
 *
 * @param {object} dados - Dados do formulário
 * @param {string} dados.nome - Nome do remetente
 * @param {string} dados.email - Email do remetente
 * @param {string} dados.assunto - Assunto selecionado
 * @param {string} dados.mensagem - Mensagem detalhada
 * @param {string|null} dados.user_uid - UID do usuário (se logado)
 * @returns {Promise<string>} - ID do documento criado
 */
// Chave de API do Firebase (pública, usada para REST fallback)
const FIREBASE_API_KEY = 'AIzaSyBygqdqXmJRTrkdKcISdkR4l8Jql7nXD6o';

export const enviarMensagemSuporte = async (dados) => {
  const suporteData = {
    nome: dados.nome.trim(),
    email: dados.email.trim(),
    assunto: dados.assunto,
    mensagem: dados.mensagem.trim(),
    user_uid: dados.user_uid || null,
    lida: false,
    criadoEm: serverTimestamp(),
  };

  try {
    // Tenta salvar diretamente no Firestore
    const docRef = await addDoc(collection(db, COLLECTIONS.SUPORTE), suporteData);
    return docRef.id;
  } catch (error) {
    // Se falhar por permissão, dá instruções claras sobre como resolver
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      // Tenta via REST API com autenticação do próprio usuário (se estiver logado)
      // Fallback: a REST API com token do usuário logado respeita as regras,
      // então precisamos mesmo atualizar as regras.
      console.error('[Suporte] Permissão negada. Instruções detalhadas enviadas ao usuário.');
      throw new Error(
        '⚠️ Permissão negada.\n\n' +
        'Para resolver, siga estes passos:\n\n' +
        '1. Acesse: https://console.firebase.google.com\n' +
        '2. Vá em Firestore Database > Rules\n' +
        '3. Substitua pelas regras abaixo:\n\n' +
        '  match /suporte/{docId} {\n' +
        '    allow create: if request.auth != null;  // usuários logados\n' +
        '    allow read, update, delete: if request.auth.token.is_admin == true;\n' +
        '  }\n\n' +
        '4. Clique em "Publicar"\n\n' +
        'Pronto! O formulário funcionará imediatamente.'
      );
    }
    throw error;
  }
};

// ============================================================
// EXCLUSÃO DE CONTA (LGPD)
// ============================================================

/**
 * Exclui todos os dados do usuário no Firestore (LGPD - Direito ao Esquecimento).
 *
 * Remove em cascata:
 * 1. Pedidos de oração onde o usuário é autor + subcoleções mensagens_apoio
 * 2. Testemunhos onde o usuário é autor + subcoleções mensagens_apoio
 * 3. Denúncias feitas pelo usuário
 * 4. Notificações recebidas pelo usuário
 * 5. Células onde o usuário é líder:
 *    - Se houver co-líder(es): passa o bastão para o primeiro co-líder (NÃO exclui a célula)
 *    - Se NÃO houver co-líder: exclui a célula
 * 6. Remove o UID do usuário de membros_ids / co_lideres_ids das células onde é membro
 * 7. Remove o UID do usuário de intercessores_uids em todos os pedidos onde intercedeu
 * 8. Remove o UID do usuário de endossos_uids em todos os perfis que ele endossou
 * 9. Remove o UID do usuário de pedidos_salvos de todos os perfis que o salvaram
 * 10. Exclui o documento principal do usuário
 *
 * Usa writeBatch (com commits parciais para não estourar o limite de 500 ops).
 * Cada query é envolvida em try/catch individual para resiliência.
 *
 * @param {string} userId - UID do usuário a ser excluído
 * @returns {Promise<void>}
 */
export const excluirDadosUsuario = async (userId) => {
  const batches = [];
  let currentBatch = writeBatch(db);
  let opCount = 0;

  const commitIfNeeded = async () => {
    if (opCount >= 400) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  };

  const flushBatch = async () => {
    if (opCount > 0) {
      await currentBatch.commit();
      currentBatch = writeBatch(db);
      opCount = 0;
    }
  };

  // ============================================================
  // 1. Excluir pedidos de oração do usuário (com subcoleções)
  // ============================================================
  try {
    const pedidosQuery = query(
      collection(db, COLLECTIONS.PEDIDOS_ORACAO),
      where('autor_id', '==', userId)
    );
    const pedidosSnap = await getDocs(pedidosQuery);
    for (const docSnap of pedidosSnap.docs) {
      // Excluir subcoleção mensagens_apoio
      const mensagensSnap = await getDocs(
        collection(db, COLLECTIONS.PEDIDOS_ORACAO, docSnap.id, 'mensagens_apoio')
      );
      for (const msgSnap of mensagensSnap.docs) {
        currentBatch.delete(
          doc(db, COLLECTIONS.PEDIDOS_ORACAO, docSnap.id, 'mensagens_apoio', msgSnap.id)
        );
        opCount++;
        await commitIfNeeded();
      }
      // Excluir documento principal do pedido
      currentBatch.delete(doc(db, COLLECTIONS.PEDIDOS_ORACAO, docSnap.id));
      opCount++;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/excluir pedidos:', error.message);
  }

  // ============================================================
  // 2. Excluir testemunhos do usuário (com subcoleções)
  // ============================================================
  try {
    const testemunhosQuery = query(
      collection(db, COLLECTIONS.TESTEMUNHOS),
      where('autor_id', '==', userId)
    );
    const testemunhosSnap = await getDocs(testemunhosQuery);
    for (const docSnap of testemunhosSnap.docs) {
      // Excluir subcoleção mensagens_apoio
      const mensagensSnap = await getDocs(
        collection(db, COLLECTIONS.TESTEMUNHOS, docSnap.id, 'mensagens_apoio')
      );
      for (const msgSnap of mensagensSnap.docs) {
        currentBatch.delete(
          doc(db, COLLECTIONS.TESTEMUNHOS, docSnap.id, 'mensagens_apoio', msgSnap.id)
        );
        opCount++;
        await commitIfNeeded();
      }
      // Excluir documento principal do testemunho
      currentBatch.delete(doc(db, COLLECTIONS.TESTEMUNHOS, docSnap.id));
      opCount++;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/excluir testemunhos:', error.message);
  }

  // ============================================================
  // 3. Excluir denúncias feitas pelo usuário
  // ============================================================
  try {
    const denunciasQuery = query(
      collection(db, COLLECTIONS.DENUNCIAS),
      where('denunciante_id', '==', userId)
    );
    const denunciasSnap = await getDocs(denunciasQuery);
    for (const docSnap of denunciasSnap.docs) {
      currentBatch.delete(doc(db, COLLECTIONS.DENUNCIAS, docSnap.id));
      opCount++;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/excluir denúncias:', error.message);
  }

  // ============================================================
  // 4. Excluir notificações recebidas pelo usuário
  // ============================================================
  try {
    const notificacoesQuery = query(
      collection(db, COLLECTIONS.NOTIFICACOES),
      where('para_uid', '==', userId)
    );
    const notificacoesSnap = await getDocs(notificacoesQuery);
    for (const docSnap of notificacoesSnap.docs) {
      currentBatch.delete(doc(db, COLLECTIONS.NOTIFICACOES, docSnap.id));
      opCount++;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/excluir notificações:', error.message);
  }

  // ============================================================
  // 5. Tratar células onde o usuário é LÍDER
  //    Regra: se houver co-líder, passa bastão. Se não, exclui célula.
  // ============================================================
  try {
    const celulasLiderQuery = query(
      collection(db, COLLECTIONS.CELULAS),
      where('lider_id', '==', userId)
    );
    const celulasLiderSnap = await getDocs(celulasLiderQuery);
    for (const docSnap of celulasLiderSnap.docs) {
      const celula = docSnap.data();
      const coLideres = celula.co_lideres_ids || [];

      if (coLideres.length > 0) {
        // Passa o bastão para o primeiro co-líder
        const novoLiderId = coLideres[0];
        const novosCoLideres = coLideres.filter((id) => id !== userId);
        const membros = celula.membros_ids || [];
        const novosMembros = membros.filter((id) => id !== userId);

        currentBatch.update(doc(db, COLLECTIONS.CELULAS, docSnap.id), {
          lider_id: novoLiderId,
          membros_ids: novosMembros,
          co_lideres_ids: novosCoLideres,
        });
        opCount++;
        await commitIfNeeded();
      } else {
        // Sem co-líder: exclui a célula junto com subcoleções
        const conteudosSnap = await getDocs(
          collection(db, COLLECTIONS.CELULAS, docSnap.id, 'conteudos_ensino')
        );
        for (const conteudoSnap of conteudosSnap.docs) {
          currentBatch.delete(
            doc(db, COLLECTIONS.CELULAS, docSnap.id, 'conteudos_ensino', conteudoSnap.id)
          );
          opCount++;
          await commitIfNeeded();
        }
        currentBatch.delete(doc(db, COLLECTIONS.CELULAS, docSnap.id));
        opCount++;
        await commitIfNeeded();
      }
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao tratar células como líder:', error.message);
  }

  // ============================================================
  // 6. Remover usuário de células como membro/co-líder
  // ============================================================
  try {
    const celulasMembroQuery = query(
      collection(db, COLLECTIONS.CELULAS),
      where('membros_ids', 'array-contains', userId)
    );
    const celulasMembroSnap = await getDocs(celulasMembroQuery);
    for (const docSnap of celulasMembroSnap.docs) {
      currentBatch.update(doc(db, COLLECTIONS.CELULAS, docSnap.id), {
        membros_ids: arrayRemove(userId),
        co_lideres_ids: arrayRemove(userId),
      });
      opCount++;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/atualizar células como membro:', error.message);
  }

  // ============================================================
  // 7. Remover usuário de intercessores_uids em pedidos de oração
  // ============================================================
  try {
    const intercessoesQuery = query(
      collection(db, COLLECTIONS.PEDIDOS_ORACAO),
      where('intercessores_uids', 'array-contains', userId)
    );
    const intercessoesSnap = await getDocs(intercessoesQuery);
    for (const docSnap of intercessoesSnap.docs) {
      currentBatch.update(doc(db, COLLECTIONS.PEDIDOS_ORACAO, docSnap.id), {
        intercessores_uids: arrayRemove(userId),
        intercessores_count: increment(-1),
      });
      opCount += 2;
      await commitIfNeeded();
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/atualizar intercessões:', error.message);
  }

  // ============================================================
  // 8. Remover usuário de endossos_uids em perfis de outros usuários
  // ============================================================
  try {
    const endossosQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('endossos_uids', 'array-contains', userId)
    );
    const endossosSnap = await getDocs(endossosQuery);
    for (const docSnap of endossosSnap.docs) {
      // Evitar modificar o próprio documento (já será excluído)
      if (docSnap.id !== userId) {
        currentBatch.update(doc(db, COLLECTIONS.USERS, docSnap.id), {
          endossos_uids: arrayRemove(userId),
        });
        opCount++;
        await commitIfNeeded();
      }
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/atualizar endossos:', error.message);
  }

  // ============================================================
  // 9. Remover usuário de pedidos_salvos de outros usuários
  // ============================================================
  try {
    const pedidosSalvosQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('pedidos_salvos', 'array-contains', userId)
    );
    const pedidosSalvosSnap = await getDocs(pedidosSalvosQuery);
    for (const docSnap of pedidosSalvosSnap.docs) {
      // Evitar modificar o próprio documento (já será excluído)
      if (docSnap.id !== userId) {
        currentBatch.update(doc(db, COLLECTIONS.USERS, docSnap.id), {
          pedidos_salvos: arrayRemove(userId),
        });
        opCount++;
        await commitIfNeeded();
      }
    }
  } catch (error) {
    console.warn('[excluirDadosUsuario] Erro ao buscar/atualizar pedidos_salvos:', error.message);
  }

  // ============================================================
  // 10. Excluir documento principal do usuário
  // ============================================================
  currentBatch.delete(doc(db, COLLECTIONS.USERS, userId));
  opCount++;

  // ============================================================
  // Executar todas as operações
  // ============================================================
  await flushBatch();
};

// ============================================================
// ESTATÍSTICAS DE ORAÇÃO (Gamificação)
// ============================================================

/**
 * Atualiza as estatísticas de oração do utilizador com lógica de reset diário/semanal.
 *
 * Campos no documento do utilizador:
 * - stats.oracoes_hoje: contador de orações no dia atual
 * - stats.minutos_semana: total de minutos orados na semana atual
 * - stats.ultima_oracao_data: data ISO da última oração (para detetar virada de dia/semana)
 *
 * Regras:
 * - Se a última oração foi num dia diferente do atual, zera oracoes_hoje.
 * - Se a última oração foi numa semana diferente, zera minutos_semana.
 * - O parâmetro minutosOrados é opcional (default 1) e representa os minutos gastos na oração.
 *
 * @param {string} userUid - UID do utilizador
 * @param {number} minutosOrados - Minutos dedicados à oração (default 1)
 */
export const registrarEstatisticasOracao = async (userUid, minutosOrados = 1) => {
  const userRef = doc(db, COLLECTIONS.USERS, userUid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const stats = userData.stats || {};
  const agora = new Date();

  // Data atual no formato YYYY-MM-DD
  const hojeStr = agora.toISOString().split('T')[0];

  // Semana atual: número ISO da semana + ano (ex: "2025-W14")
  const inicioAno = new Date(agora.getFullYear(), 0, 1);
  const diffDias = Math.floor((agora - inicioAno) / (24 * 60 * 60 * 1000));
  const semanaStr = `${agora.getFullYear()}-W${String(Math.ceil((diffDias + inicioAno.getDay() + 1) / 7)).padStart(2, '0')}`;

  const ultimaData = stats.ultima_oracao_data || '';
  const ultimaSemana = stats.ultima_oracao_semana || '';

  // Determinar se deve resetar
  const resetarDiario = ultimaData !== hojeStr;
  const resetarSemanal = ultimaSemana !== semanaStr;

  const updateData = {
    'stats.oracoes_feitas': increment(1),
    'stats.ultima_oracao_data': hojeStr,
    'stats.ultima_oracao_semana': semanaStr,
  };

  if (resetarDiario) {
    updateData['stats.oracoes_hoje'] = 1;
  } else {
    updateData['stats.oracoes_hoje'] = increment(1);
  }

  if (resetarSemanal) {
    updateData['stats.minutos_semana'] = minutosOrados;
  } else {
    updateData['stats.minutos_semana'] = increment(minutosOrados);
  }

  await setDoc(userRef, updateData, { merge: true });
};

// ============================================================
// LOOP DE INTERCESSÃO (Buscar Próximo Pedido)
// ============================================================

/**
 * Busca um pedido de oração aleatório para o loop de intercessão.
 * Exclui o pedido que acabou de ser orado e retorna apenas 1 resultado.
 * Filtra por status 'ativo' e privacidade 'publico'.
 *
 * @param {string} excluirPedidoId - ID do pedido a excluir (o que acabou de ser orado)
 * @returns {Promise<object|null>} - Dados do próximo pedido ou null se não houver
 */
export const buscarProximoPedido = async (excluirPedidoId) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  const q = query(
    collection(db, COLLECTIONS.PEDIDOS_ORACAO),
    where('status', '==', 'ativo'),
    where('privacidade', '==', 'publico'),
    where('createdAt', '>=', dataLimite),
    orderBy('createdAt', 'desc'),
    limit(10)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  // Filtrar o pedido excluído e escolher um aleatório entre os restantes
  const pedidos = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.id !== excluirPedidoId);

  if (pedidos.length === 0) return null;

  // Escolher aleatoriamente para dar variedade ao loop
  const indiceAleatorio = Math.floor(Math.random() * pedidos.length);
  return pedidos[indiceAleatorio];
};

// ============================================================
// NOTIFICAÇÕES IN-APP
// ============================================================

/**
 * Cria uma notificação para um destinatário.
 * @param {string} destinatarioId - UID do utilizador que receberá a notificação
 * @param {string} titulo - Título curto da notificação
 * @param {string} mensagem - Corpo da notificação
 * @param {string} tipo - Tipo: 'apoio', 'intercessao', 'testemunho', 'sistema'
 * @param {string|null} referenciaId - ID do documento relacionado (ex: pedido_id)
 * @returns {Promise<string>} ID do documento criado
 */
export async function criarNotificacao(destinatarioId, titulo, mensagem, tipo, referenciaId = null) {
  const notificacaoRef = await addDoc(collection(db, COLLECTIONS.NOTIFICACOES), {
    destinatario_id: destinatarioId,
    titulo,
    mensagem,
    tipo,
    referencia_id: referenciaId,
    lida: false,
    criado_em: serverTimestamp(),
  });
  return notificacaoRef.id;
}

/**
 * Marca uma notificação como lida.
 * @param {string} notificacaoId - ID do documento da notificação
 */
export async function marcarNotificacaoComoLida(notificacaoId) {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICACOES, notificacaoId), {
    lida: true,
  });
}

/**
 * Escuta em tempo real as notificações não lidas de um utilizador.
 * @param {string} userId - UID do utilizador
 * @param {function} callback - Função chamada com o array de notificações
 * @returns {function} Função para cancelar a subscrição (unsubscribe)
 */
export function ouvirNotificacoesNaoLidas(userId, callback) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICACOES),
    where('destinatario_id', '==', userId),
    where('lida', '==', false)
  );
  return onSnapshot(q, (snapshot) => {
    const notificacoes = [];
    snapshot.forEach((doc) => {
      notificacoes.push({ id: doc.id, ...doc.data() });
    });
    callback(notificacoes);
  });
}

/**
 * Busca todas as notificações de um utilizador ordenadas por data (mais recentes primeiro).
 * @param {string} userId - UID do utilizador
 * @returns {Promise<Array>} Array de notificações
 */
export async function listarNotificacoes(userId) {
  const q = query(
    collection(db, COLLECTIONS.NOTIFICACOES),
    where('destinatario_id', '==', userId),
    orderBy('criado_em', 'desc')
  );
  const snapshot = await getDocs(q);
  const notificacoes = [];
  snapshot.forEach((doc) => {
    notificacoes.push({ id: doc.id, ...doc.data() });
  });
  return notificacoes;
}

// ============================================================
// POSTAGENS DA CÉLULA
// ============================================================

/**
 * Cria uma nova postagem na célula.
 * Valida texto ofensivo e dados obrigatórios antes de enviar.
 *
 * @param {object} dados - { texto, tipo_postagem, anexo }
 * @param {object} autor - { uid, nome, foto_url }
 * @param {string} celulaId - ID da célula destino
 * @returns {Promise<string>} - ID da postagem criada
 */
export const criarPostagem = async (dados, autor, celulaId) => {
  if (!autor || !autor.uid || !autor.nome) {
    throw new Error('Apenas usuários cadastrados podem criar postagens.');
  }
  if (!celulaId) {
    throw new Error('ID da célula é obrigatório.');
  }

  const texto = dados.texto || '';
  if (texto && contemPalavraOfensiva(texto)) {
    throw new Error('Sua postagem contém palavras inadequadas. Por favor, revise o texto.');
  }

  const postagemData = {
    autor_id: autor.uid,
    autor_nome: autor.nome,
    autor_foto_url: autor.foto_url || null,
    texto: texto,
    tipo_postagem: dados.tipo_postagem || 'texto',
    anexo: dados.anexo || null,
    celula_id: celulaId,
    likes_count: 0,
    likes_uids: [],
    comments_count: 0,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.POSTAGENS), postagemData);
  return docRef.id;
};

/**
 * Escuta as postagens de uma célula em tempo real.
 * Retorna as postagens ordenadas por data decrescente.
 *
 * @param {string} celulaId - ID da célula
 * @param {function} callback - Função chamada com a lista de postagens
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarPostagensDaCelula = (celulaId, callback) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 90); // últimas 90 dias

  const q = query(
    collection(db, COLLECTIONS.POSTAGENS),
    where('celula_id', '==', celulaId),
    where('createdAt', '>=', dataLimite),
    orderBy('createdAt', 'desc'),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {
    const postagens = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(postagens);
  });
};

/**
 * Alterna o like de um usuário em uma postagem.
 * Se o usuário já curtiu, remove o like. Caso contrário, adiciona.
 *
 * @param {string} postagemId - ID da postagem
 * @param {string} userId - UID do usuário
 * @returns {Promise<boolean>} - true se adicionou like, false se removeu
 */
export const toggleLikePostagem = async (postagemId, userId) => {
  if (!userId) throw new Error('Usuário não autenticado.');

  const postagemRef = doc(db, COLLECTIONS.POSTAGENS, postagemId);
  const postagemSnap = await getDoc(postagemRef);

  if (!postagemSnap.exists()) {
    throw new Error('Postagem não encontrada.');
  }

  const postagem = postagemSnap.data();
  const likesUids = postagem.likes_uids || [];
  const jaCurtiu = likesUids.includes(userId);

  if (jaCurtiu) {
    await updateDoc(postagemRef, {
      likes_uids: arrayRemove(userId),
      likes_count: increment(-1),
    });
    return false;
  } else {
    await updateDoc(postagemRef, {
      likes_uids: arrayUnion(userId),
      likes_count: increment(1),
    });
    return true;
  }
};

/**
 * Remove uma postagem (apenas o autor pode remover).
 *
 * @param {string} postagemId - ID da postagem
 * @param {string} userId - UID do autor
 * @throws {Error} - Se não for o autor
 */
export const removerPostagem = async (postagemId, userId) => {
  const postagemRef = doc(db, COLLECTIONS.POSTAGENS, postagemId);
  const postagemSnap = await getDoc(postagemRef);

  if (!postagemSnap.exists()) {
    throw new Error('Postagem não encontrada.');
  }

  const postagem = postagemSnap.data();
  if (postagem.autor_id !== userId) {
    throw new Error('Apenas o autor pode remover a postagem.');
  }

  await deleteDoc(postagemRef);
};
