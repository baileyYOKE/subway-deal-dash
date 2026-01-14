// Create complete hard backup of all athletes (video + story)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { writeFileSync } from 'fs';

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

const date = new Date().toISOString().split('T')[0];

async function createCompleteBackup() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const athletes = docSnap.exists() ? docSnap.data().athletes || [] : [];

    const videoAthletes = athletes.filter(a => a.campaign_type === 'video');
    const storyAthletes = athletes.filter(a => a.campaign_type === 'story');

    console.log(`📊 Total: ${athletes.length} (🎬 ${videoAthletes.length} video, 📸 ${storyAthletes.length} story)`);

    // 1. VIDEO ATHLETES CSV
    const videoCsv = [
        'Name,Phone,IG Reel URL,TikTok URL',
        ...videoAthletes.map(a => `"${a.user_name}","${a.user_phone_number || ''}","${a.ig_reel_url || ''}","${a.tiktok_post_url || ''}"`)
    ].join('\n');
    writeFileSync(`./backups/video_athletes_LOCKED_${date}.csv`, videoCsv);

    // 2. STORY ATHLETES CSV
    const storyCsv = [
        'Name,Phone,IG Account',
        ...storyAthletes.map(a => `"${a.user_name}","${a.user_phone_number || ''}","${a.ig_account || ''}"`)
    ].join('\n');
    writeFileSync(`./backups/story_athletes_LOCKED_${date}.csv`, storyCsv);

    // 3. COMPLETE ROSTER JSON (full data)
    const fullBackup = {
        exportedAt: new Date().toISOString(),
        videoCount: videoAthletes.length,
        storyCount: storyAthletes.length,
        totalCount: athletes.length,
        videoAthletes: videoAthletes.map(a => ({
            name: a.user_name,
            phone: a.user_phone_number,
            igReelUrl: a.ig_reel_url,
            tiktokUrl: a.tiktok_post_url
        })),
        storyAthletes: storyAthletes.map(a => ({
            name: a.user_name,
            phone: a.user_phone_number,
            igAccount: a.ig_account
        }))
    };
    writeFileSync(`./backups/complete_roster_LOCKED_${date}.json`, JSON.stringify(fullBackup, null, 2));

    // 4. TypeScript baseline files
    const videoTs = `// VIDEO ATHLETES BASELINE - LOCKED ${date}
// ${videoAthletes.length} athletes - DO NOT MODIFY
export const VIDEO_ROSTER = [
${videoAthletes.map(a => `  "${a.user_name}",`).join('\n')}
] as const;
export const VIDEO_ROSTER_SET = new Set(VIDEO_ROSTER.map(n => n.toLowerCase()));
export const isVideoAthlete = (name: string) => VIDEO_ROSTER_SET.has(name?.toLowerCase().trim());
`;
    writeFileSync('./services/lockedVideoRoster.ts', videoTs);

    const storyTs = `// STORY ATHLETES BASELINE - LOCKED ${date}
// ${storyAthletes.length} athletes - DO NOT MODIFY
export const STORY_ROSTER = [
${storyAthletes.map(a => `  "${a.user_name}",`).join('\n')}
] as const;
export const STORY_ROSTER_SET = new Set(STORY_ROSTER.map(n => n.toLowerCase()));
export const isStoryAthlete = (name: string) => STORY_ROSTER_SET.has(name?.toLowerCase().trim());
`;
    writeFileSync('./services/lockedStoryRoster.ts', storyTs);

    console.log('\n✅ Created backup files:');
    console.log(`  📁 backups/video_athletes_LOCKED_${date}.csv`);
    console.log(`  📁 backups/story_athletes_LOCKED_${date}.csv`);
    console.log(`  📁 backups/complete_roster_LOCKED_${date}.json`);
    console.log(`  📁 services/lockedVideoRoster.ts`);
    console.log(`  📁 services/lockedStoryRoster.ts`);
}

createCompleteBackup().catch(console.error);
