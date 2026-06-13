// Tela Editar Célula - Permite ao líder editar os dados da célula
// Funcionalidades:
// - Editar nome, horário, dia da semana, local, descrição e tipo da célula

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { editarCelula, getCelula } from '../services/firestoreService';

export default function EditarCelulaScreen({ route, navigation }) {
  const { celulaId } = route.params;
  const insets = useSafeAreaInsets();

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [horario, setHorario] = useState('');
  const [diaSemana, setDiaSemana] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('publica');

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

  const handleSalvar = async () => {
    if (!nome.trim() || !horario.trim()) {
      Alert.alert('Atenção', 'Preencha pelo menos o nome e o horário da célula.');
      return;
    }

    setSalvando(true);
    try {
      await editarCelula(celulaId, {
        nome: nome.trim(),
        horario: horario.trim(),
        dia_semana: diaSemana.trim(),
        local: local.trim(),
        descricao: descricao.trim(),
        tipo,
      });
      Alert.alert('✅ Sucesso', 'Célula atualizada com sucesso!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', error.message || 'Não foi possível atualizar a célula.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {/* Nome */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome da Célula *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Célula da Fé"
              placeholderTextColor={COLORS.gray400}
              value={nome}
              onChangeText={setNome}
              editable={!salvando}
            />
          </View>

          {/* Horário */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Horário *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Quartas às 19h30"
              placeholderTextColor={COLORS.gray400}
              value={horario}
              onChangeText={setHorario}
              editable={!salvando}
            />
          </View>

          {/* Dia da Semana */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Dia da Semana</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Quarta-feira"
              placeholderTextColor={COLORS.gray400}
              value={diaSemana}
              onChangeText={setDiaSemana}
              editable={!salvando}
            />
          </View>

          {/* Local */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Local</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Online / Rua das Flores, 123"
              placeholderTextColor={COLORS.gray400}
              value={local}
              onChangeText={setLocal}
              editable={!salvando}
            />
          </View>

          {/* Tipo de Célula */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tipo de Célula *</Text>
            <View style={styles.tipoSelector}>
              <TouchableOpacity
                style={[styles.tipoOption, tipo === 'publica' && styles.tipoOptionAtivo]}
                onPress={() => setTipo('publica')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tipoOptionIcon, tipo === 'publica' && styles.tipoOptionIconAtivo]}>🌐</Text>
                <Text style={[styles.tipoOptionLabel, tipo === 'publica' && styles.tipoOptionLabelAtivo]}>Pública</Text>
                <Text style={[styles.tipoOptionDesc, tipo === 'publica' && styles.tipoOptionDescAtivo]}>Entrada livre, sem aprovação</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoOption, tipo === 'fechada' && styles.tipoOptionAtivoFechada]}
                onPress={() => setTipo('fechada')}
                activeOpacity={0.7}
              >
                <Text style={[styles.tipoOptionIcon, tipo === 'fechada' && styles.tipoOptionIconAtivo]}>🔒</Text>
                <Text style={[styles.tipoOptionLabel, tipo === 'fechada' && styles.tipoOptionLabelAtivo]}>Fechada</Text>
                <Text style={[styles.tipoOptionDesc, tipo === 'fechada' && styles.tipoOptionDescAtivo]}>Requer aprovação do líder</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Descrição */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Descreva o propósito da célula..."
              placeholderTextColor={COLORS.gray400}
              value={descricao}
              onChangeText={setDescricao}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!salvando}
            />
          </View>

          {/* Botão Salvar */}
          <TouchableOpacity
            style={[styles.salvarBtn, salvando && styles.salvarBtnDisabled]}
            onPress={handleSalvar}
            disabled={salvando}
            activeOpacity={0.8}
          >
            {salvando ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.salvarBtnText}>💾 Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// Estilos
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  form: {
    padding: SPACING.lg,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
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
  textArea: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.gray800,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  tipoSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tipoOption: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    alignItems: 'center',
  },
  tipoOptionAtivo: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  tipoOptionAtivoFechada: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  tipoOptionIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  tipoOptionIconAtivo: {
    opacity: 1,
  },
  tipoOptionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: COLORS.gray500,
    marginBottom: 2,
  },
  tipoOptionLabelAtivo: {
    color: COLORS.primary,
  },
  tipoOptionDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.gray400,
    textAlign: 'center',
  },
  tipoOptionDescAtivo: {
    color: COLORS.gray600,
  },
  salvarBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  salvarBtnDisabled: {
    opacity: 0.7,
  },
  salvarBtnText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
});