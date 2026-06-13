// Tela Termos de Uso e Política de Privacidade (LGPD)
// Exibe os documentos legais em formato de texto rolável

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

export default function TermosPrivacidadeScreen({ navigation }) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ============================================ */}
      {/* TERMOS DE USO */}
      {/* ============================================ */}
      <Text style={styles.sectionTitle}>📋 Termos de Uso</Text>
      <Text style={styles.lastUpdate}>
        Última atualização: Maio de 2026
      </Text>

      <Text style={styles.paragraph}>
        Bem-vindo ao Interceder. Ao utilizar este aplicativo, você concorda com os
        termos e condições descritos abaixo. Se não concordar com algum destes
        termos, recomendamos que não utilize o aplicativo.
      </Text>

      <Text style={styles.subtitle}>1. Aceitação dos Termos</Text>
      <Text style={styles.paragraph}>
        Ao criar uma conta e utilizar o Interceder, você declara ter lido,
        compreendido e aceitado todos os termos aqui presentes. Estes termos
        podem ser atualizados periodicamente, sendo sua responsabilidade
        revisá-los.
      </Text>

      <Text style={styles.subtitle}>2. Natureza da Plataforma</Text>
      <Text style={styles.paragraph}>
        O Interceder é uma plataforma de intercessão e comunhão cristã. Todo o
        conteúdo publicado (pedidos de oração, testemunhos, mensagens) é de
        responsabilidade exclusiva de seus autores. A plataforma não se
        responsabiliza por interpretações teológicas ou conselhos espirituais
        compartilhados entre os usuários.
      </Text>

      <Text style={styles.subtitle}>3. Conduta do Usuário</Text>
      <Text style={styles.paragraph}>
        Ao utilizar o aplicativo, você se compromete a:
      </Text>
      <Text style={styles.bulletPoint}>
        • Não publicar conteúdo ofensivo, difamatório, discriminatório ou que
        incite ódio religioso, racial ou de qualquer natureza;
      </Text>
      <Text style={styles.bulletPoint}>
        • Não utilizar a plataforma para fins comerciais, spam ou divulgação
        não autorizada;
      </Text>
      <Text style={styles.bulletPoint}>
        • Respeitar a privacidade e os sentimentos dos demais membros da
        comunidade;
      </Text>
      <Text style={styles.bulletPoint}>
        • Não criar contas falsas ou se passar por outra pessoa.
      </Text>

      <Text style={styles.subtitle}>4. Moderação e Penalidades</Text>
      <Text style={styles.paragraph}>
        A equipe de moderação do Interceder se reserva o direito de remover
        qualquer conteúdo que viole estes termos, bem como suspender ou banir
        permanentemente usuários que descumprirem as regras. Denúncias enviadas
        pela comunidade serão analisadas e podem resultar em ações moderadoras.
      </Text>

      <Text style={styles.subtitle}>5. Limitação de Responsabilidade</Text>
      <Text style={styles.paragraph}>
        O Interceder não se responsabiliza por danos diretos ou indiretos
        decorrentes do uso da plataforma, incluindo mas não se limitando a
        interpretações de conteúdo, interrupções do serviço ou perda de dados.
        O aplicativo é fornecido "como está", sem garantias de disponibilidade
        contínua ou ininterrupta.
      </Text>

      {/* ============================================ */}
      {/* POLÍTICA DE PRIVACIDADE */}
      {/* ============================================ */}
      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>🔒 Política de Privacidade</Text>
      <Text style={styles.lastUpdate}>
        Última atualização: Maio de 2026
      </Text>

      <Text style={styles.paragraph}>
        Esta Política de Privacidade descreve como o Interceder coleta, usa,
        armazena e protege os dados pessoais dos usuários, em conformidade com
        a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
      </Text>

      <Text style={styles.subtitle}>1. Dados Coletados</Text>
      <Text style={styles.paragraph}>
        Durante o uso do aplicativo, podemos coletar as seguintes informações:
      </Text>
      <Text style={styles.bulletPoint}>
        • Dados de cadastro: nome completo, endereço de e-mail e username;
      </Text>
      <Text style={styles.bulletPoint}>
        • Conteúdo gerado pelo usuário: pedidos de oração, testemunhos,
        mensagens de apoio e interações;
      </Text>
      <Text style={styles.bulletPoint}>
        • Dados de uso: informações sobre como você interage com o aplicativo,
        incluindo tempo de sessão e funcionalidades acessadas;
      </Text>
      <Text style={styles.bulletPoint}>
        • Dados do dispositivo: modelo, sistema operacional e identificadores
        anônimos para fins de analytics e melhoria do serviço.
      </Text>

      <Text style={styles.subtitle}>2. Finalidade do Tratamento</Text>
      <Text style={styles.paragraph}>
        Seus dados são utilizados exclusivamente para:
      </Text>
      <Text style={styles.bulletPoint}>
        • Permitir a criação e manutenção da sua conta;
      </Text>
      <Text style={styles.bulletPoint}>
        • Viabilizar a publicação de pedidos de oração, testemunhos e
        mensagens de apoio;
      </Text>
      <Text style={styles.bulletPoint}>
        • Conectar você a outros membros da comunidade;
      </Text>
      <Text style={styles.bulletPoint}>
        • Melhorar a experiência do usuário e corrigir falhas técnicas;
      </Text>
      <Text style={styles.bulletPoint}>
        • Enviar comunicações relacionadas ao aplicativo (apenas se você
        autorizar).
      </Text>

      <Text style={styles.subtitle}>3. Compartilhamento de Dados</Text>
      <Text style={styles.paragraph}>
        O Interceder não vende, aluga ou compartilha seus dados pessoais com
        terceiros para fins comerciais. Seus dados podem ser acessados por:
      </Text>
      <Text style={styles.bulletPoint}>
        • Prestadores de serviços essenciais (Firebase/Auth, Firestore,
        RevenueCat) que atuam como operadores de dados sob nossas instruções;
      </Text>
      <Text style={styles.bulletPoint}>
        • Autoridades legais, quando exigido por lei ou ordem judicial.
      </Text>

      <Text style={styles.subtitle}>4. Direitos do Titular (LGPD)</Text>
      <Text style={styles.paragraph}>
        Em conformidade com a LGPD, você possui os seguintes direitos:
      </Text>
      <Text style={styles.bulletPoint}>
        • Confirmação da existência de tratamento de dados;
      </Text>
      <Text style={styles.bulletPoint}>
        • Acesso aos seus dados pessoais;
      </Text>
      <Text style={styles.bulletPoint}>
        • Correção de dados incompletos, inexatos ou desatualizados;
      </Text>
      <Text style={styles.bulletPoint}>
        • Anonimização, bloqueio ou eliminação de dados desnecessários;
      </Text>
      <Text style={styles.bulletPoint}>
        • Portabilidade dos dados a outro fornecedor de serviço;
      </Text>
      <Text style={styles.bulletPoint}>
        • Exclusão dos dados pessoais tratados com seu consentimento;
      </Text>
      <Text style={styles.bulletPoint}>
        • Revogação do consentimento a qualquer tempo.
      </Text>

      <Text style={styles.subtitle}>5. Exclusão de Conta</Text>
      <Text style={styles.paragraph}>
        Você pode solicitar a exclusão da sua conta e de todos os dados
        associados a qualquer momento. Para isso, entre em contato conosco
        através do e-mail de suporte disponível no aplicativo ou utilize a
        funcionalidade de exclusão na tela de perfil. Após a confirmação,
        todos os seus dados pessoais serão removidos de nossos sistemas em até
        30 dias, exceto quando a retenção for exigida por lei.
      </Text>

      <Text style={styles.subtitle}>6. Armazenamento e Segurança</Text>
      <Text style={styles.paragraph}>
        Seus dados são armazenados em servidores seguros com criptografia em
        trânsito e em repouso. Adotamos medidas técnicas e organizacionais
        para proteger suas informações contra acesso não autorizado, perda ou
        vazamento. No entanto, nenhum sistema é 100% seguro, e não podemos
        garantir a segurança absoluta dos dados.
      </Text>

      <Text style={styles.subtitle}>7. Retenção de Dados</Text>
      <Text style={styles.paragraph}>
        Mantemos seus dados pessoais pelo período em que sua conta estiver
        ativa. Após a exclusão da conta, os dados serão eliminados conforme
        descrito na seção 5. Dados anonimizados ou agregados para fins
        estatísticos podem ser retidos indefinidamente.
      </Text>

      <Text style={styles.subtitle}>8. Contato</Text>
      <Text style={styles.paragraph}>
        Caso tenha dúvidas sobre esta Política de Privacidade ou queira
        exercer seus direitos como titular, entre em contato conosco pelo
        e-mail disponível na seção de suporte do aplicativo.
      </Text>

      {/* Espaçamento final */}
      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: 'bold',
    color: COLORS.gray800,
    marginBottom: SPACING.xs,
  },
  lastUpdate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginBottom: SPACING.lg,
    fontStyle: 'italic',
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
    color: COLORS.gray700,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  paragraph: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 22,
    marginBottom: SPACING.sm,
    textAlign: 'justify',
  },
  bulletPoint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray600,
    lineHeight: 22,
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.gray200,
    marginVertical: SPACING.xl,
  },
});
