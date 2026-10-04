/**
 * Paste your Firebase web app config here (Firebase Console → Project settings).
 * Spark (free) plan is enough. Enable Cloud Firestore in test/open mode for mentorInk.
 */
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
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
