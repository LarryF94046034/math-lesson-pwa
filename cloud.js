import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app = null;
let db = null;
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
