import { collection, query, where, onSnapshot, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Busca anúncios ativos para uma determinada tela e perfil.
 * Filtra por tela, validade, e anúncios já vistos.
 * Retorna no máximo 1 anúncio por chamada.
 *
 * @param {string} telaAtual - 'home' | 'mural' | 'celula' | 'global'
 * @param {object} userProfile - Perfil do usuário logado (ou null)
 * @param {function} callback - Função chamada com o anúncio elegível (ou null)
 * @returns {function} - Função para cancelar a inscrição
 */
export function buscarAnuncioUnico(telaAtual, userProfile, callback) {
  const q = query(
    collection(db, 'anuncios'),
    where('ativo', '==', true)
  );

  return onSnapshot(
    q,
    async (snapshot) => {
      const agora = Date.now();
      const todosAnuncios = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filtra por tela alvo, validade e segmentação
      const elegiveis = todosAnuncios.filter((anuncio) => {
        const telas = anuncio.telasAlvo || [];
        const telaValida = telas.includes(telaAtual) || telas.includes('global');
        const inicioOk = !anuncio.inicioEm?.seconds || anuncio.inicioEm.seconds * 1000 <= agora;
        const fimOk = !anuncio.fimEm?.seconds || anuncio.fimEm.seconds * 1000 >= agora;

        // Filtro por cargo ministerial
        if (anuncio.filtroCargos && anuncio.filtroCargos.length > 0 && userProfile) {
          const cargo = userProfile.titulo_ministerial || 'membro';
          if (!anuncio.filtroCargos.includes(cargo)) return false;
        }

        // Filtro por UID específico
        if (anuncio.filtroUids && anuncio.filtroUids.length > 0 && userProfile) {
          if (!anuncio.filtroUids.includes(userProfile.uid)) return false;
        }

        return telaValida && inicioOk && fimOk;
      });

      // Ordena por prioridade
      elegiveis.sort((a, b) => (a.prioridade ?? 999) - (b.prioridade ?? 999));

      // Pega apenas o primeiro não visto
      let encontrado = null;
      for (const anuncio of elegiveis) {
        try {
          const vistoKey = `visto_anuncio_${anuncio.id}`;
          const visto = await AsyncStorage.getItem(vistoKey);
          if (!visto) {
            encontrado = anuncio;
            break;
          }
        } catch (e) {
          encontrado = anuncio;
          break;
        }
      }

      callback(encontrado);
    },
    () => {
      callback(null);
    }
  );
}

/**
 * Marca um anúncio como visualizado pelo usuário.
 * Salva no AsyncStorage e incrementa contador no Firestore.
 *
 * @param {object} anuncio - Anúncio visualizado
 * @param {string} userId - UID do usuário (opcional)
 */
export async function marcarAnuncioVisto(anuncio, userId) {
  if (!anuncio?.id) return;

  try {
    await AsyncStorage.setItem(`visto_anuncio_${anuncio.id}`, 'true');
  } catch (e) {}

  // Incrementa contador de visualizações no Firestore
  try {
    const ref = doc(db, 'anuncios', anuncio.id);
    await updateDoc(ref, {
      visualizacoes: increment(1),
      ultimoVisualizadoEm: new Date().toISOString(),
    });
  } catch (e) {
    // Ignora erro de permissão (fallback silencioso)
  }
}

/**
 * Registra um clique em anúncio (incrementa contador no Firestore).
 *
 * @param {string} anuncioId - ID do anúncio clicado
 */
export async function registrarCliqueAnuncio(anuncioId) {
  if (!anuncioId) return;
  try {
    const ref = doc(db, 'anuncios', anuncioId);
    await updateDoc(ref, {
      cliques: increment(1),
      ultimoCliqueEm: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Anuncio] Erro ao registrar clique:', e.message);
  }
}