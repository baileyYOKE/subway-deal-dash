import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Brand deal ID for "IG Story" campaign (Deal #1 - matches carousel athletes)
// Note: "Complete Partnership" campaign (Deal #2: 6940ab2db1b5bacae82de3d8) has different athletes
const BRAND_DEAL_ID = '694830dca630d563ba4c77c1';

// S3 bucket to CloudFront domain mapping
const S3_TO_CLOUDFRONT: Record<string, string> = {
    'production-nilclub-infra-sto-uploadsbucketc4b27cc7-gju0hr4jkzsi.s3.us-east-1.amazonaws.com': 'd1lzo0ysca17ae.cloudfront.net',
    'production-nilclub-infra-sto-uploadsbucketc4b27cc7-gju0hr4jkzsi.s3.amazonaws.com': 'd1lzo0ysca17ae.cloudfront.net',
};

interface MediaItem {
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    instagramPermalink?: string;
    mediaType?: string;
}

interface AthleteRecord {
    firstName: string;
    lastName: string;
    sport: string;
    campaign: string;
    media: MediaItem[];
}

// Cache: hash -> S3 URL mapping (for signing)
let urlHashMap: Map<string, string> | null = null;
// Cache: athlete data with hashes
let athleteCache: AthleteWithHashes[] | null = null;

interface MediaWithHash {
    hash: string;
    mediaType?: string;
    instagramPermalink?: string;
    hasVideo: boolean;
    hasImage: boolean;
}

interface AthleteWithHashes {
    firstName: string;
    lastName: string;
    sport: string;
    campaign: string;
    school?: string;
    media: MediaWithHash[];
}

/**
 * Generate a short hash for a URL
 */
function hashUrl(url: string): string {
    return crypto.createHash('sha256').update(url).digest('hex').substring(0, 12);
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
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
    return parts;
}

/**
 * Check if a URL belongs to the target brand deal
 */
function isTargetBrandDeal(url: string): boolean {
    return url.includes(`brand-deals/${BRAND_DEAL_ID}`);
}

/**
 * Load and process athlete data from CSV
 */
function loadAthleteData(): { athletes: AthleteWithHashes[]; hashMap: Map<string, string> } {
    if (athleteCache && urlHashMap) {
        return { athletes: athleteCache, hashMap: urlHashMap };
    }

    const csvPath = path.join(process.cwd(), 'combined_campaigns_with_media.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvText.trim().split('\n');

    const athletes: AthleteWithHashes[] = [];
    const hashMap = new Map<string, string>();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const parts = parseCSVLine(line);

        const firstName = parts[0]?.trim() || '';
        const lastName = parts[1]?.trim() || '';
        const sport = parts[4]?.trim() || '';
        const campaign = parts[5]?.trim() || '';

        const mediaItems: MediaWithHash[] = [];

        // Parse up to 3 media items per row
        for (let m = 0; m < 3; m++) {
            const baseIdx = 6 + (m * 5);
            const imageUrl = parts[baseIdx]?.trim() || '';
            const videoUrl = parts[baseIdx + 1]?.trim() || '';
            const thumbnailUrl = parts[baseIdx + 2]?.trim() || '';
            const instagramPermalink = parts[baseIdx + 3]?.trim() || '';
            const mediaType = parts[baseIdx + 4]?.trim() || '';

            // Skip if no URLs or not from target brand deal
            const hasImage = imageUrl && isTargetBrandDeal(imageUrl);
            const hasVideo = videoUrl && isTargetBrandDeal(videoUrl);
            const hasThumbnail = thumbnailUrl && isTargetBrandDeal(thumbnailUrl);

            if (!hasImage && !hasVideo && !hasThumbnail) continue;

            // Use video URL as primary hash key, fallback to image
            const primaryUrl = videoUrl || imageUrl || thumbnailUrl;
            const hash = hashUrl(primaryUrl);

            // Store all URLs in hash map for later signing
            if (imageUrl && isTargetBrandDeal(imageUrl)) {
                hashMap.set(`${hash}-image`, imageUrl);
            }
            if (videoUrl && isTargetBrandDeal(videoUrl)) {
                hashMap.set(`${hash}-video`, videoUrl);
            }
            if (thumbnailUrl && isTargetBrandDeal(thumbnailUrl)) {
                hashMap.set(`${hash}-thumbnail`, thumbnailUrl);
            }

            mediaItems.push({
                hash,
                mediaType: mediaType || undefined,
                instagramPermalink: instagramPermalink || undefined,
                hasVideo: !!hasVideo,
                hasImage: !!hasImage,
            });
        }

        // Only include athletes with media from target brand deal
        if (mediaItems.length > 0) {
            athletes.push({
                firstName,
                lastName,
                sport,
                campaign,
                media: mediaItems,
            });
        }
    }

    // Cache the results
    athleteCache = athletes;
    urlHashMap = hashMap;

    return { athletes, hashMap };
}

/**
 * Convert S3 URL to CloudFront path
 */
function getCloudFrontPath(s3Url: string): string | null {
    try {
        const url = new URL(s3Url);
        const cloudFrontDomain = S3_TO_CLOUDFRONT[url.host];
        if (!cloudFrontDomain) return null;
        return url.pathname;
    } catch {
        return null;
    }
}

/**
 * Get signed URL from signing API
 */
async function getSignedUrl(resourceKey: string): Promise<string | null> {
    const signingApiUrl = process.env.SST_CF_SIGNING_API_URL;
    if (!signingApiUrl) {
        console.error('[athlete-media] SST_CF_SIGNING_API_URL not configured');
        return null;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
            `${signingApiUrl}/api/generate-signed-url`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceKey }),
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error('[athlete-media] Signing API error:', response.status);
            return null;
        }

        const data = await response.json();
        return data.url as string;
    } catch (error) {
        console.error('[athlete-media] Error getting signed URL:', error);
        return null;
    }
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
): Promise<void> {
    try {
        const { hash } = req.query;

        // GET /api/athlete-media - List all athletes with media hashes
        if (req.method === 'GET' && !hash) {
            try {
                const { athletes } = loadAthleteData();
                res.status(200).json({ athletes });
            } catch (error) {
                console.error('[athlete-media] Error loading athletes:', error);
                res.status(500).json({ error: 'Internal server error', details: String(error) });
            }
            return;
        }

    // GET /api/athlete-media?hash=xxx - Get signed URLs for a specific media item
    if (req.method === 'GET' && hash && typeof hash === 'string') {
        try {
            const { hashMap } = loadAthleteData();

            const imageUrl = hashMap.get(`${hash}-image`);
            const videoUrl = hashMap.get(`${hash}-video`);
            const thumbnailUrl = hashMap.get(`${hash}-thumbnail`);

            if (!imageUrl && !videoUrl && !thumbnailUrl) {
                res.status(404).json({ error: 'Media not found' });
                return;
            }

            // Sign the URLs
            const result: Record<string, string | null> = {};

            if (imageUrl) {
                const resourceKey = getCloudFrontPath(imageUrl);
                result.signedImageUrl = resourceKey ? await getSignedUrl(resourceKey) : null;
            }

            if (videoUrl) {
                const resourceKey = getCloudFrontPath(videoUrl);
                result.signedVideoUrl = resourceKey ? await getSignedUrl(resourceKey) : null;
            }

            if (thumbnailUrl) {
                const resourceKey = getCloudFrontPath(thumbnailUrl);
                result.signedThumbnailUrl = resourceKey ? await getSignedUrl(resourceKey) : null;
            }

            res.status(200).json(result);
        } catch (error) {
            console.error('[athlete-media] Error signing URLs:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
        return;
    }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[athlete-media] Unhandled error:', error);
        res.status(500).json({ error: 'Unhandled server error', details: String(error) });
    }
}
