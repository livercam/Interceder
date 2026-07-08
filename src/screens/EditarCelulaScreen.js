// Tela Editar Célula - Design System unificado com CriarCelulaScreen
// Gerencia upload/exclusão/troca da foto de capa

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { uploadAsync } from 'expo-file-system/legacy';
import { editarCelula, getCelula } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

// Bucket do Firebase Storage (mesmo usado em CriarCelulaScreen.js)
const STORAGE_BUCKET_URL = 'https://firebasestorage.googleapis.com/v0/b/interceder-ef0cd.firebasestorage.app/o';

export default function EditarCelulaScreen({ route, navigation }) {
  const { celulaId } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados dos inputs
  const [nome, setNome] = useState('');
  const [horario, setHorario] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('publica');

  // Estados da foto de capa
  const [capaExistente, setCapaExistente] = useState(null); // URL que veio do Firebase
  const [novaCapaUri, setNovaCapaUri] = useState(null);     // URI local de nova foto selecionada

  // ============================================================
  // Carregar dados da célula do Firestore
  // ============================================================
  useEffect(() => {
    const carregarCelula = async () => {
      try {
        const celula = await getCelula(celulaId);
        if (celula) {
          setNome(celula.nome || '');
          setHorario(celula.horario || '');
          setDiaSemana(celula.dia_semana || '');
          setLocal(celula.local || '');
          setDescricao(celula.descricao || '');
          setTipo(celula.tipo || 'publica');
          setCapaExistente(celula.capa_url || null); // Preenche com a URL existente
        }
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar os dados da célula.');
        navigation.goBack();
      } finally {
        setCarregando(false);
      }
    };
    carregarCelula();
  }, [celulaId, navigation]);

  // ============================================================
  // Seleção de nova foto de capa
  // ============================================================
  const handleSelecionarFoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para adicionar uma foto de capa.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setNovaCapaUri(result.assets[0].uri);
      }
    } catch (error) {
      console.warn('[EditarCelula] Erro ao selecionar foto:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  // ============================================================
  // Remover foto de capa (tanto existente quanto nova)
  // ============================================================
  const handleRemoverFoto = () => {
    setNovaCapaUri(null);
    setCapaExistente(null);
  };

  // ============================================================
  // Salvar alterações (Upload Inline -> Payload -> Firestore)
  // ============================================================
  const handleSalvar = async () => {
    if (!nome.trim() || !horario.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o nome e o horário da célula.');
      return;
    }

    setSalvando(true);
    try {
      let urlParaSalvar = capaExistente; // Por padrão, mantém a que já estava (pode ser null se o usuário apagou)

      // Se o usuário selecionou uma FOTO NOVA, fazemos o upload
      if (novaCapaUri) {
        const token = await user.getIdToken();
        const nomeArquivo = `capa_${Date.now()}.jpg`;
        const urlStorage = `${STORAGE_BUCKET_URL}?name=celulas_capas%2F${nomeArquivo}`;

        await uploadAsync(urlStorage, novaCapaUri, {
          httpMethod: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'image/jpeg',
          },
        });

        urlParaSalvar = `${STORAGE_BUCKET_URL}/celulas_capas%2F${nomeArquivo}?alt=media`;
      }

      // Monta o payload garantindo que a capa_url seja atualizada
      const payloadAtualizacao = {
        nome: nome.trim(),
        horario: horario.trim(),
        dia_semana: diaSemana.trim(),
        local: local.trim(),
        descricao: descricao.trim(),
        tipo,
        capa_url: urlParaSalvar, // Se o usuário excluiu, isso enviará null limpando do banco
      };

      await editarCelula(celulaId, payloadAtualizacao);

      Alert.alert('✅ Sucesso', 'Célula atualizada com sucesso!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível atualizar a célula.');
    } finally {
      setSalvando(false);
    }
  };

  // ============================================================
  // Alternar tipo com Haptics
  // ============================================================
  const handleToggleTipo = async (novoTipo) => {
    if (novoTipo === tipo) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {
      // Haptics não disponível (build nativo pendente) - fallback silencioso
    }
    setTipo(novoTipo);
  };

  // Determina se deve mostrar preview da imagem (existente ou nova)
  const imagemPreviewUri = novaCapaUri || capaExistente;
  const isLoading = carregando || salvando;

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Célula</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={220}
        viewIsInsideTabBar={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================ */}
        {/* Componente de Upload de Foto de Capa (16:9) */}
        {/* ============================================ */}
        <TouchableOpacity
          style={styles.capaContainer}
          onPress={handleSelecionarFoto}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {imagemPreviewUri ? (
            <>
              <Image
                source={{ uri: imagemPreviewUri }}
                style={styles.capaPreview}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.capaRemoveBtn}
                onPress={handleRemoverFoto}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.capaEmpty}>
              <Ionicons name="camera-outline" size={40} color="#94A3B8" />
              <Text style={styles.capaEmptyText}>Adicionar foto de capa</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ============================================ */}
        {/* Formulário */}
        {/* ============================================ */}
        <View style={styles.formContainer}>
          {/* Nome da Célula */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome da Célula *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Célula da Fé"
              placeholderTextColor="#94A3B8"
              value={nome}
              onChangeText={setNome}
              editable={!isLoading}
            />
          </View>

          {/* Horário */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Horário *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Quartas às 19h30"
              placeholderTextColor="#94A3B8"
              value={horario}
              onChangeText={setHorario}
              editable={!isLoading}
            />
          </View>

          {/* Dia da Semana */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dia da Semana</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Quarta-feira"
              placeholderTextColor="#94A3B8"
              value={diaSemana}
              onChangeText={setDiaSemana}
              editable={!isLoading}
            />
          </View>

          {/* Local */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Local</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Online / Rua das Flores, 123"
              placeholderTextColor="#94A3B8"
              value={local}
              onChangeText={setLocal}
              editable={!isLoading}
            />
          </View>

          {/* Seletor Pílula Moderna (Tipo de Célula) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de Célula *</Text>
            <View style={styles.pillContainer}>
              <TouchableOpacity
                style={[
                  styles.pillSegment,
                  tipo === 'publica' && styles.pillSegmentAtivo,
                ]}
                onPress={() => handleToggleTipo('publica')}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.pillSegmentText,
                    tipo === 'publica' && styles.pillSegmentTextAtivo,
                  ]}
                >
                  🌐 Pública
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.pillSegment,
                  tipo === 'fechada' && styles.pillSegmentAtivo,
                ]}
                onPress={() => handleToggleTipo('fechada')}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.pillSegmentText,
                    tipo === 'fechada' && styles.pillSegmentTextAtivo,
                  ]}
                >
                  🔒 Fechada
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Descrição */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva o propósito da célula..."
              placeholderTextColor="#94A3B8"
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>
        </View>

        {/* Botão Salvar (dentro do KeyboardAwareScrollView) */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={[styles.salvarBtn, isLoading && styles.salvarBtnDisabled]}
            onPress={handleSalvar}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.salvarBtnText}> Salvando...</Text>
              </View>
            ) : (
              <Text style={styles.salvarBtnText}>💾 Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

// ============================================================
// Estilos (idênticos ao CriarCelulaScreen)
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF5F0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  // Custom Header
  header: {
    backgroundColor: '#A53F36',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 16,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },

  // Foto de Capa (16:9, edge-to-edge)
  capaContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  capaEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    margin: 2,
    borderRadius: 4,
  },
  capaEmptyText: {
    fontSize: FONTS.sizes.md,
    color: '#94A3B8',
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  capaPreview: {
    width: '100%',
    height: '100%',
  },
  capaRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    padding: 0,
  },

  // Formulário
  formContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: FONTS.sizes.md,
    color: '#1E293B',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: '#1E293B',
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Seletor Pílula Moderna
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F0ED',
    borderRadius: 25,
    padding: 4,
  },
  pillSegment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pillSegmentAtivo: {
    backgroundColor: '#A53F36',
    shadowColor: '#A53F36',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  pillSegmentText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: '#64748B',
  },
  pillSegmentTextAtivo: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Footer / Botão dentro do ScrollView
  footerContainer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    marginTop: 'auto',
  },
  salvarBtn: {
    backgroundColor: '#A53F36',
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A53F36',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  salvarBtnDisabled: {
    opacity: 0.7,
  },
  salvarBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});