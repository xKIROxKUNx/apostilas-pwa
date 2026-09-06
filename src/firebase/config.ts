export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${key} não definida. Copie .env.example para .env ` +
        `e preencha com a config do app Web do Firebase (ver comentário em firebase/config.ts).`,
    );
  }
  return value;
}

export function loadFirebaseConfig(): FirebaseWebConfig {
  return {
    apiKey: requireEnv("VITE_FIREBASE_API_KEY"),
    authDomain: requireEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv("VITE_FIREBASE_APP_ID"),
  };
}
