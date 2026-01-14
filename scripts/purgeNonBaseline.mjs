// Script to purge non-baseline athletes from Firestore
// Run with: node scripts/purgeNonBaseline.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Firebase config - same as firebaseConfig.ts
const firebaseConfig = {
    apiKey: "AIzaSyBV32CqL_r2LU3H_OEv3j5yoMmrN72hB3s",
    authDomain: "subway-deal-2-dash.firebaseapp.com",
    projectId: "subway-deal-2-dash",
    storageBucket: "subway-deal-2-dash.firebasestorage.app",
    messagingSenderId: "1090232835839",
    appId: "1:1090232835839:web:caac6f0bc6c4b4af5a06ab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load baseline athlete names from CSV
const csvPath = '/Users/baileyosullivan/Downloads/subway_25_deal_full_status - subway_25_deal_full_status.csv';
const csvContent = readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').slice(1); // Skip header

const baselineNames = new Set();
for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    const firstName = parts[0]?.trim().replace(/\r/g, '');
    const lastName = parts[1]?.trim().replace(/\r/g, '');
    if (firstName && lastName) {
        baselineNames.add(`${firstName} ${lastName}`);
    }
}

console.log(`📋 Loaded ${baselineNames.size} baseline athlete names from CSV`);

// Load current athletes from Firestore
async function purgeNonBaseline() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        console.error('❌ No data found in Firestore');
        process.exit(1);
    }

    const data = docSnap.data();
    const athletes = data.athletes || [];
    console.log(`📊 Current athletes in Firestore: ${athletes.length}`);

    // Filter to only keep baseline athletes
    const keptAthletes = [];
    const removedAthletes = [];

    for (const athlete of athletes) {
        const name = athlete.user_name;
        // Skip placeholders
        if (name?.startsWith('Video_Athlete_') || name?.startsWith('Story_Athlete_')) {
            removedAthletes.push(name);
            continue;
        }

        if (baselineNames.has(name)) {
            keptAthletes.push(athlete);
        } else {
            removedAthletes.push(name);
        }
    }

    console.log(`✅ Keeping ${keptAthletes.length} athletes`);
    console.log(`🗑️  Removing ${removedAthletes.length} athletes`);

    // Show some removed names
    console.log('\nSample of removed athletes:');
    removedAthletes.slice(0, 10).forEach(n => console.log(`  - ${n}`));

    // Save back to Firestore
    await setDoc(docRef, {
        ...data,
        athletes: keptAthletes,
        updatedAt: new Date().toISOString(),
        source: 'purge-non-baseline-script'
    });

    console.log('\n✅ Purge complete! Firestore updated.');
}

purgeNonBaseline().catch(console.error);
