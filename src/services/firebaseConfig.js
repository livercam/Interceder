// Configuração do Firebase
// Firebase v12+ modular SDK
// Expo Managed Workflow — usa Firebase JS SDK (não precisa de google-services.json em runtime)
// O google-services.json é usado apenas pelo config plugin expo-build-properties para builds nativos (EAS Build)

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// CONFIGURAÇÃO DO FIREBASE — Web App
// ============================================================
// Obtida do Firebase Console > Project Settings > General > Your apps > Web
// ============================================================

const firebaseConfig = {
  apiKey: 'AIzaSyBygqdqXmJRTrkdKcISdkR4l8Jql7nXD6o',
  authDomain: 'interceder-ef0cd.firebaseapp.com',
  projectId: 'interceder-ef0cd',
  storageBucket: 'interceder-ef0cd.firebasestorage.app',
  messagingSenderId: '502593040102',
  appId: '1:502593040102:web:82a772d70483884b235527',
  measurementId: 'G-LKGZFVQ7QD',
};

// Inicializar Firebase (evita duplicação em hot-reload)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inicializar Auth com persistência AsyncStorage (para manter sessão)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Inicializar Firestore
const db = getFirestore(app);

export { auth, db };
export default app;
