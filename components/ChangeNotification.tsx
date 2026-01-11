import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Athlete, SummaryStats } from '../types';

export interface StatChange {
    label: string;
    oldValue: number;
    newValue: number;
    format?: 'number' | 'percent';
}

export interface ChangeNotificationProps {
    changes: StatChange[];
    onClose: () => void;
    title?: string;
}

// Calculate campaign summary stats from athlete data
export const calculateCampaignStats = (athletes: Athlete[]): SummaryStats => {
    let tiktokViews = 0;
    let igReelViews = 0;
    let igStoryViews = 0;
    let totalEngagements = 0;
    let totalPosts = 0;

    athletes.forEach(a => {
        // TikTok
        if (a.tiktok_views > 0) {
            tiktokViews += a.tiktok_views;
            totalEngagements += (a.tiktok_likes || 0) + (a.tiktok_comments || 0) + (a.tiktok_shares || 0);
            totalPosts++;
        }

        // IG Reels
        if (a.ig_reel_views > 0) {
            igReelViews += a.ig_reel_views;
            totalEngagements += (a.ig_reel_likes || 0) + (a.ig_reel_comments || 0) + (a.ig_reel_shares || 0);
            totalPosts++;
        }

        // Stories
        if (a.ig_story_1_views > 0) {
            igStoryViews += a.ig_story_1_views;
            totalEngagements += (a.ig_story_1_taps || 0) + (a.ig_story_1_replies || 0) + (a.ig_story_1_shares || 0);
            totalPosts++;
        }
        if (a.ig_story_2_views > 0) {
            igStoryViews += a.ig_story_2_views;
            totalEngagements += (a.ig_story_2_taps || 0) + (a.ig_story_2_replies || 0) + (a.ig_story_2_shares || 0);
            totalPosts++;
        }
        if (a.ig_story_3_views > 0) {
            igStoryViews += a.ig_story_3_views;
            totalEngagements += (a.ig_story_3_taps || 0) + (a.ig_story_3_replies || 0) + (a.ig_story_3_shares || 0);
            totalPosts++;
        }
    });

    const totalViews = tiktokViews + igReelViews + igStoryViews;
    const avgEngagementRate = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;

    return {
        totalViews,
        totalPosts,
        avgEngagementRate,
        totalEngagements,
        tiktokViews,
        igReelViews,
        igStoryViews
    };
};

// Calculate differences between old and new stats
export const calculateStatChanges = (oldStats: SummaryStats, newStats: SummaryStats): StatChange[] => {
    const changes: StatChange[] = [];

    if (newStats.totalViews !== oldStats.totalViews) {
        changes.push({ label: 'Total Views', oldValue: oldStats.totalViews, newValue: newStats.totalViews });
    }
    if (newStats.tiktokViews !== oldStats.tiktokViews) {
        changes.push({ label: 'TikTok Views', oldValue: oldStats.tiktokViews, newValue: newStats.tiktokViews });
    }
    if (newStats.igReelViews !== oldStats.igReelViews) {
        changes.push({ label: 'IG Reel Views', oldValue: oldStats.igReelViews, newValue: newStats.igReelViews });
    }
    if (newStats.igStoryViews !== oldStats.igStoryViews) {
        changes.push({ label: 'IG Story Views', oldValue: oldStats.igStoryViews, newValue: newStats.igStoryViews });
    }
    if (newStats.totalPosts !== oldStats.totalPosts) {
        changes.push({ label: 'Total Posts', oldValue: oldStats.totalPosts, newValue: newStats.totalPosts });
    }
    if (newStats.totalEngagements !== oldStats.totalEngagements) {
        changes.push({ label: 'Total Engagements', oldValue: oldStats.totalEngagements, newValue: newStats.totalEngagements });
    }
    if (Math.abs(newStats.avgEngagementRate - oldStats.avgEngagementRate) > 0.01) {
        changes.push({
            label: 'Avg Engagement Rate',
            oldValue: oldStats.avgEngagementRate,
            newValue: newStats.avgEngagementRate,
            format: 'percent'
        });
    }

    return changes;
};

// Format number with commas
const formatNumber = (num: number): string => {
    return num.toLocaleString();
};

// Apple-style notification component
export const ChangeNotification: React.FC<ChangeNotificationProps> = ({
    changes,
    onClose,
    title = 'Campaign Updated'
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animate in
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Auto-dismiss after 8 seconds
        const timer = setTimeout(() => {
            handleClose();
        }, 8000);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300);
    };

    if (changes.length === 0) return null;

    return (
        <div
            className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
                }`}
        >
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg flex items-center justify-center">
                            <TrendingUp size={16} className="text-white" />
                        </div>
                        <span className="font-semibold text-gray-900">{title}</span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition"
                    >
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>

                {/* Changes list */}
                <div className="px-4 py-3 space-y-2">
                    {changes.map((change, idx) => {
                        const diff = change.newValue - change.oldValue;
                        const isPositive = diff > 0;
                        const isPercent = change.format === 'percent';

                        return (
                            <div
                                key={idx}
                                className="flex items-center justify-between py-1"
                            >
                                <span className="text-sm text-gray-600">{change.label}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                        {isPositive ? (
                                            <TrendingUp size={14} />
                                        ) : (
                                            <TrendingDown size={14} />
                                        )}
                                        {isPositive ? '+' : ''}
                                        {isPercent
                                            ? `${diff.toFixed(2)}%`
                                            : formatNumber(diff)
                                        }
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        → {isPercent
                                            ? `${change.newValue.toFixed(2)}%`
                                            : formatNumber(change.newValue)
                                        }
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-gray-50/50 border-t border-gray-100">
                    <p className="text-xs text-gray-400 text-center">
                        Auto-dismissing in a few seconds
                    </p>
                </div>
            </div>
        </div>
    );
};
