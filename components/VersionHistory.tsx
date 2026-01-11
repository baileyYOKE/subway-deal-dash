import React, { useState, useEffect } from 'react';
import { History, Clock, RefreshCw, Eye, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { getVersionHistory, getVersion, restoreVersion, VersionSnapshot } from '../services/dataService';
import { Athlete } from '../types';

interface Props {
    onRestore: (athletes: Athlete[]) => void;
    currentData: Athlete[];
}

type ViewMode = 'list' | 'preview';

export const VersionHistory: React.FC<Props> = ({ onRestore, currentData }) => {
    const [versions, setVersions] = useState<Omit<VersionSnapshot, 'athletes'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<VersionSnapshot | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [loadingVersion, setLoadingVersion] = useState(false);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        setLoading(true);
        const history = await getVersionHistory();
        setVersions(history);
        setLoading(false);
    };

    const handleViewVersion = async (versionId: string) => {
        setLoadingVersion(true);
        const version = await getVersion(versionId);
        if (version) {
            setSelectedVersion(version);
            setViewMode('preview');
        }
        setLoadingVersion(false);
    };

    const handleRestore = async () => {
        if (!selectedVersion?.id) return;

        if (!confirm(
            `Are you sure you want to restore this version from ${formatDate(selectedVersion.timestamp)}?\n\n` +
            `This will replace your current data with ${selectedVersion.athleteCount} athletes.\n\n` +
            `Current stats:\n` +
            `• Total Views: ${currentData.reduce((sum, a) => sum + (a.tiktok_views || 0) + (a.ig_reel_views || 0), 0).toLocaleString()}\n\n` +
            `Version stats:\n` +
            `• Total Views: ${selectedVersion.totalViews.toLocaleString()}`
        )) return;

        setRestoring(true);
        const athletes = await restoreVersion(selectedVersion.id);
        if (athletes) {
            onRestore(athletes);
            alert('✅ Version restored successfully! Click "Save to Cloud" to persist.');
            setViewMode('list');
            setSelectedVersion(null);
        } else {
            alert('❌ Failed to restore version. Please try again.');
        }
        setRestoring(false);
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const getSourceLabel = (source: string) => {
        switch (source) {
            case 'import': return 'CSV Import';
            case 'low-priority-import': return 'Low Priority Import';
            case 'tiktok-refresh': return 'TikTok Refresh';
            case 'instagram-verify': return 'Instagram Verify';
            case 'manual-save': return 'Manual Save';
            case 'mock-data': return 'Mock Data';
            default: return source;
        }
    };

    const getSourceColor = (source: string) => {
        switch (source) {
            case 'import': return 'bg-blue-100 text-blue-700';
            case 'low-priority-import': return 'bg-purple-100 text-purple-700';
            case 'tiktok-refresh': return 'bg-gray-100 text-gray-700';
            case 'instagram-verify': return 'bg-pink-100 text-pink-700';
            case 'mock-data': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-3 animate-spin" />
                <p className="text-gray-500">Loading version history...</p>
            </div>
        );
    }

    // Preview mode - show selected version details
    if (viewMode === 'preview' && selectedVersion) {
        return (
            <div className="space-y-6">
                {/* Back button */}
                <button
                    onClick={() => { setViewMode('list'); setSelectedVersion(null); }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
                >
                    <ArrowLeft size={18} />
                    <span>Back to History</span>
                </button>

                {/* Version details card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Version from {formatDate(selectedVersion.timestamp)}
                                </h2>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(selectedVersion.source)}`}>
                                    {getSourceLabel(selectedVersion.source)}
                                </span>
                            </div>
                            <button
                                onClick={handleRestore}
                                disabled={restoring}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {restoring ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Restoring...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={16} />
                                        Restore This Version
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Stats comparison */}
                    <div className="p-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wide">Version Stats</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Athletes</p>
                                <p className="text-2xl font-bold text-gray-900">{selectedVersion.athleteCount}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">Total Views</p>
                                <p className="text-2xl font-bold text-gray-900">{selectedVersion.totalViews.toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">TikTok Views</p>
                                <p className="text-2xl font-bold text-gray-900">{selectedVersion.tiktokViews.toLocaleString()}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-500 mb-1">IG Reel Views</p>
                                <p className="text-2xl font-bold text-gray-900">{selectedVersion.igReelViews.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sample athletes preview */}
                    <div className="px-6 pb-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">Sample Athletes</h3>
                        <div className="bg-gray-50 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-gray-600">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Name</th>
                                        <th className="px-4 py-2 text-left">Phone</th>
                                        <th className="px-4 py-2 text-right">TT Views</th>
                                        <th className="px-4 py-2 text-right">Reel Views</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {selectedVersion.athletes.slice(0, 10).map((athlete, idx) => (
                                        <tr key={idx} className="bg-white">
                                            <td className="px-4 py-2 font-medium">{athlete.user_name}</td>
                                            <td className="px-4 py-2 text-gray-500">{athlete.user_phone_number}</td>
                                            <td className="px-4 py-2 text-right">{(athlete.tiktok_views || 0).toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right">{(athlete.ig_reel_views || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {selectedVersion.athletes.length > 10 && (
                                <p className="px-4 py-2 text-gray-500 text-sm bg-gray-100">
                                    ...and {selectedVersion.athletes.length - 10} more athletes
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // List mode - show all versions
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Version History</h2>
                    <p className="text-gray-500 text-sm">Browse and restore previous versions of your data</p>
                </div>
                <button
                    onClick={loadVersions}
                    className="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {versions.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Version History</h3>
                    <p className="text-gray-500">
                        Versions will be created automatically when you save, import, or refresh data.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {versions.map((version, idx) => (
                            <div
                                key={version.id}
                                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition cursor-pointer group"
                                onClick={() => version.id && handleViewVersion(version.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition">
                                        <Clock size={18} className="text-gray-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-medium text-gray-900">
                                                {formatDate(version.timestamp)}
                                            </span>
                                            {idx === 0 && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                                    Latest
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceColor(version.source)}`}>
                                                {getSourceLabel(version.source)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                            <span>{version.athleteCount} athletes</span>
                                            <span>•</span>
                                            <span>{version.totalViews.toLocaleString()} total views</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-600 transition">
                                    {loadingVersion ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Eye size={16} />
                                            <span className="text-sm">View</span>
                                            <ChevronRight size={16} />
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
