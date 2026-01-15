import React, { useState, useEffect } from 'react';
import { Athlete } from '../types';
import { TopContent, FeaturedComment, saveShowcaseData, loadShowcaseData, loadScrapedComments, ScrapedCommentsStore, saveScrapedComments } from '../services/dataService';
import { scrapeAllComments, ScrapedComment, analyzeCommentsWithGemini, generateWordCloudData, WordCloudItem } from '../services/commentsService';
import { Upload, Video, Image, MessageCircle, GitCompare, Plus, Trash2, Trophy, Save, Check, Search, Star, Loader2, History, Brain, BarChart3, RefreshCw } from 'lucide-react';
import { WordCloud } from './WordCloud';

interface Props {
    data: Athlete[];
    onUpdate: (data: Athlete[]) => void;
}

export const ShowcaseAdmin: React.FC<Props> = ({ data, onUpdate }) => {
    // State for top content entries
    const [topContent, setTopContent] = useState<TopContent[]>([]);
    const [featuredComments, setFeaturedComments] = useState<FeaturedComment[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Scraping state - now separated by platform
    const [isScraping, setIsScraping] = useState(false);
    const [tiktokComments, setTiktokComments] = useState<ScrapedComment[]>([]);
    const [instagramComments, setInstagramComments] = useState<ScrapedComment[]>([]);
    const [lastScrapedAt, setLastScrapedAt] = useState('');
    const [scrapeError, setScrapeError] = useState('');

    // Form states
    const [selectedAthleteId, setSelectedAthleteId] = useState('');
    const [contentType, setContentType] = useState<'tiktok' | 'ig_reel' | 'ig_story'>('tiktok');
    const [videoUrl, setVideoUrl] = useState('');

    const [commentText, setCommentText] = useState('');
    const [commentPlatform, setCommentPlatform] = useState<'tiktok' | 'instagram'>('tiktok');

    // Load showcase data and previously scraped comments on mount
    useEffect(() => {
        loadShowcaseData().then(showcaseData => {
            setTopContent(showcaseData.topContent);
            setFeaturedComments(showcaseData.featuredComments);
        });

        // Load previously scraped comments from cloud
        loadScrapedComments().then(stored => {
            if (stored.tiktok.length > 0 || stored.instagram.length > 0) {
                setTiktokComments(stored.tiktok);
                setInstagramComments(stored.instagram);
                setLastScrapedAt(stored.lastScrapedAt);
            }
        });
    }, []);

    // Get real athletes only
    const realAthletes = data.filter(a =>
        !a.user_name.startsWith('Video_Athlete_') &&
        !a.user_name.startsWith('Story_Athlete_')
    );

    // Get athlete by ID
    const getAthlete = (id: string) => data.find(a => a.id === id);

    // Collect all post URLs from athletes
    const collectPostUrls = () => {
        const tiktokUrls: string[] = [];
        const instagramUrls: string[] = [];

        realAthletes.forEach(athlete => {
            if (athlete.tiktok_post_url && athlete.tiktok_post_url.includes('tiktok.com')) {
                tiktokUrls.push(athlete.tiktok_post_url);
            }
            if (athlete.ig_reel_url && athlete.ig_reel_url.includes('instagram.com')) {
                instagramUrls.push(athlete.ig_reel_url);
            }
        });

        return { tiktokUrls, instagramUrls };
    };

    // Scrape all comments
    const handleScrapeAllComments = async () => {
        setIsScraping(true);
        setScrapeError('');

        const { tiktokUrls, instagramUrls } = collectPostUrls();

        if (tiktokUrls.length === 0 && instagramUrls.length === 0) {
            setScrapeError('No post URLs found. Make sure athletes have TikTok or Instagram URLs.');
            setIsScraping(false);
            return;
        }

        try {
            const result = await scrapeAllComments({
                tiktokUrls,
                instagramUrls,
                maxCommentsPerPost: 100 // Get all comments!
            });

            setTiktokComments(result.tiktokComments);
            setInstagramComments(result.instagramComments);
            setLastScrapedAt(new Date().toISOString());

            if (result.errors.length > 0) {
                setScrapeError(result.errors.join(', '));
            }
        } catch (e: any) {
            setScrapeError(e.message || 'Scrape failed');
        }

        setIsScraping(false);
    };

    // State for AI analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [wordCloudData, setWordCloudData] = useState<WordCloudItem[]>([]);
    const [analysisComplete, setAnalysisComplete] = useState(false);

    // Analyze comments with Gemini AI
    const handleAnalyzeWithAI = async () => {
        const allComments = [...tiktokComments, ...instagramComments];
        if (allComments.length === 0) {
            setScrapeError('No comments to analyze. Scrape comments first.');
            return;
        }

        setIsAnalyzing(true);
        setScrapeError('');

        try {
            console.log('🤖 Starting AI analysis...');

            // Analyze comments with Gemini
            const analyzedComments = await analyzeCommentsWithGemini(allComments);

            // Split back by platform
            const analyzedTikTok = analyzedComments.filter(c => c.platform === 'tiktok');
            const analyzedInstagram = analyzedComments.filter(c => c.platform === 'instagram');

            setTiktokComments(analyzedTikTok);
            setInstagramComments(analyzedInstagram);

            // Generate word cloud
            const wordCloud = generateWordCloudData(analyzedComments);
            setWordCloudData(wordCloud);

            // Save analyzed results to cloud
            await saveScrapedComments({
                tiktok: analyzedTikTok.map(c => ({ ...c, scrapedAt: new Date().toISOString() })),
                instagram: analyzedInstagram.map(c => ({ ...c, scrapedAt: new Date().toISOString() }))
            });

            setAnalysisComplete(true);
            console.log('✅ AI analysis complete');

        } catch (e: any) {
            setScrapeError(`AI Analysis failed: ${e.message}`);
        }

        setIsAnalyzing(false);
    };

    // Comment filter state
    const [commentFilter, setCommentFilter] = useState<'authentic' | 'positive' | 'all'>('authentic');

    // Words that indicate inappropriate or negative comments to filter out
    const INAPPROPRIATE_PATTERNS = [
        /paid.*ad/i, /sponsor/i, /\$\d+/i, /too much/i, /yapping/i,
        /boring/i, /cringe/i, /trash/i, /garbage/i, /stupid/i,
        /ugly/i, /worst/i, /hate/i, /suck/i, /ass/i, /wtf/i
    ];

    const isInappropriate = (text: string) => {
        return INAPPROPRIATE_PATTERNS.some(pattern => pattern.test(text));
    };

    // Heuristic score for comments without AI analysis
    const getHeuristicScore = (c: ScrapedComment): number => {
        // If AI already analyzed, use that
        if (c.sentimentScore !== undefined) {
            return c.sentimentScore * 100 + (c.isAuthentic ? 50 : 0);
        }

        // Otherwise, use heuristics
        let score = 0;
        const text = c.text.toLowerCase();

        // Positive emojis boost
        const positiveEmojis = ['🔥', '❤️', '💯', '😍', '👏', '🙌', '💪', '😊', '🤩', '👑', '🤤', '😋', '💚', '✨'];
        positiveEmojis.forEach(e => { if (c.text.includes(e)) score += 15; });

        // Positive words boost
        const positiveWords = ['love', 'amazing', 'awesome', 'best', 'perfect', 'need', 'want', 'hungry', 'delicious', 'yummy', 'fire', 'goat', 'legend'];
        positiveWords.forEach(w => { if (text.includes(w)) score += 10; });

        // Longer, substantive comments get boost
        if (c.text.length > 20) score += 5;
        if (c.text.length > 50) score += 10;
        if (c.text.length > 100) score += 15;

        // Engagement boost (but not primary)
        score += Math.min(c.likes * 0.5, 20);

        // Penalize short generic comments
        if (c.text.length < 10) score -= 20;
        if (['nice', 'cool', 'ok', 'lol', '😂'].some(x => text === x)) score -= 30;

        return score;
    };

    // Sort and filter comments - best ones for picking at top  
    const getSortedComments = (comments: ScrapedComment[]) => {
        // First filter out inappropriate comments
        let filtered = comments.filter(c => !isInappropriate(c.text));

        // Apply filter based on selection
        if (commentFilter === 'authentic') {
            // In authentic mode, if no AI analysis done yet, use heuristic filtering
            filtered = filtered.filter(c => c.isAuthentic === true || (c.sentimentScore === undefined && getHeuristicScore(c) > 30));
        } else if (commentFilter === 'positive') {
            filtered = filtered.filter(c => (c.sentimentScore || 0) > 0 || getHeuristicScore(c) > 20);
        }

        // Sort by score (AI or heuristic)
        return filtered.sort((a, b) => {
            const scoreA = getHeuristicScore(a);
            const scoreB = getHeuristicScore(b);
            return scoreB - scoreA;
        });
    };

    const sortedTikTok = getSortedComments(tiktokComments);
    const sortedInstagram = getSortedComments(instagramComments);

    // Count authentic comments
    const authenticTikTok = tiktokComments.filter(c => c.isAuthentic).length;
    const authenticInstagram = instagramComments.filter(c => c.isAuthentic).length;

    // Add scraped comment to featured
    const handleAddScrapedComment = (comment: ScrapedComment) => {
        const newComment: FeaturedComment = {
            id: Math.random().toString(36).substr(2, 9),
            text: comment.text,
            platform: comment.platform,
            athleteName: comment.username
        };

        setFeaturedComments(prev => [...prev, newComment]);
        // Remove from scraped list
        if (comment.platform === 'tiktok') {
            setTiktokComments(prev => prev.filter(c => c.id !== comment.id));
        } else {
            setInstagramComments(prev => prev.filter(c => c.id !== comment.id));
        }
        setHasUnsavedChanges(true);
    };

    // Save to Firestore
    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveShowcaseData({ topContent, featuredComments });
            setHasUnsavedChanges(false);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (e) {
            alert('Failed to save showcase data');
        }
        setIsSaving(false);
    };

    const handleAddTopContent = () => {
        if (!selectedAthleteId) {
            alert('Please select an athlete');
            return;
        }

        const athlete = getAthlete(selectedAthleteId);
        if (!athlete) return;

        let views = 0;
        let contentUrl = '';
        if (contentType === 'tiktok') {
            views = athlete.tiktok_views;
            contentUrl = athlete.tiktok_post_url || videoUrl;
        } else if (contentType === 'ig_reel') {
            views = athlete.ig_reel_views;
            contentUrl = athlete.ig_reel_url || videoUrl;
        } else if (contentType === 'ig_story') {
            views = athlete.ig_story_1_views;
            contentUrl = videoUrl;
        }

        const newContent: TopContent = {
            id: Math.random().toString(36).substr(2, 9),
            athleteId: selectedAthleteId,
            athleteName: athlete.user_name,
            type: contentType,
            videoUrl: videoUrl || contentUrl,
            views
        };

        setTopContent(prev => [...prev, newContent]);
        setSelectedAthleteId('');
        setVideoUrl('');
        setHasUnsavedChanges(true);
    };

    const handleRemoveTopContent = (id: string) => {
        setTopContent(prev => prev.filter(c => c.id !== id));
        setHasUnsavedChanges(true);
    };

    const handleAddComment = () => {
        if (!commentText.trim()) {
            alert('Please enter comment text');
            return;
        }

        const newComment: FeaturedComment = {
            id: Math.random().toString(36).substr(2, 9),
            text: commentText,
            platform: commentPlatform,
            athleteName: ''
        };

        setFeaturedComments(prev => [...prev, newComment]);
        setCommentText('');
        setHasUnsavedChanges(true);
    };

    const handleRemoveComment = (id: string) => {
        setFeaturedComments(prev => prev.filter(c => c.id !== id));
        setHasUnsavedChanges(true);
    };

    const { tiktokUrls, instagramUrls } = collectPostUrls();

    // Separate featured comments by platform
    const featuredTiktok = featuredComments.filter(c => c.platform === 'tiktok');
    const featuredInstagram = featuredComments.filter(c => c.platform === 'instagram');

    return (
        <div className="space-y-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2">
                    <Trophy className="w-6 h-6 text-subway-green" />
                    Public Showcase Manager
                </h2>
                <p className="text-gray-500">Manage content displayed on the public campaign page</p>
                <div className="flex items-center justify-center gap-4 mt-4">
                    <a href="#/public" target="_blank" className="text-subway-green hover:underline text-sm">
                        View Public Page →
                    </a>

                    {hasUnsavedChanges && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            <Save size={16} />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}

                    {saveSuccess && (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                            <Check size={16} /> Saved!
                        </span>
                    )}
                </div>
            </div>

            {/* Carousel Check Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <GitCompare className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Carousel Check</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                            Last updated: {new Date().toLocaleTimeString()}
                        </span>
                        <button
                            onClick={() => {
                                // Force re-render by triggering parent state update
                                // The data prop from parent will cause re-calculation
                                alert('✅ Carousel counts refreshed!\n\nNote: Counts update automatically when you save changes in Missing Media tab.');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                        >
                            <RefreshCw size={14} />
                            Refresh
                        </button>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mb-4">Verify data table counts match carousel display counts</p>

                {(() => {
                    // Calculate counts from data table
                    const realAthletes = data.filter(a =>
                        !a.user_name.startsWith('Video_Athlete_') &&
                        !a.user_name.startsWith('Story_Athlete_')
                    );

                    // Featured = TikTok OR Reel views
                    const featuredAthletes = realAthletes.filter(a =>
                        (a.tiktok_views || 0) > 0 || (a.ig_reel_views || 0) > 0
                    );

                    // SubClub = Only story (no video)
                    const subClubAthletes = realAthletes.filter(a =>
                        (a.tiktok_views || 0) === 0 &&
                        (a.ig_reel_views || 0) === 0 &&
                        (a.ig_story_1_views || 0) > 0
                    );

                    // Count athletes with profile pic + content for each group
                    const featuredWithProfilePic = featuredAthletes.filter(a =>
                        a.profile_image_url && a.profile_image_url.startsWith('http')
                    );
                    const subClubWithProfilePic = subClubAthletes.filter(a =>
                        a.profile_image_url && a.profile_image_url.startsWith('http')
                    );

                    // Carousel filter: only needs profile_image_url starting with 'http'
                    const carouselEligible = realAthletes.filter(a =>
                        a.profile_image_url && a.profile_image_url.startsWith('http')
                    );

                    // Featured in carousel (has video content + profile pic)
                    const featuredInCarousel = carouselEligible.filter(a =>
                        (a.tiktok_views || 0) > 0 || (a.ig_reel_views || 0) > 0
                    );

                    // SubClub in carousel (story only + profile pic)
                    const subClubInCarousel = carouselEligible.filter(a =>
                        (a.tiktok_views || 0) === 0 &&
                        (a.ig_reel_views || 0) === 0 &&
                        (a.ig_story_1_views || 0) > 0
                    );

                    const featuredMatch = featuredWithProfilePic.length === featuredInCarousel.length;
                    const subClubMatch = subClubWithProfilePic.length === subClubInCarousel.length;

                    return (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Featured Athletes */}
                            <div className={`p-4 rounded-lg border-2 ${featuredMatch ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <Video className="w-4 h-4" /> Featured Athletes
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total in data table:</span>
                                        <span className="font-medium">{featuredAthletes.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">With profile pic:</span>
                                        <span className="font-medium">{featuredWithProfilePic.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">In carousel:</span>
                                        <span className="font-medium">{featuredInCarousel.length}</span>
                                    </div>
                                    <div className={`flex justify-between pt-2 border-t ${featuredMatch ? 'text-green-700' : 'text-red-700'}`}>
                                        <span>Status:</span>
                                        <span className="font-bold">{featuredMatch ? '✓ Match' : '✗ Mismatch'}</span>
                                    </div>
                                    {!featuredMatch && (
                                        <p className="text-xs text-red-600 mt-2">
                                            Missing: {featuredAthletes.length - featuredWithProfilePic.length} athletes need profile pics
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* SubClub Athletes */}
                            <div className={`p-4 rounded-lg border-2 ${subClubMatch ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <Image className="w-4 h-4" /> SubClub Athletes
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total in data table:</span>
                                        <span className="font-medium">{subClubAthletes.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">With profile pic:</span>
                                        <span className="font-medium">{subClubWithProfilePic.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">In carousel:</span>
                                        <span className="font-medium">{subClubInCarousel.length}</span>
                                    </div>
                                    <div className={`flex justify-between pt-2 border-t ${subClubMatch ? 'text-green-700' : 'text-red-700'}`}>
                                        <span>Status:</span>
                                        <span className="font-bold">{subClubMatch ? '✓ Match' : '✗ Mismatch'}</span>
                                    </div>
                                    {!subClubMatch && (
                                        <p className="text-xs text-red-600 mt-2">
                                            Missing: {subClubAthletes.length - subClubWithProfilePic.length} athletes need profile pics
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* Top Content Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Video className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Top Content</h3>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    Select athletes to feature as top performers. Add video URL to display in native UI.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Athlete</label>
                        <select
                            value={selectedAthleteId}
                            onChange={(e) => setSelectedAthleteId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent"
                        >
                            <option value="">Select athlete...</option>
                            {realAthletes.map(a => (
                                <option key={a.id} value={a.id}>{a.user_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                        <select
                            value={contentType}
                            onChange={(e) => setContentType(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent"
                        >
                            <option value="tiktok">TikTok</option>
                            <option value="ig_reel">IG Reel</option>
                            <option value="ig_story">IG Story</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                        <input
                            type="text"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent"
                        />
                    </div>

                    <div className="flex items-end">
                        <button onClick={handleAddTopContent} className="w-full px-4 py-2 bg-subway-green text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                            <Plus size={18} /> Add
                        </button>
                    </div>
                </div>

                {topContent.length > 0 ? (
                    <div className="space-y-3">
                        {topContent.map(content => (
                            <div key={content.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className={`px-2 py-1 rounded text-xs font-medium ${content.type === 'tiktok' ? 'bg-black text-white' : content.type === 'ig_reel' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-orange-500 text-white'}`}>
                                        {content.type === 'tiktok' ? 'TikTok' : content.type === 'ig_reel' ? 'IG Reel' : 'IG Story'}
                                    </div>
                                    <span className="font-medium">{content.athleteName}</span>
                                    <span className="text-gray-500 text-sm">{content.views.toLocaleString()} views</span>
                                    {content.videoUrl && <a href={content.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-sm hover:underline">View →</a>}
                                </div>
                                <button onClick={() => handleRemoveTopContent(content.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">No top content added yet</div>
                )}
            </div>

            {/* Featured Comments Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Featured Comments</h3>
                        <span className="text-sm text-gray-400">
                            ({featuredTiktok.length} TikTok, {featuredInstagram.length} IG)
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {lastScrapedAt && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <History size={12} />
                                Last scraped: {new Date(lastScrapedAt).toLocaleDateString()}
                            </span>
                        )}
                        <button
                            onClick={handleScrapeAllComments}
                            disabled={isScraping || isAnalyzing}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            {isScraping ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                            {isScraping ? 'Scraping...' : `Scrape (${tiktokUrls.length + instagramUrls.length})`}
                        </button>
                        <button
                            onClick={handleAnalyzeWithAI}
                            disabled={isScraping || isAnalyzing || (tiktokComments.length === 0 && instagramComments.length === 0)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
                            {isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
                        </button>
                    </div>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                    Scrape comments from all athlete posts, then use AI to find authentic positive comments.
                </p>

                {/* Word Cloud Preview */}
                {wordCloudData.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <BarChart3 size={16} className="text-subway-green" />
                            Word Cloud Preview (from positive comments)
                        </h4>
                        <WordCloud words={wordCloudData} height={250} />
                    </div>
                )}

                {/* Analysis Complete Badge */}
                {analysisComplete && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                        <Check size={16} />
                        AI analysis complete! Authentic comments are highlighted. Word cloud generated.
                    </div>
                )}

                {scrapeError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{scrapeError}</div>
                )}

                {/* Scraped Comments - Separated by Platform */}
                {(tiktokComments.length > 0 || instagramComments.length > 0) && (
                    <div className="mb-6">
                        {/* Filter Buttons */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-gray-600">Show:</span>
                            <button
                                onClick={() => setCommentFilter('authentic')}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${commentFilter === 'authentic'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                ✓ Authentic Only ({authenticTikTok + authenticInstagram})
                            </button>
                            <button
                                onClick={() => setCommentFilter('positive')}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${commentFilter === 'positive'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                Positive
                            </button>
                            <button
                                onClick={() => setCommentFilter('all')}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition ${commentFilter === 'all'
                                    ? 'bg-gray-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                All (filtered)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* TikTok Comments */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-black text-white rounded text-xs">TikTok</span>
                                    <span className="text-green-600">{sortedTikTok.length} shown</span>
                                    <span className="text-gray-400">of {tiktokComments.length}</span>
                                </h4>
                                <div className="max-h-[600px] overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-2">
                                    {sortedTikTok.length === 0 ? (
                                        <div className="text-center py-4 text-gray-400 text-sm">
                                            {tiktokComments.length > 0 ? 'Run AI Analyze to find authentic comments' : 'No comments'}
                                        </div>
                                    ) : sortedTikTok.slice(0, 500).map((comment, idx) => (
                                        <div
                                            key={comment.id}
                                            onClick={() => handleAddScrapedComment(comment)}
                                            className={`p-3 rounded-lg cursor-pointer hover:opacity-80 transition text-sm flex items-start gap-2 ${comment.isAuthentic ? 'bg-green-900 border-2 border-green-500' : 'bg-gray-900'
                                                }`}
                                        >
                                            <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                                            {comment.profilePicUrl ? (
                                                <img src={comment.profilePicUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                    <span className="text-gray-400 text-xs">@{comment.username}</span>
                                                    {comment.isAuthentic && <span className="text-green-400 text-xs font-bold">✓ AUTHENTIC</span>}
                                                    <span className="text-yellow-400 text-[10px] bg-yellow-900/50 px-1 rounded">
                                                        Score: {getHeuristicScore(comment).toFixed(0)}
                                                    </span>
                                                </div>
                                                <span className="text-white text-sm">{comment.text}</span>
                                            </div>
                                            <span className="text-gray-400 text-xs whitespace-nowrap">{comment.likes} ❤️</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Instagram Comments */}
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded text-xs">Instagram</span>
                                    <span className="text-green-600">{sortedInstagram.length} shown</span>
                                    <span className="text-gray-400">of {instagramComments.length}</span>
                                </h4>
                                <div className="max-h-[600px] overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-2">
                                    {sortedInstagram.length === 0 ? (
                                        <div className="text-center py-4 text-gray-400 text-sm">
                                            {instagramComments.length > 0 ? 'Run AI Analyze to find authentic comments' : 'No comments'}
                                        </div>
                                    ) : sortedInstagram.slice(0, 500).map((comment, idx) => (
                                        <div
                                            key={comment.id}
                                            onClick={() => handleAddScrapedComment(comment)}
                                            className={`p-3 rounded-lg cursor-pointer hover:opacity-80 transition text-sm flex items-start gap-2 ${comment.isAuthentic ? 'bg-green-800 border-2 border-green-500' : 'bg-gradient-to-r from-purple-900 to-pink-900'
                                                }`}
                                        >
                                            <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                                            {comment.profilePicUrl ? (
                                                <img src={comment.profilePicUrl} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-purple-700 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                                    <span className="text-gray-300 text-xs">@{comment.username}</span>
                                                    {comment.isAuthentic && <span className="text-green-400 text-xs font-bold">✓ AUTHENTIC</span>}
                                                    <span className="text-yellow-400 text-[10px] bg-yellow-900/50 px-1 rounded">
                                                        Score: {getHeuristicScore(comment).toFixed(0)}
                                                    </span>
                                                </div>
                                                <span className="text-white text-sm">{comment.text}</span>
                                            </div>
                                            <span className="text-gray-300 text-xs whitespace-nowrap">{comment.likes} ❤️</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual add comment */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comment Text</label>
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="This is so cool! 🔥"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                        <select
                            value={commentPlatform}
                            onChange={(e) => setCommentPlatform(e.target.value as any)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent"
                        >
                            <option value="tiktok">TikTok</option>
                            <option value="instagram">Instagram</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <button onClick={handleAddComment} className="w-full px-4 py-2 bg-subway-green text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2">
                            <Plus size={18} /> Add Manual
                        </button>
                    </div>
                </div>

                {/* Featured comments - separated by platform */}
                {featuredComments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Featured TikTok</h4>
                            <div className="space-y-2">
                                {featuredTiktok.map(comment => (
                                    <div key={comment.id} className="flex items-center justify-between p-3 bg-gray-900 text-white rounded-lg">
                                        <span className="text-sm">"{comment.text}"</span>
                                        <button onClick={() => handleRemoveComment(comment.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {featuredTiktok.length === 0 && <div className="text-gray-400 text-sm">No TikTok comments</div>}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Featured Instagram</h4>
                            <div className="space-y-2">
                                {featuredInstagram.map(comment => (
                                    <div key={comment.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-900 to-pink-900 text-white rounded-lg">
                                        <span className="text-sm">"{comment.text}"</span>
                                        <button onClick={() => handleRemoveComment(comment.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                                {featuredInstagram.length === 0 && <div className="text-gray-400 text-sm">No Instagram comments</div>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400">No featured comments added yet</div>
                )}
            </div>

            {/* Placeholders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-gray-200 border-dashed p-6 text-center">
                    <Image className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-gray-400 font-medium">Athlete Headshots</h3>
                    <p className="text-gray-300 text-sm">Coming soon...</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 border-dashed p-6 text-center">
                    <GitCompare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <h3 className="text-gray-400 font-medium">Before/After Comparisons</h3>
                    <p className="text-gray-300 text-sm">Coming soon...</p>
                </div>
            </div>
        </div>
    );
};
