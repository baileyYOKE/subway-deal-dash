// Fix profile images - separate profile headshots from S3 content URLs
// Profile images: college roster URLs (*.edu, cloudfront, etc.)
// Content URLs: S3 production-nilclub-infra URLs
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

function isS3ContentUrl(url) {
    if (!url) return false;
    return url.includes('production-nilclub-infra') || url.includes('s3.us-east-1.amazonaws.com');
}

function isValidProfileUrl(url) {
    if (!url) return false;
    // Should NOT be S3 content URL
    if (isS3ContentUrl(url)) return false;
    // Should be a valid image URL
    return url.startsWith('http');
}

async function fixProfileImages() {
    // Load college roster profile images
    const profileCsv = readFileSync('./athletes_images.csv', 'utf-8');
    const profileLines = profileCsv.split('\n').slice(1);

    const profileImageMap = new Map();
    for (const line of profileLines) {
        const parts = line.split(',');
        const firstName = parts[0]?.trim();
        const lastName = parts[1]?.trim();
        const imageUrl = parts[3]?.trim();

        if (firstName && lastName && imageUrl && !isS3ContentUrl(imageUrl)) {
            const fullName = `${firstName} ${lastName}`.toLowerCase();
            profileImageMap.set(fullName, imageUrl);
        }
    }
    console.log(`📷 Loaded ${profileImageMap.size} college profile images`);

    // Load S3 content URLs from combined_media.csv
    const mediaCsv = readFileSync('./combined_media.csv', 'utf-8');
    const mediaLines = mediaCsv.split('\n').slice(1);

    const contentMap = new Map(); // name -> { imageUrl, videoUrl, thumbnailUrl, igPermalink, mediaType }
    for (const line of mediaLines) {
        const parts = parseCSVLine(line);
        const firstName = parts[0]?.trim();
        const lastName = parts[1]?.trim();
        const campaign = parts[5]?.trim();
        const imageUrl1 = parts[6]?.trim();
        const videoUrl1 = parts[7]?.trim();
        const thumbnailUrl1 = parts[8]?.trim();
        const igPermalink1 = parts[9]?.trim();
        const mediaType1 = parts[10]?.trim();

        if (!firstName || !lastName) continue;

        const fullName = `${firstName} ${lastName}`.toLowerCase();

        // Prefer video content for video campaigns, image for stories
        if (!contentMap.has(fullName)) {
            contentMap.set(fullName, {
                campaign: campaign,
                imageUrl: imageUrl1 || '',
                videoUrl: videoUrl1 || '',
                thumbnailUrl: thumbnailUrl1 || '',
                igPermalink: igPermalink1 || '',
                mediaType: mediaType1 || ''
            });
        }
    }
    console.log(`🎬 Loaded ${contentMap.size} content URLs from media CSV`);

    // Load and fix athletes
    const docRef = doc(db, 'campaigns', 'subway-deal-2-dash');
    const docSnap = await getDoc(docRef);
    const currentData = docSnap.exists() ? docSnap.data() : { athletes: [] };
    const athletes = currentData.athletes || [];

    console.log(`📊 Processing ${athletes.length} athletes`);

    let fixedProfile = 0;
    let addedContent = 0;
    let clearedBadProfile = 0;

    for (const athlete of athletes) {
        const normalized = athlete.user_name?.toLowerCase().trim();

        // Fix profile image: clear if it's an S3 URL, set from college roster if available
        if (isS3ContentUrl(athlete.profile_image_url)) {
            athlete.profile_image_url = '';
            clearedBadProfile++;
        }

        // Set profile image from college roster if we don't have one
        if (!isValidProfileUrl(athlete.profile_image_url)) {
            const collegeProfileUrl = profileImageMap.get(normalized);
            if (collegeProfileUrl) {
                athlete.profile_image_url = collegeProfileUrl;
                fixedProfile++;
            }
        }

        // Add content URL
        const content = contentMap.get(normalized);
        if (content) {
            if (athlete.campaign_type === 'video') {
                // Video athletes: use video URL or IG reel
                athlete.content_video_url = content.videoUrl || '';
                athlete.content_thumbnail_url = content.thumbnailUrl || '';
                athlete.ig_reel_url = athlete.ig_reel_url || content.igPermalink || '';
            } else {
                // Story athletes: use image URL 
                athlete.content_image_url = content.imageUrl || '';
                athlete.ig_story_url = content.igPermalink || '';
            }
            addedContent++;
        }
    }

    // Count results
    const withProfileImage = athletes.filter(a => isValidProfileUrl(a.profile_image_url)).length;
    const videoWithContent = athletes.filter(a => a.campaign_type === 'video' && (a.content_video_url || a.ig_reel_url)).length;
    const storyWithContent = athletes.filter(a => a.campaign_type === 'story' && a.content_image_url).length;

    console.log(`\n📊 Results:`);
    console.log(`  🧹 Cleared bad S3 profile URLs: ${clearedBadProfile}`);
    console.log(`  📷 Fixed profile images: ${fixedProfile}`);
    console.log(`  🎬 Added content URLs: ${addedContent}`);
    console.log(`  ✅ Athletes with profile image: ${withProfileImage}/${athletes.length}`);
    console.log(`  🎬 Video athletes with content: ${videoWithContent}/85`);
    console.log(`  📸 Story athletes with content: ${storyWithContent}/333`);

    // Save
    await setDoc(docRef, {
        ...currentData,
        athletes,
        updatedAt: new Date().toISOString(),
        source: 'fix-profile-content-separation'
    });
    console.log('\n✅ Saved to Firestore!');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line?.length || 0; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
        else current += char;
    }
    result.push(current);
    return result;
}

fixProfileImages().catch(console.error);
