import { Athlete, CampaignType } from '../types';
import { db } from './firebaseConfig';
import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import Papa from 'papaparse';

const STORAGE_KEY = 'subway_deal_2_data_v1';
const FIRESTORE_DOC = 'subway-deal-2-dash';
const FIRESTORE_COLLECTION = 'campaigns';
const HISTORY_COLLECTION = 'version_history';
const MAX_VERSIONS = 50; // Keep last 50 versions

// Subway has two campaign types:
// - Video: TikTok OR IG Reel + Story (100 athletes)
// - Story: IG Story only (500 athletes)
const VIDEO_ATHLETES = 100;
const STORY_ATHLETES = 500;
const TOTAL_ATHLETES = VIDEO_ATHLETES + STORY_ATHLETES;

// Brand deal slugs for routing
const VIDEO_SLUG = 'Subway - Complete your partnership';
const STORY_SLUG = 'Subway - Earn $25 through a partnership with Subway';

// Helper to generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Create a single athlete placeholder
const createAthletePlaceholder = (index: number, campaignType: CampaignType): Athlete => ({
  id: generateId(),
  user_name: `${campaignType === 'video' ? 'Video' : 'Story'}_Athlete_${index}`,
  user_phone_number: '',
  ig_account: '',
  tiktok_account: '',
  assigned_to: '',
  campaign_type: campaignType,
  profile_image_url: '',
  ig_reel_url: '',
  tiktok_post_url: '',
  tiktok_views: 0,
  tiktok_likes: 0,
  tiktok_comments: 0,
  tiktok_shares: 0,
  ig_reel_views: 0,
  ig_reel_shares: 0,
  ig_reel_comments: 0,
  ig_reel_likes: 0,
  ig_story_1_views: 0,
  ig_story_1_taps: 0,
  ig_story_1_replies: 0,
  ig_story_1_shares: 0,
  ig_story_2_views: 0,
  ig_story_2_taps: 0,
  ig_story_2_replies: 0,
  ig_story_2_shares: 0,
  ig_story_3_views: 0,
  ig_story_3_taps: 0,
  ig_story_3_replies: 0,
  ig_story_3_shares: 0,
});

// Initialize empty/placeholder data for both campaign types
export const generateInitialData = (): Athlete[] => {
  const data: Athlete[] = [];

  // Video campaign athletes (100)
  for (let i = 1; i <= VIDEO_ATHLETES; i++) {
    data.push(createAthletePlaceholder(i, 'video'));
  }

  // Story campaign athletes (500)
  for (let i = 1; i <= STORY_ATHLETES; i++) {
    data.push(createAthletePlaceholder(i, 'story'));
  }

  return data;
};

// Export slug constants for use in import logic
export { VIDEO_SLUG, STORY_SLUG };

// ============ SHOWCASE DATA TYPES ============

export interface TopContent {
  id: string;
  athleteId: string;
  athleteName: string;
  type: 'tiktok' | 'ig_reel' | 'ig_story';
  videoUrl: string;
  views: number;
}

export interface FeaturedComment {
  id: string;
  text: string;
  platform: 'tiktok' | 'instagram';
  athleteName: string;
}

export interface ShowcaseData {
  topContent: TopContent[];
  featuredComments: FeaturedComment[];
}

const SHOWCASE_DOC = 'showcase';
const SCRAPED_COMMENTS_DOC = 'scraped_comments';

// Save showcase data to Firestore
export const saveShowcaseData = async (data: ShowcaseData): Promise<void> => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, SHOWCASE_DOC);
    await setDoc(docRef, data, { merge: true });
    console.log('✅ Showcase data saved to cloud');
  } catch (e) {
    console.error('❌ Failed to save showcase data:', e);
    throw e;
  }
};

// Load showcase data from Firestore
export const loadShowcaseData = async (): Promise<ShowcaseData> => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, SHOWCASE_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ShowcaseData;
      console.log('✅ Loaded showcase data from cloud');
      return {
        topContent: data.topContent || [],
        featuredComments: data.featuredComments || []
      };
    }
    return { topContent: [], featuredComments: [] };
  } catch (e) {
    console.error('❌ Failed to load showcase data:', e);
    return { topContent: [], featuredComments: [] };
  }
};

// ============ SCRAPED COMMENTS STORAGE ============

export interface ScrapedCommentData {
  id: string;
  text: string;
  platform: 'tiktok' | 'instagram';
  username: string;
  likes: number;
  postUrl: string;
  profilePicUrl?: string;  // Profile picture URL from API
  sentimentScore?: number; // -1 to 1 from Gemini analysis
  isAuthentic?: boolean;   // True if genuine positive, not "nice ad"
  athleteName?: string;
  scrapedAt: string;
}

export interface ScrapedCommentsStore {
  tiktok: ScrapedCommentData[];
  instagram: ScrapedCommentData[];
  lastScrapedAt: string;
}

// Save all scraped comments to Firestore (preserves API results)
export const saveScrapedComments = async (comments: { tiktok: ScrapedCommentData[], instagram: ScrapedCommentData[] }): Promise<void> => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, SCRAPED_COMMENTS_DOC);
    const data: ScrapedCommentsStore = {
      tiktok: comments.tiktok,
      instagram: comments.instagram,
      lastScrapedAt: new Date().toISOString()
    };
    await setDoc(docRef, data);
    console.log(`✅ Saved ${comments.tiktok.length} TikTok + ${comments.instagram.length} IG comments to cloud`);
  } catch (e) {
    console.error('❌ Failed to save scraped comments:', e);
    throw e;
  }
};

// Load previously scraped comments from Firestore
export const loadScrapedComments = async (): Promise<ScrapedCommentsStore> => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, SCRAPED_COMMENTS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ScrapedCommentsStore;
      console.log(`✅ Loaded ${data.tiktok.length} TikTok + ${data.instagram.length} IG comments from cloud`);
      return data;
    }
    return { tiktok: [], instagram: [], lastScrapedAt: '' };
  } catch (e) {
    console.error('❌ Failed to load scraped comments:', e);
    return { tiktok: [], instagram: [], lastScrapedAt: '' };
  }
};

// ============ CLOUD STORAGE (FIRESTORE) ============

// Load data from Firestore (with localStorage fallback)
export const loadData = (): Athlete[] => {
  // Return localStorage data synchronously for initial render
  // Cloud sync happens in the background via loadDataFromCloud
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.length < TOTAL_ATHLETES) {
        const extra = generateInitialData().slice(parsed.length);
        return [...parsed, ...extra];
      }
      return parsed;
    }
  } catch (e) {
    console.error("Failed to load local data", e);
  }
  return generateInitialData();
};

// Async cloud load - call this after initial render
// Returns both athletes and alerts data
export interface CloudData {
  athletes: Athlete[] | null;
  failedTikTokUrls: string[];
  failedInstagramUrls: string[];
  dismissedAlerts: string[];
}

export const loadDataFromCloud = async (): Promise<CloudData> => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      if (cloudData.athletes && Array.isArray(cloudData.athletes)) {
        console.log('✅ Loaded data from cloud:', cloudData.athletes.length, 'athletes');
        // Also save to localStorage as cache
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData.athletes));
        return {
          athletes: cloudData.athletes,
          failedTikTokUrls: cloudData.failedTikTokUrls || [],
          failedInstagramUrls: cloudData.failedInstagramUrls || [],
          dismissedAlerts: cloudData.dismissedAlerts || []
        };
      }
    }
    console.log('📭 No cloud data found, using local/initial data');
    return { athletes: null, failedTikTokUrls: [], failedInstagramUrls: [], dismissedAlerts: [] };
  } catch (e) {
    console.error('❌ Failed to load from cloud:', e);
    return { athletes: null, failedTikTokUrls: [], failedInstagramUrls: [], dismissedAlerts: [] };
  }
};

// Save data to localStorage only (fast, no cloud sync)
export const saveDataLocal = (data: Athlete[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Save data to both localStorage and Firestore
export const saveData = (data: Athlete[]) => {
  // Save to localStorage immediately (fast)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  // Save to cloud in background (async)
  saveDataToCloud(data);
};

// Explicit save to cloud (returns promise so caller can await)
// Now supports saving alerts data alongside athletes
export interface AlertsData {
  failedTikTokUrls: string[];
  failedInstagramUrls: string[];
  dismissedAlerts: string[];
}

// Version history types
export interface VersionSnapshot {
  id?: string;
  timestamp: string;
  source: string; // 'import', 'tiktok-refresh', 'manual-save', etc.
  athleteCount: number;
  totalViews: number;
  tiktokViews: number;
  igReelViews: number;
  igStoryViews: number;
  athletes: Athlete[];
}

// Calculate summary stats for a version
const calculateVersionStats = (athletes: Athlete[]) => {
  let tiktokViews = 0;
  let igReelViews = 0;
  let igStoryViews = 0;

  athletes.forEach(a => {
    tiktokViews += a.tiktok_views || 0;
    igReelViews += a.ig_reel_views || 0;
    igStoryViews += (a.ig_story_1_views || 0) + (a.ig_story_2_views || 0) + (a.ig_story_3_views || 0);
  });

  return {
    tiktokViews,
    igReelViews,
    igStoryViews,
    totalViews: tiktokViews + igReelViews + igStoryViews
  };
};

// Save a version snapshot to history
const saveVersionSnapshot = async (data: Athlete[], source: string) => {
  try {
    const stats = calculateVersionStats(data);
    const historyRef = collection(db, HISTORY_COLLECTION);

    await addDoc(historyRef, {
      timestamp: new Date().toISOString(),
      source,
      athleteCount: data.length,
      ...stats,
      athletes: data
    });

    console.log('📸 Version snapshot saved:', source);

    // Cleanup old versions (keep only last MAX_VERSIONS)
    const allVersions = await getDocs(query(historyRef, orderBy('timestamp', 'desc')));
    if (allVersions.size > MAX_VERSIONS) {
      const toDelete = allVersions.docs.slice(MAX_VERSIONS);
      for (const docSnap of toDelete) {
        await deleteDoc(docSnap.ref);
      }
      console.log(`🧹 Cleaned up ${toDelete.length} old versions`);
    }
  } catch (e) {
    console.error('⚠️ Failed to save version snapshot:', e);
    // Don't throw - this is non-critical
  }
};

// Get version history (without full athlete data for performance)
export const getVersionHistory = async (): Promise<Omit<VersionSnapshot, 'athletes'>[]> => {
  try {
    const historyRef = collection(db, HISTORY_COLLECTION);
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(MAX_VERSIONS));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      timestamp: doc.data().timestamp,
      source: doc.data().source,
      athleteCount: doc.data().athleteCount,
      totalViews: doc.data().totalViews,
      tiktokViews: doc.data().tiktokViews,
      igReelViews: doc.data().igReelViews,
      igStoryViews: doc.data().igStoryViews
    }));
  } catch (e) {
    console.error('❌ Failed to get version history:', e);
    return [];
  }
};

// Get a specific version with full athlete data
export const getVersion = async (versionId: string): Promise<VersionSnapshot | null> => {
  try {
    const docRef = doc(db, HISTORY_COLLECTION, versionId);
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      return {
        id: snapshot.id,
        ...snapshot.data() as Omit<VersionSnapshot, 'id'>
      };
    }
    return null;
  } catch (e) {
    console.error('❌ Failed to get version:', e);
    return null;
  }
};

// Restore a version (returns the athlete data)
export const restoreVersion = async (versionId: string): Promise<Athlete[] | null> => {
  try {
    const version = await getVersion(versionId);
    if (version) {
      console.log('♻️ Restoring version from:', version.timestamp);
      return version.athletes;
    }
    return null;
  } catch (e) {
    console.error('❌ Failed to restore version:', e);
    return null;
  }
};

export const saveDataToCloudNow = async (
  data: Athlete[],
  alertsData?: AlertsData,
  source: string = 'manual-save'
): Promise<boolean> => {
  try {
    // Save version snapshot BEFORE updating
    await saveVersionSnapshot(data, source);

    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    const payload: any = {
      athletes: data,
      updatedAt: new Date().toISOString(),
      source: 'hardees-deal-dash-web'
    };

    // Include alerts data if provided
    if (alertsData) {
      payload.failedTikTokUrls = alertsData.failedTikTokUrls;
      payload.failedInstagramUrls = alertsData.failedInstagramUrls;
      payload.dismissedAlerts = alertsData.dismissedAlerts;
    }

    await setDoc(docRef, payload);
    // Also save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('☁️ Explicitly saved to cloud:', data.length, 'athletes');
    return true;
  } catch (e) {
    console.error('❌ Failed to save to cloud:', e);
    return false;
  }
};

// Async cloud save (background)
const saveDataToCloud = async (data: Athlete[]) => {
  try {
    const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    await setDoc(docRef, {
      athletes: data,
      updatedAt: new Date().toISOString(),
      source: 'hardees-deal-dash-web'
    });
    console.log('☁️ Saved to cloud:', data.length, 'athletes');
  } catch (e) {
    console.error('❌ Failed to save to cloud:', e);
  }
};

// Subscribe to real-time cloud changes
export const subscribeToCloudChanges = (
  onDataChange: (data: Athlete[], updatedAt: string) => void
): (() => void) => {
  const docRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);

  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      if (cloudData.athletes && Array.isArray(cloudData.athletes)) {
        const updatedAt = cloudData.updatedAt || new Date().toISOString();
        console.log('🔔 Cloud data changed, updatedAt:', updatedAt);
        onDataChange(cloudData.athletes, updatedAt);
      }
    }
  }, (error) => {
    console.error('❌ Cloud subscription error:', error);
  });

  return unsubscribe;
};

// ============ CALCULATION LOGIC ============

export const calculateEngagement = (athlete: Athlete) => {
  const safeDiv = (num: number, den: number) => (den === 0 ? 0 : num / den);

  const tiktokEng = athlete.tiktok_likes + athlete.tiktok_comments + athlete.tiktok_shares;
  const igReelEng = athlete.ig_reel_likes + athlete.ig_reel_comments + athlete.ig_reel_shares;

  const story1Eng = athlete.ig_story_1_taps + athlete.ig_story_1_replies + athlete.ig_story_1_shares;
  const story2Eng = athlete.ig_story_2_taps + athlete.ig_story_2_replies + athlete.ig_story_2_shares;
  const story3Eng = athlete.ig_story_3_taps + athlete.ig_story_3_replies + athlete.ig_story_3_shares;

  const totalEng = tiktokEng + igReelEng + story1Eng + story2Eng + story3Eng;
  const totalViews = athlete.tiktok_views + athlete.ig_reel_views + athlete.ig_story_1_views + athlete.ig_story_2_views + athlete.ig_story_3_views;

  return {
    tiktokRate: safeDiv(tiktokEng, athlete.tiktok_views),
    igReelRate: safeDiv(igReelEng, athlete.ig_reel_views),
    igStoryRate: safeDiv(story1Eng + story2Eng + story3Eng, athlete.ig_story_1_views + athlete.ig_story_2_views + athlete.ig_story_3_views),
    totalRate: safeDiv(totalEng, totalViews)
  };
};

// ============ CSV IMPORT ============

// Phone numbers to exclude from import
const EXCLUDED_PHONES = ['+18099239897', '+13014374742'];

// Normalize phone number to E.164 format (assumes US if no country code)
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';

  // If already 11 digits starting with 1, format as +1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return '+1' + digits;
  }
  // Otherwise return as-is with + prefix if not present
  return digits.startsWith('+') ? digits : '+' + digits;
};

// Check if value is non-empty (for non-override logic)
const hasValue = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (typeof val === 'number') return val !== 0;
  return true;
};

export const processCSVImport = (file: File, currentData: Athlete[]): Promise<Athlete[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newData = [...currentData];
        const importedRows = results.data as any[];

        console.log('📥 CSV Import Started');
        console.log('  Total rows in CSV:', importedRows.length);
        console.log('  Current data size:', currentData.length);
        console.log('  Sample row:', importedRows[0]);

        // Track story counts per athlete (by phone number)
        const athleteStoryCounts: Map<string, number> = new Map();
        // Track most recent IG Reel timestamp per athlete (for deduplication)
        const athleteReelTimestamps: Map<string, string> = new Map();
        let matchedCount = 0;
        let createdCount = 0;

        // Detect format by checking for key columns
        const hasMediaType = importedRows.length > 0 && 'media_type' in importedRows[0];
        const hasLiveTikTokLink = importedRows.length > 0 && 'Live TikTok Link' in importedRows[0];
        const hasSimpleRoster = importedRows.length > 0 && 'Phone Number' in importedRows[0] && ('IG Link' in importedRows[0] || 'TikTok Link' in importedRows[0]);

        const isDashboardExport = hasMediaType;
        const isRosterExport = hasLiveTikTokLink;
        const isSimpleRoster = hasSimpleRoster;

        console.log('  Format detected:', isDashboardExport ? 'Dashboard Export' : isRosterExport ? 'Roster Export' : isSimpleRoster ? 'Simple Roster' : 'UNKNOWN');

        if (isDashboardExport) {
          console.log('📊 Processing dashboard export format');

          // Process dashboard export format
          importedRows.forEach((row) => {
            const phone = row.user_phone_number?.trim();
            const name = row.user_full_name?.trim();
            const mediaType = row.media_type?.trim();

            // Skip excluded phone numbers
            if (phone && EXCLUDED_PHONES.includes(phone)) {
              console.log('⛔ Skipping excluded phone:', phone);
              return;
            }

            // Skip rows without essential data
            if (!phone && !name) return;
            if (!mediaType) return;

            // Determine campaign type from brand_deal_slug
            const brandDealSlug = row.brand_deal_slug?.trim() || '';
            let campaignType: CampaignType = 'story'; // default
            if (brandDealSlug.includes('Complete your partnership')) {
              campaignType = 'video';
            } else if (brandDealSlug.includes('Earn $25')) {
              campaignType = 'story';
            }

            // Find or create athlete
            let matchIndex = -1;
            if (phone) {
              matchIndex = newData.findIndex(a => a.user_phone_number === phone);
            }
            if (matchIndex === -1 && name) {
              matchIndex = newData.findIndex(a => a.user_name.toLowerCase() === name.toLowerCase());
            }
            if (matchIndex === -1) {
              // Find first placeholder OF THE CORRECT CAMPAIGN TYPE
              matchIndex = newData.findIndex(a =>
                a.campaign_type === campaignType &&
                (a.user_name.startsWith('Video_Athlete_') || a.user_name.startsWith('Story_Athlete_'))
              );
            }

            // If still no match, CREATE a new athlete with correct campaign type
            if (matchIndex === -1) {
              const newAthlete: Athlete = {
                id: Math.random().toString(36).substr(2, 9),
                user_name: name || 'Unknown',
                user_phone_number: phone || '',
                ig_account: '',
                tiktok_account: '',
                assigned_to: '',
                campaign_type: campaignType,
                profile_image_url: '',
                ig_reel_url: '',
                tiktok_post_url: '',
                tiktok_views: 0,
                tiktok_likes: 0,
                tiktok_comments: 0,
                tiktok_shares: 0,
                ig_reel_views: 0,
                ig_reel_shares: 0,
                ig_reel_comments: 0,
                ig_reel_likes: 0,
                ig_story_1_views: 0,
                ig_story_1_taps: 0,
                ig_story_1_replies: 0,
                ig_story_1_shares: 0,
                ig_story_2_views: 0,
                ig_story_2_taps: 0,
                ig_story_2_replies: 0,
                ig_story_2_shares: 0,
                ig_story_3_views: 0,
                ig_story_3_taps: 0,
                ig_story_3_replies: 0,
                ig_story_3_shares: 0,
              };
              newData.push(newAthlete);
              matchIndex = newData.length - 1;
              console.log(`➕ Created new ${campaignType} athlete:`, name);
            }

            const target = newData[matchIndex];

            // Update basic info and campaign type
            if (name) target.user_name = name;
            if (phone) target.user_phone_number = phone;
            target.campaign_type = campaignType;

            // Parse numeric values
            const p = (val: any) => parseFloat(val) || 0;

            // Get the key for tracking (use phone if available, otherwise name)
            const trackingKey = phone || name;

            if (mediaType === 'ig_reel') {
              // IG Reel data - keep only the most recent one based on insight_fetched_at
              const currentTimestamp = athleteReelTimestamps.get(trackingKey) || '';
              const newTimestamp = row.insight_fetched_at || row.document_updated_at || '';

              // Compare timestamps - only update if this row is newer (or if no previous data)
              const isNewer = !currentTimestamp || (newTimestamp && newTimestamp > currentTimestamp);

              if (isNewer) {
                // This is a newer reel - replace the old data instead of aggregating
                target.ig_reel_views = p(row.views);
                target.ig_reel_shares = p(row.shares);
                target.ig_reel_comments = p(row.comments);
                target.ig_reel_likes = p(row.likes);
                if (row.media_permalink) target.ig_reel_url = row.media_permalink;

                // Update the tracked timestamp
                if (newTimestamp) {
                  athleteReelTimestamps.set(trackingKey, newTimestamp);
                }
                console.log(`🎬 Updated IG Reel for ${name || phone} (${newTimestamp})`);
              } else {
                console.log(`⏭️ Skipped older IG Reel for ${name || phone} (${newTimestamp} < ${currentTimestamp})`);
              }

            } else if (mediaType === 'ig_story') {
              // IG Story data - assign to story 1, 2, or 3 based on order
              const currentCount = athleteStoryCounts.get(trackingKey) || 0;
              const storyNum = currentCount + 1;

              if (storyNum === 1) {
                target.ig_story_1_views = p(row.views);
                target.ig_story_1_taps = p(row.link_or_sticker_taps);
                target.ig_story_1_replies = p(row.replies);
                target.ig_story_1_shares = p(row.shares);
              } else if (storyNum === 2) {
                target.ig_story_2_views = p(row.views);
                target.ig_story_2_taps = p(row.link_or_sticker_taps);
                target.ig_story_2_replies = p(row.replies);
                target.ig_story_2_shares = p(row.shares);
              } else if (storyNum === 3) {
                target.ig_story_3_views = p(row.views);
                target.ig_story_3_taps = p(row.link_or_sticker_taps);
                target.ig_story_3_replies = p(row.replies);
                target.ig_story_3_shares = p(row.shares);
              }
              // Stories beyond 3 are ignored

              athleteStoryCounts.set(trackingKey, storyNum);
            }
          });

          console.log('✅ Processed', importedRows.length, 'rows from dashboard export');

        } else if (isRosterExport) {
          // Roster export format (from tender bender dashboard)
          console.log('📋 Detected roster export format');

          importedRows.forEach((row) => {
            const rawPhone = row['Phone']?.trim();
            const phone = normalizePhone(rawPhone);
            const name = row['Name']?.trim();

            // Skip excluded phones
            if (phone && EXCLUDED_PHONES.includes(phone)) {
              console.log('⛔ Skipping excluded phone:', phone);
              return;
            }

            // Skip rows without essential data
            if (!phone && !name) return;

            // Find or create athlete
            let matchIndex = -1;
            if (phone) {
              matchIndex = newData.findIndex(a => a.user_phone_number === phone);
            }
            if (matchIndex === -1 && name) {
              matchIndex = newData.findIndex(a => a.user_name.toLowerCase() === name.toLowerCase());
            }
            if (matchIndex === -1) {
              // Find first placeholder
              matchIndex = newData.findIndex(a => a.user_name.startsWith('Athlete_'));
            }

            if (matchIndex === -1) return; // No slot available

            const target = newData[matchIndex];

            // Update name and phone (always update these)
            if (name) target.user_name = name;
            if (phone) target.user_phone_number = phone;

            // Only update other fields if the new value is non-empty (don't override with null)
            const igHandle = row['Instagram Handle']?.trim();
            const tiktokHandle = row['TikTok Handle']?.trim();
            const liveIgLink = row['Live Instagram Link']?.trim();
            const liveTiktokLink = row['Live TikTok Link']?.trim();

            if (hasValue(igHandle)) target.ig_account = igHandle;
            if (hasValue(tiktokHandle)) target.tiktok_account = tiktokHandle;
            if (hasValue(liveIgLink)) target.ig_reel_url = liveIgLink;
            if (hasValue(liveTiktokLink)) target.tiktok_post_url = liveTiktokLink;
          });

          console.log('✅ Processed', importedRows.length, 'rows from roster export');

        } else if (isSimpleRoster) {
          // Simple Roster format: Name, Phone Number, IG Link, TikTok Link
          console.log('📋 Processing Simple Roster format');

          importedRows.forEach((row) => {
            const rawPhone = row['Phone Number']?.trim();
            const phone = normalizePhone(rawPhone);
            const name = row['Name']?.trim();
            const igLink = row['IG Link']?.trim();
            const tiktokLink = row['TikTok Link']?.trim();

            // Skip excluded phones
            if (phone && EXCLUDED_PHONES.includes(phone)) {
              console.log('⛔ Skipping excluded phone:', phone);
              return;
            }

            // Skip rows without essential data
            if (!phone && !name) return;

            // For Subway, determine campaign type:
            // Since this is a roster import (no brand_deal_slug), default to 'video' if they have TT or IG content
            // Otherwise could be 'story' - we'll default to 'video' since this roster has links
            const campaignType: CampaignType = 'video';

            // Find existing athlete by phone or name
            let matchIndex = -1;
            if (phone) {
              matchIndex = newData.findIndex(a => a.user_phone_number === phone);
            }
            if (matchIndex === -1 && name) {
              matchIndex = newData.findIndex(a => a.user_name.toLowerCase() === name.toLowerCase());
            }

            // If no match, find a placeholder of the correct campaign type
            if (matchIndex === -1) {
              matchIndex = newData.findIndex(a =>
                a.campaign_type === campaignType &&
                (a.user_name.startsWith('Video_Athlete_') || a.user_name.startsWith('Story_Athlete_'))
              );
            }

            // If still no slot, create new athlete
            if (matchIndex === -1) {
              const newAthlete: Athlete = {
                id: Math.random().toString(36).substr(2, 9),
                user_name: name || 'Unknown',
                user_phone_number: phone || '',
                ig_account: '',
                tiktok_account: '',
                assigned_to: '',
                campaign_type: campaignType,
                profile_image_url: '',
                ig_reel_url: '',
                tiktok_post_url: '',
                tiktok_views: 0,
                tiktok_likes: 0,
                tiktok_comments: 0,
                tiktok_shares: 0,
                ig_reel_views: 0,
                ig_reel_shares: 0,
                ig_reel_comments: 0,
                ig_reel_likes: 0,
                ig_story_1_views: 0,
                ig_story_1_taps: 0,
                ig_story_1_replies: 0,
                ig_story_1_shares: 0,
                ig_story_2_views: 0,
                ig_story_2_taps: 0,
                ig_story_2_replies: 0,
                ig_story_2_shares: 0,
                ig_story_3_views: 0,
                ig_story_3_taps: 0,
                ig_story_3_replies: 0,
                ig_story_3_shares: 0,
              };
              newData.push(newAthlete);
              matchIndex = newData.length - 1;
              createdCount++;
              console.log(`➕ Created new ${campaignType} athlete:`, name);
            } else {
              matchedCount++;
            }

            const target = newData[matchIndex];

            // Update basic info
            if (name) target.user_name = name;
            if (phone) target.user_phone_number = phone;
            target.campaign_type = campaignType;

            // Update links (IG Link can be reel or profile, TikTok Link is post URL)
            if (hasValue(igLink)) target.ig_reel_url = igLink;
            if (hasValue(tiktokLink)) target.tiktok_post_url = tiktokLink;
          });

          console.log('✅ Processed', importedRows.length, 'rows from Simple Roster');
          console.log('  Matched:', matchedCount, ', Created:', createdCount);

        } else {
          // Legacy format - original column names
          console.log('📋 Using legacy import format');

          importedRows.forEach((row) => {
            let matchIndex = -1;

            if (row.user_phone_number) {
              // Skip excluded phones
              if (EXCLUDED_PHONES.includes(row.user_phone_number)) return;
              matchIndex = newData.findIndex(a => a.user_phone_number === row.user_phone_number);
            }

            if (matchIndex === -1 && row.user_name) {
              matchIndex = newData.findIndex(a => a.user_name.toLowerCase() === row.user_name.toLowerCase());
            }

            if (matchIndex === -1) {
              matchIndex = newData.findIndex(a => a.user_name.startsWith('Athlete_'));
            }

            if (matchIndex !== -1) {
              const target = newData[matchIndex];

              if (row.user_name) target.user_name = row.user_name;
              if (row.user_phone_number) target.user_phone_number = row.user_phone_number;
              if (row['IG Account']) target.ig_account = row['IG Account'];
              if (row['TikTok Account']) target.tiktok_account = row['TikTok Account'];
              if (row['IG Reel Post']) target.ig_reel_url = row['IG Reel Post'];
              if (row['Tiktok Post']) target.tiktok_post_url = row['Tiktok Post'];

              const p = (val: any) => parseInt(val) || 0;

              if (row.Tiktok_Views !== undefined) target.tiktok_views = p(row.Tiktok_Views);
              if (row.Tiktok_Likes !== undefined) target.tiktok_likes = p(row.Tiktok_Likes);
              if (row.Tiktok_Comments !== undefined) target.tiktok_comments = p(row.Tiktok_Comments);
              if (row.Tiktok_Shares !== undefined) target.tiktok_shares = p(row.Tiktok_Shares);

              if (row.IGReel_Views !== undefined) target.ig_reel_views = p(row.IGReel_Views);
              if (row.IGReel_Shares !== undefined) target.ig_reel_shares = p(row.IGReel_Shares);
              if (row.IGReel_Comments !== undefined) target.ig_reel_comments = p(row.IGReel_Comments);
              if (row.IGReel_Likes !== undefined) target.ig_reel_likes = p(row.IGReel_Likes);

              if (row.IGStory_1_Views !== undefined) target.ig_story_1_views = p(row.IGStory_1_Views);
              if (row.IGStory_1_Taps !== undefined) target.ig_story_1_taps = p(row.IGStory_1_Taps);
              if (row.IGStory_1_Replies !== undefined) target.ig_story_1_replies = p(row.IGStory_1_Replies);
              if (row.IGStory_1_Shares !== undefined) target.ig_story_1_shares = p(row.IGStory_1_Shares);

              if (row.IGStory_2_Views !== undefined) target.ig_story_2_views = p(row.IGStory_2_Views);
              if (row.IGStory_2_Taps !== undefined) target.ig_story_2_taps = p(row.IGStory_2_Taps);
              if (row.IGStory_2_Replies !== undefined) target.ig_story_2_replies = p(row.IGStory_2_Replies);
              if (row.IGStory_2_Shares !== undefined) target.ig_story_2_shares = p(row.IGStory_2_Shares);

              if (row.IGStory_3_Views !== undefined) target.ig_story_3_views = p(row.IGStory_3_Views);
              if (row.IGStory_3_Taps !== undefined) target.ig_story_3_taps = p(row.IGStory_3_Taps);
              if (row.IGStory_3_Replies !== undefined) target.ig_story_3_replies = p(row.IGStory_3_Replies);
              if (row.IGStory_3_Shares !== undefined) target.ig_story_3_shares = p(row.IGStory_3_Shares);
            }
          });
        }

        // Summary
        const realAthletes = newData.filter(a => a.user_name && !a.user_name.startsWith('Athlete_'));
        console.log('📊 Import Complete:');
        console.log('  Real athletes in data:', realAthletes.length);
        console.log('  Sample:', realAthletes.slice(0, 3).map(a => `${a.user_name} (${a.user_phone_number})`));

        resolve(newData);
      },
      error: (err) => reject(err)
    });
  });
};

// ============ LOW PRIORITY IMPORT ============
// Only fills in missing/zero fields, NEVER overrides existing data
export interface LowPriorityImportResult {
  totalRowsProcessed: number;
  athletesMatched: number;
  fieldsUpdated: number;
  updates: string[];
}

export const processLowPriorityImport = (file: File, currentData: Athlete[]): Promise<{ data: Athlete[], result: LowPriorityImportResult }> => {
  return new Promise((resolve, reject) => {
    const result: LowPriorityImportResult = {
      totalRowsProcessed: 0,
      athletesMatched: 0,
      fieldsUpdated: 0,
      updates: []
    };

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const newData = [...currentData];
        const matchedAthletes = new Set<string>();

        results.data.forEach((row: any) => {
          result.totalRowsProcessed++;

          // Get name - try different possible column names
          const name = row['Name'] || row['name'] || row['Athlete'] || row['athlete'] || '';

          // Get phone number and normalize to E.164
          const rawPhone = row['Primary Phone Number'] || row['Phone'] || row['phone'] || row['user_phone_number'] || '';
          let phone = '';
          if (rawPhone) {
            const digits = String(rawPhone).replace(/\D/g, '');
            if (digits.length === 10) {
              phone = '+1' + digits;
            } else if (digits.length === 11 && digits.startsWith('1')) {
              phone = '+' + digits;
            } else if (digits.length > 0) {
              phone = '+' + digits;
            }
          }

          // Try to find athlete by phone first, then by name
          let target = null;
          if (phone) {
            target = newData.find(a => a.user_phone_number === phone);
          }
          if (!target && name) {
            const normalizedName = name.toLowerCase().trim();
            target = newData.find(a =>
              a.user_name.toLowerCase().trim() === normalizedName ||
              a.user_name.toLowerCase().includes(normalizedName) ||
              normalizedName.includes(a.user_name.toLowerCase())
            );
          }

          if (!target) return;

          matchedAthletes.add(target.id);
          let updatesForAthlete: string[] = [];

          // Helper to update string fields only if currently empty
          const updateStringIfMissing = (field: keyof Athlete, newValue: string, label: string) => {
            const currentVal = target[field] as string;
            if ((!currentVal || currentVal.trim() === '') && newValue && newValue.trim() !== '') {
              (target as any)[field] = newValue.trim();
              result.fieldsUpdated++;
              updatesForAthlete.push(`${label}`);
            }
          };

          // Helper to update numeric fields only if currently 0 or empty
          const updateIfMissing = (field: keyof Athlete, newValue: number, label: string) => {
            const currentVal = target[field] as number;
            if ((currentVal === 0 || currentVal === undefined || currentVal === null) && newValue > 0) {
              (target as any)[field] = newValue;
              result.fieldsUpdated++;
              updatesForAthlete.push(`${label}: ${newValue}`);
            }
          };

          // Check for TikTok Link (URL)
          const tiktokLink = row['TikTok Link'] || row['tiktok_link'] || row['TikTok URL'] || row['tiktok_url'] || '';
          if (tiktokLink) {
            updateStringIfMissing('tiktok_post_url', tiktokLink, 'TikTok URL');
          }

          // Check for TikTok Handle (username)
          const tiktokHandle = row['TikTok Handle'] || row['tiktok_handle'] || row['TikTok Username'] || '';
          if (tiktokHandle) {
            updateStringIfMissing('tiktok_account', tiktokHandle, 'TikTok Handle');
          }

          // Check for Instagram Handle (username)
          const igHandle = row['Instagram Handle'] || row['instagram_handle'] || row['IG Handle'] || row['Instagram Username'] || '';
          if (igHandle) {
            updateStringIfMissing('ig_account', igHandle, 'IG Handle');
          }

          // Check for Instagram Reel Link
          const reelLink = row['Reel Link'] || row['reel_link'] || row['IG Reel'] || row['ig_reel_url'] || '';
          if (reelLink) {
            updateStringIfMissing('ig_reel_url', reelLink, 'Reel URL');
          }

          // Check for Assigned To
          const assignedTo = row['Assigned To'] || row['assigned_to'] || row['AssignedTo'] || row['Assigned'] || '';
          if (assignedTo) {
            updateStringIfMissing('assigned_to', assignedTo, 'Assigned To');
          }

          // Check for Story data
          const storyCol = row['Story'] || row['story'] || '';
          let storyNum = 0;
          if (storyCol) {
            if (storyCol.toLowerCase().includes('one') || storyCol.includes('1')) storyNum = 1;
            else if (storyCol.toLowerCase().includes('two') || storyCol.includes('2')) storyNum = 2;
            else if (storyCol.toLowerCase().includes('three') || storyCol.includes('3')) storyNum = 3;
          }

          if (storyNum > 0) {
            // Parse values - Impressions maps to Views, ignore Likes
            const impressions = parseFloat(row['Impressions'] || row['impressions'] || '0') || 0;
            const taps = parseFloat(row['Taps'] || row['taps'] || '0') || 0;
            const replies = parseFloat(row['Replies'] || row['replies'] || '0') || 0;
            const shares = parseFloat(row['Shares'] || row['shares'] || '0') || 0;

            if (storyNum === 1) {
              updateIfMissing('ig_story_1_views', impressions, 'S1 Views');
              updateIfMissing('ig_story_1_taps', taps, 'S1 Taps');
              updateIfMissing('ig_story_1_replies', replies, 'S1 Replies');
              updateIfMissing('ig_story_1_shares', shares, 'S1 Shares');
            } else if (storyNum === 2) {
              updateIfMissing('ig_story_2_views', impressions, 'S2 Views');
              updateIfMissing('ig_story_2_taps', taps, 'S2 Taps');
              updateIfMissing('ig_story_2_replies', replies, 'S2 Replies');
              updateIfMissing('ig_story_2_shares', shares, 'S2 Shares');
            } else if (storyNum === 3) {
              updateIfMissing('ig_story_3_views', impressions, 'S3 Views');
              updateIfMissing('ig_story_3_taps', taps, 'S3 Taps');
              updateIfMissing('ig_story_3_replies', replies, 'S3 Replies');
              updateIfMissing('ig_story_3_shares', shares, 'S3 Shares');
            }
          }

          if (updatesForAthlete.length > 0) {
            result.updates.push(`${target.user_name}: ${updatesForAthlete.join(', ')}`);
          }
        });

        result.athletesMatched = matchedAthletes.size;
        resolve({ data: newData, result });
      },
      error: (err) => reject(err)
    });
  });
};