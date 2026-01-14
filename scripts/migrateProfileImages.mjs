// Migrate profile images from athletes_images.csv to Firestore
// Only updates athletes that exist in our locked roster
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

async function migrateProfileImages() {
    // Load profile images CSV
    const csv = readFileSync('./athletes_images.csv', 'utf-8');
    const lines = csv.split('\n').slice(1);

    const imageMap = new Map(); // normalized name -> imageUrl
    for (const line of lines) {
        const parts = line.split(',');
        const firstName = parts[0]?.trim();
        const lastName = parts[1]?.trim();
        const imageUrl = parts[3]?.trim();

        if (firstName && lastName && imageUrl && imageUrl.startsWith('http')) {
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            imageMap.set(fullName, imageUrl);
        }
    }
    console.log(`📷 Loaded ${imageMap.size} profile images from CSV`);

    // Load current athletes
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes: ${athletes.length}`);

    // Update athletes with profile images
    let updated = 0;
    let alreadyHad = 0;
    let noMatch = 0;

    for (const athlete of athletes) {
        const normalized = athlete.user_name?.toLowerCase().trim();
        const imageUrl = imageMap.get(normalized);

        if (imageUrl) {
            if (!athlete.profile_image_url || !athlete.profile_image_url.startsWith('http')) {
                athlete.profile_image_url = imageUrl;
                updated++;
                console.log(`✅ Updated: ${athlete.user_name}`);
            } else {
                alreadyHad++;
            }
        } else {
            noMatch++;
        }
    }

    console.log(`\n📊 Results:`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Already had image: ${alreadyHad}`);
    console.log(`  ❌ No match in CSV: ${noMatch}`);

    // Also load from combined_media.csv for video thumbnails
    const mediaCsv = readFileSync('./combined_media.csv', 'utf-8');
    const mediaLines = mediaCsv.split('\n').slice(1);

    let mediaUpdated = 0;
    for (const line of mediaLines) {
        const parts = parseCSVLine(line);
        const firstName = parts[0]?.trim();
        const lastName = parts[1]?.trim();
        const thumbnailUrl = parts[8]?.trim(); // thumbnailUrl1

        if (firstName && lastName && thumbnailUrl && thumbnailUrl.startsWith('http')) {
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            const athlete = athletes.find(a => a.user_name?.toLowerCase() === fullName);

            if (athlete && (!athlete.profile_image_url || !athlete.profile_image_url.startsWith('http'))) {
                athlete.profile_image_url = thumbnailUrl;
                mediaUpdated++;
                console.log(`🎬 Updated from video thumbnail: ${athlete.user_name}`);
            }
        }
    }
    console.log(`  🎬 Updated from video thumbnails: ${mediaUpdated}`);

    // Count final profile images
    const withImages = athletes.filter(a => a.profile_image_url?.startsWith('http')).length;
    console.log(`\n📷 Athletes with profile images: ${withImages}/${athletes.length}`);

    // Save
    await setDoc(docRef, {
        ...currentData,
        athletes,
        updatedAt: new Date().toISOString(),
        source: 'profile-image-migration'
    });
    console.log('✅ Saved to Firestore!');
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

migrateProfileImages().catch(console.error);
