// Import subclub video athletes - adds new ones and updates existing with social links
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

async function importSubclub() {
    const csv = readFileSync('./subclub_import.csv', 'utf-8');
    const lines = csv.split('\n').slice(1); // Skip header

    const imports = [];
    for (const line of lines) {
        const [name, phone, igLink, tiktokLink] = line.split(',').map(s => s?.trim().replace(/\r/g, ''));
        if (!name || name.length < 3) continue;
        imports.push({ name, phone: phone || '', igLink: igLink || '', tiktokLink: tiktokLink || '' });
    }

    console.log(`📋 Parsed ${imports.length} athletes from CSV`);

    // Load current data
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes: ${athletes.length}`);

    let added = 0, updated = 0;

    for (const imp of imports) {
        const existingIdx = athletes.findIndex(a => a.user_name === imp.name);

        if (existingIdx >= 0) {
            // Update existing with social links
            const existing = athletes[existingIdx];
            if (imp.igLink && !existing.ig_reel_url) {
                existing.ig_reel_url = imp.igLink;
            }
            if (imp.tiktokLink && !existing.tiktok_post_url) {
                existing.tiktok_post_url = imp.tiktokLink;
            }
            if (imp.phone && !existing.user_phone_number) {
                existing.user_phone_number = imp.phone;
            }
            updated++;
            console.log(`🔄 Updated: ${imp.name}`);
        } else {
            // Add new video athlete
            athletes.push({
                id: Math.random().toString(36).substr(2, 9),
                user_name: imp.name,
                user_phone_number: imp.phone,
                ig_account: '',
                tiktok_account: '',
                assigned_to: '',
                campaign_type: 'video',
                profile_image_url: '',
                ig_reel_url: imp.igLink,
                ig_reel_views: 0, ig_reel_likes: 0, ig_reel_comments: 0, ig_reel_shares: 0,
                tiktok_post_url: imp.tiktokLink,
                tiktok_views: 0, tiktok_likes: 0, tiktok_comments: 0, tiktok_shares: 0,
                ig_story_1_views: 0, ig_story_1_taps: 0, ig_story_1_replies: 0, ig_story_1_shares: 0,
                ig_story_2_views: 0, ig_story_2_taps: 0, ig_story_2_replies: 0, ig_story_2_shares: 0,
                ig_story_3_views: 0, ig_story_3_taps: 0, ig_story_3_replies: 0, ig_story_3_shares: 0,
            });
            added++;
            console.log(`➕ Added: ${imp.name}`);
        }
    }

    const finalV = athletes.filter(a => a.campaign_type === 'video').length;
    const finalS = athletes.filter(a => a.campaign_type === 'story').length;
    console.log(`\n✅ Added: ${added}, Updated: ${updated}`);
    console.log(`📊 Final: ${athletes.length} total (🎬 ${finalV} video, 📸 ${finalS} story)`);

    await setDoc(docRef, { ...currentData, athletes, updatedAt: new Date().toISOString(), source: 'subclub-import' });
    console.log('✅ Saved to Firestore!');
}

importSubclub().catch(console.error);
