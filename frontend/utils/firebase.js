import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "cortex-ai-ded75.firebaseapp.com",
  projectId: "cortex-ai-ded75",
  storageBucket: "cortex-ai-ded75.firebasestorage.app",
  messagingSenderId: "634274430694",
  appId: "1:634274430694:web:0ec36a66283eedd8488527"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();