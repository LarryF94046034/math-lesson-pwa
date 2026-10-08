import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app = null;
let db = null;
let auth = null;
let initError = null;

function mentorDocId(questionId) {
  // Firestore doc ids cannot contain "/"
  return String(questionId).replace(/\//g, "_");
}

export function cloudReady() {
  return isFirebaseConfigured() && !initError && !!db;
}

export function cloudStatus() {
  if (!isFirebaseConfigured()) return "尚未填入 firebase-config.js";
  if (initError) return "Firebase 初始化失敗：" + initError;
  return "Firebase 已連線";
}

export function initCloud() {
  if (!isFirebaseConfigured()) return false;
  if (db) return true;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    return true;
  } catch (err) {
    initError = String(err?.message || err);
    console.warn(initError);
    return false;
  }
}

export async function fetchMentorInk(questionId) {
  if (!initCloud()) return null;
  const ref = doc(db, "mentorInk", mentorDocId(questionId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return {
    zones: data.zones || {},
    order: data.order || [],
  };
}

export function watchAuth(callback) {
  if (!initCloud() || !auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInEmail(email, password) {
  if (!initCloud() || !auth) throw new Error("Firebase 尚未設定");
  await signInWithEmailAndPassword(auth, String(email || "").trim(), password);
}

export async function registerEmail(email, password) {
  if (!initCloud() || !auth) throw new Error("Firebase 尚未設定");
  await createUserWithEmailAndPassword(auth, String(email || "").trim(), password);
}

export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}

export function authErrorText(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-email") return "電子郵件格式不正確";
  if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
    return "帳號或密碼錯誤";
  }
  if (code === "auth/email-already-in-use") return "這個電子郵件已經註冊過";
  if (code === "auth/weak-password") return "密碼至少要 6 個字元";
  if (code === "auth/operation-not-allowed") return "請先到 Firebase 主控台開啟「電子郵件／密碼」登入";
  if (code === "auth/too-many-requests") return "嘗試太多次，請稍後再試";
  return err?.message || String(err);
}

export async function publishMentorInk(questionId, inkDoc) {
  if (!initCloud()) throw new Error("Firebase 尚未設定");
  const ref = doc(db, "mentorInk", mentorDocId(questionId));
  await setDoc(ref, {
    zones: inkDoc.zones || {},
    order: inkDoc.order || [],
    questionId,
    updatedAt: serverTimestamp(),
  });
}
