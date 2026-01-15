// Deduplicate scraped comments and update Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

async function deduplicateComments() {
    // Load scraped comments
    const scrapedRef = doc(db, 'campaigns', 'scraped_comments');
    const scrapedSnap = await getDoc(scrapedRef);
    const scraped = scrapedSnap.data() || { tiktok: [], instagram: [], lastScrapedAt: '' };

    console.log('=== BEFORE DEDUPLICATION ===');
    console.log('TikTok comments:', scraped.tiktok.length);
    console.log('Instagram comments:', scraped.instagram.length);

    // Dedupe function - keep first occurrence, prioritize higher likes
    function dedupe(comments) {
        const seen = new Map(); // text -> best comment

        for (const comment of comments) {
            const text = comment.text?.trim().toLowerCase();
            if (!text) continue;

            const existing = seen.get(text);
            if (!existing) {
                seen.set(text, comment);
            } else if ((comment.likes || 0) > (existing.likes || 0)) {
                // Keep the one with more likes
                seen.set(text, comment);
            }
        }

        return Array.from(seen.values());
    }

    // Dedupe both platforms
    const dedupedTiktok = dedupe(scraped.tiktok);
    const dedupedInstagram = dedupe(scraped.instagram);

    console.log('\n=== AFTER DEDUPLICATION ===');
    console.log('TikTok comments:', dedupedTiktok.length);
    console.log('Instagram comments:', dedupedInstagram.length);

    // Sort by likes (best first)
    dedupedTiktok.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    dedupedInstagram.sort((a, b) => (b.likes || 0) - (a.likes || 0));

    // Preview top comments
    console.log('\n=== TOP IG COMMENTS ===');
    dedupedInstagram.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. [${c.likes || 0} likes] ${c.text?.substring(0, 60)}...`);
    });

    console.log('\n=== TOP TIKTOK COMMENTS ===');
    dedupedTiktok.slice(0, 10).forEach((c, i) => {
        console.log(`${i + 1}. [${c.likes || 0} likes] ${c.text?.substring(0, 60)}...`);
    });

    // Save back to Firestore
    await setDoc(scrapedRef, {
        tiktok: dedupedTiktok,
        instagram: dedupedInstagram,
        lastScrapedAt: scraped.lastScrapedAt,
        deduplicatedAt: new Date().toISOString()
    });

    console.log('\n✅ Saved deduplicated comments to Firestore!');

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`TikTok: ${scraped.tiktok.length} → ${dedupedTiktok.length} (${scraped.tiktok.length - dedupedTiktok.length} duplicates removed)`);
    console.log(`Instagram: ${scraped.instagram.length} → ${dedupedInstagram.length} (${scraped.instagram.length - dedupedInstagram.length} duplicates removed)`);
}

deduplicateComments().catch(console.error);
