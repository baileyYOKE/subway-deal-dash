// Get version history from Firestore and restore video athletes
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

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

async function restoreVideoAthletes() {
    // Get ALL documents from campaigns collection to find version history
    const campaignsRef = collection(db, 'campaigns');
    const snapshot = await getDocs(campaignsRef);

    console.log('📂 Documents in campaigns collection:');
    snapshot.docs.forEach(d => {
        const data = d.data();
        const athletes = data.athletes || [];
        const video = athletes.filter(a => a.campaign_type === 'video').length;
        const story = athletes.filter(a => a.campaign_type === 'story').length;
        console.log(`  ${d.id}: ${athletes.length} athletes (🎬 ${video} video, 📸 ${story} story)`);
    });

    // Also check if there's a separate version_history collection
    console.log('\n📜 Checking for version_history...');
    try {
        const historyRef = collection(db, 'campaigns', 'subway-deal-2-dash', 'versions');
        const historySnap = await getDocs(historyRef);
        console.log(`Found ${historySnap.size} versions`);
        historySnap.docs.forEach(d => {
            const data = d.data();
            const athletes = data.athletes || [];
            console.log(`  ${d.id}: ${athletes.length} athletes - ${data.timestamp || data.updatedAt || 'no timestamp'}`);
        });
    } catch (e) {
        console.log('No versions subcollection found');
    }
}

restoreVideoAthletes();
