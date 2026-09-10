import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { logger } from './logger';

// Client-Safe Web Configuration for Firebase Hosting & Delivery
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCgzymmwcbgcPwcm94Wn6Ah9esA7AJqHtg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gymbuddy-da185.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gymbuddy-da185',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gymbuddy-da185.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1099347517125',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1099347517125:web:b6fc7e34bc85cabfa65aac',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-CL2M0KZCXK',
};

// Initialize Firebase App (Idempotent: prevents duplicate initialization)
export const firebaseApp: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

export let firebaseAnalytics: Analytics | null = null;

// Initialize Analytics asynchronously only if supported in browser environment
if (typeof window !== 'undefined') {
  isSupported().then(supported => {
    if (supported) {
      try {
        firebaseAnalytics = getAnalytics(firebaseApp);
        logger.info('Firebase Analytics initialized in privacy-safe mode');
      } catch (err) {
        logger.warn('Failed to initialize Firebase Analytics', { err });
      }
    }
  });
}
