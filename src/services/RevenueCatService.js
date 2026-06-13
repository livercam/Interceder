// RevenueCatService - Utilitários do RevenueCat
// Gerencia assinaturas In-App para o Selo Azul de Verificação (Premium)
// NOTA: A inicialização do SDK (Purchases.configure) é feita no App.js

import Purchases from 'react-native-purchases';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';

// Identificador do produto de assinatura (deve corresponder ao configurado no RevenueCat)
export const PRODUCT_IDENTIFIER = 'selo_verificacao_mensal';

// ============================================================
// Definir o ID do utilizador no RevenueCat (chamar após login)
// ============================================================
export async function setRevenueCatUserId(uid) {
  try {
    await Purchases.logIn(uid);
    console.log(`[RevenueCat] Utilizador logado: ${uid}`);
  } catch (error) {
    console.error('[RevenueCat] Erro ao logar utilizador:', error);
  }
}

// ============================================================
// Limpar o ID do utilizador no RevenueCat (chamar após logout)
// ============================================================
export async function resetRevenueCatUserId() {
  try {
    await Purchases.logOut();
    console.log('[RevenueCat] Utilizador deslogado.');
  } catch (error) {
    console.error('[RevenueCat] Erro ao deslogar utilizador:', error);
  }
}

// ============================================================
// Buscar ofertas (pacotes de assinatura disponíveis)
// ============================================================
export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    console.log('[RevenueCat] Offerings carregados:', offerings);

    // Retorna o offering atual (current) ou null
    if (offerings.current !== null) {
      return offerings.current;
    }

    // Fallback: tenta o primeiro offering disponível
    const allOfferings = offerings.all;
    const keys = Object.keys(allOfferings);
    if (keys.length > 0) {
      return allOfferings[keys[0]];
    }

    return null;
  } catch (error) {
    console.error('[RevenueCat] Erro ao buscar offerings:', error);
    return null;
  }
}

// ============================================================
// Comprar um pacote de assinatura
// ============================================================
export async function purchasePackage(purchasablePackage) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(purchasablePackage);
    console.log('[RevenueCat] Compra realizada com sucesso:', customerInfo);
    return { success: true, customerInfo };
  } catch (error) {
    // Se o utilizador cancelou a compra, não lançar erro
    if (error.userCancelled) {
      console.log('[RevenueCat] Utilizador cancelou a compra.');
      return { success: false, cancelled: true };
    }
    console.error('[RevenueCat] Erro na compra:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// Verificar se o utilizador atual tem assinatura ativa
// ============================================================
export async function checkPremiumStatus() {
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active['premium'];
    return entitlement !== undefined;
  } catch (error) {
    console.error('[RevenueCat] Erro ao verificar status premium:', error);
    return false;
  }
}

// ============================================================
// Sincronizar com Firestore: atualizar isPremium no documento do utilizador
// ============================================================
export async function syncPremiumToFirestore(uid) {
  try {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userDocRef, {
      isPremium: true,
      premiumUpdatedAt: new Date().toISOString(),
    });
    console.log(`[RevenueCat] isPremium=true sincronizado no Firestore para ${uid}`);
    return true;
  } catch (error) {
    console.error('[RevenueCat] Erro ao sincronizar premium no Firestore:', error);
    return false;
  }
}
