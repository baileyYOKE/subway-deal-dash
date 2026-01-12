// Script to extract valid athlete names from baseline CSV and match to image CSV
import fs from 'fs';
import path from 'path';

// Read baseline CSV
const baselineCSV = fs.readFileSync('/Users/baileyosullivan/.gemini/subway-deal-dash/public/subway_baseline_beforecomments.csv', 'utf-8');
const lines = baselineCSV.split('\n');

// Get header
const header = lines[0];
console.log('Header:', header.substring(0, 200));

// Parse properly - the CSV has complex JSON, but user_full_name is early in each line
const validAthleteNames = new Set();

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // user_full_name is the 3rd column (index 2)
    // Split only the first few fields before JSON mess
    const simpleMatch = line.match(/^[^,]+,([^,]+),([^,]+),/);
    if (simpleMatch) {
        const name = simpleMatch[2].trim();
        // Filter out garbage - valid names are just words
        if (name &&
            !name.includes('"') &&
            !name.includes('{') &&
            !name.includes('views') &&
            name.length > 2 &&
            name.length < 50 &&
            /^[A-Za-z\s\-\'\.]+$/.test(name)) {
            validAthleteNames.add(name);
        }
    }
}

console.log(`\nFound ${validAthleteNames.size} unique valid athlete names:\n`);
const sortedNames = Array.from(validAthleteNames).sort();
sortedNames.forEach(name => console.log(name));

// Save to file
fs.writeFileSync('/Users/baileyosullivan/.gemini/subway-deal-dash/public/baseline_athletes.json',
    JSON.stringify(sortedNames, null, 2));

console.log(`\nSaved to baseline_athletes.json`);
