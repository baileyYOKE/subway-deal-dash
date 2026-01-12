import React, { useState, useRef } from 'react';
import { Upload, RefreshCw, Film, FileWarning, Image } from 'lucide-react';

interface Props {
  onImport: (file: File) => void;
  onLowPriorityImport: (file: File) => void;
  onTikTokRefresh: () => void;
  onInstagramVerify: () => void;
  onProfileImageMigration: () => Promise<{ matched: number; notFound: string[] }>;
  isRefreshing: boolean;
  isVerifyingIG: boolean;
}

export const DataImport: React.FC<Props> = ({
  onImport,
  onLowPriorityImport,
  onTikTokRefresh,
  onInstagramVerify,
  onProfileImageMigration,
  isRefreshing,
  isVerifyingIG
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ matched: number; notFound: string[] } | null>(null);
  const lowPriorityInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImport(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  const handleLowPriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onLowPriorityImport(e.target.files[0]);
    }
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const result = await onProfileImageMigration();
      setMigrationResult(result);
    } catch (error) {
      console.error('Migration error:', error);
    }
    setIsMigrating(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto mt-10">
      {/* Main Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CSV Import */}
        <div
          className={`bg-white p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center space-y-3 ${dragActive ? 'border-hardees-yellow bg-yellow-50' : 'border-gray-200'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="p-3 bg-gray-50 rounded-full">
            <Upload className="w-6 h-6 text-gray-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Import CSV Data</h3>
            <p className="text-gray-500 text-xs mt-1">Overrides table values</p>
          </div>
          <label className="cursor-pointer bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
            <span>Select CSV File</span>
            <input type="file" className="hidden" accept=".csv" onChange={handleChange} />
          </label>
        </div>

        {/* TikTok Refresh */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 bg-gray-900 rounded-full">
            <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">TikTok Fetch</h3>
            <p className="text-gray-500 text-xs mt-1">
              Pull live metrics for all TikToks
            </p>
          </div>
          <button
            onClick={onTikTokRefresh}
            disabled={isRefreshing}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isRefreshing ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-hardees-yellow text-black hover:brightness-105'}`}
          >
            {isRefreshing ? 'Scraping...' : 'Fetch TikTok Metrics'}
          </button>
        </div>

        {/* Instagram Verify */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full">
            <Film className={`w-6 h-6 text-white ${isVerifyingIG ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">IG Reel Verify</h3>
            <p className="text-gray-500 text-xs mt-1">
              Check if Reels still exist
            </p>
          </div>
          <button
            onClick={onInstagramVerify}
            disabled={isVerifyingIG}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isVerifyingIG ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:brightness-105'}`}
          >
            {isVerifyingIG ? 'Checking...' : 'Verify IG Reels'}
          </button>
        </div>

      </div>

      {/* Profile Image Migration */}
      <div className="bg-subway-green/10 p-4 rounded-xl border border-subway-green/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-subway-green rounded-lg">
            <Image className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-700">Migrate Profile Images</h4>
            <p className="text-xs text-gray-500">
              {migrationResult
                ? `✅ ${migrationResult.matched} athletes updated`
                : 'Import 165 image URLs from roster CSV'}
            </p>
          </div>
        </div>
        <button
          onClick={handleMigration}
          disabled={isMigrating}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isMigrating ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-subway-green text-white hover:brightness-105'}`}
        >
          {isMigrating ? 'Migrating...' : 'Run Migration'}
        </button>
      </div>

      {/* Low Priority Section */}
      <div className="border-t border-gray-200 pt-6">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <FileWarning className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Very Low Priority Import</h4>
              <p className="text-xs text-gray-400">Only fills missing/zero fields - never overrides existing data</p>
            </div>
          </div>
          <label className="cursor-pointer bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-400 transition">
            <span>Select CSV</span>
            <input
              ref={lowPriorityInputRef}
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleLowPriorityChange}
            />
          </label>
        </div>
      </div>

    </div>
  );
};
