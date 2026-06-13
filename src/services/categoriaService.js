// Serviço de Categorias - Carrega categorias do Firestore com fallback local
// As categorias são gerenciadas pelo dashboard administrativo
// Se não houver categorias no Firestore, usa as fixas do constants/firestore.js

import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { CATEGORIAS_PEDIDO } from '../constants/firestore';

/**
 * Escuta as categorias do Firestore em tempo real.
 * Se não houver categorias no Firestore, usa as fixas como fallback.
 *
 * @param {function} callback - Função chamada com a lista de categorias [{label, value}]
 * @returns {function} - Função para cancelar a inscrição
 */
export const listarCategorias = (callback) => {
  const q = query(
    collection(db, 'categorias_pedidos'),
    orderBy('criado_em', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      // Fallback: usar categorias fixas do constants
      callback(CATEGORIAS_PEDIDO);
      return;
    }

    const categorias = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        label: data.nome || data.label || 'Sem nome',
        value: data.value || data.id || doc.id,
        icone: data.icone || '',
      };
    });

    callback(categorias);
  });
};