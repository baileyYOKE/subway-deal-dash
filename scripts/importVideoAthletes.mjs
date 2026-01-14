// Import video athletes - FINAL CLEAN VERSION
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

function parseCSV(content) {
    const lines = content.split('\n');
    const headers = parseCSVLine(lines[0]);
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = parseCSVLine(line);
        const record = {};
        headers.forEach((h, idx) => record[h] = values[idx] || '');
        records.push(record);
    }
    return records;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
}

// Strict validation - must look like "FirstName LastName"
function isValidAthleteName(name) {
    if (!name) return false;
    if (name.length > 40 || name.length < 5) return false;
    // Exclude any punctuation except spaces
    if (/[!@#$%^&*(),.?":{}|<>]/.test(name)) return false;
    // Must be 2-4 words, each word 2-15 chars
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2 || parts.length > 4) return false;
    for (const part of parts) {
        if (part.length < 2 || part.length > 15) return false;
        // Each part should be mostly letters
        if (!/^[A-Za-z'-]+$/.test(part)) return false;
    }
    return true;
}

async function importVideoAthletes() {
    const csvContent = readFileSync('./social_media_import.csv', 'utf-8');
    const records = parseCSV(csvContent);
    console.log(`📊 Total rows in CSV: ${records.length}`);

    const athleteMap = new Map();
    let skipped = 0;

    for (const row of records) {
        const userId = row.user_id?.trim();
        const name = row.user_full_name?.trim();
        const phone = row.user_phone_number?.trim();
        const mediaType = row.media_type?.trim().toLowerCase();
        const permalink = row.media_permalink?.trim();

        // Must have valid user_id (24 char hex) and valid name
        if (!userId || userId.length !== 24 || !isValidAthleteName(name)) {
            skipped++;
            continue;
        }

        if (!athleteMap.has(name)) {
            athleteMap.set(name, {
                user_name: name,
                user_phone_number: phone || '',
                ig_account: '',
                tiktok_account: '',
                assigned_to: '',
                campaign_type: 'video',
                profile_image_url: '',
                ig_reel_url: '', ig_reel_views: 0, ig_reel_likes: 0, ig_reel_comments: 0, ig_reel_shares: 0,
                tiktok_post_url: '', tiktok_views: 0, tiktok_likes: 0, tiktok_comments: 0, tiktok_shares: 0,
                ig_story_1_views: 0, ig_story_1_taps: 0, ig_story_1_replies: 0, ig_story_1_shares: 0,
                ig_story_2_views: 0, ig_story_2_taps: 0, ig_story_2_replies: 0, ig_story_2_shares: 0,
                ig_story_3_views: 0, ig_story_3_taps: 0, ig_story_3_replies: 0, ig_story_3_shares: 0,
            });
        }

        const athlete = athleteMap.get(name);
        const views = parseFloat(row.views) || 0;
        const likes = parseFloat(row.likes) || 0;
        const comments = parseFloat(row.comments) || 0;
        const shares = parseFloat(row.shares) || 0;
        const replies = parseFloat(row.replies) || 0;
        const taps = parseFloat(row.link_or_sticker_taps) || 0;

        if (mediaType === 'ig_reel') {
            athlete.ig_reel_views = Math.max(athlete.ig_reel_views, views);
            athlete.ig_reel_likes = Math.max(athlete.ig_reel_likes, likes);
            athlete.ig_reel_comments = Math.max(athlete.ig_reel_comments, comments);
            athlete.ig_reel_shares = Math.max(athlete.ig_reel_shares, shares);
            if (permalink && !athlete.ig_reel_url) athlete.ig_reel_url = permalink;
        } else if (mediaType === 'ig_story') {
            if (athlete.ig_story_1_views === 0) {
                athlete.ig_story_1_views = views; athlete.ig_story_1_taps = taps;
                athlete.ig_story_1_replies = replies; athlete.ig_story_1_shares = shares;
            } else if (athlete.ig_story_2_views === 0) {
                athlete.ig_story_2_views = views; athlete.ig_story_2_taps = taps;
                athlete.ig_story_2_replies = replies; athlete.ig_story_2_shares = shares;
            } else if (athlete.ig_story_3_views === 0) {
                athlete.ig_story_3_views = views; athlete.ig_story_3_taps = taps;
                athlete.ig_story_3_replies = replies; athlete.ig_story_3_shares = shares;
            }
        }
    }

    console.log(`⏭️  Skipped ${skipped} invalid rows`);
    const videoAthletes = Array.from(athleteMap.values());
    console.log(`\n👥 Valid unique athletes: ${videoAthletes.length}`);

    const withReels = videoAthletes.filter(a => a.ig_reel_views > 0);
    const withStories = videoAthletes.filter(a => a.ig_story_1_views > 0);
    console.log(`🎬 With reel data: ${withReels.length}`);
    console.log(`📸 With story data: ${withStories.length}`);

    console.log('\n📋 All video athletes:');
    videoAthletes.forEach(a => console.log(`  ${a.user_name}: reel=${a.ig_reel_views}, story=${a.ig_story_1_views}`));

    // Load current and replace video section
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };

    // Keep only story athletes from current, add new video athletes
    const storyOnly = (currentData.athletes || []).filter(a => a.campaign_type === 'story');
    console.log(`\n📊 Keeping ${storyOnly.length} story athletes`);

    const merged = [...storyOnly];
    let added = 0, updated = 0;

    for (const va of videoAthletes) {
        const idx = merged.findIndex(a => a.user_name === va.user_name);
        if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...va, campaign_type: 'video' };
            updated++;
        } else {
            merged.push({ id: Math.random().toString(36).substr(2, 9), ...va });
            added++;
        }
    }

    console.log(`\n✅ Added: ${added}, Updated: ${updated}`);
    const finalV = merged.filter(a => a.campaign_type === 'video').length;
    const finalS = merged.filter(a => a.campaign_type === 'story').length;
    console.log(`📊 Final: ${merged.length} total (🎬 ${finalV} video, 📸 ${finalS} story)`);

    await setDoc(docRef, { ...currentData, athletes: merged, updatedAt: new Date().toISOString(), source: 'clean-video-import' });
    console.log('\n✅ Saved to Firestore!');
}

importVideoAthletes().catch(console.error);
