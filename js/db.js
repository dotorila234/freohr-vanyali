// ==========================================================================
// Capa de datos: todo lo que habla con Firebase vive aquí.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig, AUTH_FAKE_DOMAIN } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const dbase = getFirestore(app);

function emailForId(id) {
  return `id${id}@${AUTH_FAKE_DOMAIN}`;
}

// ---------- Auth / cuentas ----------

export async function registerAccount(username, password) {
  const usernameLower = username.trim().toLowerCase();

  const existing = await getDocs(query(collection(dbase, "users"), where("usernameLower", "==", usernameLower)));
  if (!existing.empty) {
    throw new Error("username-taken");
  }

  const counterRef = doc(dbase, "meta", "counter");
  const nextId = await runTransaction(dbase, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().nextId : 1;
    tx.set(counterRef, { nextId: current + 1 }, { merge: true });
    return current;
  });

  const email = emailForId(nextId);
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const role = nextId === 1 ? "gm" : "player";

  await setDoc(doc(dbase, "users", credential.user.uid), {
    id: nextId,
    username: username.trim(),
    usernameLower,
    role,
    createdAt: serverTimestamp()
  });

  return { id: nextId, username: username.trim(), role };
}

export async function login(username, password) {
  const usernameLower = username.trim().toLowerCase();
  const found = await getDocs(query(collection(dbase, "users"), where("usernameLower", "==", usernameLower)));
  if (found.empty) throw new Error("not-found");
  const userDoc = found.docs[0].data();
  const email = emailForId(userDoc.id);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(dbase, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ---------- Personajes ----------

export async function createCharacter(ownerId, ownerUsername, data) {
  const ref = await addDoc(collection(dbase, "characters"), {
    ownerId,
    ownerUsername,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateCharacter(charId, data) {
  await updateDoc(doc(dbase, "characters", charId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteCharacter(charId) {
  await deleteDoc(doc(dbase, "characters", charId));
}

export async function getCharacter(charId) {
  const snap = await getDoc(doc(dbase, "characters", charId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listAllCharacters() {
  const snap = await getDocs(collection(dbase, "characters"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
