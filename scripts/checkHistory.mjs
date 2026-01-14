// Check version history for latest backup before purge
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBV32CqL_r2LU3H_OEv3j5yoMmrN72hB3s",
    authDomain: "subway-deal-2-dash.firebaseapp.com",
    projectId: "subway-deal-2-dash",
    storageBucket: "subway-deal-2-dash.firebasestorage.app",
    messagingSenderId: "1090232835839",
    appId: "1:1090232835839:web:caac6f0bc6c4b4af5a06ab"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkHistory() {
    const historyRef = collection(db, 'version_history');
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(10));
    const snapshot = await getDocs(q);

    console.log('📜 Recent version history:');
    snapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`${i + 1}. ${data.timestamp} - ${data.source} - ${data.athleteCount} athletes`);

        // Check campaign types in this version
        const athletes = data.athletes || [];
        const video = athletes.filter(a => a.campaign_type === 'video').length;
        const story = athletes.filter(a => a.campaign_type === 'story').length;
        console.log(`   🎬 Video: ${video}, 📸 Story: ${story}`);
    });
}

checkHistory();
