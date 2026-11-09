import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbik6YijIWLjO8ryopaE5wYDf6lwS54",
  authDomain: "senon-industrias.firebaseapp.com",
  projectId: "senon-industrias",
  storageBucket: "senon-industrias.firebasestorage.app",
  messagingSenderId: "893668541483",
  appId: "1:893668541483:web:163275b719534e4d0d166e",
  measurementId: "G-25V25931ZW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("¡Conexión a Firebase configurada correctamente!");
