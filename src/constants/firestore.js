// Constantes do Firestore - Schema do Banco de Dados
// Baseado no CONTEXT.md

export const COLLECTIONS = {
  USERS: 'users',
  PEDIDOS_ORACAO: 'pedidos_oracao',
  CELULAS: 'celulas',
  CONFIGURACOES: 'configuracoes',
  TESTEMUNHOS: 'testemunhos',
  DENUNCIAS: 'denuncias',
  NOTIFICACOES: 'notificacoes',
  SUPORTE: 'suporte',
};

export const USER_FIELDS = {
  UID: 'uid',
  NOME: 'nome',
  EMAIL: 'email',
  TITULO_MINISTERIAL: 'titulo_ministerial',
  CELULAS_INSCRITAS: 'celulas_inscritas',
  STATS: 'stats',
  IS_ADMIN: 'is_admin',
};

export const TITULOS_MINISTERIAIS = [
  { label: 'Membro', value: 'membro' },
  { label: 'Diácono', value: 'diacono' },
  { label: 'Missionário', value: 'missionario' },
  { label: 'Evangelista', value: 'evangelista' },
  { label: 'Presbítero', value: 'presbitero' },
  { label: 'Pastor', value: 'pastor' },
];

export const PEDIDO_FIELDS = {
  ID: 'id',
  AUTOR_ID: 'autor_id',
  AUTOR_NOME: 'autor_nome',
  TEXTO: 'texto',
  CATEGORIA: 'categoria',
  PRIVACIDADE: 'privacidade',
  ID_CELULA_RESTRITA: 'id_celula_restrita',
  INTERCESSORES_COUNT: 'intercessores_count',
  STATUS: 'status',
  DENUNCIAS_UIDS: 'denuncias_uids',
  CREATED_AT: 'createdAt',
};

export const CATEGORIAS_PEDIDO = [
  { label: 'Saúde', value: 'saude' },
  { label: 'Família', value: 'familia' },
  { label: 'Finanças', value: 'financas' },
  { label: 'Espiritual', value: 'espiritual' },
  { label: 'Vida Sentimental', value: 'vida_sentimental' },
  { label: 'Outros', value: 'outros' },
];

export const PRIVACIDADE_OPCOES = [
  { label: 'Público', value: 'publico' },
  { label: 'Apenas Célula', value: 'celula' },
];

// Número mínimo de denúncias para moderar automaticamente um pedido
export const DENUNCIAS_LIMITE = 3;

export const STATUS_PEDIDO = {
  ATIVO: 'ativo',
  EM_MODERACAO: 'em_moderacao',
  RESPONDIDO: 'respondido',
};

export const CELULA_FIELDS = {
  ID: 'id',
  NOME: 'nome',
  LIDER_ID: 'lider_id',
  CO_LIDERES_IDS: 'co_lideres_ids',
  MEMBROS_IDS: 'membros_ids',
  HORARIO_ORACAO: 'horario_oracao',
  ENSINO_ATUAL: 'ensino_atual',
  CREATED_AT: 'createdAt',
};
