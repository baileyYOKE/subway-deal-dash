import React, { useState, useEffect, useMemo } from 'react';
import { Athlete } from '../types';
import { loadDataFromCloud, loadShowcaseData, loadScrapedComments, TopContent, FeaturedComment, ScrapedCommentsStore } from '../services/dataService';
import { AthleteListItem, loadAthleteList, createAthleteLookup } from '../services/mediaService';
import { isBaselineAthlete } from '../services/baselineAthletes';
import { Lock, Eye, Users, Video, TrendingUp, MessageCircle, ExternalLink, Heart, BarChart3, Award, Zap, Star } from 'lucide-react';
import { AthleteCarousel, AthleteImage, parseAthleteImageCSV, athletesToCarouselImages } from './AthleteCarousel';
import { AthleteDetailModal } from './AthleteDetailModal';
import { AthleteMediaModal } from './AthleteMediaModal';

const PUBLIC_PASSCODE = 'subway';

// Calculate detailed stats by athlete tier and platform
const calculateDetailedStats = (athletes: Athlete[]) => {
    const realAthletes = athletes.filter(a => !a.user_name.startsWith('Video_Athlete_') && !a.user_name.startsWith('Story_Athlete_'));

    // Featured Athletes = those with TikTok OR IG Reel (they do video + story)
    const featuredAthletes = realAthletes.filter(a => (a.tiktok_views || 0) > 0 || (a.ig_reel_views || 0) > 0);

    // Sub Club Athletes = those with ONLY story (no video)
    const subClubAthletes = realAthletes.filter(a =>
        (a.tiktok_views || 0) === 0 &&
        (a.ig_reel_views || 0) === 0 &&
        (a.ig_story_1_views || 0) > 0
    );

    // Featured Athletes stats by platform
    let featuredTikTokViews = 0, featuredTikTokLikes = 0, featuredTikTokComments = 0;
    let featuredReelViews = 0, featuredReelLikes = 0, featuredReelComments = 0;
    let featuredStoryViews = 0, featuredStoryTaps = 0;

    featuredAthletes.forEach(a => {
        featuredTikTokViews += a.tiktok_views || 0;
        featuredTikTokLikes += a.tiktok_likes || 0;
        featuredTikTokComments += a.tiktok_comments || 0;
        featuredReelViews += a.ig_reel_views || 0;
        featuredReelLikes += a.ig_reel_likes || 0;
        featuredReelComments += a.ig_reel_comments || 0;
        featuredStoryViews += a.ig_story_1_views || 0;
        featuredStoryTaps += a.ig_story_1_taps || 0;
    });

    // Sub Club Athletes stats (story only)
    let subClubStoryViews = 0, subClubStoryTaps = 0, subClubStoryReplies = 0, subClubStoryShares = 0;

    subClubAthletes.forEach(a => {
        subClubStoryViews += a.ig_story_1_views || 0;
        subClubStoryTaps += a.ig_story_1_taps || 0;
        subClubStoryReplies += a.ig_story_1_replies || 0;
        subClubStoryShares += a.ig_story_1_shares || 0;
    });

    // Totals
    const totalViews = featuredTikTokViews + featuredReelViews + featuredStoryViews + subClubStoryViews;
    const totalPosts = realAthletes.filter(a =>
        (a.tiktok_views || 0) > 0 || (a.ig_reel_views || 0) > 0 || (a.ig_story_1_views || 0) > 0
    ).length;

    return {
        totalViews,
        totalAthletes: realAthletes.length,
        totalPosts,
        featured: {
            count: featuredAthletes.length,
            tiktok: { views: featuredTikTokViews, likes: featuredTikTokLikes, comments: featuredTikTokComments },
            reel: { views: featuredReelViews, likes: featuredReelLikes, comments: featuredReelComments },
            story: { views: featuredStoryViews, taps: featuredStoryTaps }
        },
        subClub: {
            count: subClubAthletes.length,
            story: { views: subClubStoryViews, taps: subClubStoryTaps, replies: subClubStoryReplies, shares: subClubStoryShares }
        }
    };
};


const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

// Animated counter with spring effect
const AnimatedCounter: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        const duration = 2000;
        const steps = 60;
        const increment = value / steps;
        let current = 0;

        const timer = setInterval(() => {
            current += increment;
            if (current >= value) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.floor(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{formatNumber(displayValue)}{suffix}</span>;
};

// Floating Sandwich Component
const FloatingSandwich: React.FC<{ style: React.CSSProperties; emoji: string }> = ({ style, emoji }) => (
    <div
        className="absolute text-4xl md:text-6xl pointer-events-none select-none animate-float opacity-60"
        style={style}
    >
        {emoji}
    </div>
);

// Stat Card - Premium glass effect
const StatCard: React.FC<{ icon: React.ReactNode; value: number | string; label: string; suffix?: string; delay?: number }> =
    ({ icon, value, label, suffix = '', delay = 0 }) => (
        <div
            className="relative bg-white/80 backdrop-blur-sm rounded-3xl p-6 border border-subway-green/20 shadow-xl shadow-subway-green/5 hover:shadow-2xl hover:shadow-subway-green/10 transition-all duration-500 group hover:-translate-y-2"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="absolute -top-3 -right-3 w-16 h-16 bg-gradient-to-br from-subway-green to-subway-yellow rounded-2xl flex items-center justify-center shadow-lg transform rotate-12 group-hover:rotate-0 transition-transform">
                <div className="text-white">{icon}</div>
            </div>
            <div className="text-5xl font-black text-gray-900 mb-1">
                {typeof value === 'number' ? <AnimatedCounter value={value} suffix={suffix} /> : value}
            </div>
            <div className="text-gray-500 font-medium uppercase tracking-wider text-sm">{label}</div>
        </div>
    );

// Comment Card - Fresh design
const CommentCard: React.FC<{ comment: FeaturedComment; platform: 'tiktok' | 'instagram' }> = ({ comment, platform }) => {
    const gradients = {
        tiktok: 'from-black via-gray-900 to-black',
        instagram: 'from-purple-500 via-pink-500 to-orange-400'
    };

    return (
        <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-all hover:-translate-y-1 group">
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradients[platform]} flex items-center justify-center text-white font-bold shadow-lg`}>
                    {comment.athleteName?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-gray-900">{comment.athleteName || 'Fan'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${platform === 'tiktok' ? 'bg-black text-white' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                            }`}>
                            {platform === 'tiktok' ? 'TikTok' : 'Instagram'}
                        </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{comment.text}</p>
                </div>
                <Heart className="w-5 h-5 text-red-500 fill-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    );
};

// Top Content Card - Vibrant
const TopContentCard: React.FC<{ content: TopContent }> = ({ content }) => {
    const platformThemes = {
        tiktok: { bg: 'from-gray-900 to-black', accent: '#00f2ea', label: 'TikTok' },
        ig_reel: { bg: 'from-purple-600 via-pink-500 to-orange-400', accent: '#e1306c', label: 'Reel' },
        ig_story: { bg: 'from-yellow-400 via-orange-500 to-red-500', accent: '#fd1d1d', label: 'Story' }
    };

    const theme = platformThemes[content.type];

    return (
        <div className="group relative overflow-hidden rounded-3xl bg-white shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
            <div className={`bg-gradient-to-br ${theme.bg} aspect-[9/16] flex items-center justify-center relative`}>
                {content.videoUrl ? (
                    <a
                        href={content.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-4 text-white z-10"
                    >
                        <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Video className="w-10 h-10" />
                        </div>
                        <span className="flex items-center gap-2 font-medium">
                            Watch Now <ExternalLink size={16} />
                        </span>
                    </a>
                ) : (
                    <Video className="w-16 h-16 text-white/30" />
                )}

                {/* View count badge */}
                <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-white" />
                    <span className="text-white font-bold">{formatNumber(content.views)}</span>
                </div>

                {/* Platform badge */}
                <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1 shadow-lg">
                    <span className="font-bold text-sm">{theme.label}</span>
                </div>
            </div>

            <div className="p-5 bg-white">
                <div className="font-bold text-lg text-gray-900">{content.athleteName}</div>
                <div className="text-subway-green font-medium flex items-center gap-1">
                    <Zap className="w-4 h-4" /> Top Performer
                </div>
            </div>
        </div>
    );
};

export const PublicShowcase: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passcodeInput, setPasscodeInput] = useState('');
    const [data, setData] = useState<Athlete[]>([]);
    const [topContent, setTopContent] = useState<TopContent[]>([]);
    const [featuredComments, setFeaturedComments] = useState<FeaturedComment[]>([]);
    const [scrapedData, setScrapedData] = useState<ScrapedCommentsStore | null>(null);
    const [athleteImages, setAthleteImages] = useState<AthleteImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [athleteMediaList, setAthleteMediaList] = useState<AthleteListItem[]>([]);
    const [selectedMediaAthlete, setSelectedMediaAthlete] = useState<AthleteListItem | null>(null);
    const [carouselFilter, setCarouselFilter] = useState<'all' | 'featured' | 'subclub'>('all');

    useEffect(() => {
        // Check localStorage first
        const authStatus = localStorage.getItem('subway_public_auth');
        if (authStatus === 'true') {
            setIsAuthenticated(true);
            return;
        }

        // Check URL query param: ?auth=subway or #/public?auth=subway
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
        const authParam = urlParams.get('auth') || hashParams.get('auth');

        if (authParam?.toLowerCase() === PUBLIC_PASSCODE) {
            setIsAuthenticated(true);
            localStorage.setItem('subway_public_auth', 'true');
            console.log('✅ Authenticated via URL parameter');
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            Promise.all([
                loadDataFromCloud(),
                loadShowcaseData(),
                loadScrapedComments(),
                loadAthleteList()
            ]).then(([athleteResult, showcaseResult, scrapedResult, mediaList]) => {
                if (athleteResult.athletes) {
                    setData(athleteResult.athletes);
                    // Use Firestore data for carousel (with athlete objects attached)
                    const carouselAthletes = athletesToCarouselImages(athleteResult.athletes);
                    console.log('[PublicShowcase] Carousel athletes:', carouselAthletes.length, 'video:', carouselAthletes.filter(a => a.isVideoAthlete).length);
                    setAthleteImages(carouselAthletes);
                }
                setTopContent(showcaseResult.topContent);
                setFeaturedComments(showcaseResult.featuredComments);
                setScrapedData(scrapedResult);
                setAthleteMediaList(mediaList);
                setLoading(false);
            });
        }
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passcodeInput.toLowerCase() === PUBLIC_PASSCODE) {
            setIsAuthenticated(true);
            localStorage.setItem('subway_public_auth', 'true');
        } else {
            alert('Incorrect passcode');
        }
    };

    const stats = calculateDetailedStats(data);
    // Combine scraped comments from TikTok and IG, dedupe by text, sort by likes
    // Keep TikTok and Instagram separate for the split layout
    const { tiktokComments, instagramComments } = useMemo(() => {
        const ttComments = (scrapedData?.tiktok || []).map(c => ({
            id: c.id || Math.random().toString(36).substr(2, 9),
            text: c.text,
            platform: 'tiktok' as const,
            athleteName: c.athleteName || c.username || '',
            username: c.username || '',
            likes: c.likes || 0,
            profilePicUrl: c.profilePicUrl || ''
        }));
        const igComments = (scrapedData?.instagram || []).map(c => ({
            id: c.id || Math.random().toString(36).substr(2, 9),
            text: c.text,
            platform: 'instagram' as const,
            athleteName: c.athleteName || c.username || '',
            username: c.username || '',
            likes: c.likes || 0,
            profilePicUrl: c.profilePicUrl || ''
        }));

        // Dedupe by text for each platform
        const dedupeByText = (comments: typeof ttComments) => {
            const seen = new Set();
            return comments.filter(c => {
                const key = c.text?.toLowerCase().trim();
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };

        // Sort by likes desc
        const sortedTT = dedupeByText(ttComments).sort((a, b) => (b.likes || 0) - (a.likes || 0));
        const sortedIG = dedupeByText(igComments).sort((a, b) => (b.likes || 0) - (a.likes || 0));

        return {
            tiktokComments: sortedTT,
            instagramComments: sortedIG
        };
    }, [scrapedData]);

    // Combined for legacy usage
    const allComments = useMemo(() => {
        return [...tiktokComments, ...instagramComments].slice(0, 12);
    }, [tiktokComments, instagramComments]);

    // Create lookup map for athlete media by name
    const athleteMediaLookup = useMemo(() => createAthleteLookup(athleteMediaList), [athleteMediaList]);

    // Filter athlete media list for navigation based on carousel filter
    const filteredAthleteMediaList = useMemo(() => {
        if (carouselFilter === 'all') return athleteMediaList;

        return athleteMediaList.filter(athlete => {
            const hasVideo = athlete.media.some(m =>
                m.mediaType?.toLowerCase() === 'tiktok' ||
                m.mediaType?.toLowerCase() === 'ig_reel'
            );
            if (carouselFilter === 'featured') return hasVideo;
            return !hasVideo; // subclub = story-only athletes
        });
    }, [athleteMediaList, carouselFilter]);

    // Handle athlete click - use media lookup to find athlete with signable hashes
    const handleAthleteClick = (athleteImage: AthleteImage) => {
        console.log('[PublicShowcase] Athlete clicked:', athleteImage.firstName, athleteImage.lastName);

        // Look up athlete in the media list (which has proper hashes for the API)
        const nameKey = `${athleteImage.firstName}-${athleteImage.lastName}`.toLowerCase();
        const mediaAthlete = athleteMediaLookup.get(nameKey);

        if (mediaAthlete && mediaAthlete.media.length > 0) {
            console.log('[PublicShowcase] Found athlete in media lookup with', mediaAthlete.media.length, 'media items');
            setSelectedMediaAthlete(mediaAthlete);
        } else {
            console.log('[PublicShowcase] Athlete not in media lookup, showing detail modal');
            // Fallback to detail modal if no media
            if (athleteImage.athlete) {
                setSelectedAthlete(athleteImage.athlete);
            }
        }
    };


    // Enrich athlete images with hasMedia, isVideoAthlete flags and interleave
    const enrichedAthleteImages = useMemo(() => {
        // Separate video and story athletes
        const videoImages: typeof athleteImages = [];
        const storyImages: typeof athleteImages = [];

        for (const img of athleteImages) {
            const athlete = img.athlete;
            const isVideo = athlete?.campaign_type === 'video';
            const nameKey = `${img.firstName}-${img.lastName}`.toLowerCase();
            const mediaAthlete = athleteMediaLookup.get(nameKey);

            const enriched = {
                ...img,
                hasMedia: mediaAthlete && mediaAthlete.media.length > 0,
                isVideoAthlete: isVideo,
                igReelUrl: athlete?.ig_reel_url || ''
            };

            if (isVideo) {
                videoImages.push(enriched);
            } else {
                storyImages.push(enriched);
            }
        }

        // Interleave: spread video athletes throughout story athletes
        // Roughly 1 video every 4 story athletes
        const result: typeof athleteImages = [];
        const ratio = storyImages.length > 0 ? Math.floor(storyImages.length / Math.max(videoImages.length, 1)) : 1;

        let videoIdx = 0;
        for (let i = 0; i < storyImages.length; i++) {
            result.push(storyImages[i]);
            // Insert a video athlete every 'ratio' story athletes
            if ((i + 1) % ratio === 0 && videoIdx < videoImages.length) {
                result.push(videoImages[videoIdx]);
                videoIdx++;
            }
        }
        // Add remaining video athletes at the end
        while (videoIdx < videoImages.length) {
            result.push(videoImages[videoIdx]);
            videoIdx++;
        }

        return result;
    }, [athleteImages, athleteMediaLookup]);

    // Login screen - Light and welcoming
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-subway-yellow/20 via-white to-subway-green/20 flex items-center justify-center p-4 relative overflow-hidden">
                {/* Floating sandwiches */}
                <FloatingSandwich emoji="🥖" style={{ top: '10%', left: '10%', animationDelay: '0s' }} />
                <FloatingSandwich emoji="🥬" style={{ top: '20%', right: '15%', animationDelay: '0.5s' }} />

                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-10 w-full max-w-md border border-subway-green/20 relative z-10">
                    <div className="flex justify-center mb-8">
                        <div className="w-20 h-20 bg-gradient-to-br from-subway-green to-subway-yellow rounded-2xl flex items-center justify-center shadow-xl transform -rotate-6">
                            <span className="text-4xl">🥖</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-center text-gray-900 mb-2">Subway NIL Club</h1>
                    <p className="text-center text-gray-500 mb-8">Enter your access code to view the magic ✨</p>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            value={passcodeInput}
                            onChange={(e) => setPasscodeInput(e.target.value)}
                            placeholder="Access Code"
                            className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-4 focus:ring-subway-green/30 focus:border-subway-green outline-none transition font-medium text-center text-lg tracking-widest"
                        />
                        <button type="submit" className="w-full bg-gradient-to-r from-subway-green to-subway-green/90 text-white font-bold py-4 rounded-xl hover:shadow-lg hover:shadow-subway-green/30 transition-all hover:-translate-y-0.5 text-lg">
                            View Campaign 🚀
                        </button>
                    </form>
                </div>

                {/* Animation styles */}
                <style>{`
                    @keyframes float {
                        0%, 100% { transform: translateY(0) rotate(0deg); }
                        50% { transform: translateY(-20px) rotate(10deg); }
                    }
                    .animate-float { animation: float 6s ease-in-out infinite; }
                `}</style>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-subway-yellow/10 via-white to-subway-green/10 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4 animate-bounce">🥖</div>
                    <div className="text-xl font-bold text-gray-700">Loading the good stuff...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-subway-yellow/5 to-subway-green/10 relative overflow-hidden">
            {/* Animation styles */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(10deg); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
                @keyframes slide-in {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-in { animation: slide-in 0.6s ease-out forwards; }
            `}</style>

            {/* Floating decorative elements - Subway ingredients */}
            <FloatingSandwich emoji="🥖" style={{ top: '5%', left: '5%', animationDelay: '0s' }} />
            <FloatingSandwich emoji="🥬" style={{ top: '15%', right: '8%', animationDelay: '0.3s' }} />
            <FloatingSandwich emoji="🥑" style={{ top: '40%', right: '2%', animationDelay: '1.5s' }} />

            {/* Hero Header */}
            <header className="pt-20 pb-16 px-8 text-center relative">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-subway-green/10 rounded-full text-subway-green font-bold mb-8 animate-slide-in">
                        <Award className="w-5 h-5" />
                        Campaign Results Are In!
                    </div>
                    <h1 className="text-6xl md:text-7xl font-black mb-6 text-gray-900 animate-slide-in" style={{ animationDelay: '0.1s' }}>
                        Subway
                        <span className="bg-gradient-to-r from-subway-green to-subway-yellow bg-clip-text text-transparent"> NIL Club</span>
                    </h1>
                    <p className="text-2xl text-gray-600 mb-4 animate-slide-in" style={{ animationDelay: '0.2s' }}>
                        Deal #2 Performance Report
                    </p>
                    <div className="flex items-center justify-center gap-2 text-gray-400 animate-slide-in" style={{ animationDelay: '0.3s' }}>
                        <Star className="w-4 h-4 fill-subway-yellow text-subway-yellow" />
                        <span>Powered by NIL Club</span>
                        <Star className="w-4 h-4 fill-subway-yellow text-subway-yellow" />
                    </div>
                </div>
            </header>

            {/* Hero Stats - Overview */}
            <section className="py-12 px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        <StatCard
                            icon={<Eye className="w-6 h-6" />}
                            value={stats.totalViews}
                            label="Total Views"
                            delay={0}
                        />
                        <StatCard
                            icon={<Users className="w-6 h-6" />}
                            value={stats.totalAthletes}
                            label="Total Athletes"
                            delay={100}
                        />
                        <StatCard
                            icon={<Video className="w-6 h-6" />}
                            value={stats.totalPosts}
                            label="Total Posts"
                            delay={200}
                        />
                    </div>
                </div>
            </section>

            {/* Featured Athletes Breakdown */}
            <section className="py-12 px-8 bg-gradient-to-b from-subway-green/5 to-transparent">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-subway-green/10 rounded-full text-subway-green font-bold mb-3">
                            <Star className="w-5 h-5 fill-subway-green" /> Featured Athletes
                        </div>
                        <p className="text-gray-500">Video + Story creators • 85 athletes</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* TikTok */}
                        {(() => {
                            const tiktokEngagement = stats.featured.tiktok.views > 0
                                ? ((stats.featured.tiktok.likes + stats.featured.tiktok.comments) / stats.featured.tiktok.views) * 100
                                : 0;
                            const tiktokBenchmark = 2.5;
                            const beatingBenchmark = tiktokEngagement > tiktokBenchmark;
                            const maxScale = 10; // 0-10% scale

                            return (
                                <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 ${beatingBenchmark ? 'border-emerald-400' : 'border-gray-100'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">TT</span>
                                        </div>
                                        <span className="font-bold text-gray-900">TikTok</span>
                                        {beatingBenchmark && (
                                            <span className="ml-auto text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                                                🔥 Above Benchmark
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Views</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.tiktok.views)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Likes</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.tiktok.likes)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Comments</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.tiktok.comments)}</span>
                                        </div>
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-gray-700 font-medium">Engagement Rate</span>
                                                <span className={`text-lg font-black ${beatingBenchmark ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {tiktokEngagement.toFixed(2)}%
                                                </span>
                                            </div>
                                            {/* Stacked bar: red to benchmark, green beyond */}
                                            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                                                {/* Red section: 0 to benchmark */}
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-red-400"
                                                    style={{ width: `${(tiktokBenchmark / maxScale) * 100}%` }}
                                                />
                                                {/* Green section: benchmark to our rate (only when beating) */}
                                                {beatingBenchmark && (
                                                    <div
                                                        className="absolute top-0 h-full bg-emerald-500"
                                                        style={{
                                                            left: `${(tiktokBenchmark / maxScale) * 100}%`,
                                                            width: `${Math.min((tiktokEngagement - tiktokBenchmark) / maxScale * 100, 100 - (tiktokBenchmark / maxScale) * 100)}%`
                                                        }}
                                                    />
                                                )}
                                                {/* Marker line at our rate */}
                                                <div
                                                    className="absolute top-0 h-full w-1 bg-gray-800 border-l border-r border-white"
                                                    style={{ left: `${Math.min((tiktokEngagement / maxScale) * 100, 99)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-gray-400">0%</span>
                                                <span className="text-red-500 font-medium">Industry: {tiktokBenchmark}%</span>
                                                <span className="text-gray-400">{maxScale}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* IG Reel */}
                        {(() => {
                            const reelEngagement = stats.featured.reel.views > 0
                                ? ((stats.featured.reel.likes + stats.featured.reel.comments) / stats.featured.reel.views) * 100
                                : 0;
                            const reelBenchmark = 0.5;
                            const beatingBenchmark = reelEngagement > reelBenchmark;
                            const maxScale = 5; // 0-5% scale for reels

                            return (
                                <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 ${beatingBenchmark ? 'border-emerald-400' : 'border-gray-100'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">IG</span>
                                        </div>
                                        <span className="font-bold text-gray-900">IG Reels</span>
                                        {beatingBenchmark && (
                                            <span className="ml-auto text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                                                🔥 Above Benchmark
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Views</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.reel.views)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Likes</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.reel.likes)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Comments</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.reel.comments)}</span>
                                        </div>
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-gray-700 font-medium">Engagement Rate</span>
                                                <span className={`text-lg font-black ${beatingBenchmark ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {reelEngagement.toFixed(2)}%
                                                </span>
                                            </div>
                                            {/* Stacked bar: red to benchmark, green beyond */}
                                            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                                                {/* Red section: 0 to benchmark */}
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-red-400"
                                                    style={{ width: `${(reelBenchmark / maxScale) * 100}%` }}
                                                />
                                                {/* Green section: benchmark to our rate (only when beating) */}
                                                {beatingBenchmark && (
                                                    <div
                                                        className="absolute top-0 h-full bg-emerald-500"
                                                        style={{
                                                            left: `${(reelBenchmark / maxScale) * 100}%`,
                                                            width: `${Math.min((reelEngagement - reelBenchmark) / maxScale * 100, 100 - (reelBenchmark / maxScale) * 100)}%`
                                                        }}
                                                    />
                                                )}
                                                {/* Marker line at our rate */}
                                                <div
                                                    className="absolute top-0 h-full w-1 bg-gray-800 border-l border-r border-white"
                                                    style={{ left: `${Math.min((reelEngagement / maxScale) * 100, 99)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-gray-400">0%</span>
                                                <span className="text-red-500 font-medium">Industry: {reelBenchmark}%</span>
                                                <span className="text-gray-400">{maxScale}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* IG Story */}
                        {(() => {
                            const storyEngagementRate = stats.featured.story.views > 0
                                ? (stats.featured.story.taps / stats.featured.story.views) * 100
                                : 0;
                            const storyBenchmark = 0.6;
                            const beatingBenchmark = storyEngagementRate > storyBenchmark;
                            const maxScale = 5; // 0-5% scale

                            return (
                                <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 ${beatingBenchmark ? 'border-emerald-400' : 'border-gray-100'}`}>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-xl flex items-center justify-center">
                                            <span className="text-white font-bold text-sm">📱</span>
                                        </div>
                                        <span className="font-bold text-gray-900">IG Stories</span>
                                        {beatingBenchmark && (
                                            <span className="ml-auto text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                                                🔥 Above Benchmark
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Views</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.story.views)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Link Taps</span>
                                            <span className="font-bold text-gray-900">{formatNumber(stats.featured.story.taps)}</span>
                                        </div>
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-gray-700 font-medium">IG Story Eng Rate</span>
                                                <span className={`text-lg font-black ${beatingBenchmark ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                    {storyEngagementRate.toFixed(2)}%
                                                </span>
                                            </div>
                                            {/* Stacked bar: red to benchmark, green beyond */}
                                            <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                                                {/* Red section: 0 to benchmark */}
                                                <div
                                                    className="absolute left-0 top-0 h-full bg-red-400"
                                                    style={{ width: `${(storyBenchmark / maxScale) * 100}%` }}
                                                />
                                                {/* Green section: benchmark to our rate (only when beating) */}
                                                {beatingBenchmark && (
                                                    <div
                                                        className="absolute top-0 h-full bg-emerald-500"
                                                        style={{
                                                            left: `${(storyBenchmark / maxScale) * 100}%`,
                                                            width: `${Math.min((storyEngagementRate - storyBenchmark) / maxScale * 100, 100 - (storyBenchmark / maxScale) * 100)}%`
                                                        }}
                                                    />
                                                )}
                                                {/* Marker line at our rate */}
                                                <div
                                                    className="absolute top-0 h-full w-1 bg-gray-800 border-l border-r border-white"
                                                    style={{ left: `${Math.min((storyEngagementRate / maxScale) * 100, 99)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span className="text-gray-400">0%</span>
                                                <span className="text-red-500 font-medium">Industry: {storyBenchmark}%</span>
                                                <span className="text-gray-400">{maxScale}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Benchmark Source Citation */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-gray-400">
                            Industry benchmarks sourced from Socialinsider 2025 Social Media Benchmarks
                        </p>
                    </div>
                </div>
            </section>

            {/* Sub Club Athletes Breakdown */}
            {(() => {
                const subClubEngagement = stats.subClub.story.views > 0
                    ? (stats.subClub.story.taps / stats.subClub.story.views) * 100
                    : 0;
                const storyBenchmark = 0.6;
                const beatingBenchmark = subClubEngagement > storyBenchmark;
                const maxScale = 5;

                return (
                    <section className="py-12 px-8">
                        <div className="max-w-3xl mx-auto">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-subway-yellow/20 rounded-full text-orange-600 font-bold mb-3">
                                    <Users className="w-5 h-5" /> Sub Club Athletes
                                </div>
                                <p className="text-gray-500">Story creators • 340 athletes</p>
                            </div>

                            <div className={`bg-white rounded-2xl p-6 shadow-lg border-2 max-w-md mx-auto ${beatingBenchmark ? 'border-emerald-400' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-xl flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">📱</span>
                                    </div>
                                    <span className="font-bold text-gray-900">IG Stories</span>
                                    {beatingBenchmark && (
                                        <span className="ml-auto text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">
                                            🔥 Above Benchmark
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Views</span>
                                        <span className="font-bold text-gray-900">{formatNumber(stats.subClub.story.views)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Link Taps</span>
                                        <span className="font-bold text-gray-900">{formatNumber(stats.subClub.story.taps)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Replies</span>
                                        <span className="font-bold text-gray-900">{formatNumber(stats.subClub.story.replies)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Shares</span>
                                        <span className="font-bold text-gray-900">{formatNumber(stats.subClub.story.shares)}</span>
                                    </div>
                                    <div className="pt-3 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-700 font-medium">IG Story Eng Rate</span>
                                            <span className={`text-lg font-black ${beatingBenchmark ? 'text-emerald-600' : 'text-gray-900'}`}>
                                                {subClubEngagement.toFixed(2)}%
                                            </span>
                                        </div>
                                        {/* Stacked bar: red to benchmark, green beyond */}
                                        <div className="relative h-6 bg-gray-100 rounded-full overflow-hidden">
                                            {/* Red section: 0 to benchmark */}
                                            <div
                                                className="absolute left-0 top-0 h-full bg-red-400"
                                                style={{ width: `${(storyBenchmark / maxScale) * 100}%` }}
                                            />
                                            {/* Green section: benchmark to our rate (only when beating) */}
                                            {beatingBenchmark && (
                                                <div
                                                    className="absolute top-0 h-full bg-emerald-500"
                                                    style={{
                                                        left: `${(storyBenchmark / maxScale) * 100}%`,
                                                        width: `${Math.min((subClubEngagement - storyBenchmark) / maxScale * 100, 100 - (storyBenchmark / maxScale) * 100)}%`
                                                    }}
                                                />
                                            )}
                                            {/* Marker line at our rate */}
                                            <div
                                                className="absolute top-0 h-full w-1 bg-gray-800 border-l border-r border-white"
                                                style={{ left: `${Math.min((subClubEngagement / maxScale) * 100, 99)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-gray-400">0%</span>
                                            <span className="text-red-500 font-medium">Industry: {storyBenchmark}%</span>
                                            <span className="text-gray-400">{maxScale}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* Athlete Army Carousel */}
            {enrichedAthleteImages.length > 0 && (() => {
                // Filter athletes based on selection
                const filteredAthletes = carouselFilter === 'all'
                    ? enrichedAthleteImages
                    : carouselFilter === 'featured'
                        ? enrichedAthleteImages.filter(a => a.isVideoAthlete)
                        : enrichedAthleteImages.filter(a => !a.isVideoAthlete);

                // Handle bubble click
                const handleFilterClick = (type: 'featured' | 'subclub') => {
                    if (carouselFilter === type) {
                        // Clicking the same filter again shows all
                        setCarouselFilter('all');
                    } else if (carouselFilter !== 'all') {
                        // Clicking a different filter when one is active shows all
                        setCarouselFilter('all');
                    } else {
                        // Clicking a filter when showing all filters to that type
                        setCarouselFilter(type);
                    }
                };

                return (
                    <section className="py-16 relative">
                        <div className="max-w-7xl mx-auto px-4 mb-8">
                            <div className="flex items-center justify-center gap-3 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-subway-green to-subway-yellow rounded-xl flex items-center justify-center shadow-lg">
                                    <Users className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-4xl font-black text-gray-900">The Athlete Army</h2>
                            </div>
                            <p className="text-gray-500 text-center text-lg">
                                Click any athlete to view their campaign content
                            </p>
                            <div className="flex items-center justify-center gap-6 mt-3 text-sm">
                                {/* Featured Athletes Bubble - Clickable */}
                                <button
                                    onClick={() => handleFilterClick('featured')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${carouselFilter === 'featured'
                                        ? 'bg-blue-100 ring-2 ring-blue-400 shadow-lg'
                                        : carouselFilter === 'all'
                                            ? 'hover:bg-blue-50'
                                            : 'opacity-50'
                                        }`}
                                >
                                    <span className={`w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 via-cyan-400 to-teal-500 p-[2px] ${carouselFilter === 'featured' ? 'ring-2 ring-blue-400' : ''
                                        }`}>
                                        <span className={`block w-full h-full rounded-full ${carouselFilter === 'featured' ? 'bg-blue-500' : 'bg-white'
                                            }`}></span>
                                    </span>
                                    <span className="text-blue-600 font-medium">🎬 Featured Athletes</span>
                                </button>

                                {/* Sub Club Athletes Bubble - Clickable */}
                                <button
                                    onClick={() => handleFilterClick('subclub')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${carouselFilter === 'subclub'
                                        ? 'bg-pink-100 ring-2 ring-pink-400 shadow-lg'
                                        : carouselFilter === 'all'
                                            ? 'hover:bg-pink-50'
                                            : 'opacity-50'
                                        }`}
                                >
                                    <span className={`w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] ${carouselFilter === 'subclub' ? 'ring-2 ring-pink-400' : ''
                                        }`}>
                                        <span className={`block w-full h-full rounded-full ${carouselFilter === 'subclub' ? 'bg-pink-500' : 'bg-white'
                                            }`}></span>
                                    </span>
                                    <span className="text-pink-600 font-medium">📸 Sub Club Athletes</span>
                                </button>
                            </div>
                            {carouselFilter !== 'all' && (
                                <p className="text-center text-xs text-gray-400 mt-2">
                                    Click either bubble to show all athletes
                                </p>
                            )}
                        </div>
                        <AthleteCarousel
                            athletes={filteredAthletes}
                            onAthleteClick={handleAthleteClick}
                            paused={selectedMediaAthlete !== null || selectedAthlete !== null}
                        />
                    </section>
                );
            })()}

            {/* Follower Insights - Story Campaign Analytics */}
            {data.filter(a => a.campaign_type === 'story' && (a.ig_followers || 0) > 0).length > 0 && (() => {
                // Calculate cohort metrics
                const storyAthletes = data.filter(a => a.campaign_type === 'story' && (a.ig_followers || 0) > 0);

                const cohorts = [
                    { name: 'Under 1K', min: 0, max: 999, color: 'from-emerald-500 to-green-600' },
                    { name: '1K-2K', min: 1000, max: 2000, color: 'from-green-500 to-teal-600' },
                    { name: '2K-3K', min: 2001, max: 3000, color: 'from-teal-500 to-cyan-600' },
                    { name: '3K-5K', min: 3001, max: 5000, color: 'from-cyan-500 to-blue-600' },
                    { name: '5K-10K', min: 5001, max: 10000, color: 'from-blue-500 to-indigo-600' },
                    { name: '10K+', min: 10001, max: Infinity, color: 'from-indigo-500 to-purple-600' },
                ];

                const cohortData = cohorts.map(cohort => {
                    const group = storyAthletes.filter(a =>
                        (a.ig_followers || 0) >= cohort.min && (a.ig_followers || 0) <= cohort.max
                    );
                    if (group.length === 0) return null;

                    const totalViews = group.reduce((sum, a) => sum + (a.ig_story_1_views || 0), 0);
                    const totalFollowers = group.reduce((sum, a) => sum + (a.ig_followers || 0), 0);
                    const totalEngagements = group.reduce((sum, a) =>
                        sum + (a.ig_story_1_taps || 0) + (a.ig_story_1_replies || 0) + (a.ig_story_1_shares || 0), 0);

                    return {
                        ...cohort,
                        count: group.length,
                        avgViews: Math.round(totalViews / group.length),
                        viewsPerFollower: totalViews / totalFollowers,
                        reachRate: (totalViews / totalFollowers) * 100,
                        engagementRate: (totalEngagements / totalViews) * 100,
                    };
                }).filter(Boolean);

                // Find max values for scaling bars
                const maxReach = Math.max(...cohortData.map(c => c?.reachRate || 0));
                const maxEngagement = Math.max(...cohortData.map(c => c?.engagementRate || 0));

                return (
                    <section className="py-20 px-8 bg-gradient-to-b from-white via-green-50/30 to-white">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-12">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 font-bold mb-4">
                                    <BarChart3 className="w-5 h-5" /> Story Campaign Insights
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 mb-3">
                                    Smaller Followings, <span className="text-emerald-600">Bigger Impact</span>
                                </h2>
                                <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                                    Our data reveals that athletes with smaller followings deliver significantly
                                    higher reach rates and engagement — proving that <strong>quality trumps quantity</strong>.
                                </p>
                            </div>

                            {/* Key Insight Cards */}
                            <div className="grid md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-100">
                                    <div className="text-5xl mb-3">📊</div>
                                    <div className="text-3xl font-black text-emerald-600 mb-1">
                                        {cohortData[0]?.reachRate.toFixed(0)}%
                                    </div>
                                    <div className="text-sm text-gray-500 mb-2">Reach Rate (Under 1K)</div>
                                    <div className="text-xs text-emerald-600 font-medium">
                                        vs {cohortData[cohortData.length - 1]?.reachRate.toFixed(0)}% for 10K+ accounts
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-100">
                                    <div className="text-5xl mb-3">⚡</div>
                                    <div className="text-3xl font-black text-emerald-600 mb-1">
                                        {((cohortData[0]?.reachRate || 1) / (cohortData[cohortData.length - 1]?.reachRate || 1)).toFixed(0)}x
                                    </div>
                                    <div className="text-sm text-gray-500 mb-2">More Efficient Reach</div>
                                    <div className="text-xs text-emerald-600 font-medium">
                                        Smaller accounts reach more of their audience
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-100">
                                    <div className="text-5xl mb-3">💬</div>
                                    <div className="text-3xl font-black text-emerald-600 mb-1">
                                        {cohortData[0]?.engagementRate.toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-gray-500 mb-2">IG Story Engagement Rate (Under 1K)</div>
                                    <div className="text-xs text-emerald-600 font-medium">
                                        {((cohortData[0]?.engagementRate || 1) / (cohortData[cohortData.length - 1]?.engagementRate || 1)).toFixed(1)}x higher than 10K+ accounts
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Benchmark: 0.6%</div>
                                </div>
                            </div>

                            {/* Cohort Comparison Table */}
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-500 to-green-600">
                                    <h3 className="text-xl font-bold text-white">Performance by Follower Count</h3>
                                    <p className="text-emerald-100 text-sm">Analyzing {storyAthletes.length} story campaigns</p>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-4">
                                        {cohortData.map((cohort, idx) => (
                                            <div key={cohort?.name} className="flex items-center gap-4">
                                                <div className="w-28 flex-shrink-0">
                                                    <div className="text-sm font-bold text-gray-700">{cohort?.name}</div>
                                                    <div className="text-xs text-gray-500">Avg: {cohort?.avgViews?.toLocaleString()} views</div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs text-gray-500 w-24">Reach Rate</span>
                                                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                                            <div
                                                                className={`h-full bg-gradient-to-r ${cohort?.color} rounded-full transition-all`}
                                                                style={{ width: `${((cohort?.reachRate || 0) / maxReach) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-700 w-16">{cohort?.reachRate.toFixed(1)}%</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 w-24">IG Story Eng Rate</span>
                                                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                                            <div
                                                                className={`h-full bg-gradient-to-r ${cohort?.color} rounded-full transition-all opacity-70`}
                                                                style={{ width: `${((cohort?.engagementRate || 0) / maxEngagement) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-bold text-gray-700 w-16">{cohort?.engagementRate.toFixed(2)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-emerald-50 border-t border-emerald-100">
                                    <p className="text-sm text-emerald-700 text-center">
                                        <Star className="w-4 h-4 inline mr-1" />
                                        <strong>Key Takeaway:</strong> Athletes with under 1K followers deliver the highest IG Story reach
                                        and engagement rates, making them ideal partners for authentic brand storytelling.
                                    </p>
                                    <p className="text-xs text-gray-400 text-center mt-2">
                                        Industry benchmark: 0.6% (Socialinsider 2025)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* Top Content */}
            {
                topContent.length > 0 && (
                    <section className="py-16 px-8">
                        <div className="max-w-6xl mx-auto">
                            <div className="text-center mb-12">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-subway-yellow/20 rounded-full text-orange-600 font-bold mb-4">
                                    <Zap className="w-5 h-5" /> Top Performers
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 mb-3">Viral Moments</h2>
                                <p className="text-gray-500 text-lg">Our highest-viewed content from this campaign</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {topContent.slice(0, 3).map(content => (
                                    <TopContentCard key={content.id} content={content} />
                                ))}
                            </div>
                        </div>
                    </section>
                )
            }





            {/* Fan Comments - Native Platform Look */}
            {
                featuredComments.length > 0 && (() => {
                    const featuredTiktok = featuredComments.filter(c => c.platform === 'tiktok');
                    const featuredInstagram = featuredComments.filter(c => c.platform === 'instagram');
                    return (
                        <section className="py-16 px-4 md:px-8 bg-gray-50 overflow-hidden">
                            <div className="max-w-7xl mx-auto">
                                {/* Header */}
                                <div className="text-center mb-12">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full text-pink-600 font-bold mb-4">
                                        <Heart className="w-5 h-5 fill-pink-500" /> What Fans Are Saying
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-3">Real Comments</h2>
                                    <p className="text-gray-500 text-lg">Authentic reactions scraped directly from posts</p>
                                </div>

                                {/* Split Layout - TikTok Left, Instagram Right */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                                    {/* TikTok Column - Dark Theme (Native Look) */}
                                    {featuredTiktok.length > 0 && (
                                        <div className="relative">
                                            {/* TikTok Comment Panel - Dark Mode */}
                                            <div className="bg-[#121212] rounded-3xl overflow-hidden shadow-2xl">
                                                {/* Header Bar */}
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white text-lg font-bold">{featuredTiktok.length} comments</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                                                        <span>♪</span>
                                                        <span className="font-medium">TikTok</span>
                                                    </div>
                                                </div>

                                                {/* Scrollable Comments */}
                                                <div className="max-h-96 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                                    {featuredTiktok.map((comment, idx) => (
                                                        <div key={comment.id} className="flex gap-3 group">
                                                            {/* Avatar */}
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                                                {comment.athleteName?.[0]?.toUpperCase() || '?'}
                                                            </div>

                                                            {/* Comment Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    <span className="text-white text-sm font-semibold">
                                                                        {comment.athleteName || 'Fan'}
                                                                    </span>
                                                                    <span className="text-gray-500 text-xs">• 2d</span>
                                                                </div>
                                                                <p className="text-gray-200 text-sm leading-relaxed">{comment.text}</p>
                                                                <div className="flex items-center gap-4 mt-1.5 text-gray-500 text-xs">
                                                                    <span>Reply</span>
                                                                </div>
                                                            </div>

                                                            {/* Like Button */}
                                                            <div className="flex flex-col items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                                                                <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer transition-colors" />
                                                                <span className="text-gray-500 text-xs">
                                                                    {Math.floor(Math.random() * 50) + 5}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Input Bar */}
                                                <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-800">
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0"></div>
                                                    <div className="flex-1 bg-gray-800 rounded-full px-4 py-2 text-gray-500 text-sm">
                                                        Add a comment...
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Instagram Column - Light Theme (Native Look) */}
                                    {featuredInstagram.length > 0 && (
                                        <div className="relative">
                                            {/* Instagram Comment Panel */}
                                            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-200">
                                                {/* Header Bar */}
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                                                    <span className="text-gray-900 text-lg font-bold">Comments</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-transparent bg-clip-text font-bold">
                                                            Instagram
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Scrollable Comments */}
                                                <div className="max-h-96 overflow-y-auto p-4 space-y-4">
                                                    {featuredInstagram.map((comment, idx) => (
                                                        <div key={comment.id} className="flex gap-3 group">
                                                            {/* Avatar with Story Ring */}
                                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 p-[2px] flex-shrink-0">
                                                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-gray-900">
                                                                        {comment.athleteName?.[0]?.toUpperCase() || '?'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Comment Content */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-gray-900 text-sm">
                                                                    <span className="font-semibold mr-1">
                                                                        {comment.athleteName || 'fan'}
                                                                    </span>
                                                                    {comment.text}
                                                                </p>
                                                                <div className="flex items-center gap-3 mt-1.5 text-gray-500 text-xs">
                                                                    <span>2d</span>
                                                                    <span className="font-semibold">{Math.floor(Math.random() * 30) + 3} likes</span>
                                                                    <span className="font-semibold cursor-pointer">Reply</span>
                                                                </div>
                                                            </div>

                                                            {/* Like Button */}
                                                            <div className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity pt-1">
                                                                <Heart className="w-3.5 h-3.5 text-gray-400 hover:text-red-500 cursor-pointer transition-colors" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Input Bar */}
                                                <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
                                                    <span className="text-lg">😊</span>
                                                    <div className="flex-1 text-gray-400 text-sm">
                                                        Add a comment...
                                                    </div>
                                                    <span className="text-blue-500 font-semibold text-sm cursor-pointer opacity-50">Post</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    );
                })()
            }

            {/* Footer */}
            <footer className="py-12 px-8 text-center bg-gradient-to-t from-subway-green/10 to-transparent">
                <div className="flex items-center justify-center gap-3">
                    <span className="font-bold text-gray-600">Powered by</span>
                    <span className="font-black text-subway-green text-xl">NIL Club</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">v1.3.3</p>
            </footer>

            {/* Athlete Detail Modal */}
            {
                selectedAthlete && (
                    <AthleteDetailModal
                        athlete={selectedAthlete}
                        onClose={() => setSelectedAthlete(null)}
                    />
                )
            }

            {/* Athlete Media Modal */}
            {
                selectedMediaAthlete && (
                    <AthleteMediaModal
                        athlete={selectedMediaAthlete}
                        allAthletes={filteredAthleteMediaList}
                        onClose={() => setSelectedMediaAthlete(null)}
                        onNavigate={(newAthlete) => setSelectedMediaAthlete(newAthlete)}
                    />
                )
            }
        </div >
    );
};
