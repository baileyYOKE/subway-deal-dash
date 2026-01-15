// Replace story athletes with new data from CSV
// - Removes all existing story athletes
// - Adds new story athletes from CSV
// - Keeps all video athletes unchanged
// - Adds new fields: ig_username, ig_followers, ig_profile_url
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

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line?.length || 0; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else current += char;
    }
    result.push(current.trim());
    return result;
}

function generateId() {
    return 'athlete_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

async function replaceStoryAthletes() {
    // Load and parse CSV
    const csv = readFileSync('./new_story_athletes.csv', 'utf-8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    console.log('📋 CSV Headers:', headers);

    // Column indices based on the file structure
    const cols = {
        name: headers.indexOf('name'),
        phone: headers.indexOf('phone'),
        user_id: headers.indexOf('user_id'),
        views: headers.indexOf('views'),
        reach: headers.indexOf('reach'),
        shares: headers.indexOf('shares'),
        replies: headers.indexOf('replies'),
        link_taps: headers.indexOf('link_or_sticker_taps'),
        content_link: headers.indexOf('content link'),
        ig_username: headers.indexOf('ig username'),
        ig_followers: headers.indexOf('ig followers')
    };

    console.log('📊 Column mapping:', cols);

    // Parse new story athletes from CSV
    const newStoryAthletes = [];
    const seen = new Set(); // Deduplicate by name

    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < 5) continue;

        const name = parts[cols.name]?.trim();
        if (!name) continue;

        const normalized = name.toLowerCase();
        if (seen.has(normalized)) {
            console.log(`⏭️  Skipping duplicate: ${name}`);
            continue;
        }
        seen.add(normalized);

        const igUsername = parts[cols.ig_username]?.trim() || '';
        const igFollowers = parseInt(parts[cols.ig_followers]) || 0;
        const igProfileUrl = igUsername ? `https://instagram.com/${igUsername}` : '';

        const athlete = {
            id: generateId(),
            user_name: name,
            user_phone_number: parts[cols.phone]?.trim() || '',
            ig_account: igUsername,
            tiktok_account: '',
            assigned_to: '',
            campaign_type: 'story',
            profile_image_url: '',

            // Content URLs
            content_image_url: parts[cols.content_link]?.trim() || '',
            content_video_url: '',
            content_thumbnail_url: '',

            // Instagram URLs
            ig_reel_url: '',
            ig_story_url: '',
            ig_profile_url: igProfileUrl,
            tiktok_post_url: '',

            // New fields
            ig_username: igUsername,
            ig_followers: igFollowers,

            // TikTok Metrics (not applicable for story athletes)
            tiktok_views: 0,
            tiktok_likes: 0,
            tiktok_comments: 0,
            tiktok_shares: 0,

            // IG Reel Metrics (not applicable for story athletes)
            ig_reel_views: 0,
            ig_reel_shares: 0,
            ig_reel_comments: 0,
            ig_reel_likes: 0,

            // IG Story 1 Metrics
            ig_story_1_views: parseInt(parts[cols.views]) || 0,
            ig_story_1_taps: parseInt(parts[cols.link_taps]) || 0,
            ig_story_1_replies: parseInt(parts[cols.replies]) || 0,
            ig_story_1_shares: parseInt(parts[cols.shares]) || 0,

            // IG Story 2 & 3 (not used)
            ig_story_2_views: 0, ig_story_2_taps: 0, ig_story_2_replies: 0, ig_story_2_shares: 0,
            ig_story_3_views: 0, ig_story_3_taps: 0, ig_story_3_replies: 0, ig_story_3_shares: 0,
        };

        newStoryAthletes.push(athlete);
    }

    console.log(`\n📊 Parsed ${newStoryAthletes.length} new story athletes from CSV`);

    // Load current data and keep only video athletes
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const currentAthletes = currentData.athletes || [];

    const videoAthletes = currentAthletes.filter(a => a.campaign_type === 'video');
    const oldStoryCount = currentAthletes.filter(a => a.campaign_type === 'story').length;

    console.log(`📊 Current: ${currentAthletes.length} total (${videoAthletes.length} video, ${oldStoryCount} story)`);
    console.log(`🗑️  Removing ${oldStoryCount} old story athletes`);
    console.log(`➕ Adding ${newStoryAthletes.length} new story athletes`);

    // Combine video athletes with new story athletes
    const finalAthletes = [...videoAthletes, ...newStoryAthletes];

    console.log(`\n📊 Final: ${finalAthletes.length} total (${videoAthletes.length} video, ${newStoryAthletes.length} story)`);

    // Save
    await setDoc(docRef, {
        ...currentData,
        athletes: finalAthletes,
        updatedAt: new Date().toISOString(),
        source: 'story-athletes-replacement'
    });
    console.log('\n✅ Saved to Firestore!');

    // Show sample
    console.log('\n📋 Sample new story athletes:');
    newStoryAthletes.slice(0, 5).forEach(a => {
        console.log(`  - ${a.user_name} | @${a.ig_username} | ${a.ig_followers} followers | ${a.ig_story_1_views} views`);
    });
}

replaceStoryAthletes().catch(console.error);
