// Tema do App Interceder
// Paleta "Acolhimento Quente" - Terracota e Algodão
// Inspirada em tons de barro, cerâmica e comunidade

export const COLORS = {
  // Fundo e Superfície
  backgroundApp: '#FFFBF5', // Creme/Algodão para o fundo dos ecrãs
  cardBackground: '#FFFFFF', // Branco puro para os cartões saltarem
  white: '#FFFFFF',

  // Cores primárias - Terracota
  primary: '#A94438', // Terracota para botões e headers
  primaryLight: '#C96A5E',
  primaryDark: '#8A352A',

  // Cores secundárias - Laranja Queimado
  secondary: '#E28743', // Laranja queimado para destaques e ícones
  secondaryLight: '#F0A86A',
  secondaryDark: '#C46E2E',

  // Cores de destaque
  accent: '#D4A373', // Dourado suave / Areia
  accentLight: '#E8C9A8',
  accentDark: '#B8895E',

  // Neutros
  background: '#FFFBF5', // alias para backgroundApp
  surface: '#FFFFFF',
  gray50: '#FDF8F0',
  gray100: '#F5F0E8',
  gray200: '#E8E0D5',
  gray300: '#D1C8BC',
  gray400: '#A69B8E',
  gray500: '#7A7063',
  gray600: '#5C5348',
  gray700: '#3E3830',
  gray800: '#2A2520',
  gray900: '#1A1714',

  // Estados
  success: '#4CAF50', // Verde mantido para pedidos respondidos
  warning: '#F59E0B',
  error: '#EF4444',
  danger: '#EF4444',
  info: '#3B82F6',

  // Gradientes (para uso com LinearGradient)
  gradientPrimary: ['#A94438', '#C96A5E'],
  gradientSecondary: ['#E28743', '#F0A86A'],
  gradientAccent: ['#D4A373', '#E8C9A8'],
  gradientHero: ['#A94438', '#E28743', '#D4A373'],
};

export const FONTS = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  bold: 'Nunito_700Bold',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    display: 40,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};