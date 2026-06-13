# 📖 Documentação Técnica - Interceder App

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | React Native + Expo (SDK 56, Managed Workflow) |
| Navegação | React Navigation (Stack) |
| Autenticação | Firebase Auth (email/senha + Google Sign-In) |
| Banco de Dados | Firestore (NoSQL, tempo real) |
| Storage | Firebase Storage (imagens, vídeos) |
| Backend Serverless | Firebase Cloud Functions (Node.js 22) |
| Push Notifications | Firebase Cloud Messaging (FCM v1) via Admin SDK |
| Mapas | react-native-maps |
| Animações | Lottie + React Native Animated |

## Arquitetura do Projeto

```
Interceder/
├── App.js                    # Entry point
├── app.json                  # Expo config
├── firebase.json             # Firebase CLI config
├── firestore.rules           # Regras de segurança
├── storage.rules             # Regras do Storage
├── eas.json                  # EAS Build config
├── functions/                # Cloud Functions
│   ├── index.js              # Todas as funções
│   ├── package.json
│   └── service-account.json  # Credenciais Admin (gitignored)
├── src/
│   ├── assets/
│   │   └── animations/       # Arquivos Lottie (particles.json)
│   ├── components/           # Componentes reutilizáveis
│   │   ├── BannerAd.js       # Popup de anúncios (imagem/vídeo)
│   │   ├── CustomAlert.js    # Alertas customizados
│   │   ├── CustomSplashScreen.js
│   │   ├── DenunciaModal.js  # Modal de denúncia
│   │   ├── HeaderLogo.js     # Logo no header
│   │   ├── KebabMenu.js      # Menu de opções
│   │   └── NotificationIcon.js
│   ├── constants/
│   │   ├── firestore.js      # Schema do Firestore
│   │   └── theme.js          # Cores, fontes, espaçamentos
│   ├── contexts/
│   │   └── AuthContext.js    # Estado global do usuário
│   ├── navigation/
│   │   └── AppNavigator.js   # Configuração de rotas
│   ├── screens/              # Telas do app
│   ├── services/
│   │   ├── firebaseConfig.js # Config Firebase
│   │   ├── firestoreService.js # CRUD + queries
│   │   ├── authService.js    # Auth operations
│   │   ├── categoriaService.js
│   │   ├── googleAuthService.js
│   │   ├── anuncioService.js # Sistema de anúncios
│   │   ├── notificationService.js # Push notifications
│   │   └── RevenueCatService.js
│   └── utils/
│       └── formatters.js     # Funções de formatação
```

## 🔐 Autenticação (AuthContext)

O `AuthContext` gerencia o estado global do usuário, combinando:
- `onAuthStateChanged` (Firebase Auth)
- `onSnapshot` (Firestore perfil)

```javascript
const { user, userProfile, isLoading } = useAuth();
```

**Fluxo de login:**
1. Usuário faz login (email/senha ou Google)
2. AuthContext escuta mudanças no Auth
3. Se logado, busca perfil no Firestore (`users/{uid}`)
4. Se não existir perfil, cria com dados básicos
5. Registra push token automaticamente

## 📦 Firestore - Coleções

| Coleção | Campos principais | Uso |
|---------|------------------|-----|
| `users/{uid}` | nome, email, whatsapp, titulo_ministerial, expo_push_token, celulas_inscritas, endossos_uids, isPremium | Perfil |
| `pedidos_oracao/{id}` | autor_id, texto, categoria, privacidade, status, intercessores_count, denuncias_uids | Pedidos |
| `celulas/{id}` | nome, lider_id, membros_ids, destaque_tipo | Grupos |
| `testemunhos/{id}` | autor_id, texto, glorias, status | Testemunhos |
| `anuncios/{id}` | titulo, tipo, imagemUrl, videoUrl, linkDestino, telasAlvo, prioridade, filtroCargos, filtroUids, visualizacoes, cliques | Anúncios |
| `denuncias/{id}` | item_id, item_tipo, denunciante_id | Denúncias |
| `suporte/{id}` | nome, email, assunto, mensagem | Contato |
| `configuracoes/geral` | pix_chave, link_doacao | Config |
| `titulos_ministeriais/{id}` | label, value, ordem | Cargos |
| `categorias_pedidos/{id}` | nome, icone | Categorias |

## 📢 Sistema de Anúncios (BannerAd)

### Estrutura do documento `anuncios/{id}`
```typescript
{
  titulo: string,
  tipo: 'imagem' | 'video',
  imagemUrl?: string,       // URL da imagem no Storage
  videoUrl?: string,        // URL do vídeo (Storage ou externo)
  linkDestino?: string,     // URL ao clicar
  telasAlvo: string[],      // ['home', 'mural', 'celula', 'global']
  prioridade: number,       // 0 = mais alta
  ativo: boolean,
  filtroCargos?: string[],  // Segmentação por cargo
  filtroUids?: string[],    // Segmentação por usuário
  visualizacoes: number,    // Métrica
  cliques: number,          // Métrica
  versao: number            // Incrementa ao editar
}
```

### Fluxo no App
1. `buscarAnuncioUnico()` busca 1 anúncio ativo não visto
2. Filtra por tela, cargo, UID, validade
3. Salva como visto no AsyncStorage
4. Exibe popup fullscreen
5. Ao clicar "Acessar", registra clique no Firestore

## 🔔 Push Notifications

### Arquitetura Atual
```
App Mobile (getDevicePushTokenAsync)
    → Token FCM nativo salvo em users/{uid}.expo_push_token
    → Cloud Function lê token e usa admin.messaging().send()
    → FCM v1 API entrega ao dispositivo
```

### Gatilhos automáticos (Cloud Functions)
| Gatilho | Quando | Quem recebe |
|---------|--------|-------------|
| `onPedidoCelulaCriado` | Novo pedido em célula | Membros da célula (exceto autor) |
| `onFeedCelulaCriado` | Novo conteúdo de ensino | Membros da célula |
| `onMensagemApoioPedido` | Mensagem de apoio | Autor do pedido |
| `onMensagemApoioTestemunho` | Mensagem de apoio | Autor do testemunho |

## 🎨 Tema (theme.js)

```javascript
COLORS = {
  primary: '#A94438',       // Terracota
  secondary: '#E28743',     // Laranja queimado
  accent: '#D4A373',        // Dourado suave
  background: '#FFFBF5',    // Creme
  success: '#4CAF50',
  error: '#EF4444',
}
```

## 📦 Deploy

### Cloud Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

### EAS Build (Android)
```bash
eas build --platform android --profile production