/**
 * Utilitários de formatação de texto para toda a aplicação.
 */

/**
 * Formata um nome completo para exibir apenas o primeiro e o último nome.
 * Ex: "João Pedro da Silva Santos" → "João Santos"
 * Ex: "Maria" → "Maria"
 * Ex: null/undefined → "Usuário"
 *
 * @param {string|null|undefined} nomeCompleto - Nome completo do utilizador
 * @returns {string} - Nome formatado (primeiro + último nome)
 */
export const formatarNomeCurto = (nomeCompleto) => {
  if (!nomeCompleto) return 'Usuário';
  const partes = nomeCompleto.trim().split(' ').filter(Boolean);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
};

/**
 * Aumenta a resolução da foto de perfil do Google.
 * O Google permite redimensionar as imagens via parâmetro na URL.
 * Padrão: =s96-c (96x96). Substituímos por =s200-c (200x200).
 *
 * @param {string|null} photoURL - URL da foto do Google
 * @returns {string|null} - URL com resolução maior, ou null se não houver URL
 */
export const formatarFotoGoogle = (photoURL) => {
  if (!photoURL) return null;
  if (photoURL.includes('=s96-c')) {
    return photoURL.replace('=s96-c', '=s200-c');
  }
  return photoURL;
};