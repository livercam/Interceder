// Serviço de Autenticação - Firebase Auth
// Gerencia login, cadastro, logout e observação do estado de autenticação

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  deleteUser,
  sendEmailVerification,
  applyActionCode,
} from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { buscarCelulasPadrao } from './firestoreService';

/**
 * Gera um username único baseado no nome do usuário.
 * Remove espaços, acentos, coloca em minúsculas e adiciona sufixo numérico aleatório.
 * Verifica se o username já existe no Firestore e gera outro se necessário.
 *
 * @param {string} nome - Nome completo do usuário
 * @returns {Promise<string>} - Username único (ex: @joaosilva384)
 */
const gerarUsernameUnico = async (nome) => {
  // Normalizar: remover acentos, espaços, minúsculas
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '') // remove espaços
    .toLowerCase();

  let username = '';
  let tentativas = 0;

  do {
    const sufixo = Math.floor(100 + Math.random() * 900); // 100-999
    username = `@${base}${sufixo}`;
    tentativas++;

    // Verificar se já existe
    const q = query(collection(db, 'users'), where('username', '==', username));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return username; // Único!
    }

    // Segurança: evitar loop infinito
    if (tentativas > 20) {
      // Usar timestamp como fallback
      username = `@${base}${Date.now().toString(36).slice(-4)}`;
      return username;
    }
  } while (tentativas < 20);

  return username;
};

/**
 * Cria um novo usuário com email/senha.
 * Após criar no Auth, armazena o perfil no Firestore com titulo_ministerial='membro'
 * e um username único gerado automaticamente.
 *
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @param {string} nome - Nome completo do usuário
 * @param {boolean} notificacoesAceitas - Se o usuário aceitou receber notificações (LGPD)
 * @returns {Promise<object>} - Objeto do usuário autenticado
 */
export const registerUser = async (email, password, nome, notificacoesAceitas = false) => {
  // 1. Criar usuário no Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // 2. Atualizar o displayName no Auth
  await updateProfile(user, { displayName: nome });

  // 3. Gerar username único
  const username = await gerarUsernameUnico(nome);

  // 4. Criar documento do usuário no Firestore
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    nome,
    username,
    email,
    titulo_ministerial: 'membro',
    celulas_inscritas: [],
    stats: {
      oracoes_feitas: 0,
      dias_seguidos: 0,
    },
    is_admin: false,
    createdAt: serverTimestamp(),
    // Campos LGPD
    termos_aceitos: true,
    notificacoes_aceitas: notificacoesAceitas,
    lgpd_data_aceite: serverTimestamp(),
  });

  // 5. Enviar email de verificação (não bloqueante — resiliência)
  try {
    await sendEmailVerification(user);
    console.log('[Auth] Email de verificação enviado para:', email);
  } catch (verifError) {
    // Não travar o fluxo de registo se o envio do email falhar
    console.warn('[Auth] Erro ao enviar email de verificação:', verifError.message);
  }

  // 6. Auto-inscrição em células 'Padrão'
  try {
    const celulasPadrao = await buscarCelulasPadrao();
    if (celulasPadrao.length > 0) {
      const celulasIds = celulasPadrao.map((c) => c.id);

      // Atualizar o documento do usuário com os IDs das células padrão
      await setDoc(
        doc(db, 'users', user.uid),
        {
          celulas_inscritas: celulasIds,
        },
        { merge: true }
      );

      // Adicionar o UID do usuário ao array membros_ids de cada célula padrão
      const promessas = celulasPadrao.map((celula) =>
        setDoc(
          doc(db, 'celulas', celula.id),
          {
            membros_ids: arrayUnion(user.uid),
          },
          { merge: true }
        )
      );
      await Promise.all(promessas);
    }
  } catch (error) {
    // Não travar o fluxo de registo se a busca por células padrão falhar
    console.warn('[AutoInscricao] Erro ao inscrever em células padrão:', error);
  }

  return user;
};

/**
 * Autentica um usuário existente com email/senha.
 *
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<object>} - Objeto do usuário autenticado
 */
export const loginUser = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

/**
 * Encerra a sessão do usuário atual.
 *
 * @returns {Promise<void>}
 */
export const logoutUser = async () => {
  await signOut(auth);
};

/**
 * Escuta as mudanças no estado de autenticação do Firebase.
 * Retorna a função de unsubscribe para parar de escutar.
 *
 * @param {function} callback - Função chamada com o usuário (ou null)
 * @returns {function} - Função para cancelar a inscrição
 */
export const subscribeToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

/**
 * Retorna o usuário atualmente autenticado (síncrono).
 *
 * @returns {object|null}
 */
export const getCurrentUser = () => {
  return auth.currentUser;
};

/**
 * Exclui a conta de autenticação do usuário atual no Firebase Auth.
 * ATENÇÃO: Esta ação é irreversível. Os dados no Firestore devem ser
 * excluídos ANTES de chamar esta função.
 *
 * Se o Firebase Auth retornar o erro 'auth/requires-recent-login',
 * a função captura e relança com uma mensagem amigável.
 *
 * @returns {Promise<void>}
 * @throws {Error} - Se o login recente for necessário
 */
export const excluirContaAuth = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nenhum usuário autenticado.');
  }

  try {
    await deleteUser(user);
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      throw new Error(
        'Por segurança, faça logout, entre novamente e tente excluir a conta logo em seguida.'
      );
    }
    throw error;
  }
};

/**
 * Envia um email de verificação para o usuário atualmente autenticado.
 * O email contém um link que o usuário deve clicar para confirmar o endereço.
 *
 * @returns {Promise<void>}
 * @throws {Error} - Se não houver usuário autenticado
 */
export const enviarVerificacaoEmail = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nenhum usuário autenticado para verificar o email.');
  }

  await sendEmailVerification(user, {
    // URL para onde o usuário será redirecionado após clicar no link (opcional)
    // No mobile, o Firebase geralmente usa o link dinâmico ou deep link configurado no console
    url: 'https://interceder-ef0cd.firebaseapp.com',
  });
};

/**
 * Recarrega os dados do usuário do Firebase Auth (para atualizar emailVerified).
 * Deve ser chamado após o usuário clicar no link de verificação.
 *
 * @returns {Promise<boolean>} - true se o email foi verificado, false caso contrário
 */
export const recarregarEAnalisarVerificacao = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Nenhum usuário autenticado.');
  }

  await user.reload();
  const usuarioAtualizado = auth.currentUser;
  return usuarioAtualizado?.emailVerified === true;
};

/**
 * Verifica se o usuário atual tem o email verificado.
 * Usa o objeto em cache do Firebase Auth (não faz reload).
 * Para verificação precisa, use recarregarEAnalisarVerificacao().
 *
 * @returns {boolean}
 */
export const isEmailVerificado = () => {
  const user = auth.currentUser;
  return user?.emailVerified === true;
};
