// Fill profile_image_url from subway_athletes_final CSV
// Match by name AND phone for accuracy
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

function normalizeName(name) {
    return name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
}

function normalizePhone(phone) {
    return phone?.replace(/\D/g, '') || '';
}

async function fillProfileImages() {
    // Load CSV
    const csv = readFileSync('/Users/baileyosullivan/Downloads/subway_athletes_final - Sheet1 (1).csv', 'utf-8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    console.log('📋 CSV Headers:', headers);

    // Column indices: Name,Phone,Profile Pic URL
    const nameCol = headers.indexOf('name');
    const phoneCol = headers.indexOf('phone');
    const profilePicCol = headers.indexOf('profile pic url');

    console.log(`📊 Columns: name=${nameCol}, phone=${phoneCol}, profile pic url=${profilePicCol}`);

    if (profilePicCol === -1) {
        console.error('❌ Could not find Profile Pic URL column!');
        return;
    }

    // Build profile pic maps (by name AND phone for matching)
    const picByName = new Map();
    const picByPhone = new Map();

    let csvCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < headers.length) continue;

        const name = parts[nameCol]?.trim();
        const phone = parts[phoneCol]?.trim();
        const profilePicUrl = parts[profilePicCol]?.trim();

        if (!name || !profilePicUrl) continue;

        const normalizedName = normalizeName(name);
        const normalizedPhone = normalizePhone(phone);

        if (profilePicUrl.startsWith('http')) {
            csvCount++;
            picByName.set(normalizedName, profilePicUrl);
            if (normalizedPhone) {
                picByPhone.set(normalizedPhone, profilePicUrl);
            }
            console.log(`📷 Loaded: ${name} -> ${profilePicUrl.substring(0, 60)}...`);
        }
    }

    console.log(`\n📷 Profile pics in CSV: ${csvCount}`);

    // Load current athletes from Firestore
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`\n📊 Current athletes in Firestore: ${athletes.length}`);

    // Update profile images
    let filled = 0;
    let alreadyHas = 0;
    let notFound = 0;
    const filledNames = [];

    for (const athlete of athletes) {
        // Skip placeholder athletes
        if (athlete.user_name?.startsWith('Video_Athlete_') || athlete.user_name?.startsWith('Story_Athlete_')) {
            continue;
        }

        const normalizedName = normalizeName(athlete.user_name);
        const normalizedPhone = normalizePhone(athlete.user_phone_number);

        // Check if already has a valid profile image
        if (athlete.profile_image_url && athlete.profile_image_url.startsWith('http')) {
            alreadyHas++;
            continue;
        }

        // Try to match by phone first (more reliable), then by name
        let profilePicUrl = picByPhone.get(normalizedPhone) || picByName.get(normalizedName);

        if (profilePicUrl) {
            athlete.profile_image_url = profilePicUrl;
            filled++;
            filledNames.push(athlete.user_name);
            console.log(`✅ Filled: ${athlete.user_name}`);
        } else {
            notFound++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Filled profile pics: ${filled}`);
    console.log(`  ⏭️  Already had profile pics: ${alreadyHas}`);
    console.log(`  ❌ Not found in CSV or already have: ${notFound}`);

    if (filled > 0) {
        // Save
        await setDoc(docRef, {
            ...currentData,
            athletes,
            updatedAt: new Date().toISOString(),
            source: 'fill-profile-images-final'
        });
        console.log('\n✅ Saved to Firestore!');
        console.log(`\n📋 Athletes filled:`);
        filledNames.forEach(name => console.log(`  - ${name}`));
    } else {
        console.log('\n⚠️ No changes needed - nothing to save.');
    }
}

fillProfileImages().catch(console.error);
