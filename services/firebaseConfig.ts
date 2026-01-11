// Firebase configuration for Subway Deal #2 Dash
// Auto-generated via Firebase CLI

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBXgPjE0XrYYwwMl843hG4XqhlJXkgNngY",
  authDomain: "subway-deal-2-dash.firebaseapp.com",
  projectId: "subway-deal-2-dash",
  storageBucket: "subway-deal-2-dash.firebasestorage.app",
  messagingSenderId: "773244283224",
  appId: "1:773244283224:web:7f8f787f1951919327dd2d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Apify API Token for social media scrapers (from environment)
export const APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || '';

// Gemini API Key for sentiment analysis (from environment)
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
