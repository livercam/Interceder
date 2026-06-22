# 📋 Próximas Melhorias (Pendentes)

_Criado em 21/06/2026_

---

## 📱 App Mobile (React Native + Expo)

### 🎨 Melhorias de UI/UX
- [ ] **Dark Mode** — Implementar tema escuro completo (ThemeContext)
- [ ] **Onboarding** — Verificar se aparece apenas na 1ª vez (testar fluxo)

### 🔧 Infraestrutura
- [ ] **CI/CD** — GitHub Actions para lint + build automático

---

## 🖥️ Painel Admin (React + Vite + TypeScript)

### 📊 Dashboard
- [ ] **Dashboard com stats reais** — Gráficos conectados ao Firestore (não mockados)

### 📱 Responsividade
- [ ] **Responsividade mobile** — Layout adaptado para telas menores

### 📦 Exportação
- [ ] **Exportar dados CSV** — Botão para exportar usuários, pedidos, denúncias

---

## 🏗️ Build
- [ ] **Gerar novo APK** — `npx eas build --platform android --profile development --clear-cache`
  (Inclui: WebViewScreen, expo-image-picker, expo-image-manipulator)