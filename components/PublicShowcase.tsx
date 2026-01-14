import React, { useState, useEffect, useMemo } from 'react';
import { Athlete } from '../types';
import { loadDataFromCloud, loadShowcaseData, loadScrapedComments, TopContent, FeaturedComment, ScrapedCommentsStore } from '../services/dataService';
import { AthleteListItem, loadAthleteList, createAthleteLookup } from '../services/mediaService';
import { isBaselineAthlete } from '../services/baselineAthletes';
import { Lock, Eye, Users, Video, TrendingUp, MessageCircle, ExternalLink, Heart, BarChart3, Sparkles, Zap, Star } from 'lucide-react';
import { AthleteCarousel, AthleteImage, parseAthleteImageCSV, athletesToCarouselImages } from './AthleteCarousel';
import { AthleteDetailModal } from './AthleteDetailModal';
import { AthleteMediaModal } from './AthleteMediaModal';

const PUBLIC_PASSCODE = 'subway';

// Calculate detailed stats by athlete tier and platform
const calculateDetailedStats = (athletes: Athlete[]) => {
    const realAthletes = athletes.filter(a => !a.user_name.startsWith('Video_Athlete_') && !a.user_name.startsWith('Story_Athlete_'));

    // Featured Athletes = those with TikTok OR IG Reel (they do video + story)
    const featuredAthletes = realAthletes.filter(a => (a.tiktok_views || 0) > 0 || (a.ig_reel_views || 0) > 0);

    // Sub Club Athletes = those with ONLY story (no video) AND in baseline CSV
    const subClubAthletes = realAthletes.filter(a =>
        (a.tiktok_views || 0) === 0 &&
        (a.ig_reel_views || 0) === 0 &&
        (a.ig_story_1_views || 0) > 0 &&
        isBaselineAthlete(a.user_name)  // Only include athletes from baseline CSV
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
    let subClubStoryViews = 0, subClubStoryTaps = 0;

    subClubAthletes.forEach(a => {
        subClubStoryViews += a.ig_story_1_views || 0;
        subClubStoryTaps += a.ig_story_1_taps || 0;
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
            story: { views: subClubStoryViews, taps: subClubStoryTaps }
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

    useEffect(() => {
        const authStatus = localStorage.getItem('subway_public_auth');
        if (authStatus === 'true') setIsAuthenticated(true);
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            Promise.all([
                loadDataFromCloud(),
                loadShowcaseData(),
                loadScrapedComments(),
                fetch('/subway_deal_with_images.csv').then(r => r.text()).catch(() => ''),
                loadAthleteList()
            ]).then(([athleteResult, showcaseResult, scrapedResult, csvText, mediaList]) => {
                if (athleteResult.athletes) setData(athleteResult.athletes);
                setTopContent(showcaseResult.topContent);
                setFeaturedComments(showcaseResult.featuredComments);
                setScrapedData(scrapedResult);
                if (csvText) setAthleteImages(parseAthleteImageCSV(csvText));
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
    const allComments = featuredComments;

    // Create lookup map for athlete media by name
    const athleteMediaLookup = useMemo(() => createAthleteLookup(athleteMediaList), [athleteMediaList]);

    // Handle athlete click - video athletes open IG Reel, story athletes show modal
    const handleAthleteClick = (athleteImage: AthleteImage) => {
        console.log('[PublicShowcase] Athlete clicked:', athleteImage.firstName, athleteImage.lastName);

        // Video athletes: open their Instagram Reel directly
        if (athleteImage.isVideoAthlete && athleteImage.igReelUrl) {
            console.log('[PublicShowcase] Opening Instagram Reel:', athleteImage.igReelUrl);
            window.open(athleteImage.igReelUrl, '_blank');
            return;
        }

        // Story athletes: show media modal or detail modal
        const nameKey = `${athleteImage.firstName}-${athleteImage.lastName}`.toLowerCase();
        const mediaAthlete = athleteMediaLookup.get(nameKey);
        console.log('[PublicShowcase] Media athlete found:', !!mediaAthlete);

        if (mediaAthlete && mediaAthlete.media.length > 0) {
            console.log('[PublicShowcase] Opening media modal with API data');
            setSelectedMediaAthlete(mediaAthlete);
        } else if (athleteImage.athlete) {
            console.log('[PublicShowcase] Opening detail modal');
            setSelectedAthlete(athleteImage.athlete);
        } else {
            console.log('[PublicShowcase] Opening fallback modal');
            const tempAthlete: AthleteListItem = {
                firstName: athleteImage.firstName,
                lastName: athleteImage.lastName,
                sport: athleteImage.sport,
                campaign: '',
                school: athleteImage.schoolName,
                media: []
            };
            setSelectedMediaAthlete(tempAthlete);
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
                <FloatingSandwich emoji="🍅" style={{ bottom: '30%', left: '8%', animationDelay: '1s' }} />
                <FloatingSandwich emoji="🧀" style={{ bottom: '20%', right: '10%', animationDelay: '1.5s' }} />

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
            <FloatingSandwich emoji="🍅" style={{ top: '60%', left: '3%', animationDelay: '0.7s' }} />
            <FloatingSandwich emoji="🧀" style={{ top: '70%', right: '5%', animationDelay: '1s' }} />
            <FloatingSandwich emoji="🥑" style={{ top: '40%', right: '2%', animationDelay: '1.5s' }} />

            {/* Hero Header */}
            <header className="pt-20 pb-16 px-8 text-center relative">
                <div className="max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-subway-green/10 rounded-full text-subway-green font-bold mb-8 animate-slide-in">
                        <Sparkles className="w-5 h-5" />
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
                        <p className="text-gray-500">Video + Story creators • {stats.featured.count} athletes</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* TikTok */}
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">TT</span>
                                </div>
                                <span className="font-bold text-gray-900">TikTok</span>
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
                            </div>
                        </div>

                        {/* IG Reel */}
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">IG</span>
                                </div>
                                <span className="font-bold text-gray-900">IG Reels</span>
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
                            </div>
                        </div>

                        {/* IG Story */}
                        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-xl flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">📱</span>
                                </div>
                                <span className="font-bold text-gray-900">IG Stories</span>
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
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Sub Club Athletes Breakdown */}
            <section className="py-12 px-8">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-subway-yellow/20 rounded-full text-orange-600 font-bold mb-3">
                            <Users className="w-5 h-5" /> Sub Club Athletes
                        </div>
                        <p className="text-gray-500">Story creators • {stats.subClub.count} athletes</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 max-w-md mx-auto">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-yellow-400 rounded-xl flex items-center justify-center">
                                <span className="text-white font-bold text-sm">📱</span>
                            </div>
                            <span className="font-bold text-gray-900">IG Stories</span>
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
                        </div>
                    </div>
                </div>
            </section>

            {/* Athlete Army Carousel */}
            {enrichedAthleteImages.length > 0 && (
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
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-500 via-cyan-400 to-teal-500 p-[2px]">
                                    <span className="block w-full h-full rounded-full bg-white"></span>
                                </span>
                                <span className="text-blue-600">🎬 Video Athletes</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                                    <span className="block w-full h-full rounded-full bg-white"></span>
                                </span>
                                <span className="text-pink-600">📸 Story Athletes</span>
                            </div>
                        </div>
                    </div>
                    <AthleteCarousel
                        athletes={enrichedAthleteImages}
                        onAthleteClick={handleAthleteClick}
                        paused={selectedMediaAthlete !== null || selectedAthlete !== null}
                    />
                </section>
            )}

            {/* Top Content */}
            {topContent.length > 0 && (
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
            )}



            {/* Fan Comments */}
            {allComments.length > 0 && (
                <section className="py-16 px-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-12">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-100 rounded-full text-pink-600 font-bold mb-4">
                                <Heart className="w-5 h-5" /> Real Love
                            </div>
                            <h2 className="text-4xl font-black text-gray-900 mb-3">Featured Comments</h2>
                            <p className="text-gray-500 text-lg">Authentic reactions from real fans</p>
                        </div>
                        <div className="space-y-4">
                            {allComments.slice(0, 8).map(comment => (
                                <CommentCard
                                    key={comment.id}
                                    comment={comment}
                                    platform={comment.platform as 'tiktok' | 'instagram'}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            {/* Footer */}
            <footer className="py-12 px-8 text-center bg-gradient-to-t from-subway-green/10 to-transparent">
                <div className="flex items-center justify-center gap-3">
                    <span className="font-bold text-gray-600">Powered by</span>
                    <span className="font-black text-subway-green text-xl">NIL Club</span>
                </div>
            </footer>

            {/* Athlete Detail Modal */}
            {selectedAthlete && (
                <AthleteDetailModal
                    athlete={selectedAthlete}
                    onClose={() => setSelectedAthlete(null)}
                />
            )}

            {/* Athlete Media Modal */}
            {selectedMediaAthlete && (
                <AthleteMediaModal
                    athlete={selectedMediaAthlete}
                    onClose={() => setSelectedMediaAthlete(null)}
                />
            )}
        </div>
    );
};
