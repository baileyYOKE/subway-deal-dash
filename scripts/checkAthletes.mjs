// Script to check current athlete counts in Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

async function checkAthletes() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        console.error('❌ No data found');
        return;
    }

    const athletes = docSnap.data().athletes || [];

    const videoAthletes = athletes.filter(a => a.campaign_type === 'video');
    const storyAthletes = athletes.filter(a => a.campaign_type === 'story');

    console.log(`📊 Total athletes: ${athletes.length}`);
    console.log(`🎬 Video athletes: ${videoAthletes.length}`);
    console.log(`📸 Story athletes: ${storyAthletes.length}`);

    console.log('\n🎬 Video athlete names:');
    videoAthletes.slice(0, 20).forEach(a => console.log(`  - ${a.user_name}`));
    if (videoAthletes.length > 20) console.log(`  ... and ${videoAthletes.length - 20} more`);
}

checkAthletes();
