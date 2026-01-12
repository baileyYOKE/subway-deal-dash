/**
 * Media Service
 * Handles loading athlete media via secure API (no S3 URLs exposed to frontend)
 */

// Media item with hash (from list API)
export interface MediaWithHash {
    hash: string;
    mediaType?: string;
    instagramPermalink?: string;
    hasVideo: boolean;
    hasImage: boolean;
}

// Athlete info returned from list API (no S3 URLs)
export interface AthleteListItem {
    firstName: string;
    lastName: string;
    sport: string;
    campaign: string;
    school?: string;
    media: MediaWithHash[];
}

// Signed URLs returned from hash lookup
export interface SignedMediaUrls {
    signedImageUrl?: string | null;
    signedVideoUrl?: string | null;
    signedThumbnailUrl?: string | null;
}

// Combined media item with signed URLs (for display)
export interface SignedMediaItem extends SignedMediaUrls {
    mediaType?: string;
    instagramPermalink?: string;
    hasVideo: boolean;
    hasImage: boolean;
}

// Full athlete with all signed media
export interface AthleteMediaResponse {
    firstName: string;
    lastName: string;
    sport: string;
    campaign: string;
    media: SignedMediaItem[];
}

/**
 * Load list of athletes with media hashes (no S3 URLs exposed)
 */
export async function loadAthleteList(): Promise<AthleteListItem[]> {
    try {
        const response = await fetch('/api/athlete-media');
        if (!response.ok) {
            console.error('[mediaService] Failed to load athlete list:', response.status);
            return [];
        }

        const data = await response.json();
        return data.athletes || [];
    } catch (error) {
        console.error('[mediaService] Error loading athlete list:', error);
        return [];
    }
}

/**
 * Get signed URLs for a specific media hash
 */
export async function getSignedUrls(hash: string): Promise<SignedMediaUrls | null> {
    try {
        const response = await fetch(`/api/athlete-media?hash=${encodeURIComponent(hash)}`);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('[mediaService] Media not found:', hash);
                return null;
            }
            console.error('[mediaService] Failed to get signed URLs:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[mediaService] Error getting signed URLs:', error);
        return null;
    }
}

/**
 * Get all signed media for an athlete
 * Fetches signed URLs for all media items in parallel
 */
export async function getAthleteMedia(athlete: AthleteListItem): Promise<AthleteMediaResponse | null> {
    try {
        // Fetch signed URLs for all media items in parallel
        const signedMediaPromises = athlete.media.map(async (mediaItem): Promise<SignedMediaItem | null> => {
            const signedUrls = await getSignedUrls(mediaItem.hash);
            if (!signedUrls) return null;

            return {
                ...signedUrls,
                mediaType: mediaItem.mediaType,
                instagramPermalink: mediaItem.instagramPermalink,
                hasVideo: mediaItem.hasVideo,
                hasImage: mediaItem.hasImage,
            };
        });

        const results = await Promise.all(signedMediaPromises);
        const validMedia = results.filter((m): m is SignedMediaItem => m !== null);

        return {
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            sport: athlete.sport,
            campaign: athlete.campaign,
            media: validMedia,
        };
    } catch (error) {
        console.error('[mediaService] Error getting athlete media:', error);
        return null;
    }
}

/**
 * Find athlete in list by name
 */
export function findAthleteByName(
    athletes: AthleteListItem[],
    firstName: string,
    lastName: string
): AthleteListItem | undefined {
    const normalizedFirst = firstName.toLowerCase().trim();
    const normalizedLast = lastName.toLowerCase().trim();

    return athletes.find(
        a => a.firstName.toLowerCase() === normalizedFirst &&
            a.lastName.toLowerCase() === normalizedLast
    );
}

/**
 * Create a lookup map for quick athlete matching
 */
export function createAthleteLookup(athletes: AthleteListItem[]): Map<string, AthleteListItem> {
    const lookup = new Map<string, AthleteListItem>();

    for (const athlete of athletes) {
        // Key by "firstname-lastname" for matching with carousel
        const nameKey = `${athlete.firstName}-${athlete.lastName}`.toLowerCase();
        lookup.set(nameKey, athlete);
    }

    return lookup;
}
