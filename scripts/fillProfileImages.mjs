// Fill profile_image_url from combined_campaigns_matched.csv
// Only update existing athletes, don't add new ones
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

async function fillProfileImages() {
    // Load CSV
    const csv = readFileSync('/Users/baileyosullivan/Downloads/combined_campaigns_matched.csv', 'utf-8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    console.log('📋 CSV Headers:', headers);

    // Column indices
    const firstNameCol = headers.indexOf('firstname');
    const lastNameCol = headers.indexOf('lastname');
    const imageUrlCol = headers.indexOf('imageurl');
    const hasImageCol = headers.indexOf('hasimage');

    console.log(`📊 Columns: firstName=${firstNameCol}, lastName=${lastNameCol}, imageUrl=${imageUrlCol}, hasImage=${hasImageCol}`);

    // Build image map (only entries with valid URLs and hasImage=YES)
    const imageMap = new Map(); // normalized name -> imageUrl

    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < 5) continue;

        const firstName = parts[firstNameCol]?.trim();
        const lastName = parts[lastNameCol]?.trim();
        const imageUrl = parts[imageUrlCol]?.trim();
        const hasImage = parts[hasImageCol]?.trim();

        if (!firstName || !lastName) continue;

        const fullName = normalizeName(`${firstName} ${lastName}`);

        // Only use if hasImage=YES and URL is valid
        if (hasImage === 'YES' && imageUrl && imageUrl.startsWith('http')) {
            imageMap.set(fullName, imageUrl);
        }
    }

    console.log(`\n📷 Loaded ${imageMap.size} profile images from CSV`);

    // Load current athletes
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes: ${athletes.length}`);

    // Update profile images
    let filled = 0;
    let alreadyHas = 0;
    let notFound = 0;

    for (const athlete of athletes) {
        const normalized = normalizeName(athlete.user_name);
        const imageUrl = imageMap.get(normalized);

        // Check if already has a valid profile image
        if (athlete.profile_image_url && athlete.profile_image_url.startsWith('http')) {
            alreadyHas++;
            continue;
        }

        if (imageUrl) {
            athlete.profile_image_url = imageUrl;
            filled++;
            console.log(`✅ Filled: ${athlete.user_name}`);
        } else {
            notFound++;
        }
    }

    // Count results
    const withProfile = athletes.filter(a => a.profile_image_url && a.profile_image_url.startsWith('http')).length;
    const withContent = athletes.filter(a =>
        (a.content_image_url && a.content_image_url.startsWith('http')) ||
        (a.content_video_url && a.content_video_url.startsWith('http'))
    ).length;
    const carouselReady = athletes.filter(a =>
        (a.profile_image_url && a.profile_image_url.startsWith('http')) &&
        ((a.content_image_url && a.content_image_url.startsWith('http')) ||
            (a.content_video_url && a.content_video_url.startsWith('http')))
    ).length;

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Filled profile images: ${filled}`);
    console.log(`  ⏭️  Already had profile images: ${alreadyHas}`);
    console.log(`  ❌ Not found in CSV: ${notFound}`);
    console.log(`\n📊 Final counts:`);
    console.log(`  📷 Athletes with profile image: ${withProfile}/${athletes.length}`);
    console.log(`  🎬 Athletes with content: ${withContent}/${athletes.length}`);
    console.log(`  🎠 Carousel-ready (both): ${carouselReady}/${athletes.length}`);

    // Save
    await setDoc(docRef, {
        ...currentData,
        athletes,
        updatedAt: new Date().toISOString(),
        source: 'fill-profile-images'
    });
    console.log('\n✅ Saved to Firestore!');
}

fillProfileImages().catch(console.error);
