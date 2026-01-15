/**
 * One-time script to import media data from combined_campaigns_with_media.csv into Firestore
 * 
 * Run with: npx ts-node scripts/importMediaToFirestore.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple CSV parser
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

interface MediaItem {
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    instagramPermalink?: string;
    mediaType?: string;
}

interface CSVAthlete {
    firstName: string;
    lastName: string;
    sport: string;
    campaign: string;
    media: MediaItem[];
}

async function main() {
    // Read the CSV
    const csvPath = path.join(__dirname, '..', 'combined_campaigns_with_media.csv');
    console.log(`Reading CSV from: ${csvPath}`);

    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvText.trim().split('\n');

    console.log(`Found ${lines.length - 1} athletes in CSV`);

    const athletes: CSVAthlete[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].replace(/\r/g, '');
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);

        const firstName = parts[0]?.trim() || '';
        const lastName = parts[1]?.trim() || '';
        const sport = parts[4]?.trim() || '';
        const campaign = parts[5]?.trim() || '';

        const media: MediaItem[] = [];

        // Parse up to 3 media items
        for (let m = 0; m < 3; m++) {
            const baseIdx = 6 + (m * 5);
            const imageUrl = parts[baseIdx]?.trim() || '';
            const videoUrl = parts[baseIdx + 1]?.trim() || '';
            const thumbnailUrl = parts[baseIdx + 2]?.trim() || '';
            const instagramPermalink = parts[baseIdx + 3]?.trim() || '';
            const mediaType = parts[baseIdx + 4]?.trim() || '';

            if (imageUrl || videoUrl) {
                media.push({
                    imageUrl: imageUrl || undefined,
                    videoUrl: videoUrl || undefined,
                    thumbnailUrl: thumbnailUrl || undefined,
                    instagramPermalink: instagramPermalink || undefined,
                    mediaType: mediaType || undefined,
                });
            }
        }

        athletes.push({ firstName, lastName, sport, campaign, media });
    }

    console.log(`\nParsed ${athletes.length} athletes with media:`);

    // Count by campaign
    const byCampaign = new Map<string, number>();
    athletes.forEach(a => {
        byCampaign.set(a.campaign, (byCampaign.get(a.campaign) || 0) + 1);
    });
    console.log('\nBy campaign:');
    byCampaign.forEach((count, campaign) => {
        console.log(`  ${campaign}: ${count}`);
    });

    // Count athletes with media
    const withMedia = athletes.filter(a => a.media.length > 0).length;
    console.log(`\nAthletes with media: ${withMedia}`);

    // Output format for Firestore bulk update
    console.log('\n=== FIRESTORE UPDATE DATA ===');
    console.log('The following data needs to be added to Firestore athlete documents:');
    console.log('\nExample athlete:');
    const example = athletes.find(a => a.media.length > 0);
    if (example) {
        console.log(JSON.stringify({
            user_name: `${example.firstName} ${example.lastName}`,
            campaign: example.campaign,
            media: example.media
        }, null, 2));
    }

    // Create a JSON file with all the media data for import
    const outputPath = path.join(__dirname, '..', 'media_import_data.json');
    const importData = athletes.map(a => ({
        name: `${a.firstName} ${a.lastName}`.toLowerCase(),
        campaign: a.campaign,
        media: a.media
    }));

    fs.writeFileSync(outputPath, JSON.stringify(importData, null, 2));
    console.log(`\n✓ Export saved to: ${outputPath}`);
    console.log(`  Total athletes: ${importData.length}`);
    console.log(`  Athletes with media: ${importData.filter(a => a.media.length > 0).length}`);
}

main().catch(console.error);
