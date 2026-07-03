// ==========================================================================
// PEGA AQUÍ LAS CLAVES DE TU PROYECTO FIREBASE
// (Firebase console → ⚙️ Configuración del proyecto → tus apps → SDK setup)
// Estas claves NO son secretas de verdad (son públicas por diseño en apps
// web de Firebase), la seguridad real la dan las reglas de Firestore.
// ==========================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyAbjqTVb4hj3mB72Kkb9xo4NneFPmSrqw0",
  authDomain: "freohr-vanyali.firebaseapp.com",
  projectId: "freohr-vanyali",
  storageBucket: "freohr-vanyali.firebasestorage.app",
  messagingSenderId: "1000576466641",
  appId: "1:1000576466641:web:63e38982fa64c53bdb4ff0"
};

// Dominio falso usado internamente para convertir tu "ID" numérico
// en un email con el que Firebase Auth pueda trabajar por debajo.
// No hace falta tocar esto.
export const AUTH_FAKE_DOMAIN = "fichas-alagaesia.local";
