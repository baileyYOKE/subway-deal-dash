import React, { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AthleteListItem, SignedMediaItem, AthleteMediaResponse, getAthleteMedia } from '../services/mediaService';

interface Props {
    athlete: AthleteListItem;
    allAthletes?: AthleteListItem[]; // Optional: all athletes for navigation
    onClose: () => void;
    onNavigate?: (athlete: AthleteListItem) => void; // Callback when navigating to new athlete
}

// Skeleton loading animation
const SkeletonLoader: React.FC = () => (
    <div className="animate-pulse">
        <div className="aspect-[9/16] max-h-[60vh] bg-gradient-to-b from-gray-200 to-gray-300 rounded-xl overflow-hidden relative">
            {/* Fake video UI elements */}
            <div className="absolute bottom-4 left-4 space-y-2">
                <div className="h-3 w-24 bg-gray-400/30 rounded" />
                <div className="h-3 w-32 bg-gray-400/30 rounded" />
            </div>
            {/* Play button placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-gray-400/40 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[12px] border-l-gray-400/60 border-y-[8px] border-y-transparent ml-1" />
                </div>
            </div>
            {/* Progress bar placeholder */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-400/30">
                <div className="h-full w-1/3 bg-gray-400/50 animate-shimmer" />
            </div>
        </div>
    </div>
);

const MediaView: React.FC<{ media: SignedMediaItem; isLoading: boolean }> = ({ media, isLoading }) => {
    const [imageError, setImageError] = useState(false);

    // Reset error state when media changes
    useEffect(() => {
        setImageError(false);
    }, [media.signedVideoUrl, media.signedImageUrl]);

    if (isLoading) {
        return <SkeletonLoader />;
    }

    // Video content
    if (media.signedVideoUrl) {
        return (
            <div className="relative w-full aspect-[9/16] max-h-[70vh] bg-black rounded-xl overflow-hidden">
                <video
                    src={media.signedVideoUrl}
                    poster={media.signedThumbnailUrl || undefined}
                    controls
                    autoPlay
                    className="absolute inset-0 w-full h-full object-contain"
                />
            </div>
        );
    }

    // Image content
    if (media.signedImageUrl && !imageError) {
        return (
            <div className="relative w-full aspect-[9/16] max-h-[70vh] bg-gray-50 rounded-xl overflow-hidden">
                <img
                    src={media.signedImageUrl}
                    alt="Media preview"
                    className="absolute inset-0 w-full h-full object-contain"
                    onError={() => setImageError(true)}
                />
            </div>
        );
    }

    // Fallback
    return (
        <div className="flex items-center justify-center h-64 bg-gray-100 rounded-xl">
            <p className="text-gray-500">Media not available</p>
        </div>
    );
};

const MediaTypeLabel: React.FC<{ type?: string }> = ({ type }) => {
    if (!type) return null;

    const labels: Record<string, { label: string; color: string }> = {
        'ig_reel': { label: 'Instagram Reel', color: 'from-purple-500 via-pink-500 to-orange-400' },
        'ig_story': { label: 'Instagram Story', color: 'from-orange-400 to-yellow-400' },
        'tiktok': { label: 'TikTok', color: 'from-gray-900 to-black' },
    };

    const config = labels[type.toLowerCase()] || { label: type, color: 'from-gray-500 to-gray-600' };

    return (
        <span className={`px-3 py-1 rounded-full text-white text-xs font-medium bg-gradient-to-r ${config.color}`}>
            {config.label}
        </span>
    );
};

/**
 * Select the best single media item based on priority:
 * 1. Instagram Reel (full video content)
 * 2. TikTok video
 * 3. Instagram Story (fallback)
 */
function selectBestMedia(mediaItems: SignedMediaItem[]): SignedMediaItem | null {
    if (mediaItems.length === 0) return null;
    if (mediaItems.length === 1) return mediaItems[0];

    // Priority order: ig_reel > tiktok > ig_story
    const reelMedia = mediaItems.find(m => m.mediaType?.toLowerCase() === 'ig_reel');
    if (reelMedia) return reelMedia;

    const tiktokMedia = mediaItems.find(m => m.mediaType?.toLowerCase() === 'tiktok');
    if (tiktokMedia) return tiktokMedia;

    const storyMedia = mediaItems.find(m => m.mediaType?.toLowerCase() === 'ig_story');
    if (storyMedia) return storyMedia;

    // Default to first if no type matches
    return mediaItems[0];
}

/**
 * Get the appropriate external link based on media type and athlete data
 */
function getExternalLink(media: SignedMediaItem | null, athlete: AthleteListItem): { url: string; label: string } | null {
    if (!media) return null;

    const mediaType = media.mediaType?.toLowerCase();

    // Instagram Reel - use the permalink if available
    if (mediaType === 'ig_reel' && media.instagramPermalink) {
        return { url: media.instagramPermalink, label: 'View on Instagram' };
    }

    // TikTok - check if athlete has TikTok link in their data
    if (mediaType === 'tiktok') {
        // Look through all media for a TikTok permalink
        const tiktokPermalink = athlete.media.find(m =>
            m.mediaType?.toLowerCase() === 'tiktok' && m.instagramPermalink
        )?.instagramPermalink;
        if (tiktokPermalink) {
            return { url: tiktokPermalink, label: 'View on TikTok' };
        }
    }

    // Instagram Story - stories expire, so no external link
    if (mediaType === 'ig_story') {
        // Check if the athlete has a TikTok we could link to instead
        const tiktokMedia = athlete.media.find(m => m.mediaType?.toLowerCase() === 'tiktok');
        if (tiktokMedia?.instagramPermalink) {
            return { url: tiktokMedia.instagramPermalink, label: 'View on TikTok' };
        }
        // No link for expired stories
        return null;
    }

    // Fallback: if there's any permalink, use it
    if (media.instagramPermalink) {
        return { url: media.instagramPermalink, label: 'View Post' };
    }

    return null;
}

export const AthleteMediaModal: React.FC<Props> = ({ athlete, allAthletes, onClose, onNavigate }) => {
    const [mediaData, setMediaData] = useState<AthleteMediaResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Find current index in the list for navigation
    const currentIndex = allAthletes?.findIndex(
        a => a.firstName === athlete.firstName && a.lastName === athlete.lastName
    ) ?? -1;

    const hasPrev = currentIndex > 0;
    const hasNext = allAthletes ? currentIndex < allAthletes.length - 1 : false;
    const prevAthlete = hasPrev && allAthletes ? allAthletes[currentIndex - 1] : null;
    const nextAthlete = hasNext && allAthletes ? allAthletes[currentIndex + 1] : null;

    // Navigate to prev/next athlete
    const navigateTo = useCallback((direction: 'prev' | 'next') => {
        if (direction === 'prev' && prevAthlete && onNavigate) {
            onNavigate(prevAthlete);
        } else if (direction === 'next' && nextAthlete && onNavigate) {
            onNavigate(nextAthlete);
        }
    }, [prevAthlete, nextAthlete, onNavigate]);

    // Load signed media when modal opens
    useEffect(() => {
        let cancelled = false;

        const loadMedia = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getAthleteMedia(athlete);
                if (!cancelled) {
                    if (data && data.media.length > 0) {
                        setMediaData(data);
                    } else {
                        setError('Could not load media');
                    }
                }
            } catch (err) {
                console.error('[AthleteMediaModal] Error loading media:', err);
                if (!cancelled) {
                    setError('Failed to load media');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadMedia();

        return () => {
            cancelled = true;
        };
    }, [athlete]);

    // Preload next/prev athlete media (fire and forget) 
    useEffect(() => {
        if (nextAthlete) {
            // Preload next athlete's media in the background
            getAthleteMedia(nextAthlete).catch(() => { });
        }
        if (prevAthlete) {
            getAthleteMedia(prevAthlete).catch(() => { });
        }
    }, [nextAthlete, prevAthlete]);

    // Select the single best media item
    const bestMedia = selectBestMedia(mediaData?.media || []);
    const externalLink = getExternalLink(bestMedia, athlete);

    // Keyboard navigation (Escape to close, Arrow keys to navigate)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && hasPrev) {
                navigateTo('prev');
            } else if (e.key === 'ArrowRight' && hasNext) {
                navigateTo('next');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, navigateTo, hasPrev, hasNext]);

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Modal container with arrows inside */}
            <div className="relative max-w-md w-full flex items-center gap-2 md:gap-4">
                {/* Left Arrow */}
                {hasPrev && onNavigate && (
                    <button
                        onClick={(e) => { e.stopPropagation(); navigateTo('prev'); }}
                        className="flex-shrink-0 bg-white/90 hover:bg-white rounded-full p-2 md:p-3 shadow-xl transition-all hover:scale-110"
                    >
                        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-gray-800" />
                    </button>
                )}

                {/* Modal Content */}
                <div
                    className="bg-white rounded-3xl shadow-2xl flex-1 max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative p-6 border-b border-gray-100">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-subway-green to-subway-yellow rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                {athlete.firstName[0]?.toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">
                                    {athlete.firstName} {athlete.lastName}
                                </h2>
                                {athlete.school && (
                                    <p className="text-gray-500">{athlete.school}</p>
                                )}
                                <p className="text-gray-500">{athlete.sport}</p>
                                {/* Dynamic badge based on campaign type (not media type) */}
                                {/* Complete Partnership = Featured Athlete (85), others = Sub Club (340) */}
                                {athlete.campaign === 'Complete Partnership' ? (
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium">
                                        🎬 Featured Athlete
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 bg-pink-100 text-pink-600 rounded-full font-medium">
                                        📸 Sub Club Athlete
                                    </span>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Media Content */}
                    {error ? (
                        <div className="p-6 text-center text-red-500">
                            <p>{error}</p>
                        </div>
                    ) : isLoading ? (
                        <div className="p-6">
                            {/* Fixed-height skeleton to prevent collapse */}
                            <div className="min-h-[300px]">
                                <SkeletonLoader />
                            </div>
                            <p className="text-center text-gray-400 text-sm mt-4">Loading media...</p>
                        </div>
                    ) : bestMedia ? (
                        <div className="p-6">
                            {/* Media type label */}
                            <div className="mb-4">
                                <MediaTypeLabel type={bestMedia.mediaType} />
                            </div>

                            {/* Single media viewer */}
                            <MediaView media={bestMedia} isLoading={false} />

                            {/* External link (View on Instagram/TikTok) */}
                            {externalLink && (
                                <a
                                    href={externalLink.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-4 flex items-center justify-center gap-2 text-subway-green hover:text-subway-green/80 font-medium transition"
                                >
                                    {externalLink.label} <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-400">
                            <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                                <X className="w-6 h-6 opacity-50" />
                            </div>
                            <p>No media available for this athlete</p>
                        </div>
                    )}
                </div>

                {/* Right Arrow */}
                {hasNext && onNavigate && (
                    <button
                        onClick={(e) => { e.stopPropagation(); navigateTo('next'); }}
                        className="flex-shrink-0 bg-white/90 hover:bg-white rounded-full p-2 md:p-3 shadow-xl transition-all hover:scale-110"
                    >
                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-gray-800" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default AthleteMediaModal;

