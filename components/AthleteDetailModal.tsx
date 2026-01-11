import React from 'react';
import { Athlete } from '../types';
import { X, Eye, Heart, MessageCircle, Share2, MousePointer, ExternalLink, Video, Camera } from 'lucide-react';

interface Props {
    athlete: Athlete;
    onClose: () => void;
}

const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

const MetricRow: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
    <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2 text-gray-600">
            {icon}
            <span>{label}</span>
        </div>
        <span className="font-bold text-gray-900">{formatNumber(value)}</span>
    </div>
);

export const AthleteDetailModal: React.FC<Props> = ({ athlete, onClose }) => {
    const hasTikTok = (athlete.tiktok_views || 0) > 0;
    const hasReel = (athlete.ig_reel_views || 0) > 0;
    const hasStory = (athlete.ig_story_1_views || 0) > 0;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Header with close button */}
                <div className="relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur rounded-full p-2 shadow-lg hover:bg-gray-100 transition"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>

                    {/* Profile Image */}
                    <div className="h-48 bg-gradient-to-br from-subway-green/20 to-subway-yellow/20 flex items-center justify-center">
                        {athlete.profile_image_url ? (
                            <img
                                src={athlete.profile_image_url}
                                alt={athlete.user_name}
                                className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl"
                            />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-subway-green to-subway-yellow flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                                {athlete.user_name[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Athlete Info */}
                <div className="p-6">
                    <h2 className="text-2xl font-black text-gray-900 text-center mb-1">
                        {athlete.user_name}
                    </h2>
                    <p className="text-center text-gray-500 mb-6">
                        {athlete.campaign_type === 'video' ? 'Featured Athlete' : 'Sub Club Athlete'}
                    </p>

                    {/* TikTok Section */}
                    {hasTikTok && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">TT</span>
                                    </div>
                                    <span className="font-bold text-gray-900">TikTok</span>
                                </div>
                                {athlete.tiktok_post_url && (
                                    <a
                                        href={athlete.tiktok_post_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-subway-green hover:underline text-sm font-medium"
                                    >
                                        Watch <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 divide-y divide-gray-200">
                                <MetricRow icon={<Eye className="w-4 h-4" />} label="Views" value={athlete.tiktok_views} />
                                <MetricRow icon={<Heart className="w-4 h-4" />} label="Likes" value={athlete.tiktok_likes} />
                                <MetricRow icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={athlete.tiktok_comments} />
                                <MetricRow icon={<Share2 className="w-4 h-4" />} label="Shares" value={athlete.tiktok_shares} />
                            </div>
                        </div>
                    )}

                    {/* IG Reel Section */}
                    {hasReel && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg flex items-center justify-center">
                                        <Video className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-bold text-gray-900">Instagram Reel</span>
                                </div>
                                {athlete.ig_reel_url && (
                                    <a
                                        href={athlete.ig_reel_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-subway-green hover:underline text-sm font-medium"
                                    >
                                        Watch <ExternalLink className="w-3 h-3" />
                                    </a>
                                )}
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 divide-y divide-gray-200">
                                <MetricRow icon={<Eye className="w-4 h-4" />} label="Views" value={athlete.ig_reel_views} />
                                <MetricRow icon={<Heart className="w-4 h-4" />} label="Likes" value={athlete.ig_reel_likes} />
                                <MetricRow icon={<MessageCircle className="w-4 h-4" />} label="Comments" value={athlete.ig_reel_comments} />
                                <MetricRow icon={<Share2 className="w-4 h-4" />} label="Shares" value={athlete.ig_reel_shares} />
                            </div>
                        </div>
                    )}

                    {/* IG Story Section */}
                    {hasStory && (
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-lg flex items-center justify-center">
                                    <Camera className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-bold text-gray-900">Instagram Story</span>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 divide-y divide-gray-200">
                                <MetricRow icon={<Eye className="w-4 h-4" />} label="Views" value={athlete.ig_story_1_views} />
                                <MetricRow icon={<MousePointer className="w-4 h-4" />} label="Link Taps" value={athlete.ig_story_1_taps} />
                                <MetricRow icon={<MessageCircle className="w-4 h-4" />} label="Replies" value={athlete.ig_story_1_replies} />
                                <MetricRow icon={<Share2 className="w-4 h-4" />} label="Shares" value={athlete.ig_story_1_shares} />
                            </div>
                        </div>
                    )}

                    {/* No metrics */}
                    {!hasTikTok && !hasReel && !hasStory && (
                        <div className="text-center text-gray-400 py-8">
                            No metrics available yet
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AthleteDetailModal;
