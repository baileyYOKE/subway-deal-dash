import React, { useState, useEffect, useRef } from 'react';
import { Athlete } from './types';
import { loadData, saveDataLocal, saveDataToCloudNow, processCSVImport, processLowPriorityImport, loadDataFromCloud, subscribeToCloudChanges } from './services/dataService';
import { fetchTikTokData } from './services/tiktokService';
import { verifyInstagramReels } from './services/instagramService';
import { Dashboard } from './components/Dashboard';
import { DataTable } from './components/DataTable';
import { DataImport } from './components/DataImport';
import { MissingMedia } from './components/MissingMedia';
import { Alerts } from './components/Alerts';
import { VersionHistory } from './components/VersionHistory';
import { ShowcaseAdmin } from './components/ShowcaseAdmin';
import { ChangeNotification, StatChange, calculateCampaignStats, calculateStatChanges } from './components/ChangeNotification';
import { Lock, LayoutDashboard, Table as TableIcon, Database, LogOut, Cloud, CloudOff, AlertCircle, AlertTriangle, Save, RefreshCw, History, Sparkles } from 'lucide-react';

// App version - increment on each deploy for easy tracking
const APP_VERSION = '1.1.0';

const PASSCODE = 'nil';

enum Tab {
  DASHBOARD = 'dashboard',
  TABLE = 'table',
  MISSING = 'missing',
  ALERTS = 'alerts',
  HISTORY = 'history',
  SHOWCASE = 'showcase',
  IMPORT = 'import',
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [data, setData] = useState<Athlete[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifyingIG, setIsVerifyingIG] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cloudSynced, setCloudSynced] = useState<boolean | null>(null);
  const [failedTikTokUrls, setFailedTikTokUrls] = useState<string[]>([]);
  const [failedInstagramUrls, setFailedInstagramUrls] = useState<string[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // New real-time sync state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newDataAvailable, setNewDataAvailable] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string>('');
  const lastKnownUpdateRef = useRef<string>('');

  // Change notification state
  const [changeNotification, setChangeNotification] = useState<{ changes: StatChange[]; title: string } | null>(null);

  // Initial Load
  useEffect(() => {
    const loadInitialData = async () => {
      const authStatus = localStorage.getItem('subway_auth');
      if (authStatus === 'true') setIsAuthenticated(true);

      // Load from cloud first
      try {
        const cloudResult = await loadDataFromCloud();
        if (cloudResult.athletes && cloudResult.athletes.length > 0) {
          const cloudHasRealData = cloudResult.athletes.some(a => a.user_name && !a.user_name.startsWith('Athlete_'));
          if (cloudHasRealData) {
            setData(cloudResult.athletes);
            setCloudSynced(true);
          } else {
            // Try local
            const localData = loadData();
            setData(localData);
            setCloudSynced(false);
          }
        } else {
          const localData = loadData();
          setData(localData);
          setCloudSynced(false);
        }

        // Load alerts from cloud
        if (cloudResult.failedTikTokUrls.length > 0 || cloudResult.failedInstagramUrls.length > 0) {
          setFailedTikTokUrls(cloudResult.failedTikTokUrls);
          setFailedInstagramUrls(cloudResult.failedInstagramUrls);
          console.log('📋 Loaded alerts from cloud:', cloudResult.failedTikTokUrls.length, 'TikTok,', cloudResult.failedInstagramUrls.length, 'IG');
        }
        if (cloudResult.dismissedAlerts.length > 0) {
          setDismissedAlerts(cloudResult.dismissedAlerts);
          console.log('📋 Loaded dismissed alerts:', cloudResult.dismissedAlerts.length);
        }
      } catch (err) {
        console.error('Cloud load error:', err);
        const localData = loadData();
        setData(localData);
        setCloudSynced(false);
      }
      setLoading(false);
    };

    loadInitialData();
  }, []);

  // Subscribe to real-time cloud changes
  useEffect(() => {
    const unsubscribe = subscribeToCloudChanges((cloudData, updatedAt) => {
      // If this is a new update from someone else, show banner
      if (lastKnownUpdateRef.current && updatedAt !== lastKnownUpdateRef.current) {
        console.log('🔔 New data detected from another device!');
        setNewDataAvailable(true);
        setCloudUpdatedAt(updatedAt);
      }
      lastKnownUpdateRef.current = updatedAt;
    });

    return () => unsubscribe();
  }, []);

  // Save to local storage on change (but NOT to cloud - that's manual now)
  useEffect(() => {
    if (!loading) {
      saveDataLocal(data);
      setHasUnsavedChanges(true);
    }
  }, [data, loading]);

  // Handler to refresh data from cloud
  const handleRefreshFromCloud = async () => {
    const cloudResult = await loadDataFromCloud();
    if (cloudResult.athletes && cloudResult.athletes.length > 0) {
      setData(cloudResult.athletes);
      setFailedTikTokUrls(cloudResult.failedTikTokUrls);
      setFailedInstagramUrls(cloudResult.failedInstagramUrls);
      setDismissedAlerts(cloudResult.dismissedAlerts);
      setNewDataAvailable(false);
      setHasUnsavedChanges(false);
      setCloudSynced(true);
      alert('✅ Data refreshed from cloud!');
    }
  };

  // Handler to save to cloud (includes alerts data)
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    const success = await saveDataToCloudNow(data, {
      failedTikTokUrls,
      failedInstagramUrls,
      dismissedAlerts
    });
    setIsSaving(false);
    if (success) {
      setHasUnsavedChanges(false);
      setCloudSynced(true);
      lastKnownUpdateRef.current = new Date().toISOString();
      alert('✅ Saved to cloud! Other devices will see the update.');
    } else {
      alert('❌ Failed to save to cloud. Please try again.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.toLowerCase() === PASSCODE) {
      setIsAuthenticated(true);
      localStorage.setItem('subway_auth', 'true');
    } else {
      alert('Incorrect passcode');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('subway_auth');
    setPasscodeInput('');
  };

  // Handler to dismiss an alert (mark it as checked)
  const handleDismissAlert = (url: string) => {
    setDismissedAlerts(prev => [...prev, url]);
    setHasUnsavedChanges(true);
  };

  const handleImport = async (file: File) => {
    try {
      setLoading(true);

      // Capture stats BEFORE import
      const statsBefore = calculateCampaignStats(data);

      const updated = await processCSVImport(file, data);
      setData(updated);

      // Calculate stats AFTER and show notification
      const statsAfter = calculateCampaignStats(updated);
      const changes = calculateStatChanges(statsBefore, statsAfter);
      if (changes.length > 0) {
        setChangeNotification({ changes, title: 'Data Import Complete' });
      }

      // Auto-save to cloud after import
      await saveDataToCloudNow(updated, {
        failedTikTokUrls,
        failedInstagramUrls,
        dismissedAlerts
      }, 'import');
      console.log('💾 Auto-saved to cloud after import');

      setActiveTab(Tab.TABLE);
    } catch (e) {
      alert('Failed to parse CSV');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLowPriorityImport = async (file: File) => {
    try {
      setLoading(true);

      // Capture stats BEFORE import
      const statsBefore = calculateCampaignStats(data);

      const { data: updated, result } = await processLowPriorityImport(file, data);
      setData(updated);

      // Calculate stats AFTER and show notification
      const statsAfter = calculateCampaignStats(updated);
      const changes = calculateStatChanges(statsBefore, statsAfter);
      if (changes.length > 0) {
        setChangeNotification({ changes, title: 'Low Priority Import' });
      }

      // Build report
      let message = `Low Priority Import Complete!\n\n`;
      message += `📋 Rows processed: ${result.totalRowsProcessed}\n`;
      message += `👤 Athletes matched: ${result.athletesMatched}\n`;
      message += `✅ Fields updated: ${result.fieldsUpdated}\n`;

      if (result.updates.length > 0) {
        message += `\n📝 Updates made:\n`;
        result.updates.slice(0, 20).forEach(u => {
          message += `• ${u}\n`;
        });
        if (result.updates.length > 20) {
          message += `... and ${result.updates.length - 20} more`;
        }
      } else {
        message += `\nNo fields needed updating (all already had data).`;
      }

      alert(message);
      console.log('Low Priority Import Full Results:', result);

      // Auto-save to cloud after import
      await saveDataToCloudNow(updated, {
        failedTikTokUrls,
        failedInstagramUrls,
        dismissedAlerts
      }, 'low-priority-import');
      console.log('💾 Auto-saved to cloud after low priority import');

      setActiveTab(Tab.TABLE);
    } catch (e) {
      alert('Failed to parse low priority CSV');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTikTokRefresh = async () => {
    if (confirm("This will trigger a live scrape using your Apify quota. Continue?")) {
      setIsRefreshing(true);
      try {
        // Capture stats BEFORE refresh
        const statsBefore = calculateCampaignStats(data);

        const { athletes: updated, result } = await fetchTikTokData(data);
        setData(updated);

        // Calculate stats AFTER and show notification
        const statsAfter = calculateCampaignStats(updated);
        const changes = calculateStatChanges(statsBefore, statsAfter);
        if (changes.length > 0) {
          setChangeNotification({ changes, title: 'TikTok Refresh Complete' });
        }

        // Store failed URLs for Alerts module
        setFailedTikTokUrls(result.failedUrls || []);

        // Clear dismissed alerts for URLs that still fail (they should reappear)
        const newFailed = result.failedUrls || [];
        setDismissedAlerts(prev => prev.filter(url => !newFailed.includes(url)));

        // Build detailed feedback message
        let message = `TikTok Fetch Complete!\n\n`;
        message += `📊 Athletes with TikTok URLs: ${result.athletesWithUrls}\n`;
        message += `✅ Successfully updated: ${result.successfulFetches}\n`;
        message += `❌ Failed/No data: ${result.failedFetches}\n`;

        if (result.failedFetches > 0) {
          message += `\n⚠️ Check the Alerts tab to see which TikToks may be deleted/archived.`;
        }

        if (result.errors.length > 0) {
          message += `\n\nIssues:\n${result.errors.join('\n')}`;
        }

        // Log debug info to console for troubleshooting
        if (result.debugInfo && result.debugInfo.length > 0) {
          console.log('🔍 TikTok Debug Info:');
          result.debugInfo.forEach(info => console.log(`  ${info}`));
        }

        alert(message);

        // Auto-save alerts to cloud so they persist
        const updatedDismissed = dismissedAlerts.filter(url => !newFailed.includes(url));
        await saveDataToCloudNow(updated, {
          failedTikTokUrls: newFailed,
          failedInstagramUrls,
          dismissedAlerts: updatedDismissed
        }, 'tiktok-refresh');
        console.log('💾 Auto-saved alerts to cloud');
      } catch (e) {
        alert('Failed to refresh TikTok data. Check console for details.');
        console.error(e);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const handleInstagramVerify = async () => {
    if (confirm("This will verify Instagram Reels via Apify. It will NOT update metrics. Continue?")) {
      setIsVerifyingIG(true);
      try {
        const { result } = await verifyInstagramReels(data);

        // Store failed URLs for Alerts module
        setFailedInstagramUrls(result.failedUrls || []);

        // Clear dismissed alerts for URLs that still fail (they should reappear)
        const newFailed = result.failedUrls || [];
        setDismissedAlerts(prev => prev.filter(url => !newFailed.includes(url)));

        // Build feedback message
        let message = `Instagram Reel Verification Complete!\n\n`;
        message += `📸 Reels checked: ${result.athletesWithUrls}\n`;
        message += `✅ Verified (post exists): ${result.verifiedPosts}\n`;
        message += `❌ Not found: ${result.failedPosts}\n`;

        if (result.failedPosts > 0) {
          message += `\n⚠️ Check the Alerts tab to see which Reels may be deleted/archived.`;
        }

        if (result.debugInfo && result.debugInfo.length > 0) {
          console.log('🔍 Instagram Debug Info:');
          result.debugInfo.forEach(info => console.log(`  ${info}`));
        }

        alert(message);

        // Auto-save alerts to cloud so they persist
        const updatedDismissed = dismissedAlerts.filter(url => !newFailed.includes(url));
        await saveDataToCloudNow(data, {
          failedTikTokUrls,
          failedInstagramUrls: newFailed,
          dismissedAlerts: updatedDismissed
        }, 'instagram-verify');
        console.log('💾 Auto-saved alerts to cloud');
      } catch (e) {
        alert('Failed to verify Instagram Reels. Check console for details.');
        console.error(e);
      } finally {
        setIsVerifyingIG(false);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-subway-green p-4 rounded-full">
              <Lock className="w-8 h-8 text-black" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Subway Deal #2</h1>
          <p className="text-center text-gray-500 mb-8">Enter access code to continue</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="Passcode"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-subway-green focus:border-transparent outline-none transition"
            />
            <button
              type="submit"
              className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-subway-green rounded flex items-center justify-center font-bold text-white text-xs">S</div>
              <span className="font-bold text-xl tracking-tight text-gray-900">Subway <span className="text-gray-400 font-light">Deal #2 Dash</span></span>
            </div>

            <nav className="flex items-center space-x-1">
              <NavButton
                active={activeTab === Tab.DASHBOARD}
                onClick={() => setActiveTab(Tab.DASHBOARD)}
                icon={<LayoutDashboard size={18} />}
                label="Overview"
              />
              <NavButton
                active={activeTab === Tab.TABLE}
                onClick={() => setActiveTab(Tab.TABLE)}
                icon={<TableIcon size={18} />}
                label="Data Table"
              />
              <NavButton
                active={activeTab === Tab.MISSING}
                onClick={() => setActiveTab(Tab.MISSING)}
                icon={<AlertCircle size={18} />}
                label="Missing Media"
              />
              <NavButton
                active={activeTab === Tab.ALERTS}
                onClick={() => setActiveTab(Tab.ALERTS)}
                icon={<AlertTriangle size={18} />}
                label={`Alerts${(failedTikTokUrls.length + failedInstagramUrls.length) > 0 ? ` (${failedTikTokUrls.length + failedInstagramUrls.length})` : ''}`}
              />
              <NavButton
                active={activeTab === Tab.HISTORY}
                onClick={() => setActiveTab(Tab.HISTORY)}
                icon={<History size={18} />}
                label="History"
              />
              <NavButton
                active={activeTab === Tab.SHOWCASE}
                onClick={() => setActiveTab(Tab.SHOWCASE)}
                icon={<Sparkles size={18} />}
                label="Showcase"
              />
              <NavButton
                active={activeTab === Tab.IMPORT}
                onClick={() => setActiveTab(Tab.IMPORT)}
                icon={<Database size={18} />}
                label="Sources & Import"
              />
            </nav>

            {/* Save and Sync Controls */}
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveToCloud}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                >
                  <Save size={16} />
                  {isSaving ? 'Saving...' : 'Save to Cloud'}
                </button>
              )}
              {cloudSynced ? (
                <Cloud className="w-5 h-5 text-green-500" />
              ) : (
                <CloudOff className="w-5 h-5 text-gray-400" />
              )}
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-600 transition">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* New Data Available Banner */}
        {newDataAvailable && (
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} />
              <span className="text-sm font-medium">New data available from another device!</span>
            </div>
            <button
              onClick={handleRefreshFromCloud}
              className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-blue-50 transition"
            >
              Refresh Now
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === Tab.DASHBOARD && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Campaign Overview</h2>
              <p className="text-gray-500">Live aggregated metrics from all athletes</p>
            </div>
            <Dashboard data={data} />
          </div>
        )}

        {activeTab === Tab.TABLE && (
          <div className="animate-fade-in space-y-8">
            {/* Video Campaign Table */}
            <div>
              <div className="mb-4 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">🎬 Video Campaign</h2>
                  <p className="text-gray-500">TikTok OR IG Reel + Story</p>
                </div>
                <div className="text-xs text-gray-400">
                  {data.filter(a => a.campaign_type === 'video').length} athletes
                </div>
              </div>
              <div className="h-[400px] bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <DataTable
                  data={data.filter(a => a.campaign_type === 'video')}
                  onUpdate={(updated) => {
                    // Merge: keep non-video athletes + updated video athletes
                    const nonVideoAthletes = data.filter(a => a.campaign_type !== 'video');
                    setData([...nonVideoAthletes, ...updated]);
                  }}
                />
              </div>
            </div>

            {/* Story Campaign Table */}
            <div>
              <div className="mb-4 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">📸 Just Story Campaign</h2>
                  <p className="text-gray-500">IG Story only</p>
                </div>
                <div className="text-xs text-gray-400">
                  {data.filter(a => a.campaign_type === 'story').length} athletes
                </div>
              </div>
              <div className="h-[400px] bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <DataTable
                  data={data.filter(a => a.campaign_type === 'story')}
                  onUpdate={(updated) => {
                    // Merge: keep non-story athletes + updated story athletes
                    const nonStoryAthletes = data.filter(a => a.campaign_type !== 'story');
                    setData([...nonStoryAthletes, ...updated]);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === Tab.MISSING && (
          <div className="animate-fade-in">
            <MissingMedia data={data} onUpdate={setData} />
          </div>
        )}

        {activeTab === Tab.ALERTS && (
          <div className="animate-fade-in">
            <Alerts
              data={data}
              failedTikTokUrls={failedTikTokUrls}
              failedInstagramUrls={failedInstagramUrls}
              dismissedAlerts={dismissedAlerts}
              onDismissAlert={handleDismissAlert}
            />
          </div>
        )}

        {activeTab === Tab.HISTORY && (
          <div className="animate-fade-in">
            <VersionHistory
              currentData={data}
              onRestore={(athletes) => {
                setData(athletes);
                setHasUnsavedChanges(true);
              }}
            />
          </div>
        )}

        {activeTab === Tab.SHOWCASE && (
          <div className="animate-fade-in">
            <ShowcaseAdmin data={data} onUpdate={(newData) => {
              setData(newData);
              setHasUnsavedChanges(true);
            }} />
          </div>
        )}

        {activeTab === Tab.IMPORT && (
          <div className="animate-fade-in">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">Data Sources</h2>
              <p className="text-gray-500">Manage external data ingestion</p>
            </div>
            <DataImport
              onImport={handleImport}
              onLowPriorityImport={handleLowPriorityImport}
              onTikTokRefresh={handleTikTokRefresh}
              onInstagramVerify={handleInstagramVerify}
              onProfileImageMigration={async () => {
                const { applyProfileImages } = await import('./services/profileImageMigration');
                const result = applyProfileImages(data);
                // Update local data with migrated images
                setData(result.athletes);
                // Trigger cloud save with updated data
                await saveDataToCloudNow(result.athletes);
                return { matched: result.matched, notFound: result.notFound };
              }}
              onBackupContacts={() => {
                const { generateContactBackupCSV } = require('./services/athleteRosterService');
                const csv = generateContactBackupCSV(data);
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `athlete_contacts_backup_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              onPurgeNonBaseline={async () => {
                const { filterToBaselineAthletes } = await import('./services/athleteRosterService');
                const { kept, removed } = filterToBaselineAthletes(data);
                setData(kept);
                // Save to cloud immediately
                await saveDataToCloudNow(kept, {
                  failedTikTokUrls,
                  failedInstagramUrls,
                  dismissedAlerts
                }, 'purge-non-baseline');
                return { removed: removed.length, kept: kept.length };
              }}
              isRefreshing={isRefreshing}
              isVerifyingIG={isVerifyingIG}
            />
          </div>
        )}
      </main>

      {/* Change Notification */}
      {changeNotification && (
        <ChangeNotification
          changes={changeNotification.changes}
          title={changeNotification.title}
          onClose={() => setChangeNotification(null)}
        />
      )}

      {/* Footer with Version */}
      <footer className="bg-gray-100 border-t border-gray-200 py-3 px-4 text-center">
        <span className="text-xs text-gray-400">
          Subway Deal #2 Dash • Version <span className="font-mono font-bold text-gray-500">{APP_VERSION}</span>
        </span>
      </footer>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active
      ? 'bg-gray-900 text-white'
      : 'text-gray-600 hover:bg-gray-100'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default App;
