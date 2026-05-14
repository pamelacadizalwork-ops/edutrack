import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDG_j5O-vo9nt727bjgod1Ux8_AGvP-VZo",
  authDomain: "edutrak-f6e7b.firebaseapp.com",
  projectId: "edutrak-f6e7b",
  storageBucket: "edutrak-f6e7b.firebasestorage.app",
  messagingSenderId: "373431497544",
  appId: "1:373431497544:web:132c0003854709e583797d",
  measurementId: "G-XQXQQ2BE0G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
