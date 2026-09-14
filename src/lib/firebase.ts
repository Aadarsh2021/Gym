import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { logger } from './logger';

// Client-Safe Web Configuration for Firebase Hosting & Delivery
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured = Boolean(apiKey && projectId);

// Initialize Firebase App only if configuration is provided
export const firebaseApp: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

export let firebaseAnalytics: Analytics | null = null;

// Initialize Analytics asynchronously only if supported in browser environment and Firebase is configured
if (typeof window !== 'undefined' && firebaseApp) {
  isSupported().then(supported => {
    if (supported && firebaseApp) {
      try {
        firebaseAnalytics = getAnalytics(firebaseApp);
        logger.info('Firebase Analytics initialized in privacy-safe mode');
      } catch (err) {
        logger.warn('Failed to initialize Firebase Analytics', { err });
      }
    }
  });
}
