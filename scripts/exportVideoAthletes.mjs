// Export video athletes to a locked baseline file
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

async function exportVideoAthletes() {
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const athletes = docSnap.exists() ? docSnap.data().athletes || [] : [];

    const videoAthletes = athletes.filter(a => a.campaign_type === 'video');
    console.log(`🎬 Found ${videoAthletes.length} video athletes`);

    // Create CSV backup
    const csvHeaders = 'Name,Phone,IG Reel URL,TikTok URL';
    const csvRows = videoAthletes.map(a =>
        `"${a.user_name}","${a.user_phone_number || ''}","${a.ig_reel_url || ''}","${a.tiktok_post_url || ''}"`
    );
    const csvContent = [csvHeaders, ...csvRows].join('\n');

    const date = new Date().toISOString().split('T')[0];
    const csvPath = `./video_athletes_backup_${date}.csv`;
    writeFileSync(csvPath, csvContent);
    console.log(`📁 Saved CSV backup: ${csvPath}`);

    // Create TypeScript baseline file (like baselineAthletes.ts)
    const tsContent = `// Video Athletes Baseline - LOCKED ${date}
// These ${videoAthletes.length} athletes are the definitive video roster
// New video athletes cannot be added during imports when VIDEO_ROSTER_LOCKED = true

export const VIDEO_ATHLETES: { name: string; phone: string; igReelUrl: string; tiktokUrl: string }[] = [
${videoAthletes.map(a => `  { name: "${a.user_name}", phone: "${a.user_phone_number || ''}", igReelUrl: "${a.ig_reel_url || ''}", tiktokUrl: "${a.tiktok_post_url || ''}" },`).join('\n')}
];

// Quick lookup set for name matching
export const VIDEO_ATHLETE_NAMES = new Set(VIDEO_ATHLETES.map(a => a.name.toLowerCase()));

export function isVideoAthlete(name: string): boolean {
  return VIDEO_ATHLETE_NAMES.has(name?.toLowerCase().trim() || '');
}

export function getVideoAthleteData(name: string) {
  const normalized = name?.toLowerCase().trim();
  return VIDEO_ATHLETES.find(a => a.name.toLowerCase() === normalized);
}
`;

    writeFileSync('./services/baselineVideoAthletes.ts', tsContent);
    console.log(`📁 Saved TypeScript baseline: services/baselineVideoAthletes.ts`);

    // Print summary
    console.log('\n📋 Video Athletes Roster:');
    videoAthletes.forEach((a, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${a.user_name} | ${a.user_phone_number || 'no phone'}`);
    });
}

exportVideoAthletes().catch(console.error);
