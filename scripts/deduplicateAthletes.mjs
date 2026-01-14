// Deduplicate video athletes by normalizing names (case-insensitive)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

// Normalize name for comparison
function normalizeName(name) {
    return name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
}

// Title case a name
function titleCase(name) {
    return name.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

async function deduplicateAthletes() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes: ${athletes.length}`);

    // Find duplicates by normalized name
    const seen = new Map(); // normalized name -> first athlete
    const duplicates = [];
    const unique = [];

    for (const athlete of athletes) {
        const normalized = normalizeName(athlete.user_name);

        if (seen.has(normalized)) {
            // Merge data into the existing one
            const existing = seen.get(normalized);
            console.log(`🔄 Merging duplicate: "${athlete.user_name}" -> "${existing.user_name}"`);

            // Merge: keep non-empty values, prefer higher metrics
            existing.user_phone_number = existing.user_phone_number || athlete.user_phone_number;
            existing.ig_reel_url = existing.ig_reel_url || athlete.ig_reel_url;
            existing.tiktok_post_url = existing.tiktok_post_url || athlete.tiktok_post_url;
            existing.ig_reel_views = Math.max(existing.ig_reel_views || 0, athlete.ig_reel_views || 0);
            existing.ig_reel_likes = Math.max(existing.ig_reel_likes || 0, athlete.ig_reel_likes || 0);
            existing.ig_reel_comments = Math.max(existing.ig_reel_comments || 0, athlete.ig_reel_comments || 0);
            existing.ig_reel_shares = Math.max(existing.ig_reel_shares || 0, athlete.ig_reel_shares || 0);
            existing.ig_story_1_views = Math.max(existing.ig_story_1_views || 0, athlete.ig_story_1_views || 0);

            duplicates.push(athlete.user_name);
        } else {
            // Normalize the name to Title Case for consistency
            athlete.user_name = titleCase(athlete.user_name);
            seen.set(normalized, athlete);
            unique.push(athlete);
        }
    }

    console.log(`\n🗑️  Removed ${duplicates.length} duplicates:`);
    duplicates.forEach(d => console.log(`  - ${d}`));

    const finalVideo = unique.filter(a => a.campaign_type === 'video').length;
    const finalStory = unique.filter(a => a.campaign_type === 'story').length;
    console.log(`\n📊 Final: ${unique.length} athletes (🎬 ${finalVideo} video, 📸 ${finalStory} story)`);

    await setDoc(docRef, {
        ...currentData,
        athletes: unique,
        updatedAt: new Date().toISOString(),
        source: 'deduplication'
    });
    console.log('✅ Saved to Firestore!');
}

deduplicateAthletes().catch(console.error);
