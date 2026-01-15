import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
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

    // Video content - check for truthy URL
    if (media.signedVideoUrl && media.signedVideoUrl.length > 0) {
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

    // Image content - check for truthy URL
    if (media.signedImageUrl && media.signedImageUrl.length > 0 && !imageError) {
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

export const AthleteMediaModal: React.FC<Props> = ({ athlete, onClose }) => {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [mediaData, setMediaData] = useState<AthleteMediaResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load signed media when modal opens
    useEffect(() => {
        let cancelled = false;

        const loadMedia = async () => {
            setIsLoading(true);
            setError(null);

            // Check if we have direct S3 URLs encoded in the hash
            const firstMedia = athlete.media[0];
            if (firstMedia && (firstMedia.hash?.startsWith('direct:') || firstMedia.hash?.startsWith('direct-video:'))) {
                // Direct URL mode - extract URL from hash and use directly
                const isVideo = firstMedia.hash.startsWith('direct-video:');
                const directUrl = firstMedia.hash.replace('direct-video:', '').replace('direct:', '');
                console.log('[AthleteMediaModal] Using direct S3 URL:', directUrl, 'isVideo:', isVideo);

                // Create media item with proper URL assignment
                const mediaItem: SignedMediaItem = {
                    signedImageUrl: isVideo ? '' : directUrl,
                    signedVideoUrl: isVideo ? directUrl : '',
                    signedThumbnailUrl: '',
                    mediaType: firstMedia.mediaType,
                    instagramPermalink: '',
                    hasVideo: isVideo,
                    hasImage: !isVideo
                };

                const directMediaResponse: AthleteMediaResponse = {
                    firstName: athlete.firstName,
                    lastName: athlete.lastName,
                    sport: athlete.sport,
                    campaign: athlete.campaign,
                    media: [mediaItem]
                };

                if (!cancelled) {
                    setMediaData(directMediaResponse);
                    setIsLoading(false);
                }
                return;
            }

            // Regular mode - fetch signed URLs from API
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

    const mediaItems = mediaData?.media || [];
    const hasMultiple = mediaItems.length > 1;
    const currentMedia = mediaItems[currentIdx];

    const goNext = () => setCurrentIdx((prev) => (prev + 1) % mediaItems.length);
    const goPrev = () => setCurrentIdx((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight' && hasMultiple) {
                goNext();
            } else if (e.key === 'ArrowLeft' && hasMultiple) {
                goPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasMultiple, onClose]);

    const mediaCount = athlete.media.length;

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
                ) : mediaItems.length > 0 ? (
                    <div className="p-6">
                        {/* Media type label */}
                        <div className="flex items-center justify-between mb-4">
                            <MediaTypeLabel type={currentMedia?.mediaType} />
                        </div>

                        {/* Media viewer - single item, no navigation */}
                        <div className="relative">
                            {currentMedia && <MediaView media={currentMedia} isLoading={false} />}
                        </div>
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
