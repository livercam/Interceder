// Tela FAQ - Dúvidas Frequentes sobre o App Interceder
// Dados atualizados com as funcionalidades do app

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const FAQ_DATA = [
  {
    pergunta: '🙏 Como funciona a intercessão?',
    resposta:
      'Ao abrir um pedido de oração, toque em "Interceder" e escolha um período (1, 3 ou 5 minutos). Você será levado à Sala de Intercessão, onde poderá orar em foco. Ao finalizar, seu tempo é registrado automaticamente e o contador 🔥 do pedido é incrementado.',
  },
  {
    pergunta: '👥 O que são células e como participar?',
    resposta:
      'Células são grupos de oração e comunhão. Você pode participar de várias células. Para entrar, vá até a aba "Células" e clique em "Inscrever-se" nas células públicas. Células fechadas exigem aprovação do líder — após solicitar, aparecerá "✅ Pedido enviado" e você aguardará a aprovação.',
  },
  {
    pergunta: '🔒 O que significa "Privacidade: Célula"?',
    resposta:
      'Ao criar um pedido de oração, você pode escolher "Público" (visível no Mural para todos) ou "Célula" (visível apenas para membros das células selecionadas). Pedidos de célula têm um cadeado 🔒 indicativo.',
  },
  {
    pergunta: '📌 Como salvo um pedido para orar depois?',
    resposta:
      'Na tela de detalhes do pedido, toque em "Interceder" e depois em "Salvar para Orar Mais Tarde". O pedido será adicionado à sua Lista de Oração, acessível pelo Perfil.',
  },
  {
    pergunta: '💬 Como funcionam as mensagens de apoio?',
    resposta:
      'Você pode enviar mensagens de encorajamento nos pedidos de oração. Use @ para mencionar outros usuários. Para responder a uma mensagem específica, toque em "↩ Responder". O autor do pedido e os comentaristas recebem notificações.',
  },
  {
    pergunta: '🎖️ Como funciona o sistema de títulos ministeriais?',
    resposta:
      'Os títulos (Membro, Diácono, Missionário, Evangelista, Presbítero, Pastor) indicam seu nível no app. Para que o título apareça nos feeds, você precisa de 5+ endossos ou verificação da liderança. Caso contrário, o título não é exibido publicamente.',
  },
  {
    pergunta: '🙌 O que são endossos e como funcionam?',
    resposta:
      'Endossos são o reconhecimento da comunidade. Você pode endossar outros membros no perfil deles. Cada usuário tem um limite diário de endossos. Líderes podem fazer "Super Endossos", que concedem verificação instantânea. É necessário ter vínculo (mesma célula ou interação) para endossar.',
  },
  {
    pergunta: '🔥 O que significa o contador de chamas?',
    resposta:
      'O ícone 🔥 mostra quantas pessoas já intercederam por aquele pedido. Cada vez que alguém completa um tempo de oração na Sala de Intercessão, o contador é incrementado.',
  },
  {
    pergunta: '🛡️ Como funciona a moderação de conteúdo?',
    resposta:
      'Palavras ofensivas são bloqueadas automaticamente no momento da publicação. Se um pedido receber 3 denúncias de usuários distintos, ele entra em moderação para análise pela equipe.',
  },
  {
    pergunta: '📊 Onde vejo minhas estatísticas?',
    resposta:
      'Suas estatísticas (orações feitas e dias seguidos) estão disponíveis no seu Perfil. Os dados são atualizados automaticamente conforme você interage no app.',
  },
  {
    pergunta: '🔐 Como recuperar minha senha?',
    resposta:
      'Na tela de Login, toque em "Esqueci minha senha". Digite seu e-mail cadastrado e enviaremos um link de redefinição. O link expira em 1 hora. Verifique também a pasta de spam.',
  },
  {
    pergunta: '🗑️ Como excluir minha conta?',
    resposta:
      'No seu Perfil, role até o final e toque em "Excluir Minha Conta". Confirme a ação. Todos os seus dados (pedidos, testemunhos, mensagens) serão removidos permanentemente conforme a LGPD.',
  },
  {
    pergunta: '❓ Como entro em contato com o suporte?',
    resposta:
      'Para suporte técnico ou dúvidas não respondidas aqui, envie um e-mail para interceder@oficinaoracao.com.br. Responderemos em até 48 horas úteis.',
  },
];

export default function FaqScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>❓</Text>
        <Text style={styles.headerTitle}>Dúvidas Frequentes</Text>
        <Text style={styles.headerSubtitle}>
          Tire suas principais dúvidas sobre o Interceder
        </Text>
      </View>

      {FAQ_DATA.map((item, index) => (
        <View key={index} style={styles.faqCard}>
          <Text style={styles.pergunta}>{item.pergunta}</Text>
          <Text style={styles.resposta}>{item.resposta}</Text>
        </View>
      ))}

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },

  // FAQ Card
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  pergunta: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.sm,
  },
  resposta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 22,
  },
});