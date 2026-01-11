/**
 * Comments Scraper Service
 * Uses Apify APIs to scrape comments from TikTok and Instagram
 * 
 * TikTok: clockworks/tiktok-comments-scraper
 * Instagram: apidojo/instagram-comments-scraper
 * 
 * IMPORTANT: All scraped results are saved to Firestore to preserve API costs
 */

import { APIFY_TOKEN, GEMINI_API_KEY } from './firebaseConfig';
import { saveScrapedComments, ScrapedCommentData } from './dataService';

// ============ TYPES ============

export interface ScrapedComment {
    id: string;
    text: string;
    platform: 'tiktok' | 'instagram';
    username: string;
    likes: number;
    postUrl: string;
    profilePicUrl?: string;  // Added for profile pictures
    sentimentScore?: number; // -1 to 1 scale
    isAuthentic?: boolean;   // True if not just "nice ad" type comment
    athleteName?: string;
}

export interface CommentScrapeResult {
    tiktokComments: ScrapedComment[];
    instagramComments: ScrapedComment[];
    totalScraped: number;
    errors: string[];
}

// ============ TIKTOK COMMENTS ============

const TIKTOK_COMMENTS_ACTOR = 'clockworks~tiktok-comments-scraper';

export const scrapeTikTokComments = async (videoUrls: string[], maxCommentsPerPost: number = 100): Promise<ScrapedComment[]> => {
    const allComments: ScrapedComment[] = [];

    if (videoUrls.length === 0) return [];

    try {
        console.log(`📱 Scraping TikTok comments for ${videoUrls.length} videos...`);

        const response = await fetch(
            `https://api.apify.com/v2/acts/${TIKTOK_COMMENTS_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postURLs: videoUrls,
                    maxComments: maxCommentsPerPost,
                    maxRepliesPerComment: 0
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('TikTok API error:', response.status, errorText);
            throw new Error(`Apify TikTok API error: ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                if (item.text) {
                    allComments.push({
                        id: item.id || Math.random().toString(36).substr(2, 9),
                        text: item.text,
                        platform: 'tiktok',
                        username: item.uniqueId || item.username || 'Unknown',
                        likes: item.diggCount || item.likes || 0,
                        postUrl: item.videoUrl || '',
                        // TikTok profile pic - try multiple field names
                        profilePicUrl: item.avatarThumb || item.avatarMedium || item.userAvatar || item.avatar || ''
                    });
                }
            });
        }

        console.log(`✅ Scraped ${allComments.length} TikTok comments`);

    } catch (e: any) {
        console.error('❌ TikTok comments scrape failed:', e);
        throw e;
    }

    return allComments;
};

// ============ INSTAGRAM COMMENTS ============

const INSTAGRAM_COMMENTS_ACTOR = 'apidojo~instagram-comments-scraper';

export const scrapeInstagramComments = async (postUrls: string[], maxCommentsPerPost: number = 100): Promise<ScrapedComment[]> => {
    const allComments: ScrapedComment[] = [];

    if (postUrls.length === 0) return [];

    try {
        console.log(`📸 Scraping Instagram comments for ${postUrls.length} posts...`);
        console.log('📸 First 3 IG URLs:', postUrls.slice(0, 3));

        const requestBody = {
            startUrls: postUrls,
            maxItems: maxCommentsPerPost * postUrls.length
        };

        const response = await fetch(
            `https://api.apify.com/v2/acts/${INSTAGRAM_COMMENTS_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        console.log('📸 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Instagram API error response:', errorText);
            throw new Error(`Apify Instagram API error: ${response.status} - ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        console.log('📸 Response length:', Array.isArray(data) ? data.length : 'N/A');

        // API returns: inputSource, postId, type, id, userId, message, createdAt, likeCount, replyCount, user, isRanked
        if (Array.isArray(data)) {
            data.forEach((item: any) => {
                const text = item.message || item.text || item.comment || item.body || item.content;
                if (text) {
                    allComments.push({
                        id: item.id || item.pk || Math.random().toString(36).substr(2, 9),
                        text: text,
                        platform: 'instagram',
                        username: item.user?.username || item.ownerUsername || item.username || 'Unknown',
                        likes: item.likeCount || item.likesCount || item.likes || 0,
                        postUrl: item.inputSource || item.postUrl || item.mediaUrl || '',
                        // Instagram profile pic from user object
                        profilePicUrl: item.user?.profilePicUrl || item.user?.profilePicture || item.profilePicUrl || ''
                    });
                }
            });
        }

        console.log(`✅ Scraped ${allComments.length} Instagram comments`);

    } catch (e: any) {
        console.error('❌ Instagram comments scrape failed:', e);
        throw e;
    }

    return allComments;
};

// ============ SCRAPE ALL COMMENTS ============

export interface ScrapeAllCommentsInput {
    tiktokUrls: string[];
    instagramUrls: string[];
    maxCommentsPerPost?: number;
}

export const scrapeAllComments = async (input: ScrapeAllCommentsInput): Promise<CommentScrapeResult> => {
    const maxComments = input.maxCommentsPerPost || 100;
    const errors: string[] = [];
    let tiktokComments: ScrapedComment[] = [];
    let instagramComments: ScrapedComment[] = [];

    console.log('🔄 Starting comment scrape for all posts...');
    console.log(`  TikTok URLs: ${input.tiktokUrls.length}`);
    console.log(`  Instagram URLs: ${input.instagramUrls.length}`);

    if (input.tiktokUrls.length > 0) {
        try {
            tiktokComments = await scrapeTikTokComments(input.tiktokUrls, maxComments);
        } catch (e: any) {
            errors.push(`TikTok: ${e.message}`);
        }
    }

    if (input.instagramUrls.length > 0) {
        try {
            instagramComments = await scrapeInstagramComments(input.instagramUrls, maxComments);
        } catch (e: any) {
            errors.push(`Instagram: ${e.message}`);
        }
    }

    tiktokComments.sort((a, b) => b.likes - a.likes);
    instagramComments.sort((a, b) => b.likes - a.likes);

    const totalScraped = tiktokComments.length + instagramComments.length;
    console.log(`✅ Total comments scraped: ${totalScraped}`);

    if (totalScraped > 0) {
        try {
            await saveScrapedComments({
                tiktok: tiktokComments.map(c => ({ ...c, scrapedAt: new Date().toISOString() })),
                instagram: instagramComments.map(c => ({ ...c, scrapedAt: new Date().toISOString() }))
            });
        } catch (e) {
            console.error('Failed to save scraped comments to cloud', e);
        }
    }

    return {
        tiktokComments,
        instagramComments,
        totalScraped,
        errors
    };
};

// ============ GEMINI SENTIMENT ANALYSIS ============

interface SentimentResult {
    id: string;           // Comment ID
    score: number;        // -1 to 1
    isAuthentic: boolean; // Not just "nice ad" type
    summary?: string;
}

// Analyze a batch of comments using Gemini
export const analyzeCommentsWithGemini = async (comments: ScrapedComment[]): Promise<ScrapedComment[]> => {
    if (!GEMINI_API_KEY || comments.length === 0) {
        console.log('⚠️ No Gemini API key or no comments to analyze');
        return comments;
    }

    try {
        console.log(`🤖 Analyzing ${comments.length} comments with Gemini...`);

        // Batch comments for analysis (max 50 at a time to avoid token limits)
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < comments.length; i += batchSize) {
            batches.push(comments.slice(i, i + batchSize));
        }

        const allAnalyzed: ScrapedComment[] = [];

        for (const batch of batches) {
            const prompt = `Analyze these social media comments for sentiment. For each comment, return a JSON array with:
- id: the comment id
- score: sentiment score from -1 (very negative) to 1 (very positive)
- isAuthentic: true if it's a genuine positive reaction (excited, hungry, wants the product), false if it's generic ("nice ad", "cool"), spam, or mentions they're being paid

Comments to analyze:
${batch.map((c, i) => `${i + 1}. [ID: ${c.id}] "${c.text}"`).join('\n')}

Return ONLY a valid JSON array like: [{"id": "...", "score": 0.8, "isAuthentic": true}, ...]`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                }
            );

            if (response.ok) {
                const data = await response.json();
                const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Extract JSON from response
                const jsonMatch = textResponse.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    try {
                        const results = JSON.parse(jsonMatch[0]) as SentimentResult[];

                        // Merge results back into comments
                        batch.forEach(comment => {
                            const result = results.find(r => r.id === comment.id);
                            if (result) {
                                comment.sentimentScore = result.score;
                                comment.isAuthentic = result.isAuthentic;
                            }
                        });
                    } catch (parseError) {
                        console.error('Failed to parse Gemini response:', parseError);
                    }
                }
            }

            allAnalyzed.push(...batch);
        }

        console.log(`✅ Analyzed ${allAnalyzed.length} comments`);
        return allAnalyzed;

    } catch (e: any) {
        console.error('❌ Gemini analysis failed:', e);
        return comments;
    }
};

// ============ FILTER AUTHENTIC POSITIVE COMMENTS ============

export const filterAuthenticPositiveComments = (comments: ScrapedComment[], limit: number = 50): ScrapedComment[] => {
    return comments
        .filter(c => c.isAuthentic === true && (c.sentimentScore || 0) > 0.3)
        .sort((a, b) => (b.sentimentScore || 0) - (a.sentimentScore || 0))
        .slice(0, limit);
};

// ============ WORD CLOUD DATA ============

// Positive words to include in word cloud
const POSITIVE_WORD_SET = new Set([
    'love', 'amazing', 'awesome', 'great', 'best', 'perfect', 'fire', 'delicious',
    'yummy', 'hungry', 'need', 'want', 'obsessed', 'incredible', 'fantastic',
    'beautiful', 'incredible', 'goat', 'legend', 'king', 'queen', 'favorite',
    'subway', 'sandwich', 'fresh', 'tasty', 'good', 'nice', 'cool', 'yes',
    'absolutely', 'definitely', 'totally', 'literally', 'finally', 'omg',
    'blessed', 'lucky', 'excited', 'happy', 'proud', 'congratulations'
]);

// Words to exclude (too generic or negative)
const EXCLUDE_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
    'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'what', 'which',
    'who', 'whom', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'like', 'get', 'got',
    'ad', 'sponsored', 'paid', 'promotion', 'promo'
]);

export interface WordCloudItem {
    text: string;
    value: number;
}

export const generateWordCloudData = (comments: ScrapedComment[], minCount: number = 2): WordCloudItem[] => {
    const wordCounts: Map<string, number> = new Map();

    comments.forEach(comment => {
        // Only use authentic positive comments
        if (comment.isAuthentic !== false && (comment.sentimentScore === undefined || comment.sentimentScore > 0)) {
            const words = comment.text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2);

            words.forEach(word => {
                if (!EXCLUDE_WORDS.has(word)) {
                    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
                }
            });
        }
    });

    // Convert to array and filter by minimum count
    const wordCloud = Array.from(wordCounts.entries())
        .filter(([_, count]) => count >= minCount)
        .map(([text, value]) => ({ text, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 100); // Top 100 words

    console.log(`📊 Generated word cloud with ${wordCloud.length} words`);
    return wordCloud;
};

// ============ LEGACY FILTERS ============

export const filterTopComments = (comments: ScrapedComment[], limit: number = 200): ScrapedComment[] => {
    const filtered = comments.filter(c => {
        const text = c.text.toLowerCase();
        if (c.text.length < 5) return false;
        if (text.includes('follow me') || text.includes('check my')) return false;
        return true;
    });
    return filtered.sort((a, b) => b.likes - a.likes).slice(0, limit);
};

const POSITIVE_INDICATORS = [
    '🔥', '❤️', '💯', '😍', '👏', '🙌', '💪', '😊', '🤩', '👑',
    'fire', 'love', 'amazing', 'awesome', 'great', 'best', 'perfect',
    'need', 'want', 'finally', 'yes', 'goat', 'legend', 'king', 'queen',
    'yum', 'hungry', 'delicious', 'ordering', 'getting', 'downloading'
];

export const findPositiveComments = (comments: ScrapedComment[], limit: number = 100): ScrapedComment[] => {
    const scored = comments.map(c => {
        const text = c.text.toLowerCase();
        let score = c.likes;

        POSITIVE_INDICATORS.forEach(indicator => {
            if (text.includes(indicator.toLowerCase()) || c.text.includes(indicator)) {
                score += 10;
            }
        });

        if (c.text.length > 30) score += 5;
        if (c.text.length > 60) score += 10;

        return { ...c, score };
    });

    return scored
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, limit);
};
