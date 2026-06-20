// Serviço de Autenticação Google - Google OAuth + Firebase
// Fluxo: GoogleSignIn → idToken → Firebase Credential → signInWithCredential

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  getAdditionalUserInfo,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import { formatarFotoGoogle } from '../utils/formatters';

// ============================================================
// Configuração do Google Sign-In
// ============================================================
// O Firebase exige o webClientId (do console do Google Cloud / Firebase Web App)
// para gerar o idToken. NÃO use androidClientId.
// ============================================================

const WEB_CLIENT_ID = '502593040102-hbhi67eb9f2k3srn5m305ajnu2v3hsef.apps.googleusercontent.com';

/**
 * Configura o GoogleSignin SDK.
 * Deve ser chamado uma vez no início da aplicação (ex: App.js).
 */
export const configureGoogleSignIn = () => {
  try {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
    });
    console.log('[GoogleAuth] GoogleSignin configurado com sucesso.');
  } catch (error) {
    console.error('[GoogleAuth] Erro ao configurar GoogleSignin:', error);
  }
};

/**
 * Gera um username único baseado no nome do Google.
 * Como o Google já garante que o email é único, usamos o prefixo do email
 * como base do username para evitar colisões.
 *
 * @param {string} nome - Nome completo do usuário (do Google)
 * @param {string} email - Email do Google (usado como fallback)
 * @returns {string} - Username (ex: @joaosilva384)
 */
const gerarUsernameGoogle = (nome, email) => {
  // Tentar usar o nome normalizado
  const baseNome = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  if (baseNome.length >= 3) {
    const sufixo = Math.floor(100 + Math.random() * 900);
    return `@${baseNome}${sufixo}`;
  }

  // Fallback: usar prefixo do email
  const prefixoEmail = email.split('@')[0]
    .replace(/[^a-z0-9]/g, '')
    .toLowerCase();
  const sufixo = Math.floor(100 + Math.random() * 900);
  return `@${prefixoEmail}${sufixo}`;
};

/**
 * Executa o fluxo completo de login com Google:
 * 1. Verifica Google Play Services
 * 2. Abre a UI do Google Sign-In
 * 3. Extrai o idToken
 * 4. Cria credencial Firebase
 * 5. Faz signInWithCredential
 * 6. Se for novo usuário, cria o perfil no Firestore
 *
 * @returns {Promise<object>} - Objeto do usuário autenticado no Firebase
 * @throws {Error} - Se o fluxo falhar em qualquer etapa
 */
export const signInWithGoogle = async () => {
  // 1. Verificar Google Play Services
  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  // 2. Abrir UI do Google Sign-In
  const userInfo = await GoogleSignin.signIn();

  // 3. Extrair idToken
  const idToken = userInfo.data?.idToken;
  if (!idToken) {
    throw new Error('Não foi possível obter o token de autenticação do Google.');
  }

  // 4. Criar credencial Firebase com o idToken
  const googleCredential = GoogleAuthProvider.credential(idToken);

  // 5. Autenticar no Firebase
  const userCredential = await signInWithCredential(auth, googleCredential);
  const firebaseUser = userCredential.user;

  // 6. Atualizar foto do perfil no Firebase Auth (sempre, mesmo para usuários existentes)
  const googlePhoto = userInfo.user?.photo || null;
  const fotoAltaResolucao = formatarFotoGoogle(googlePhoto);
  if (fotoAltaResolucao && firebaseUser.photoURL !== fotoAltaResolucao) {
    try {
      await updateProfile(firebaseUser, { photoURL: fotoAltaResolucao });
      console.log('[GoogleAuth] photoURL atualizado no Firebase Auth.');
    } catch (profileError) {
      console.warn('[GoogleAuth] Erro ao atualizar photoURL:', profileError.message);
    }
  }

  // 7. Verificar se é novo usuário e criar perfil
  const additionalUserInfo = getAdditionalUserInfo(userCredential);

  if (additionalUserInfo?.isNewUser) {
    // Dados do perfil Google
    const displayName = firebaseUser.displayName || '';
    const email = firebaseUser.email || '';
    const photoURL = firebaseUser.photoURL || fotoAltaResolucao || '';
    const username = gerarUsernameGoogle(displayName, email);

    // Criar documento do usuário no Firestore
    await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
      uid: firebaseUser.uid,
      nome: displayName,
      username,
      email,
      foto_url: photoURL,
      titulo_ministerial: 'membro',
      celulas_inscritas: [],
      endossos_uids: [],
      verificado_lideranca: false,
      stats: {
        oracoes_feitas: 0,
        oracoes_hoje: 0,
        minutos_semana: 0,
        ultima_oracao_data: '',
        ultima_oracao_semana: '',
        testemunhos: 0,
        endossos_recebidos: 0,
      },
      is_admin: false,
      termos_aceitos: true,
      push_notificacoes_activas: true,
      createdAt: serverTimestamp(),
    });

    console.log('[GoogleAuth] Novo perfil criado para:', firebaseUser.uid);
  } else {
    // Usuário existente: atualizar foto_url no Firestore para manter sincronizado
    if (fotoAltaResolucao) {
      try {
        await setDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
          foto_url: fotoAltaResolucao,
        }, { merge: true });
        console.log('[GoogleAuth] foto_url atualizado no Firestore para usuário existente.');
      } catch (firestoreError) {
        console.warn('[GoogleAuth] Erro ao atualizar foto_url no Firestore:', firestoreError.message);
      }
    }
  }

  return firebaseUser;
};

/**
 * Faz logout desconectando tanto do Firebase quanto do Google Sign-In.
 */
export const signOutGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    console.log('[GoogleAuth] Logout do Google realizado.');
  } catch (error) {
    console.warn('[GoogleAuth] Erro ao fazer logout do Google:', error.message);
  }
};