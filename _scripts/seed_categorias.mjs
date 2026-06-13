const API_KEY = 'AIzaSyBygqdqXmJRTrkdKcISdkR4l8Jql7nXD6o';
const PROJECT_ID = 'interceder-ef0cd';

const categorias = [
  { nome: 'Saúde', icone: '🩺', value: 'saude' },
  { nome: 'Família', icone: '👨‍👩‍👧‍👦', value: 'familia' },
  { nome: 'Finanças', icone: '💰', value: 'financas' },
  { nome: 'Espiritual', icone: '🙏', value: 'espiritual' },
  { nome: 'Vida Sentimental', icone: '💕', value: 'vida_sentimental' },
  { nome: 'Outros', icone: '📌', value: 'outros' },
];

async function criarCategoria(cat) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/categorias_pedidos?key=${API_KEY}`;
  const body = JSON.stringify({
    fields: {
      nome: { stringValue: cat.nome },
      icone: { stringValue: cat.icone },
      value: { stringValue: cat.value },
      criado_em: { timestampValue: new Date().toISOString() },
    }
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.json();
    if (res.ok) {
      console.log('✅ Criada:', cat.nome, '→', data.name?.split('/').pop());
    } else {
      console.log('❌ Erro em', cat.nome + ':', data.error?.message);
    }
  } catch (err) {
    console.log('❌ Falha em', cat.nome + ':', err.message);
  }
}

(async () => {
  console.log('📦 Cadastrando categorias padrão no Firestore...\n');
  for (const cat of categorias) {
    await criarCategoria(cat);
  }
  console.log('\n🏁 Finalizado!');
})();