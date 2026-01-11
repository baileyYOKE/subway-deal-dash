/**
 * Image Analysis Script
 * Uses Gemini Vision API to determine if each athlete image is a real person or a logo/mascot
 * Run with: npx ts-node scripts/analyzeImages.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const GEMINI_API_KEY = 'AIzaSyCLMEfNZ5gIuCK_l1c9oEFBXnljl8jXbvY'; // Firebase API key

interface AthleteImage {
    firstName: string;
    lastName: string;
    schoolName: string;
    sport: string;
    imageUrl: string;
    hasImage: string;
    isPerson?: boolean;
}

// Parse CSV
function parseCSV(csvText: string): AthleteImage[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(',');
    const athletes: AthleteImage[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current);

        athletes.push({
            firstName: parts[0]?.trim() || '',
            lastName: parts[1]?.trim() || '',
            schoolName: parts[3]?.trim() || '',
            sport: parts[4]?.trim() || '',
            imageUrl: parts[5]?.trim() || '',
            hasImage: parts[6]?.trim() || ''
        });
    }

    return athletes;
}

// Analyze a single image with Gemini
async function analyzeImage(imageUrl: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: "Look at this image. Is this a photograph of a real human person (like a headshot or portrait), or is it a logo, mascot, illustration, cartoon, or placeholder image? Reply with ONLY 'PERSON' or 'NOT_PERSON'. Nothing else."
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: '' // We'll use URL instead
                                }
                            },
                            {
                                fileData: {
                                    mimeType: 'image/jpeg',
                                    fileUri: imageUrl
                                }
                            }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text.trim().toUpperCase().includes('PERSON') && !text.trim().toUpperCase().includes('NOT_PERSON');
    } catch (e) {
        console.error(`Error analyzing ${imageUrl}:`, e);
        return true; // Assume person if error
    }
}

// Alternative: fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    } catch (e) {
        console.error(`Error fetching ${imageUrl}:`, e);
        return null;
    }
}

async function analyzeImageWithBase64(imageUrl: string): Promise<boolean> {
    try {
        const base64 = await fetchImageAsBase64(imageUrl);
        if (!base64) return true; // Assume person if can't fetch

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: "Is this a photograph of a real human person (headshot/portrait), or is it a logo, mascot, illustration, cartoon, animal, or placeholder? Reply with ONLY the word 'PERSON' or 'LOGO'. Nothing else."
                            },
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: base64
                                }
                            }
                        ]
                    }]
                })
            }
        );

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`  -> ${text.trim()}`);
        return text.trim().toUpperCase() === 'PERSON';
    } catch (e) {
        console.error(`Error analyzing ${imageUrl}:`, e);
        return true;
    }
}

async function main() {
    // Read CSV
    const csvPath = path.join(__dirname, '..', 'public', 'subway_deal_with_images.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const athletes = parseCSV(csvText);

    // Filter to only those with images
    const withImages = athletes.filter(a => a.hasImage === 'YES' && a.imageUrl.startsWith('http'));
    console.log(`Found ${withImages.length} athletes with images. Analyzing...`);

    const results: { url: string; isPerson: boolean; name: string }[] = [];

    // Process in batches to avoid rate limits
    for (let i = 0; i < withImages.length; i++) {
        const athlete = withImages[i];
        console.log(`[${i + 1}/${withImages.length}] ${athlete.firstName} ${athlete.lastName}`);

        const isPerson = await analyzeImageWithBase64(athlete.imageUrl);
        results.push({
            url: athlete.imageUrl,
            isPerson,
            name: `${athlete.firstName} ${athlete.lastName}`
        });

        // Rate limit: wait 500ms between requests
        await new Promise(r => setTimeout(r, 500));
    }

    // Save results
    const notPeople = results.filter(r => !r.isPerson);
    console.log(`\n=== RESULTS ===`);
    console.log(`Total analyzed: ${results.length}`);
    console.log(`Real people: ${results.filter(r => r.isPerson).length}`);
    console.log(`Logos/mascots: ${notPeople.length}`);

    console.log(`\n=== NOT REAL PEOPLE (to filter out) ===`);
    notPeople.forEach(r => console.log(`- ${r.name}: ${r.url}`));

    // Save to JSON for the app to use
    const outputPath = path.join(__dirname, '..', 'public', 'image_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
