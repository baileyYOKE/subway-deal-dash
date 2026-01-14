// Filter story athletes to only those in the baseline CSV
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

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

async function filterStoryAthletes() {
    // Load baseline names from CSV (firstName,lastName format)
    const csv = readFileSync('./story_baseline.csv', 'utf-8');
    const lines = csv.split('\n').slice(1); // Skip header

    const baselineNames = new Set();
    for (const line of lines) {
        const [firstName, lastName] = line.split(',').map(s => s?.trim().replace(/\r/g, ''));
        if (firstName && lastName) {
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            baselineNames.add(fullName);
        }
    }
    console.log(`📋 Baseline story athletes: ${baselineNames.size}`);

    // Load current data
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes: ${athletes.length}`);

    // Keep all video athletes, filter story athletes
    const videoAthletes = athletes.filter(a => a.campaign_type === 'video');
    const storyAthletes = athletes.filter(a => a.campaign_type === 'story');

    console.log(`🎬 Video athletes (keeping all): ${videoAthletes.length}`);
    console.log(`📸 Story athletes before filter: ${storyAthletes.length}`);

    // Filter story athletes to baseline
    const keptStory = [];
    const removedStory = [];

    for (const athlete of storyAthletes) {
        const normalized = athlete.user_name?.toLowerCase().trim();
        if (baselineNames.has(normalized)) {
            keptStory.push(athlete);
        } else {
            removedStory.push(athlete.user_name);
        }
    }

    console.log(`\n✅ Keeping ${keptStory.length} story athletes`);
    console.log(`🗑️  Removing ${removedStory.length} story athletes:`);
    removedStory.forEach(n => console.log(`  - ${n}`));

    // Combine and save
    const finalAthletes = [...videoAthletes, ...keptStory];
    const finalVideo = finalAthletes.filter(a => a.campaign_type === 'video').length;
    const finalStory = finalAthletes.filter(a => a.campaign_type === 'story').length;

    console.log(`\n📊 Final: ${finalAthletes.length} (🎬 ${finalVideo} video, 📸 ${finalStory} story)`);

    await setDoc(docRef, {
        ...currentData,
        athletes: finalAthletes,
        updatedAt: new Date().toISOString(),
        source: 'story-filter-baseline'
    });
    console.log('✅ Saved to Firestore!');
}

filterStoryAthletes().catch(console.error);
