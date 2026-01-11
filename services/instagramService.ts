import { Athlete } from '../types';

// Apify API token (from environment)
const APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || '';
// Instagram scraper actor ID
const ACTOR_ID = 'nH2AHrwxeTRJoN5hX';

export interface InstagramVerifyResult {
    success: boolean;
    totalAthletes: number;
    athletesWithUrls: number;
    verifiedPosts: number;
    failedPosts: number;
    failedUrls: string[];
    errors: string[];
    debugInfo: string[];
}

export const verifyInstagramReels = async (athletes: Athlete[]): Promise<{ result: InstagramVerifyResult }> => {
    const result: InstagramVerifyResult = {
        success: false,
        totalAthletes: athletes.length,
        athletesWithUrls: 0,
        verifiedPosts: 0,
        failedPosts: 0,
        failedUrls: [],
        errors: [],
        debugInfo: []
    };

    // Find athletes with Instagram Reel URLs
    const athletesWithReels = athletes.filter(a =>
        a.ig_reel_url &&
        (a.ig_reel_url.includes('instagram.com') || a.ig_reel_url.includes('instagr.am'))
    );
    result.athletesWithUrls = athletesWithReels.length;

    if (athletesWithReels.length === 0) {
        result.errors.push('No athletes have Instagram Reel URLs');
        return { result };
    }

    const urlsToVerify = athletesWithReels.map(a => a.ig_reel_url);
    console.log(`📸 Starting Instagram Reel verification for ${urlsToVerify.length} URLs`);
    result.debugInfo.push(`Sending ${urlsToVerify.length} URLs to Apify`);

    try {
        // 1. Start the Actor run
        const startUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`;

        const runResponse = await fetch(startUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: urlsToVerify,
                resultsLimit: 1,
                skipPinnedPosts: true
            })
        });

        if (!runResponse.ok) {
            const errorText = await runResponse.text();
            result.errors.push(`Apify API error: ${runResponse.status} - ${errorText}`);
            throw new Error(`Failed to start Apify run: ${runResponse.statusText}`);
        }

        const runData = await runResponse.json();
        const runId = runData.data.id;
        const datasetId = runData.data.defaultDatasetId;
        console.log(`✅ Apify Instagram run started: ${runId}`);
        result.debugInfo.push(`Run started: ${runId}`);

        // 2. Poll for completion (5 minutes max)
        let status = runData.data.status;
        let attempts = 0;
        const maxAttempts = 60;

        while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED' && status !== 'TIMED-OUT') {
            if (attempts >= maxAttempts) {
                result.errors.push('Polling timed out after 5 minutes');
                throw new Error('Apify run timed out');
            }

            await new Promise(r => setTimeout(r, 5000));
            attempts++;

            const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
            if (!statusRes.ok) continue;

            const statusData = await statusRes.json();
            status = statusData.data.status;
            console.log(`⏳ Poll ${attempts}: ${status}`);
        }

        if (status !== 'SUCCEEDED') {
            result.errors.push(`Apify run ended with status: ${status}`);
            throw new Error(`Apify run ${status}`);
        }

        result.debugInfo.push(`Run SUCCEEDED after ${attempts} polls`);

        // 3. Fetch results
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`);
        if (!resultsRes.ok) {
            throw new Error('Failed to fetch dataset items');
        }

        const items = await resultsRes.json();
        console.log(`📊 Received ${items.length} results from Apify`);
        result.debugInfo.push(`Received ${items.length} items from dataset`);

        if (!Array.isArray(items)) {
            result.errors.push('Invalid dataset format received');
            throw new Error('Invalid dataset format');
        }

        // 4. Check each result - a post is VALID only if there's no error field
        // Posts that are deleted/private return {"url": "...", "error": "restricted_page"}
        const verifiedUrls = new Set<string>();
        const errorUrls = new Set<string>();

        items.forEach((item: any) => {
            const itemUrl = item.url || item.inputUrl || '';

            // Check if this result has an error field - that means the post is unavailable
            if (item.error) {
                console.log(`❌ Error for ${itemUrl}: ${item.error}`);
                // Mark as failed
                athletesWithReels.forEach(athlete => {
                    if (athlete.ig_reel_url && urlsMatch(itemUrl, athlete.ig_reel_url)) {
                        errorUrls.add(athlete.ig_reel_url);
                    }
                });
            } else {
                // No error = post is valid
                console.log(`✅ Valid: ${itemUrl}`);
                athletesWithReels.forEach(athlete => {
                    if (athlete.ig_reel_url && urlsMatch(itemUrl, athlete.ig_reel_url)) {
                        verifiedUrls.add(athlete.ig_reel_url);
                    }
                });
            }
        });

        // Remove any that were in error set from verified set
        errorUrls.forEach(url => verifiedUrls.delete(url));

        result.verifiedPosts = verifiedUrls.size;

        // Failed = athletes with URLs that either had errors OR no results at all
        const failedAthletes = athletesWithReels.filter(a =>
            !verifiedUrls.has(a.ig_reel_url)
        );

        result.failedPosts = failedAthletes.length;
        result.failedUrls = failedAthletes.map(a => a.ig_reel_url);

        if (result.failedPosts > 0) {
            const examples = failedAthletes.slice(0, 5).map(a => `${a.user_name}: ${a.ig_reel_url}`).join('\n');
            result.errors.push(`${result.failedPosts} Reels unavailable or not found`);
            result.debugInfo.push(`Failed examples:\n${examples}`);
        }

        result.success = true;
        result.debugInfo.push(`Verified ${result.verifiedPosts}/${result.athletesWithUrls} Reels`);
        result.debugInfo.push(`Errors in results: ${errorUrls.size}`);

        return { result };

    } catch (error) {
        console.error("Instagram Verification Error:", error);
        result.errors.push(String(error));
        result.debugInfo.push(`Exception: ${error}`);
        return { result };
    }
};

// Helper to match URLs that may have different formats
function urlsMatch(url1: string, url2: string): boolean {
    // Normalize: lowercase, remove trailing slashes, remove query params for matching
    const normalize = (u: string) => {
        const base = u.toLowerCase()
            .replace(/\/$/, '')
            .split('?')[0]  // Remove query params
            .replace('/p/', '/reel/')  // Instagram sometimes uses /p/ for reels
            .replace('instagr.am', 'instagram.com');
        return base;
    };

    const n1 = normalize(url1);
    const n2 = normalize(url2);

    // Exact match or one contains the other
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}
