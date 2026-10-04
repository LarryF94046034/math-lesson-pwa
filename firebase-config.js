/**
 * Firebase web app config for project Teach (teach-bba0b).
 */
export const firebaseConfig = {
  apiKey: "AIzaSyD1_TMnCFKns6XVGmgeUcWZe_uQq0qo6kc",
  authDomain: "teach-bba0b.firebaseapp.com",
  projectId: "teach-bba0b",
  storageBucket: "teach-bba0b.firebasestorage.app",
  messagingSenderId: "48567893781",
  appId: "1:48567893781:web:5ce036c21df80d1461b31c",
  measurementId: "G-2M8SZ6Y6L8",
};

export function isFirebaseConfigured() {
  return (
    typeof firebaseConfig.apiKey === "string" &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("REPLACE") &&
    firebaseConfig.projectId &&
    !String(firebaseConfig.projectId).startsWith("REPLACE")
  );
}
