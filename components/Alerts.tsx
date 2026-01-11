import React, { useMemo, useState } from 'react';
import { Athlete } from '../types';
import { AlertTriangle, ExternalLink, XCircle, Video, Film, Copy, Check, EyeOff, Instagram } from 'lucide-react';

interface Props {
    data: Athlete[];
    failedTikTokUrls: string[];
    failedInstagramUrls: string[];
    dismissedAlerts: string[];
    onDismissAlert: (url: string) => void;
}

// Helper to clean and format username
const cleanUsername = (username: string): string => {
    if (!username) return '';
    return username.replace(/^@/, '').trim();
};

// CopyPhone component with feedback
const CopyPhone: React.FC<{ phone: string }> = ({ phone }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(phone);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    if (!phone) return <span className="text-gray-400">-</span>;

    return (
        <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition group"
            title="Click to copy"
        >
            <span>{phone}</span>
            {copied ? (
                <Check size={14} className="text-green-500" />
            ) : (
                <Copy size={14} className="opacity-0 group-hover:opacity-100 transition" />
            )}
        </button>
    );
};

// Clickable IG link
const IGLink: React.FC<{ username: string }> = ({ username }) => {
    const clean = cleanUsername(username);
    if (!clean) return <span className="text-gray-400">-</span>;

    return (
        <a
            href={`https://instagram.com/${clean}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-pink-600 hover:text-pink-800 hover:underline"
        >
            <Instagram size={14} />
            <span>@{clean}</span>
        </a>
    );
};

// Clickable TikTok link
const TikTokLink: React.FC<{ username: string }> = ({ username }) => {
    const clean = cleanUsername(username);
    if (!clean) return <span className="text-gray-400">-</span>;

    return (
        <a
            href={`https://tiktok.com/@${clean}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-gray-900 hover:text-black hover:underline"
        >
            <Video size={14} />
            <span>@{clean}</span>
        </a>
    );
};

export const Alerts: React.FC<Props> = ({
    data,
    failedTikTokUrls,
    failedInstagramUrls,
    dismissedAlerts,
    onDismissAlert
}) => {
    // Find athletes whose TikTok URLs are in the failed list (and not dismissed)
    const tiktokAlertAthletes = useMemo(() => {
        if (!failedTikTokUrls || failedTikTokUrls.length === 0) return [];
        return data.filter(athlete =>
            athlete.tiktok_post_url &&
            failedTikTokUrls.includes(athlete.tiktok_post_url) &&
            !dismissedAlerts.includes(athlete.tiktok_post_url)
        );
    }, [data, failedTikTokUrls, dismissedAlerts]);

    // Find athletes whose Instagram Reel URLs are in the failed list (and not dismissed)
    const instagramAlertAthletes = useMemo(() => {
        if (!failedInstagramUrls || failedInstagramUrls.length === 0) return [];
        return data.filter(athlete =>
            athlete.ig_reel_url &&
            failedInstagramUrls.includes(athlete.ig_reel_url) &&
            !dismissedAlerts.includes(athlete.ig_reel_url)
        );
    }, [data, failedInstagramUrls, dismissedAlerts]);

    const totalAlerts = tiktokAlertAthletes.length + instagramAlertAthletes.length;

    if (totalAlerts === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Alerts</h3>
                <p className="text-gray-500">All checked URLs returned valid data.</p>
                <p className="text-gray-400 text-sm mt-2">Run TikTok fetch or Instagram verification to check for deleted/archived posts.</p>
            </div>
        );
    }

    const AlertTable = ({
        athletes,
        type,
        icon,
        urlField
    }: {
        athletes: Athlete[];
        type: 'TikTok' | 'Instagram Reel';
        icon: React.ReactNode;
        urlField: 'tiktok_post_url' | 'ig_reel_url';
    }) => (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                {icon}
                <span className="font-medium text-gray-800">{type} Alerts</span>
                <span className="ml-auto px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                    {athletes.length}
                </span>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Athlete</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Phone</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">IG Account</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">TikTok Account</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Post URL</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {athletes.map(athlete => (
                        <tr key={athlete.id} className="hover:bg-red-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{athlete.user_name}</td>
                            <td className="px-4 py-3">
                                <CopyPhone phone={athlete.user_phone_number} />
                            </td>
                            <td className="px-4 py-3">
                                <IGLink username={athlete.ig_account} />
                            </td>
                            <td className="px-4 py-3">
                                <TikTokLink username={athlete.tiktok_account} />
                            </td>
                            <td className="px-4 py-3">
                                <a
                                    href={athlete[urlField]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                    <span className="truncate max-w-[150px]">{athlete[urlField]}</span>
                                    <ExternalLink size={14} />
                                </a>
                            </td>
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => onDismissAlert(athlete[urlField])}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition"
                                    title="Hide this alert (will reappear if still failing on next check)"
                                >
                                    <EyeOff size={12} />
                                    Dismiss
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Content Alerts</h2>
                    <p className="text-gray-500 text-sm">Posts that returned no data (possibly deleted/archived)</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    <XCircle className="w-4 h-4" />
                    {totalAlerts} issue{totalAlerts !== 1 ? 's' : ''}
                </div>
            </div>

            {tiktokAlertAthletes.length > 0 && (
                <AlertTable
                    athletes={tiktokAlertAthletes}
                    type="TikTok"
                    icon={<Video className="w-5 h-5 text-gray-900" />}
                    urlField="tiktok_post_url"
                />
            )}

            {instagramAlertAthletes.length > 0 && (
                <AlertTable
                    athletes={instagramAlertAthletes}
                    type="Instagram Reel"
                    icon={<Film className="w-5 h-5 text-pink-500" />}
                    urlField="ig_reel_url"
                />
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-1">What does this mean?</h4>
                <p className="text-yellow-700 text-sm">
                    These posts returned no data from the Apify scraper. This could mean:
                </p>
                <ul className="text-yellow-700 text-sm mt-2 space-y-1 ml-4 list-disc">
                    <li>The video was deleted or archived</li>
                    <li>The video is set to private</li>
                    <li>The URL format is incorrect</li>
                    <li>Temporary scraping issue (try again later)</li>
                </ul>
                <p className="text-yellow-600 text-xs mt-3">
                    💡 Dismissed alerts will reappear if the URL still fails on the next verification.
                </p>
            </div>
        </div>
    );
};
