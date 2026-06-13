// AuthContext - Estado Global Reativo do Usuário
// Combina onAuthStateChanged (Firebase Auth) com onSnapshot (Firestore)
// para fornecer um perfil de usuário sempre atualizado em tempo real.

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { COLLECTIONS } from '../constants/firestore';
import { registrarParaPushNotificationsAsync } from '../services/notificationService';
import { salvarPushToken } from '../services/firestoreService';

const AuthContext = createContext(null);

/**
 * Provider do AuthContext.
 * Mantém o estado do usuário Firebase Auth + perfil Firestore em tempo real.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Firebase Auth user
  const userRef = useRef(null);                 // Ref para evitar closures obsoletas
  const [userProfile, setUserProfile] = useState(null); // Firestore document
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeProfile = useRef(null);
  const pushRegistrado = useRef(false); // Evita registar token múltiplas vezes

  useEffect(() => {
    // Escuta mudanças no Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Escuta o documento do usuário no Firestore em tempo real
        const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
        unsubscribeProfile.current = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserProfile(docSnap.data());
            } else {
              setUserProfile(null);
            }
            setIsLoading(false);
          },
          (error) => {
            console.error('Erro no onSnapshot do perfil:', error);
            setIsLoading(false);
          }
        );

        // ============================================================
        // Sincronizar foto do perfil (Auth → Firestore)
        // Se o Firebase Auth tem photoURL mas o Firestore não tem foto_url,
        // ou se são diferentes, atualiza o Firestore para manter sincronizado.
        // Isso garante que a foto apareça em telas de perfil público,
        // que só consultam o Firestore (não têm acesso ao Auth de outro usuário).
        // ============================================================
        const syncProfilePhoto = async () => {
          const authPhotoUrl = firebaseUser.photoURL || null;
          if (!authPhotoUrl) return;

          try {
            const userDocRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              const firestoreFotoUrl = docSnap.data().foto_url || null;
              if (firestoreFotoUrl !== authPhotoUrl) {
                await setDoc(userDocRef, { foto_url: authPhotoUrl }, { merge: true });
                console.log('[AuthContext] foto_url sincronizado do Auth para o Firestore.');
              }
            }
          } catch (error) {
            console.warn('[AuthContext] Erro ao sincronizar foto do perfil:', error.message);
          }
        };
        syncProfilePhoto();

        // ============================================================
        // Registar notificações push (apenas uma vez por sessão)
        // ============================================================
        if (!pushRegistrado.current) {
          pushRegistrado.current = true;
          registrarParaPushNotificationsAsync().then((token) => {
            if (token) {
              salvarPushToken(firebaseUser.uid, token);
            }
          });
        }
      } else {
        // Usuário deslogado: limpa perfil
        if (unsubscribeProfile.current) {
          unsubscribeProfile.current();
          unsubscribeProfile.current = null;
        }
        setUserProfile(null);
        setIsLoading(false);
        pushRegistrado.current = false; // Reset para permitir novo registo no próximo login
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile.current) {
        unsubscribeProfile.current();
      }
    };
  }, []);

  // Determinar se o email está verificado
  // Usuários do Google já vêm com emailVerified = true
  const emailVerified = user?.emailVerified === true;

  /**
   * Força o reload do usuário Firebase Auth e atualiza o estado.
   * Necessário após o usuário verificar o email (pois onAuthStateChanged
   * não é disparado para mudanças em propriedades como emailVerified).
   *
   * @returns {Promise<boolean>} - true se o email foi verificado
   */
  const refreshUser = async () => {
    try {
      await auth.currentUser?.reload();
      const usuarioAtualizado = auth.currentUser;
      if (usuarioAtualizado) {
        // Força a atualização do estado para disparar re-renderização
        setUser({ ...usuarioAtualizado });
      }
      return usuarioAtualizado?.emailVerified === true;
    } catch (error) {
      console.warn('[AuthContext] Erro ao recarregar usuário:', error.message);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, isLoading, emailVerified, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para consumir o AuthContext.
 * Retorna { user, userProfile, isLoading }.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
