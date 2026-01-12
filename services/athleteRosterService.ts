// Athlete Roster Management Service
// Handles backup, deletion of non-baseline athletes, and roster locking

import { Athlete } from '../types';
import { isBaselineAthlete } from './baselineAthletes';

// Contact info we want to preserve
export interface AthleteContact {
    user_name: string;
    user_phone_number: string;
    ig_account: string;
    tiktok_account: string;
    ig_reel_url: string;
    tiktok_post_url: string;
    profile_image_url: string;
}

// Export athlete contacts for backup
export function exportAthleteContacts(athletes: Athlete[]): AthleteContact[] {
    return athletes.map(a => ({
        user_name: a.user_name,
        user_phone_number: a.user_phone_number,
        ig_account: a.ig_account,
        tiktok_account: a.tiktok_account,
        ig_reel_url: a.ig_reel_url,
        tiktok_post_url: a.tiktok_post_url,
        profile_image_url: a.profile_image_url,
    }));
}

// Generate a downloadable JSON backup
export function generateContactBackupJSON(athletes: Athlete[]): string {
    const contacts = exportAthleteContacts(athletes);
    const backup = {
        timestamp: new Date().toISOString(),
        athleteCount: contacts.length,
        contacts,
    };
    return JSON.stringify(backup, null, 2);
}

// Generate a downloadable CSV backup
export function generateContactBackupCSV(athletes: Athlete[]): string {
    const contacts = exportAthleteContacts(athletes);
    const headers = ['user_name', 'user_phone_number', 'ig_account', 'tiktok_account', 'ig_reel_url', 'tiktok_post_url', 'profile_image_url'];
    const rows = contacts.map(c =>
        headers.map(h => `"${(c[h as keyof AthleteContact] || '').replace(/"/g, '""')}"`).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

// Filter out athletes not in baseline list
export function filterToBaselineAthletes(athletes: Athlete[]): {
    kept: Athlete[];
    removed: Athlete[];
} {
    const kept: Athlete[] = [];
    const removed: Athlete[] = [];

    for (const athlete of athletes) {
        if (isBaselineAthlete(athlete.user_name)) {
            kept.push(athlete);
        } else {
            removed.push(athlete);
        }
    }

    return { kept, removed };
}

// Check if an athlete name exists in the current roster
export function athleteExistsInRoster(userName: string, athletes: Athlete[]): boolean {
    return athletes.some(a => a.user_name.toLowerCase() === userName.toLowerCase());
}

// Find an athlete by name (case-insensitive)
export function findAthleteByName(userName: string, athletes: Athlete[]): Athlete | undefined {
    return athletes.find(a => a.user_name.toLowerCase() === userName.toLowerCase());
}

// Merge imported data into existing athlete (only update metrics, not contact info)
export function mergeAthleteMetrics(existing: Athlete, imported: Partial<Athlete>): Athlete {
    return {
        ...existing,
        // Only update metrics, preserve contact info
        tiktok_views: imported.tiktok_views ?? existing.tiktok_views,
        tiktok_likes: imported.tiktok_likes ?? existing.tiktok_likes,
        tiktok_comments: imported.tiktok_comments ?? existing.tiktok_comments,
        tiktok_shares: imported.tiktok_shares ?? existing.tiktok_shares,
        ig_reel_views: imported.ig_reel_views ?? existing.ig_reel_views,
        ig_reel_shares: imported.ig_reel_shares ?? existing.ig_reel_shares,
        ig_reel_comments: imported.ig_reel_comments ?? existing.ig_reel_comments,
        ig_reel_likes: imported.ig_reel_likes ?? existing.ig_reel_likes,
        ig_story_1_views: imported.ig_story_1_views ?? existing.ig_story_1_views,
        ig_story_1_taps: imported.ig_story_1_taps ?? existing.ig_story_1_taps,
        ig_story_1_replies: imported.ig_story_1_replies ?? existing.ig_story_1_replies,
        ig_story_1_shares: imported.ig_story_1_shares ?? existing.ig_story_1_shares,
        ig_story_2_views: imported.ig_story_2_views ?? existing.ig_story_2_views,
        ig_story_2_taps: imported.ig_story_2_taps ?? existing.ig_story_2_taps,
        ig_story_2_replies: imported.ig_story_2_replies ?? existing.ig_story_2_replies,
        ig_story_2_shares: imported.ig_story_2_shares ?? existing.ig_story_2_shares,
        ig_story_3_views: imported.ig_story_3_views ?? existing.ig_story_3_views,
        ig_story_3_taps: imported.ig_story_3_taps ?? existing.ig_story_3_taps,
        ig_story_3_replies: imported.ig_story_3_replies ?? existing.ig_story_3_replies,
        ig_story_3_shares: imported.ig_story_3_shares ?? existing.ig_story_3_shares,
    };
}
