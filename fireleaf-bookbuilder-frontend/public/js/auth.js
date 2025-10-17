// public/js/auth.js
import { auth } from "./firebase.client.js";
import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

let idTokenCache = null;

export async function ensureAuth() {
  if (idTokenCache) return idTokenCache;

  const customToken = import.meta.env.VITE_FIREBASE_TOKEN; 
  if (!customToken) throw new Error("Missing Firebase token in .env");

  // Sign in silently
  await signInWithCustomToken(auth, customToken);

  const user = auth.currentUser;
  if (!user) throw new Error("Failed to authenticate with Firebase");

  idTokenCache = await user.getIdToken();
  return idTokenCache;
}

export async function refreshIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  idTokenCache = await user.getIdToken(true);
  return idTokenCache;
}
