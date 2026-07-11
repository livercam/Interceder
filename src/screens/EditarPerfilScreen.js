// Tela Editar Perfil - Formulário para editar Nome, Username, Biografia, Vibe, Interesses e Título Ministerial
// Funcionalidades:
// - Editar Nome
// - Editar Username (com validação de unicidade)
// - Editar Biografia (~150 caracteres)
// - Seletor "Minha Vibe" com ícones
// - Seletor "Interesses" com pílulas clicáveis
// - Editar WhatsApp
// - Editar Título Ministerial (Picker)
// - Salvar no Firestore e voltar ao Perfil

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { updateUserProfile, verificarUsernameDisponivel, excluirDadosUsuario } from '../services/firestoreService';
import { excluirContaAuth } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';

const TITULOS_MINISTERIAIS = [
  { value: 'membro', label: 'Membro' },
  { value: 'diacono', label: 'Diácono' },
  { value: 'missionario', label: 'Missionário(a)' },
  { value: 'evangelista', label: 'Evangelista' },
  { value: 'presbitero', label: 'Presbítero' },
  { value: 'pastor', label: 'Pastor(a)' },
];

const CARGO_ADMIN = 'administrador';

const OPCOES_VIBE = [
  { key: 'oracao', icone: '🛐', label: 'Oração' },
  { key: 'estudo', icone: '📖', label: 'Estudo' },
  { key: 'servir', icone: '🙌', label: 'Servir' },
  { key: 'celula', icone: '🤝', label: 'Célula' },
];

const SUGESTOES_INTERESSES = [
  'Oração',
  'Estudo Bíblico',
  'Jovens',
  'Discipulado',
  'Testemunhos',
  'Pregação',
];

export default function EditarPerfilScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const { showAlert } = useAlert();

  const [nome, setNome] = useState(userProfile?.nome || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [whatsapp, setWhatsapp] = useState(userProfile?.whatsapp || '');
  const [titulo, setTitulo] = useState(userProfile?.titulo_ministerial || 'membro');
  const [biografia, setBiografia] = useState(userProfile?.biografia || '');
  const [vibeAtual, setVibeAtual] = useState(userProfile?.vibe_atual || '');
  const [interesses, setInteresses] = useState(userProfile?.interesses || []);
  const [salvando, setSalvando] = useState(false);
  const [inicializado, setInicializado] = useState(false);
  const [modalMinisterioVisivel, setModalMinisterioVisivel] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [pushAtivo, setPushAtivo] = useState(true);

  // Sincronizar com userProfile APENAS na primeira carga,
  // para evitar que o onSnapshot do AuthContext sobrescreva
  // dados que o usuário está editando.
  useEffect(() => {
    if (!inicializado && userProfile) {
      setNome(userProfile.nome || '');
      setUsername(userProfile.username || '');
      setWhatsapp(userProfile.whatsapp || '');
      setTitulo(userProfile.titulo_ministerial || 'membro');
      setBiografia(userProfile.biografia || '');
      setVibeAtual(userProfile.vibe_atual || '');
      setInteresses(userProfile.interesses || []);
      setPushAtivo(userProfile.push_notificacoes_activas !== false);
      setInicializado(true);
    }
  }, [userProfile, inicializado]);

  // Estados de erro inline
  const [erroNome, setErroNome] = useState('');
  const [erroUsername, setErroUsername] = useState('');

  // Se o usuário for Administrador, desativa o campo para não perder permissão
  const isAdmin = userProfile?.titulo_ministerial === CARGO_ADMIN;
  const [verificandoUsername, setVerificandoUsername] = useState(false);
  const [usernameDisponivel, setUsernameDisponivel] = useState(null);

  // Alterna um interesse no array
  const toggleInteresse = useCallback((interesse) => {
    setInteresses((prev) => {
      if (prev.includes(interesse)) {
        return prev.filter((i) => i !== interesse);
      }
      return [...prev, interesse];
    });
  }, []);

  // Verificar disponibilidade do username
  const handleVerificarUsername = useCallback(async (texto) => {
    setUsername(texto);
    if (texto.length < 3) {
      setUsernameDisponivel(null);
      return;
    }
    setVerificandoUsername(true);
    try {
      const disponivel = await verificarUsernameDisponivel(texto, user?.uid);
      setUsernameDisponivel(disponivel);
    } catch {
      setUsernameDisponivel(null);
    } finally {
      setVerificandoUsername(false);
    }
  }, [user]);

  // Salvar alterações
  const handleSalvar = useCallback(async () => {
    // Resetar erros
    setErroNome('');
    setErroUsername('');

    let temErro = false;

    if (!nome.trim()) {
      setErroNome('O nome é obrigatório.');
      temErro = true;
    }
    if (!username.trim() || username.length < 3) {
      setErroUsername('O username deve ter pelo menos 3 caracteres.');
      temErro = true;
    }
    if (usernameDisponivel === false) {
      setErroUsername('Este username já está em uso. Escolha outro.');
      temErro = true;
    }

    if (temErro) return;

    setSalvando(true);
    try {
      await updateUserProfile(user.uid, {
        nome: nome.trim(),
        username: username.trim(),
        whatsapp: whatsapp.replace(/[^\d+]/g, '') || null,
        titulo_ministerial: titulo,
        biografia: biografia.trim().substring(0, 150),
        vibe_atual: vibeAtual,
        interesses: interesses,
        push_notificacoes_activas: pushAtivo,
      });
      showAlert({
        title: '✅ Perfil atualizado!',
        message: 'Suas informações foram salvas com sucesso.',
        icon: 'checkmark-circle-outline',
        iconColor: COLORS.success,
        buttons: [
          { text: 'OK', type: 'default', onPress: () => navigation.goBack() },
        ],
      });
    } catch (error) {
      showAlert({
        title: 'Erro',
        message: 'Não foi possível salvar as alterações.',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', type: 'default' }],
      });
    } finally {
      setSalvando(false);
    }
  }, [nome, username, whatsapp, titulo, biografia, vibeAtual, interesses, pushAtivo, user, usernameDisponivel, navigation, showAlert]);

  const handleExcluirConta = useCallback(() => {
    showAlert({
      title: 'Excluir Conta Definitivamente',
      message: 'Tem certeza? Esta ação apagará todos os seus dados e não poderá ser desfeita.',
      icon: 'trash-outline',
      iconColor: COLORS.danger,
      buttons: [
        { text: 'Cancelar', type: 'cancel' },
        {
          text: 'Sim, Excluir',
          type: 'destructive',
          onPress: async () => {
            setExcluindo(true);
            try {
              await excluirDadosUsuario(user.uid);
              await excluirContaAuth();
            } catch (error) {
              const mensagem = error.message || 'Erro ao excluir conta.';
              showAlert({
                title: 'Erro',
                message: mensagem,
                icon: 'alert-circle-outline',
                buttons: [{ text: 'OK', type: 'default' }],
              });
            } finally {
              setExcluindo(false);
            }
          },
        },
      ],
    });
  }, [user, showAlert]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* ============================================ */}
      {/* Nome */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>👤 Nome</Text>
        <TextInput
          style={[styles.input, erroNome ? styles.inputError : null]}
          value={nome}
          onChangeText={(text) => { setNome(text); setErroNome(''); }}
          placeholder="Seu nome completo"
          placeholderTextColor={COLORS.gray400}
          maxLength={60}
        />
        {erroNome ? <Text style={styles.erroTexto}>{erroNome}</Text> : null}
      </View>

      {/* ============================================ */}
      {/* Username */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🔗 Username</Text>
        <TextInput
          style={[
            styles.input,
            usernameDisponivel === false && styles.inputError,
            usernameDisponivel === true && styles.inputSuccess,
          ]}
          value={username}
          onChangeText={handleVerificarUsername}
          placeholder="ex: joaosilva"
          placeholderTextColor={COLORS.gray400}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={30}
        />
        {verificandoUsername && (
          <View style={styles.usernameStatus}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.usernameStatusText}>Verificando...</Text>
          </View>
        )}
        {!verificandoUsername && usernameDisponivel === true && username.length >= 3 && (
          <View style={styles.usernameStatus}>
            <Text style={styles.usernameDisponivel}>✅ Disponível</Text>
          </View>
        )}
        {!verificandoUsername && usernameDisponivel === false && (
          <View style={styles.usernameStatus}>
            <Text style={styles.usernameIndisponivel}>❌ Indisponível</Text>
          </View>
        )}
        <Text style={styles.fieldHint}>
          Este será seu identificador único no app (ex: @joaosilva)
        </Text>
      </View>

      {/* ============================================ */}
      {/* Biografia */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>📝 Biografia</Text>
        <TextInput
          style={styles.bioInput}
          value={biografia}
          onChangeText={setBiografia}
          placeholder="Conte um pouco sobre sua jornada de fé..."
          placeholderTextColor={COLORS.gray400}
          multiline
          maxLength={150}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {biografia.length}/150 caracteres
        </Text>
      </View>

      {/* ============================================ */}
      {/* Minha Vibe */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🎵 Minha Vibe</Text>
        <View style={styles.vibeRow}>
          {OPCOES_VIBE.map((opcao) => {
            const selecionado = vibeAtual === opcao.key;
            return (
              <TouchableOpacity
                key={opcao.key}
                style={[
                  styles.vibeItem,
                  selecionado && styles.vibeItemSelecionado,
                ]}
                onPress={() => setVibeAtual(selecionado ? '' : opcao.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.vibeIcone}>{opcao.icone}</Text>
                <Text style={[styles.vibeLabel, selecionado && styles.vibeLabelSelecionado]}>
                  {opcao.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldHint}>
          Sua vibe atual aparece no seu perfil público.
        </Text>
      </View>

      {/* ============================================ */}
      {/* Interesses */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🏷️ Interesses</Text>
        <View style={styles.interessesRow}>
          {SUGESTOES_INTERESSES.map((interesse) => {
            const selecionado = interesses.includes(interesse);
            return (
              <TouchableOpacity
                key={interesse}
                style={[
                  styles.pilulaInteresse,
                  selecionado && styles.pilulaInteresseSelecionada,
                ]}
                onPress={() => toggleInteresse(interesse)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pilulaInteresseTexto,
                    selecionado && styles.pilulaInteresseTextoSelecionado,
                  ]}
                >
                  {interesse}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldHint}>
          Toque nos interesses que combinam com você para adicioná-los ao seu perfil.
        </Text>
      </View>

      {/* ============================================ */}
      {/* Título Ministerial */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>🎖️ Título Ministerial</Text>
        {isAdmin ? (
          <>
            <View style={[styles.pickerContainer, styles.pickerDisabled]}>
              <Text style={styles.pickerDisabledText}>
                Administrador
              </Text>
            </View>
            <Text style={styles.fieldHintAdmin}>
              🔒 Cargo de Administrador gerido pelo painel web. Não é possível alterar pelo app.
            </Text>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.pickerContainer}
              onPress={() => setModalMinisterioVisivel(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerText}>
                {TITULOS_MINISTERIAIS.find((t) => t.value === titulo)?.label || 'Selecione um título...'}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.fieldHint}>
              Apenas líderes (Pastor, Presbítero, Evangelista, Missionário) podem criar células.
            </Text>
          </>
        )}
      </View>

      {/* ============================================ */}
      {/* WhatsApp */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>💬 WhatsApp (opcional)</Text>
        <TextInput
          style={styles.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+55 27 99999-9999"
          placeholderTextColor={COLORS.gray400}
          keyboardType="phone-pad"
          maxLength={20}
        />
        <Text style={styles.fieldHint}>
          Inclua o código do país e área. Ex: +55 27 99999-9999
        </Text>
      </View>

      {/* ============================================ */}
      {/* Notificações Push */}
      {/* ============================================ */}
      <View style={styles.fieldGroup}>
        <View style={styles.pushRow}>
          <View style={styles.pushInfo}>
            <Text style={styles.label}>🔔 Notificações Push</Text>
            <Text style={styles.fieldHint}>
              Receba notificações de pedidos, feeds e mensagens de apoio das suas células.
            </Text>
          </View>
          <Switch
            value={pushAtivo}
            onValueChange={setPushAtivo}
            trackColor={{ false: COLORS.gray200, true: COLORS.primaryLight }}
            thumbColor={pushAtivo ? COLORS.primary : COLORS.gray400}
          />
        </View>
      </View>

      {/* ============================================ */}
      {/* Botões */}
      {/* ============================================ */}
      <TouchableOpacity
        style={[styles.salvarBtn, salvando && styles.salvarBtnDisabled]}
        onPress={handleSalvar}
        disabled={salvando}
        activeOpacity={0.85}
      >
        {salvando ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <Text style={styles.salvarBtnText}>💾 Salvar Alterações</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelarBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}
      >
        <Text style={styles.cancelarBtnText}>Cancelar</Text>
      </TouchableOpacity>

      {/* Excluir Conta */}
      <TouchableOpacity
        style={styles.excluirLink}
        onPress={handleExcluirConta}
        disabled={excluindo}
        activeOpacity={0.7}
      >
        {excluindo ? (
          <ActivityIndicator color={COLORS.danger} size="small" />
        ) : (
          <Text style={styles.excluirLinkText}>🗑️ Excluir Minha Conta</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: SPACING.xxl }} />
    </ScrollView>

      {/* ============================================ */}
      {/* Modal Customizado - Título Ministerial */}
      {/* ============================================ */}
      <Modal
        visible={modalMinisterioVisivel}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalMinisterioVisivel(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>🎖️ Selecione o Título Ministerial</Text>

            {TITULOS_MINISTERIAIS.map((item) => {
              const selecionado = titulo === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.modalOpcao,
                    selecionado && styles.modalOpcaoSelecionada,
                  ]}
                  onPress={() => {
                    setTitulo(item.value);
                    setModalMinisterioVisivel(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalOpcaoTexto,
                      selecionado && styles.modalOpcaoTextoSelecionado,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selecionado && (
                    <Text style={styles.modalOpcaoCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.modalCancelarBtn}
              onPress={() => setModalMinisterioVisivel(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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

  // Campos
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  fieldHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    marginTop: SPACING.xs,
    lineHeight: 16,
  },

  // Biografia
  bioInput: {
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Vibe Selector
  vibeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  vibeItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  vibeItemSelecionado: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
  },
  vibeIcone: {
    fontSize: 28,
    marginBottom: SPACING.xs,
  },
  vibeLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: COLORS.gray600,
    textAlign: 'center',
  },
  vibeLabelSelecionado: {
    color: COLORS.primary,
  },

  // Interesses (Pílulas)
  interessesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pilulaInteresse: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: 'transparent',
  },
  pilulaInteresseSelecionada: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pilulaInteresseTexto: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray500,
  },
  pilulaInteresseTextoSelecionado: {
    color: COLORS.white,
  },

  // Mensagem de erro inline
  erroTexto: {
    color: '#EF4444',
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
    marginLeft: 2,
  },

  // Status do Username
  usernameStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  usernameStatusText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.gray500,
  },
  usernameDisponivel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  usernameIndisponivel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.danger,
    fontWeight: '600',
  },

  // Picker (Custom Dropdown)
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: COLORS.gray200,
    opacity: 0.8,
  },
  pickerText: {
    fontSize: FONTS.sizes.md,
    color: '#1F2937',
    flex: 1,
  },
  pickerArrow: {
    fontSize: 12,
    color: COLORS.gray400,
    marginLeft: SPACING.sm,
  },
  pickerDisabledText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray400,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  fieldHintAdmin: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.warning,
    marginTop: SPACING.xs,
    lineHeight: 16,
    fontWeight: '500',
  },

  // Modal Customizado - Título Ministerial
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  modalOpcao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: 4,
  },
  modalOpcaoSelecionada: {
    backgroundColor: COLORS.primary + '15',
  },
  modalOpcaoTexto: {
    fontSize: FONTS.sizes.md,
    color: '#000000',
  },
  modalOpcaoTextoSelecionado: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  modalOpcaoCheck: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  modalCancelarBtn: {
    marginTop: SPACING.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  modalCancelarTexto: {
    fontSize: FONTS.sizes.md,
    color: COLORS.gray500,
    fontWeight: '600',
  },

  // Botões
  salvarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  salvarBtnDisabled: {
    opacity: 0.7,
  },
  salvarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  cancelarBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelarBtnText: {
    color: COLORS.gray500,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },

  // Push Toggle
  pushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
  },
  pushInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },

  // Excluir Conta (link)
  excluirLink: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    marginTop: SPACING.sm,
  },
  excluirLinkText: {
    color: COLORS.danger,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
});