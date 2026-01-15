import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';
import { AthleteListItem, SignedMediaItem, AthleteMediaResponse, getAthleteMedia } from '../services/mediaService';

interface Props {
    athlete: AthleteListItem;
    onClose: () => void;
}

const MediaView: React.FC<{ media: SignedMediaItem; isLoading: boolean }> = ({ media, isLoading }) => {
    const [imageError, setImageError] = useState(false);

    // Reset error state when media changes
    useEffect(() => {
        setImageError(false);
    }, [media.signedVideoUrl, media.signedImageUrl]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-100 rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-subway-green" />
            </div>
        );
    }

    // Video content
    if (media.signedVideoUrl) {
        return (
            <video
                src={media.signedVideoUrl}
                poster={media.signedThumbnailUrl || undefined}
                controls
                autoPlay
                className="w-full max-h-[60vh] rounded-xl object-contain bg-black"
            />
        );
    }

    // Image content
    if (media.signedImageUrl && !imageError) {
        return (
            <img
                src={media.signedImageUrl}
                alt="Media preview"
                className="w-full max-h-[60vh] rounded-xl object-contain"
                onError={() => setImageError(true)}
            />
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

export const AthleteMediaModal: React.FC<Props> = ({ athlete, onClose }) => {
    const [mediaData, setMediaData] = useState<AthleteMediaResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    // Select the single best media item
    const bestMedia = selectBestMedia(mediaData?.media || []);
    const externalLink = getExternalLink(bestMedia, athlete);

    // Keyboard navigation (Escape to close)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
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
                            {athlete.campaign && (
                                <span className="text-xs px-2 py-0.5 bg-subway-green/10 text-subway-green rounded-full font-medium">
                                    {athlete.campaign}
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
                    <div className="p-6 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-subway-green" />
                        <p className="text-gray-500 text-sm">Loading media...</p>
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
        </div>
    );
};

export default AthleteMediaModal;
