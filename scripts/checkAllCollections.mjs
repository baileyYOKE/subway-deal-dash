// Check ALL Firestore collections for backup data
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

// Known collections to check
const collectionsToCheck = [
    'campaigns',
    'version_history',
    'history',
    'backups',
    'athletes',
    'subway-deal-2-dash'
];

async function checkAllCollections() {
    for (const collName of collectionsToCheck) {
        try {
            const ref = collection(db, collName);
            const snap = await getDocs(ref);
            if (snap.size > 0) {
                console.log(`\n📁 ${collName}: ${snap.size} documents`);
                snap.docs.forEach(d => {
                    const data = d.data();
                    const athletes = data.athletes || [];
                    if (athletes.length > 0) {
                        const video = athletes.filter(a => a.campaign_type === 'video').length;
                        const story = athletes.filter(a => a.campaign_type === 'story').length;
                        console.log(`  📄 ${d.id}: ${athletes.length} athletes (🎬 ${video} video, 📸 ${story} story)`);
                    } else {
                        console.log(`  📄 ${d.id}: ${Object.keys(data).slice(0, 5).join(', ')}...`);
                    }
                });
            }
        } catch (e) {
            // Collection doesn't exist or no access
        }
    }
}

checkAllCollections();
