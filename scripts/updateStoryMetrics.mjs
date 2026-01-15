// Update story athlete metrics from CSV
// - Only updates existing athletes (no new athletes created)
// - If duplicate rows for same athlete, keeps the one with most views
// - Updates: ig_story_1_views, ig_story_1_taps, ig_story_1_replies, ig_story_1_shares
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

// Get CSV file from command line argument
const csvPath = process.argv[2];
if (!csvPath) {
    console.error('Usage: node updateStoryMetrics.mjs <path-to-csv>');
    console.error('CSV should have columns: Name (or firstName,lastName), views, taps, replies, shares');
    process.exit(1);
}

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

async function updateStoryMetrics() {
    // Load and parse CSV
    const csv = readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));

    console.log('📋 CSV Headers:', headers);

    // Find column indices - prefer exact matches
    const findCol = (patterns) => {
        // First try exact match
        for (const p of patterns) {
            const exact = headers.findIndex(h => h === p);
            if (exact >= 0) return exact;
        }
        // Then try includes
        return headers.findIndex(h => patterns.some(p => h.includes(p)));
    };

    // Prefer user_full_name (exact) over partial matches
    let nameCol = headers.findIndex(h => h === 'user_full_name');
    if (nameCol < 0) nameCol = findCol(['name', 'user_name', 'athlete']);

    const firstNameCol = findCol(['first', 'firstname']);
    const lastNameCol = findCol(['last', 'lastname']);
    const viewsCol = findCol(['views', 'story_views', 'ig_story']);
    const tapsCol = headers.findIndex(h => h === 'link_or_sticker_taps'); // More specific
    const repliesCol = findCol(['replies', 'reply']);
    const sharesCol = findCol(['shares', 'share']);

    console.log(`📊 Column mapping: name=${nameCol}, views=${viewsCol}, taps=${tapsCol}, replies=${repliesCol}, shares=${sharesCol}`);

    // Parse all rows, deduplicating by keeping highest views
    const metricsMap = new Map(); // normalized name -> { views, taps, replies, shares }

    for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        if (parts.length < 2) continue;

        // Get name
        let name = '';
        if (nameCol >= 0 && parts[nameCol]) {
            name = parts[nameCol];
        } else if (firstNameCol >= 0 && lastNameCol >= 0) {
            name = `${parts[firstNameCol]} ${parts[lastNameCol]}`;
        }
        if (!name) continue;

        const normalized = normalizeName(name);
        const views = parseInt(parts[viewsCol]) || 0;
        const taps = parseInt(parts[tapsCol]) || 0;
        const replies = parseInt(parts[repliesCol]) || 0;
        const shares = parseInt(parts[sharesCol]) || 0;

        // Keep the row with highest views
        const existing = metricsMap.get(normalized);
        if (!existing || views > existing.views) {
            metricsMap.set(normalized, { name, views, taps, replies, shares });
        }
    }

    console.log(`📊 Parsed ${metricsMap.size} unique athletes from CSV`);

    // Load current athletes from Firestore
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Current athletes in Firestore: ${athletes.length}`);

    // Update only existing story athletes
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const athlete of athletes) {
        if (athlete.campaign_type !== 'story') continue;

        const normalized = normalizeName(athlete.user_name);
        const metrics = metricsMap.get(normalized);

        if (metrics) {
            // Update metrics
            athlete.ig_story_1_views = metrics.views;
            athlete.ig_story_1_taps = metrics.taps;
            athlete.ig_story_1_replies = metrics.replies;
            athlete.ig_story_1_shares = metrics.shares;
            updated++;
            console.log(`✅ Updated: ${athlete.user_name} (views: ${metrics.views})`);
            metricsMap.delete(normalized); // Mark as processed
        } else {
            skipped++;
        }
    }

    // Log athletes in CSV but not in Firestore
    if (metricsMap.size > 0) {
        console.log(`\n⚠️  ${metricsMap.size} athletes in CSV not found in Firestore (not imported):`);
        for (const [name, data] of metricsMap) {
            console.log(`  - ${data.name}`);
            notFound++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Updated: ${updated} story athletes`);
    console.log(`  ⏭️  Skipped (no CSV data): ${skipped} story athletes`);
    console.log(`  ❌ Not in Firestore: ${notFound} CSV entries`);

    // Save
    await setDoc(docRef, {
        ...currentData,
        athletes,
        updatedAt: new Date().toISOString(),
        source: 'story-metrics-update'
    });
    console.log('\n✅ Saved to Firestore!');
}

updateStoryMetrics().catch(console.error);
