// uploadService — Upload de mídia para o Firebase Storage via REST API
import { uploadAsync } from 'expo-file-system/legacy';

const BUCKET = 'interceder-ef0cd.firebasestorage.app';
const BASE_URL = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o`;

/**
 * Faz upload de uma imagem para o Firebase Storage.
 * @param {string} uri - URI local da imagem
 * @param {object} user - Objeto do usuário (com getIdToken)
 * @param {string} pasta - Pasta de destino (ex: 'pedidos', 'testemunhos')
 * @returns {Promise<string>} - URL pública da imagem
 */
export async function uploadImagem(uri, user, pasta = 'pedidos') {
  if (!uri) return null;
  const token = await user.getIdToken();
  const nome = `img_${Date.now()}.jpg`;
  const urlUpload = `${BASE_URL}?name=${pasta}%2F${user.uid}%2F${nome}`;

  await uploadAsync(urlUpload, uri, {
    httpMethod: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
  });

  return `${BASE_URL}/${pasta}%2F${user.uid}%2F${nome}?alt=media`;
}
