import { Athlete } from '../types';

// Apify API token (from environment)
const APIFY_TOKEN = import.meta.env.VITE_APIFY_TOKEN || '';
// Use tilde (~) for username/actor separation in API URLs
const ACTOR_ID = 'clockworks~tiktok-video-scraper';

export interface TikTokFetchResult {
  success: boolean;
  totalAthletes: number;
  athletesWithUrls: number;
  successfulFetches: number;
  failedFetches: number;
  failedUrls: string[];
  errors: string[];
  debugInfo: string[];
}

export const fetchTikTokData = async (athletes: Athlete[]): Promise<{ athletes: Athlete[], result: TikTokFetchResult }> => {
  const result: TikTokFetchResult = {
    success: false,
    totalAthletes: athletes.length,
    athletesWithUrls: 0,
    successfulFetches: 0,
    failedFetches: 0,
    failedUrls: [],
    errors: [],
    debugInfo: []
  };

  const athletesWithTikTok = athletes.filter(a => a.tiktok_post_url && a.tiktok_post_url.includes('tiktok.com'));
  result.athletesWithUrls = athletesWithTikTok.length;

  if (athletesWithTikTok.length === 0) {
    result.errors.push('No athletes have TikTok URLs');
    return { athletes, result };
  }

  const urlsToScrape = athletesWithTikTok.map(a => a.tiktok_post_url);
  console.log(`🎬 Starting TikTok fetch for ${urlsToScrape.length} URLs`);
  result.debugInfo.push(`Sending ${urlsToScrape.length} URLs to Apify`);

  try {
    // 1. Start the Actor run
    const startUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`;

    const runResponse = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startUrls: urlsToScrape.map(url => ({ url })),
        postURLs: urlsToScrape,
        proxyConfiguration: { useApifyProxy: true },
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
        commentsPerPost: 0,
      })
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      result.errors.push(`Apify API error: ${runResponse.status} - ${errorText}`);
      result.debugInfo.push(`Start run failed: ${runResponse.status}`);
      throw new Error(`Failed to start Apify run: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const datasetId = runData.data.defaultDatasetId;
    console.log(`✅ Apify run started: ${runId}`);
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
      result.debugInfo.push(`Run failed with status: ${status}`);
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

    if (!Array.isArray(items) || items.length === 0) {
      result.errors.push(`Apify returned ${items.length} results`);
      return { athletes, result };
    }

    // 4. Map results back to athletes using submittedVideoUrl for exact matching
    const updatedAthletes = [...athletes];
    const matchedUrls = new Set<string>();

    // Create a lookup map from submittedVideoUrl to item for O(1) matching
    const urlToItem = new Map<string, any>();
    items.forEach((item: any) => {
      // The key field is submittedVideoUrl - it matches exactly what we sent
      if (item.submittedVideoUrl) {
        urlToItem.set(item.submittedVideoUrl, item);
        console.log(`📎 Indexed: ${item.submittedVideoUrl}`);
      }
      // Also index by webVideoUrl as fallback
      if (item.webVideoUrl) {
        urlToItem.set(item.webVideoUrl, item);
      }
    });

    result.debugInfo.push(`Indexed ${urlToItem.size} URLs from results`);

    // Match athletes to results
    athletesWithTikTok.forEach(athlete => {
      const url = athlete.tiktok_post_url;
      const item = urlToItem.get(url);

      if (item && !matchedUrls.has(url)) {
        matchedUrls.add(url);

        // Update stats - fields are at root level
        athlete.tiktok_views = item.playCount || 0;
        athlete.tiktok_likes = item.diggCount || 0;
        athlete.tiktok_comments = item.commentCount || 0;
        athlete.tiktok_shares = item.shareCount || 0;

        result.successfulFetches++;
        console.log(`✅ ${athlete.user_name}: ${athlete.tiktok_views} views, ${athlete.tiktok_likes} likes`);
      }
    });

    // Track failures
    result.failedFetches = result.athletesWithUrls - result.successfulFetches;
    result.debugInfo.push(`Matched ${result.successfulFetches}/${result.athletesWithUrls} URLs`);

    if (result.failedFetches > 0) {
      const unmatchedAthletes = athletesWithTikTok
        .filter(a => !matchedUrls.has(a.tiktok_post_url));

      // Store all failed URLs for alerts
      result.failedUrls = unmatchedAthletes.map(a => a.tiktok_post_url);

      const examples = unmatchedAthletes.slice(0, 5).map(a => `${a.user_name}: ${a.tiktok_post_url}`).join('\n');
      result.errors.push(`${result.failedFetches} URLs not in results`);
      result.debugInfo.push(`Unmatched examples:\n${examples}`);
    }

    result.success = result.successfulFetches > 0;

    // Update athletes in the main array
    athletesWithTikTok.forEach(updated => {
      const idx = updatedAthletes.findIndex(a => a.id === updated.id);
      if (idx !== -1) {
        updatedAthletes[idx] = updated;
      }
    });

    return { athletes: updatedAthletes, result };

  } catch (error) {
    console.error("TikTok Refresh Error:", error);
    result.errors.push(String(error));
    result.debugInfo.push(`Exception: ${error}`);
    return { athletes, result };
  }
};