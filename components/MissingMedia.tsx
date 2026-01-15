import React, { useMemo, useState } from 'react';
import { Athlete } from '../types';
import { AlertCircle, CheckCircle, Save, ChevronDown, ChevronUp, Copy, Check, Video, Instagram, UserX, Wand2 } from 'lucide-react';

interface Props {
    data: Athlete[];
    onUpdate: (updatedData: Athlete[]) => void;
}

// Historical ratios interface
interface HistoricalRatios {
    tapsToViews: number;      // What % of viewers tap forward
    repliesToViews: number;   // What % of viewers reply
    sharesToViews: number;    // What % of viewers share
    sampleSize: number;       // How many data points we have
}

// Calculate historical ratios from real story data
const calculateHistoricalRatios = (athletes: Athlete[]): HistoricalRatios => {
    let totalViews = 0;
    let totalTaps = 0;
    let totalReplies = 0;
    let totalShares = 0;
    let sampleSize = 0;

    athletes.forEach(a => {
        // Story 1
        if (a.ig_story_1_views > 0) {
            totalViews += a.ig_story_1_views;
            totalTaps += a.ig_story_1_taps || 0;
            totalReplies += a.ig_story_1_replies || 0;
            totalShares += a.ig_story_1_shares || 0;
            sampleSize++;
        }
        // Story 2
        if (a.ig_story_2_views > 0) {
            totalViews += a.ig_story_2_views;
            totalTaps += a.ig_story_2_taps || 0;
            totalReplies += a.ig_story_2_replies || 0;
            totalShares += a.ig_story_2_shares || 0;
            sampleSize++;
        }
        // Story 3
        if (a.ig_story_3_views > 0) {
            totalViews += a.ig_story_3_views;
            totalTaps += a.ig_story_3_taps || 0;
            totalReplies += a.ig_story_3_replies || 0;
            totalShares += a.ig_story_3_shares || 0;
            sampleSize++;
        }
    });

    if (totalViews === 0) {
        // Default ratios if no data
        return { tapsToViews: 0.15, repliesToViews: 0.02, sharesToViews: 0.01, sampleSize: 0 };
    }

    return {
        tapsToViews: totalTaps / totalViews,
        repliesToViews: totalReplies / totalViews,
        sharesToViews: totalShares / totalViews,
        sampleSize
    };
};

// Add random variance to a ratio (±30% variance)
const addVariance = (baseValue: number, variancePercent: number = 0.3): number => {
    const variance = baseValue * variancePercent;
    const randomOffset = (Math.random() - 0.5) * 2 * variance;
    return Math.max(0, Math.round(baseValue + randomOffset));
};

// Generate mock story data based on views and historical ratios
const generateMockStoryData = (views: number, ratios: HistoricalRatios) => {
    // Calculate base values from historical ratios
    const baseTaps = views * ratios.tapsToViews;
    const baseReplies = views * ratios.repliesToViews;
    const baseShares = views * ratios.sharesToViews;

    // Add variance (30% random variation)
    return {
        taps: addVariance(baseTaps, 0.35),
        replies: addVariance(baseReplies, 0.5),  // More variance on replies (rarer event)
        shares: addVariance(baseShares, 0.45)    // More variance on shares
    };
};

// Estimate views for a story based on IG reel views (stories get ~10% of reel views on average)
const estimateStoryViews = (athlete: Athlete): number => {
    // Use IG reel views as baseline, stories get ~8-12% of reel views
    const reelViews = athlete.ig_reel_views || 0;
    if (reelViews > 0) {
        const baseRatio = 0.08 + (Math.random() * 0.04); // 8-12%
        return addVariance(Math.round(reelViews * baseRatio), 0.25);
    }

    // Fallback: use TikTok views as rough proxy (stories get even less vs TT)
    const tiktokViews = athlete.tiktok_views || 0;
    if (tiktokViews > 0) {
        const baseRatio = 0.05 + (Math.random() * 0.03); // 5-8% - IG stories much less than TT
        return addVariance(Math.round(tiktokViews * baseRatio), 0.3);
    }

    // No data to estimate from - use a reasonable default range
    return Math.floor(Math.random() * 300) + 200; // 200-500 views
};

// Helper to clean username
const cleanUsername = (username: string): string => {
    if (!username) return '';
    return username.replace(/^@/, '').trim();
};

// Copy phone with feedback
const CopyPhone: React.FC<{ phone: string }> = ({ phone }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(phone);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { console.error('Copy failed:', err); }
    };
    if (!phone) return <span className="text-gray-400">-</span>;
    return (
        <button onClick={handleCopy} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition group" title="Click to copy">
            <span>{phone}</span>
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="opacity-0 group-hover:opacity-100 transition" />}
        </button>
    );
};

// Clickable IG link
const IGLink: React.FC<{ username: string }> = ({ username }) => {
    const clean = cleanUsername(username);
    if (!clean) return <span className="text-gray-400 text-xs">No IG</span>;
    return (
        <a href={`https://instagram.com/${clean}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-pink-600 hover:text-pink-800 hover:underline text-xs">
            <Instagram size={12} />@{clean}
        </a>
    );
};

// Clickable TikTok link
const TikTokLink: React.FC<{ username: string }> = ({ username }) => {
    const clean = cleanUsername(username);
    if (!clean) return <span className="text-gray-400 text-xs">No TT</span>;
    return (
        <a href={`https://tiktok.com/@${clean}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-900 hover:text-black hover:underline text-xs">
            <Video size={12} />@{clean}
        </a>
    );
};

export const MissingMedia: React.FC<Props> = ({ data, onUpdate }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Record<string, Partial<Athlete>>>({});

    // Find athletes with post URLs but missing usernames
    const athletesMissingUsernames = useMemo(() => {
        return data.filter(athlete => {
            const hasReelUrl = !!(athlete.ig_reel_url && athlete.ig_reel_url.length > 0);
            const hasTikTokUrl = !!(athlete.tiktok_post_url && athlete.tiktok_post_url.length > 0);
            const missingIgAccount = !athlete.ig_account || athlete.ig_account.trim() === '';
            const missingTikTokAccount = !athlete.tiktok_account || athlete.tiktok_account.trim() === '';

            // Has a post URL but missing the corresponding account
            return (hasReelUrl && missingIgAccount) || (hasTikTokUrl && missingTikTokAccount);
        });
    }, [data]);

    // Find athletes with partial media (some but not all)
    // For Subway Deal 2:
    // - Featured Athletes (TikTok/Reel): Need TikTok OR Reel + Story 1 + Profile Pic
    // - SubClub Athletes (Story only): Need Story 1 + Profile Pic + AWS URL (content)
    const athletesWithMissing = useMemo(() => {
        return data
            .map(athlete => {
                const hasTikTok = !!(athlete.tiktok_post_url && athlete.tiktok_post_url.length > 0);
                const hasReel = !!(athlete.ig_reel_url && athlete.ig_reel_url.length > 0) || athlete.ig_reel_views > 0;
                const hasStory1 = athlete.ig_story_1_views > 0;
                const hasProfilePic = !!(athlete.profile_image_url && athlete.profile_image_url.length > 0);
                const hasAwsUrl = !!(athlete.approved_aws_url && athlete.approved_aws_url.length > 0);

                // Determine athlete type
                const isFeatured = hasTikTok || hasReel;
                const isSubClub = !isFeatured && hasStory1;

                // For Featured: need video + story + profile pic
                // For SubClub: need story + profile pic + aws url (content)
                let isComplete = false;
                let missingItems: string[] = [];

                if (isFeatured) {
                    // Featured athlete - needs (TikTok OR Reel) + Story 1 + Profile Pic
                    if (!hasTikTok && !hasReel) missingItems.push('TikTok/Reel');
                    if (!hasStory1) missingItems.push('Story');
                    if (!hasProfilePic) missingItems.push('Profile Pic');
                    isComplete = (hasTikTok || hasReel) && hasStory1 && hasProfilePic;
                } else if (isSubClub) {
                    // SubClub athlete - needs Story 1 + Profile Pic + AWS URL
                    if (!hasStory1) missingItems.push('Story');
                    if (!hasProfilePic) missingItems.push('Profile Pic');
                    if (!hasAwsUrl) missingItems.push('AWS URL');
                    isComplete = hasStory1 && hasProfilePic && hasAwsUrl;
                } else {
                    // No content at all - skip
                    return null;
                }

                return {
                    athlete,
                    hasTikTok,
                    hasReel,
                    hasStory1,
                    hasProfilePic,
                    hasAwsUrl,
                    isFeatured,
                    isSubClub,
                    missingItems,
                    isComplete
                };
            })
            .filter(a => a !== null && !a.isComplete)
            .sort((a, b) => a!.missingItems.length - b!.missingItems.length);
    }, [data]);

    const handleExpand = (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            const athlete = data.find(a => a.id === id);
            if (athlete && !editValues[id]) {
                setEditValues(prev => ({
                    ...prev,
                    [id]: { ...athlete }
                }));
            }
        }
    };

    const handleFieldChange = (id: string, field: keyof Athlete, value: string | number) => {
        setEditValues(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    const handleSave = (id: string) => {
        const updates = editValues[id];
        if (!updates) return;

        const newData = data.map(athlete => {
            if (athlete.id === id) {
                return { ...athlete, ...updates };
            }
            return athlete;
        });

        onUpdate(newData);
        setExpandedId(null);
    };

    // Calculate historical ratios from real data (MUST be before any early returns!)
    const historicalRatios = useMemo(() => calculateHistoricalRatios(data), [data]);

    // Handle username field update
    const handleUsernameUpdate = (athleteId: string, field: 'ig_account' | 'tiktok_account', value: string) => {
        const newData = data.map(athlete => {
            if (athlete.id === athleteId) {
                return { ...athlete, [field]: value };
            }
            return athlete;
        });
        onUpdate(newData);
    };

    // Early return AFTER all hooks are declared
    if (athletesWithMissing.length === 0 && athletesMissingUsernames.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Complete!</h3>
                <p className="text-gray-500">No athletes with partial media or missing accounts found.</p>
            </div>
        );
    }

    // Handle mock all missing story data
    const handleMockAllMissing = () => {
        try {
            const athletesToMock = athletesWithMissing.filter(
                a => a && !a.hasStory1
            );

            if (athletesToMock.length === 0) {
                alert('No athletes need story data mocking!');
                return;
            }

            const confirmed = confirm(
                `This will fill missing Story 1 data for ${athletesToMock.length} athletes using:\n\n` +
                `📊 Historical Ratios (from ${historicalRatios.sampleSize} real stories):\n` +
                `• Taps/Views: ${(historicalRatios.tapsToViews * 100).toFixed(1)}%\n` +
                `• Replies/Views: ${(historicalRatios.repliesToViews * 100).toFixed(2)}%\n` +
                `• Shares/Views: ${(historicalRatios.sharesToViews * 100).toFixed(2)}%\n\n` +
                `Each value will have ±30-50% random variance.\n\nContinue?`
            );

            if (!confirmed) return;

            let mockCount = 0;
            const athleteIdsToMock = new Set(athletesToMock.map(a => a!.athlete.id));

            const newData = data.map(athlete => {
                if (!athleteIdsToMock.has(athlete.id)) return athlete;

                const athleteInfo = athletesToMock.find(a => a!.athlete.id === athlete.id);
                if (!athleteInfo) return athlete;

                const updated = { ...athlete };

                // Mock Story 1 if missing
                if (!athleteInfo.hasStory1) {
                    const views = estimateStoryViews(athlete);
                    const mock = generateMockStoryData(views, historicalRatios);
                    updated.ig_story_1_views = views;
                    updated.ig_story_1_taps = mock.taps;
                    updated.ig_story_1_replies = mock.replies;
                    updated.ig_story_1_shares = mock.shares;
                    updated.has_mock_data = true;
                    mockCount++;
                }

                return updated;
            });

            console.log('🎭 Mock data generated for', mockCount, 'story slots');
            console.log('📊 New data length:', newData.length);

            // Use setTimeout to ensure React state update happens cleanly
            setTimeout(() => {
                onUpdate(newData);
                alert(`✨ Mocked ${mockCount} story slots for ${athletesToMock.length} athletes!\n\nClick "Save to Cloud" to persist.`);
            }, 0);
        } catch (error) {
            console.error('❌ Mock data error:', error);
            alert('Error generating mock data. Check console for details.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Missing Usernames Section */}
            {athletesMissingUsernames.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-purple-200 overflow-hidden">
                    <div className="px-4 py-3 bg-purple-50 border-b border-purple-200 flex items-center gap-2">
                        <UserX className="w-5 h-5 text-purple-600" />
                        <span className="font-medium text-purple-800">Missing Account Usernames</span>
                        <span className="ml-auto px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {athletesMissingUsernames.length}
                        </span>
                    </div>
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Athlete</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Phone</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Assigned To</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">IG Username</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">TikTok Username</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {athletesMissingUsernames.map(athlete => {
                                const needsIg = !!(athlete.ig_reel_url && athlete.ig_reel_url.length > 0) && (!athlete.ig_account || athlete.ig_account.trim() === '');
                                const needsTikTok = !!(athlete.tiktok_post_url && athlete.tiktok_post_url.length > 0) && (!athlete.tiktok_account || athlete.tiktok_account.trim() === '');

                                return (
                                    <tr key={athlete.id} className="hover:bg-purple-50 transition-colors">
                                        <td className="px-4 py-2 font-medium text-gray-900">{athlete.user_name}</td>
                                        <td className="px-4 py-2"><CopyPhone phone={athlete.user_phone_number} /></td>
                                        <td className="px-4 py-2">
                                            {athlete.assigned_to ? (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{athlete.assigned_to}</span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {needsIg ? (
                                                <input
                                                    type="text"
                                                    placeholder="Enter IG username"
                                                    className="px-2 py-1 border border-purple-300 rounded text-sm w-32 focus:ring-2 focus:ring-purple-400"
                                                    onBlur={(e) => handleUsernameUpdate(athlete.id, 'ig_account', e.target.value)}
                                                    defaultValue={athlete.ig_account || ''}
                                                />
                                            ) : (
                                                <IGLink username={athlete.ig_account} />
                                            )}
                                        </td>
                                        <td className="px-4 py-2">
                                            {needsTikTok ? (
                                                <input
                                                    type="text"
                                                    placeholder="Enter TikTok username"
                                                    className="px-2 py-1 border border-purple-300 rounded text-sm w-32 focus:ring-2 focus:ring-purple-400"
                                                    onBlur={(e) => handleUsernameUpdate(athlete.id, 'tiktok_account', e.target.value)}
                                                    defaultValue={athlete.tiktok_account || ''}
                                                />
                                            ) : (
                                                <TikTokLink username={athlete.tiktok_account} />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Missing Media Section */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Missing Media</h2>
                    <p className="text-gray-500 text-sm">Athletes with some but not all media types</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleMockAllMissing}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm"
                    >
                        <Wand2 size={16} />
                        Mock All Missing Stories
                    </button>
                    <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <span className="text-gray-600">{athletesWithMissing.length} athletes need attention</span>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {athletesWithMissing.map((item) => {
                    if (!item) return null;
                    const { athlete, hasTikTok, hasReel, hasStory1, hasProfilePic, hasAwsUrl, isFeatured, isSubClub, missingItems } = item;
                    const isExpanded = expandedId === athlete.id;
                    const values = editValues[athlete.id] || {};

                    // Helper to get value for a field
                    const getVal = (field: keyof Athlete) => values[field] ?? athlete[field] ?? 0;

                    return (
                        <div key={athlete.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            {/* Header Row */}
                            <div
                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                                onClick={() => handleExpand(athlete.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">{athlete.user_name}</span>
                                        <CopyPhone phone={athlete.user_phone_number} />
                                        {athlete.assigned_to && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                                {athlete.assigned_to}
                                            </span>
                                        )}
                                        {isFeatured && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                                Featured
                                            </span>
                                        )}
                                        {isSubClub && (
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                                                SubClub
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                        {isFeatured && (
                                            <>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${hasTikTok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {hasTikTok ? '✓' : '-'} TikTok
                                                </span>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${hasReel ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {hasReel ? '✓' : '-'} Reel
                                                </span>
                                            </>
                                        )}
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${hasStory1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {hasStory1 ? '✓' : '✗'} Story
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${hasProfilePic ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {hasProfilePic ? '✓' : '✗'} Profile Pic
                                        </span>
                                        {isSubClub && (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${hasAwsUrl ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {hasAwsUrl ? '✓' : '✗'} AWS URL
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-orange-600 font-medium">Missing: {missingItems.join(', ')}</span>
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </div>

                            {/* Expanded Edit Form */}
                            {isExpanded && (
                                <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-6">
                                    {/* TikTok & Reel URLs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className={!hasTikTok ? 'ring-2 ring-orange-200 rounded-lg p-3 bg-white' : 'p-3 bg-white rounded-lg'}>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                TikTok URL {!hasTikTok && <span className="text-orange-500">*Missing</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={String(getVal('tiktok_post_url') || '')}
                                                onChange={(e) => handleFieldChange(athlete.id, 'tiktok_post_url', e.target.value)}
                                                placeholder="https://tiktok.com/..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                            />
                                        </div>

                                        <div className={!hasReel ? 'ring-2 ring-orange-200 rounded-lg p-3 bg-white' : 'p-3 bg-white rounded-lg'}>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                IG Reel URL {!hasReel && <span className="text-orange-500">*Missing</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={String(getVal('ig_reel_url') || '')}
                                                onChange={(e) => handleFieldChange(athlete.id, 'ig_reel_url', e.target.value)}
                                                placeholder="https://instagram.com/reel/..."
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Story 1 */}
                                    <div className={!hasStory1 ? 'ring-2 ring-orange-200 rounded-lg p-4 bg-white' : 'p-4 bg-white rounded-lg border border-gray-200'}>
                                        <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                            Story 1 {!hasStory1 && <span className="text-orange-500 font-normal">*Missing</span>}
                                        </h4>
                                        <div className="grid grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Views</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={getVal('ig_story_1_views')}
                                                    onChange={(e) => handleFieldChange(athlete.id, 'ig_story_1_views', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Taps</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={getVal('ig_story_1_taps')}
                                                    onChange={(e) => handleFieldChange(athlete.id, 'ig_story_1_taps', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Replies</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={getVal('ig_story_1_replies')}
                                                    onChange={(e) => handleFieldChange(athlete.id, 'ig_story_1_replies', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Shares</label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={getVal('ig_story_1_shares')}
                                                    onChange={(e) => handleFieldChange(athlete.id, 'ig_story_1_shares', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profile Picture URL */}
                                    <div className={!hasProfilePic ? 'ring-2 ring-orange-200 rounded-lg p-4 bg-white' : 'p-4 bg-white rounded-lg border border-gray-200'}>
                                        <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                            Profile Picture {!hasProfilePic && <span className="text-orange-500 font-normal">*Missing</span>}
                                        </h4>
                                        <div className="flex gap-4 items-center">
                                            <div className="flex-1">
                                                <label className="block text-xs text-gray-500 mb-1">Profile Image URL</label>
                                                <input
                                                    type="text"
                                                    value={String(getVal('profile_image_url') || '')}
                                                    onChange={(e) => handleFieldChange(athlete.id, 'profile_image_url', e.target.value)}
                                                    placeholder="https://..."
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                />
                                            </div>
                                            {athlete.profile_image_url && (
                                                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
                                                    <img src={athlete.profile_image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* AWS Content URL (for SubClub athletes) */}
                                    {isSubClub && (
                                        <div className={!hasAwsUrl ? 'ring-2 ring-orange-200 rounded-lg p-4 bg-white' : 'p-4 bg-white rounded-lg border border-gray-200'}>
                                            <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                                Content URL (AWS) {!hasAwsUrl && <span className="text-orange-500 font-normal">*Missing</span>}
                                            </h4>
                                            <div className="flex gap-4 items-center">
                                                <div className="flex-1">
                                                    <label className="block text-xs text-gray-500 mb-1">AWS Content URL (approved_aws_url)</label>
                                                    <input
                                                        type="text"
                                                        value={String(getVal('approved_aws_url') || '')}
                                                        onChange={(e) => handleFieldChange(athlete.id, 'approved_aws_url', e.target.value)}
                                                        placeholder="https://..."
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-hardees-yellow focus:border-transparent"
                                                    />
                                                </div>
                                                {athlete.approved_aws_url && (
                                                    <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
                                                        <img src={athlete.approved_aws_url} alt="Content" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <button
                                            onClick={() => handleSave(athlete.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                                        >
                                            <Save size={16} />
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
