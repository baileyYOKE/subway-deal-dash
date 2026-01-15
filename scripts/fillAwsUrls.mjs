// Fill approved_aws_url from subway_athletes_combined.csv
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
    // Remove all non-numeric characters
    return phone?.replace(/\D/g, '') || '';
}

async function fillAwsUrls() {
    // Load CSV
    const csv = readFileSync('/Users/baileyosullivan/Downloads/subway_athletes_combined.csv', 'utf-8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

    console.log('📋 CSV Headers:', headers);

    // Column indices: name,phone,user_id,school_id,school_name,club_id,sport,approved_aws_url
    const nameCol = headers.indexOf('name');
    const phoneCol = headers.indexOf('phone');
    const awsUrlCol = headers.indexOf('approved_aws_url');

    console.log(`📊 Columns: name=${nameCol}, phone=${phoneCol}, approved_aws_url=${awsUrlCol}`);

    if (awsUrlCol === -1) {
        console.error('❌ Could not find approved_aws_url column!');
        return;
    }

    // Build AWS URL maps (by name AND phone for matching)
    const awsByName = new Map(); // normalized name -> awsUrl
    const awsByPhone = new Map(); // normalized phone -> awsUrl

    let csvWithAws = 0;
    let csvWithoutAws = 0;

    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < headers.length) continue;

        const name = parts[nameCol]?.trim();
        const phone = parts[phoneCol]?.trim();
        const awsUrl = parts[awsUrlCol]?.trim();

        if (!name) continue;

        const normalizedName = normalizeName(name);
        const normalizedPhone = normalizePhone(phone);

        if (awsUrl && awsUrl.startsWith('http')) {
            csvWithAws++;
            awsByName.set(normalizedName, awsUrl);
            if (normalizedPhone) {
                awsByPhone.set(normalizedPhone, awsUrl);
            }
        } else {
            csvWithoutAws++;
        }
    }

    console.log(`\n📷 AWS URLs in CSV: ${csvWithAws} with, ${csvWithoutAws} without`);
    console.log(`📋 Unique names: ${awsByName.size}, Unique phones: ${awsByPhone.size}`);

    // Load current athletes from Firestore
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`\n📊 Current athletes in Firestore: ${athletes.length}`);

    // Update AWS URLs
    let filled = 0;
    let alreadyHas = 0;
    let notFound = 0;
    const filledNames = [];

    for (const athlete of athletes) {
        // Skip placeholder athletes
        if (athlete.user_name?.startsWith('Video_Athlete_') || athlete.user_name?.startsWith('Story_Athlete_')) {
            continue;
        }

        // Check if already has a valid AWS URL
        if (athlete.approved_aws_url && athlete.approved_aws_url.startsWith('http')) {
            alreadyHas++;
            continue;
        }

        const normalizedName = normalizeName(athlete.user_name);
        const normalizedPhone = normalizePhone(athlete.user_phone_number);

        // Try to match by phone first (more reliable), then by name
        let awsUrl = awsByPhone.get(normalizedPhone) || awsByName.get(normalizedName);

        if (awsUrl) {
            athlete.approved_aws_url = awsUrl;
            filled++;
            filledNames.push(athlete.user_name);
            console.log(`✅ Filled: ${athlete.user_name}`);
        } else {
            notFound++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Filled AWS URLs: ${filled}`);
    console.log(`  ⏭️  Already had AWS URLs: ${alreadyHas}`);
    console.log(`  ❌ Not found in CSV: ${notFound}`);

    if (filled > 0) {
        // Save
        await setDoc(docRef, {
            ...currentData,
            athletes,
            updatedAt: new Date().toISOString(),
            source: 'fill-aws-urls'
        });
        console.log('\n✅ Saved to Firestore!');
        console.log(`\n📋 Athletes filled:`);
        filledNames.forEach(name => console.log(`  - ${name}`));
    } else {
        console.log('\n⚠️ No changes needed - nothing to save.');
    }
}

fillAwsUrls().catch(console.error);
