import React, { useMemo } from 'react';
import { Athlete } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, Eye, Activity, Share2, Video, Film, Camera } from 'lucide-react';

interface Props {
  data: Athlete[];
}

export const Dashboard: React.FC<Props> = ({ data }) => {
  const stats = useMemo(() => {
    let totalViews = 0;
    let totalEngagements = 0;
    let postCount = 0;
    let tiktoksPosted = 0;
    let reelsPosted = 0;

    let tiktokViews = 0;
    let tiktokEngagements = 0;
    let igReelViews = 0;
    let igReelEngagements = 0;
    let igStoryViews = 0;
    let igStoryEngagements = 0;

    // Filter out placeholder athletes first
    const realAthletes = data.filter(a =>
      !a.user_name.startsWith('Video_Athlete_') &&
      !a.user_name.startsWith('Story_Athlete_')
    );

    realAthletes.forEach(a => {
      const hasContent = a.tiktok_views > 0 || a.ig_reel_views > 0 || a.ig_story_1_views > 0;

      // Count TikToks posted (has URL or views)
      if (a.tiktok_post_url && a.tiktok_post_url.length > 0) {
        tiktoksPosted++;
      }

      // Count Reels posted (has URL or views)
      if ((a.ig_reel_url && a.ig_reel_url.length > 0) || a.ig_reel_views > 0) {
        reelsPosted++;
      }

      if (hasContent) {
        postCount++;

        // TikTok metrics
        tiktokViews += a.tiktok_views;
        const tEng = a.tiktok_likes + a.tiktok_comments + a.tiktok_shares;
        tiktokEngagements += tEng;

        // IG Reel metrics
        igReelViews += a.ig_reel_views;
        const iEng = a.ig_reel_likes + a.ig_reel_comments + a.ig_reel_shares;
        igReelEngagements += iEng;

        // IG Story metrics (all 3 stories combined)
        const storyViews = a.ig_story_1_views + a.ig_story_2_views + a.ig_story_3_views;
        igStoryViews += storyViews;
        const sEng = (a.ig_story_1_taps + a.ig_story_1_replies + a.ig_story_1_shares) +
          (a.ig_story_2_taps + a.ig_story_2_replies + a.ig_story_2_shares) +
          (a.ig_story_3_taps + a.ig_story_3_replies + a.ig_story_3_shares);
        igStoryEngagements += sEng;

        totalViews += (a.tiktok_views + a.ig_reel_views + storyViews);
        totalEngagements += (tEng + iEng + sEng);
      }
    });

    const engagementRate = totalViews > 0 ? (totalEngagements / totalViews) : 0;
    const tiktokER = tiktokViews > 0 ? (tiktokEngagements / tiktokViews) : 0;
    const igReelER = igReelViews > 0 ? (igReelEngagements / igReelViews) : 0;
    const igStoryER = igStoryViews > 0 ? (igStoryEngagements / igStoryViews) : 0;

    return {
      totalViews,
      totalEngagements,
      postCount,
      tiktoksPosted,
      reelsPosted,
      engagementRate,
      tiktokViews,
      tiktokEngagements,
      tiktokER,
      igReelViews,
      igReelEngagements,
      igReelER,
      igStoryViews,
      igStoryEngagements,
      igStoryER
    };
  }, [data]);

  const platformData = [
    { name: 'TikTok', views: stats.tiktokViews, er: stats.tiktokER },
    { name: 'IG Reels', views: stats.igReelViews, er: stats.igReelER },
    { name: 'IG Stories', views: stats.igStoryViews, er: stats.igStoryER },
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Views"
          value={formatNumber(stats.totalViews)}
          icon={<Eye className="w-6 h-6 text-yellow-500" />}
          subtext="All platforms"
        />
        <StatCard
          title="Active Athletes"
          value={stats.postCount.toString()}
          icon={<Users className="w-6 h-6 text-blue-500" />}
          subtext={`of ${data.length} slots`}
        />
        <StatCard
          title="TikToks Posted"
          value={stats.tiktoksPosted.toString()}
          icon={<Video className="w-6 h-6 text-gray-900" />}
          subtext="With URLs"
        />
        <StatCard
          title="Reels Posted"
          value={stats.reelsPosted.toString()}
          icon={<Film className="w-6 h-6 text-pink-500" />}
          subtext="With URLs/views"
        />
        <StatCard
          title="Engagement Rate"
          value={(stats.engagementRate * 100).toFixed(2) + '%'}
          icon={<Activity className="w-6 h-6 text-green-500" />}
          subtext="Overall"
        />
        <StatCard
          title="Engagements"
          value={formatNumber(stats.totalEngagements || 0)}
          icon={<Share2 className="w-6 h-6 text-purple-500" />}
          subtext="Total"
        />
      </div>

      {/* Platform Engagement Rates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">TikTok</h3>
              <p className="text-xs text-gray-400">Engagement Rate</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {(stats.tiktokER * 100).toFixed(2)}%
          </div>
          <div className="text-sm text-gray-500">
            {formatNumber(stats.tiktokEngagements)} eng / {formatNumber(stats.tiktokViews)} views
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">IG Reels</h3>
              <p className="text-xs text-gray-400">Engagement Rate</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {(stats.igReelER * 100).toFixed(2)}%
          </div>
          <div className="text-sm text-gray-500">
            {formatNumber(stats.igReelEngagements)} eng / {formatNumber(stats.igReelViews)} views
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">IG Stories</h3>
              <p className="text-xs text-gray-400">Engagement Rate</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {(stats.igStoryER * 100).toFixed(2)}%
          </div>
          <div className="text-sm text-gray-500">
            {formatNumber(stats.igStoryEngagements)} eng / {formatNumber(stats.igStoryViews)} views
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Views by Platform</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(value)} />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#1D1D1B' : index === 1 ? '#C13584' : '#FFC72C'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <h3 className="text-lg font-semibold mb-2 text-gray-800">Campaign Status</h3>
          <div className="w-48 h-48 rounded-full border-8 border-hardees-yellow flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-gray-900">{stats.postCount}</span>
          </div>
          <p className="text-gray-500">Athletes have posted content</p>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, subtext }: { title: string, value: string, icon: React.ReactNode, subtext: string }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    <p className="text-xs text-gray-400 mt-1">{subtext}</p>
  </div>
);
