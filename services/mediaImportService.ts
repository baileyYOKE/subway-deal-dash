import { doc, updateDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// Type for media item
interface MediaItem {
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    instagramPermalink?: string;
    mediaType?: string;
}

interface CSVAthleteMedia {
    firstName: string;
    lastName: string;
    schoolId: string;
    clubId: string;
    sport: string;
    campaign: string;
    media: MediaItem[];
}

// Parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Parse combined_campaigns_with_media.csv into structured data
export function parseMediaCSV(csvText: string): CSVAthleteMedia[] {
    const lines = csvText.trim().split('\n');
    const athletes: CSVAthleteMedia[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace(/\r/g, '');
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);

        const firstName = parts[0]?.trim() || '';
        const lastName = parts[1]?.trim() || '';
        const schoolId = parts[2]?.trim() || '';
        const clubId = parts[3]?.trim() || '';
        const sport = parts[4]?.trim() || '';
        const campaign = parts[5]?.trim() || '';

        const media: MediaItem[] = [];

        // Parse up to 3 media items (columns 6-20)
        for (let m = 0; m < 3; m++) {
            const baseIdx = 6 + (m * 5);
            const imageUrl = parts[baseIdx]?.trim() || '';
            const videoUrl = parts[baseIdx + 1]?.trim() || '';
            const thumbnailUrl = parts[baseIdx + 2]?.trim() || '';
            const instagramPermalink = parts[baseIdx + 3]?.trim() || '';
            const mediaType = parts[baseIdx + 4]?.trim() || '';

            // Only add if we have at least one URL
            if (imageUrl || videoUrl || thumbnailUrl) {
                media.push({
                    imageUrl: imageUrl || undefined,
                    videoUrl: videoUrl || undefined,
                    thumbnailUrl: thumbnailUrl || undefined,
                    instagramPermalink: instagramPermalink || undefined,
                    mediaType: mediaType || undefined,
                });
            }
        }

        if (firstName && lastName) {
            athletes.push({
                firstName,
                lastName,
                schoolId,
                clubId,
                sport,
                campaign,
                media
            });
        }
    }

    return athletes;
}

// Match CSV athletes to Firestore athletes and update with media
export async function importMediaToFirestore(csvText: string): Promise<{
    matched: number;
    unmatched: string[];
    updated: number;
}> {
    const csvAthletes = parseMediaCSV(csvText);
    console.log(`[ImportMedia] Parsed ${csvAthletes.length} athletes from CSV`);

    // Get all Firestore athletes
    const athletesRef = collection(db, 'subway-deal-data');
    const snapshot = await getDocs(athletesRef);

    // Build lookup by name
    const firestoreAthletes = new Map<string, { id: string; data: Record<string, unknown> }>();
    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const name = (data.user_name as string || '').toLowerCase().trim();
        if (name) {
            firestoreAthletes.set(name, { id: docSnap.id, data });
        }
    });
    console.log(`[ImportMedia] Found ${firestoreAthletes.size} athletes in Firestore`);

    const matched: string[] = [];
    const unmatched: string[] = [];
    const updates: { docId: string; media: MediaItem[]; campaign: string }[] = [];

    // Match CSV athletes to Firestore
    for (const csvAthlete of csvAthletes) {
        const fullName = `${csvAthlete.firstName} ${csvAthlete.lastName}`.toLowerCase().trim();
        const firestoreAthlete = firestoreAthletes.get(fullName);

        if (firestoreAthlete) {
            matched.push(fullName);
            if (csvAthlete.media.length > 0) {
                updates.push({
                    docId: firestoreAthlete.id,
                    media: csvAthlete.media,
                    campaign: csvAthlete.campaign
                });
            }
        } else {
            unmatched.push(fullName);
        }
    }

    console.log(`[ImportMedia] Matched: ${matched.length}, Unmatched: ${unmatched.length}`);
    console.log(`[ImportMedia] Will update ${updates.length} athletes with media`);

    // Batch update Firestore
    const batchSize = 400; // Firestore limit is 500
    let updated = 0;

    for (let i = 0; i < updates.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchUpdates = updates.slice(i, i + batchSize);

        for (const update of batchUpdates) {
            const docRef = doc(db, 'subway-deal-data', update.docId);
            batch.update(docRef, {
                media: update.media,
                campaign: update.campaign
            });
        }

        await batch.commit();
        updated += batchUpdates.length;
        console.log(`[ImportMedia] Updated batch ${Math.floor(i / batchSize) + 1}, total: ${updated}`);
    }

    return {
        matched: matched.length,
        unmatched,
        updated
    };
}

// Get media for an athlete by name - now reads from Firestore
export async function getAthleteMediaFromFirestore(firstName: string, lastName: string): Promise<MediaItem[]> {
    const athletesRef = collection(db, 'subway-deal-data');
    const snapshot = await getDocs(athletesRef);

    const fullName = `${firstName} ${lastName}`.toLowerCase().trim();

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const name = (data.user_name || '').toLowerCase().trim();
        if (name === fullName && data.media) {
            return data.media as MediaItem[];
        }
    }

    return [];
}
