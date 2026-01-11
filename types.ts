export type CampaignType = 'video' | 'story';

export interface Athlete {
  id: string; // Internal ID for stability
  user_name: string;
  user_phone_number: string;
  ig_account: string;
  tiktok_account: string;
  assigned_to: string;
  campaign_type: CampaignType; // 'video' = TT/IG Reel + Story, 'story' = Story only
  profile_image_url: string; // Roster headshot URL

  // URLs
  ig_reel_url: string;
  tiktok_post_url: string;

  // TikTok Metrics
  tiktok_views: number;
  tiktok_likes: number;
  tiktok_comments: number;
  tiktok_shares: number;

  // IG Reel Metrics
  ig_reel_views: number;
  ig_reel_shares: number;
  ig_reel_comments: number;
  ig_reel_likes: number;

  // IG Story 1
  ig_story_1_views: number;
  ig_story_1_taps: number;
  ig_story_1_replies: number;
  ig_story_1_shares: number;

  // IG Story 2
  ig_story_2_views: number;
  ig_story_2_taps: number;
  ig_story_2_replies: number;
  ig_story_2_shares: number;

  // IG Story 3
  ig_story_3_views: number;
  ig_story_3_taps: number;
  ig_story_3_replies: number;
  ig_story_3_shares: number;

  // Computed/Overridable Rates (Stored as numbers 0-1, e.g., 0.05 for 5%)
  // Note: While these can be computed, the prompt implies we treat the table as a source of truth where values might be overridden.
  // We will compute them on the fly for display if values exist, but allow overrides if we were to strictly follow a "value store" model.
  // For this implementation, we will compute them dynamically to ensure consistency, but if data is imported, we rely on the raw metrics.

  // Flag to track if this athlete has mock/estimated data
  has_mock_data?: boolean;
}

export interface SummaryStats {
  totalViews: number;
  totalPosts: number;
  avgEngagementRate: number;
  totalEngagements: number;
  tiktokViews: number;
  igReelViews: number;
  igStoryViews: number;
}
