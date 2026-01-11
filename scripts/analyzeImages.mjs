/**
 * Image Analysis Script
 * Uses Gemini Vision API to determine if each athlete image is a real person or a logo/mascot
 * Run with: node scripts/analyzeImages.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = 'AIzaSyCLMEfNZ5gIuCK_l1c9oEFBXnljl8jXbvY';

// Parse CSV
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const athletes = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = [];
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

// Fetch image and convert to base64
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    } catch (e) {
        console.error(`Error fetching ${imageUrl}:`, e.message);
        return null;
    }
}

async function analyzeImageWithBase64(imageUrl, name) {
    try {
        const base64 = await fetchImageAsBase64(imageUrl);
        if (!base64) return true;

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
        const result = text.trim().toUpperCase();
        console.log(`  -> ${result}`);
        return result === 'PERSON';
    } catch (e) {
        console.error(`Error analyzing:`, e.message);
        return true;
    }
}

async function main() {
    const csvPath = path.join(__dirname, '..', 'public', 'subway_deal_with_images.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const athletes = parseCSV(csvText);

    const withImages = athletes.filter(a => a.hasImage === 'YES' && a.imageUrl.startsWith('http'));
    console.log(`Found ${withImages.length} athletes with images. Analyzing...`);

    const results = [];
    const notPeople = [];

    for (let i = 0; i < withImages.length; i++) {
        const athlete = withImages[i];
        const name = `${athlete.firstName} ${athlete.lastName}`;
        console.log(`[${i + 1}/${withImages.length}] ${name}`);

        const isPerson = await analyzeImageWithBase64(athlete.imageUrl, name);
        results.push({ url: athlete.imageUrl, isPerson, name });

        if (!isPerson) {
            notPeople.push({ name, url: athlete.imageUrl });
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 300));
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Total: ${results.length}`);
    console.log(`Real people: ${results.filter(r => r.isPerson).length}`);
    console.log(`Logos/mascots: ${notPeople.length}`);

    if (notPeople.length > 0) {
        console.log(`\n=== NOT REAL PEOPLE ===`);
        notPeople.forEach(r => console.log(`- ${r.name}: ${r.url}`));
    }

    // Save to JSON
    const outputPath = path.join(__dirname, '..', 'public', 'image_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
