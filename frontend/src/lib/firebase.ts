import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// VITE_FIREBASE_CONFIG is the JSON string from Firebase Console → Project Settings
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG as string)

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
