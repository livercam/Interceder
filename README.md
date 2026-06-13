# 🙏 Interceder - App Mobile

Aplicativo de comunidade cristã para compartilhamento de pedidos de oração, testemunhos, células e intercessão.

## 📱 Tecnologias

- **React Native** com **Expo** (Managed Workflow)
- **Firebase** (Auth, Firestore, Storage, Cloud Functions, Cloud Messaging)
- **React Navigation** (navegação em pilha)

## 🚀 Como Executar

```bash
# Instalar dependências
npm install --legacy-peer-deps

# Iniciar servidor de desenvolvimento
npx expo start

# Limpar cache (se houver problemas)
npx expo start --clear
```

## 📁 Estrutura do Projeto

```
src/
├── assets/         # Animações e recursos estáticos
├── components/     # Componentes reutilizáveis (BannerAd, CustomAlert, etc.)
├── constants/      # Temas, esquemas do Firestore
├── contexts/       # Contextos React (AuthContext)
├── navigation/     # Configuração de navegação
├── screens/        # Telas do aplicativo
├── services/       # Serviços Firebase e utilitários
└── utils/          # Funções utilitárias
```

## 🔐 Autenticação

- Firebase Auth com email/senha e Google Sign-In
- Fluxo de verificação de email
- Persistência de sessão com AsyncStorage

## 📋 Principais Funcionalidades

| Tela | Descrição |
|------|-----------|
| **Mural** | Feed de pedidos de oração com filtros |
| **Células** | Grupos com feed de ensino |
| **Perfil** | Edição, cargo ministerial, endossos |
| **Testemunhos** | Compartilhamento de orações respondidas |
| **Sala de Intercessão** | Interação em tempo real |
| **Anúncios** | Banners promocionais segmentados (imagem ou vídeo) |

## 🔔 Notificações Push

- **Token:** FCM nativo (`getDevicePushTokenAsync`)
- **Envio:** Cloud Function `enviarPush` (Firebase Admin SDK)
- **Gatilhos:** Novo pedido na célula, mensagem de apoio, feed de ensino

## ☁️ Firebase

### Firestore
- `users` - Perfis de usuários
- `pedidos_oracao` - Pedidos de oração
- `celulas` - Grupos/células
- `testemunhos` - Testemunhos
- `anuncios` - Banners promocionais
- `denuncias`, `suporte`, `notificacoes`, `configuracoes`
- `titulos_ministeriais`, `categorias_pedidos`

### Cloud Functions
| Função | Descrição |
|--------|-----------|
| `enviarPush` | Envia push notification via FCM v1 |
| `onPedidoCelulaCriado` | Notifica membros da célula |
| `onFeedCelulaCriado` | Notifica novo conteúdo de ensino |
| `onMensagemApoioPedido` | Notifica apoio em pedido |
| `onMensagemApoioTestemunho` | Notifica apoio em testemunho |
| `enviarSuporte` | Formulário de contato |

## 📦 Deploy das Cloud Functions

```bash
cd functions
firebase deploy --only functions