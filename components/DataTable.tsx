import React, { useState, useMemo } from 'react';
import { Athlete } from '../types';
import { calculateEngagement } from '../services/dataService';
import { ArrowUpDown, ArrowUp, ArrowDown, Trash2, Download } from 'lucide-react';

interface Props {
  data: Athlete[];
  onUpdate: (updatedData: Athlete[]) => void;
}

type SortDirection = 'asc' | 'desc' | null;
type SortConfig = { key: string; direction: SortDirection };

// CSV Export function
const exportToCSV = (data: Athlete[]) => {
  // Define columns to export (in order)
  const columns = [
    { key: 'user_name', label: 'Name' },
    { key: 'user_phone_number', label: 'Phone' },
    { key: 'ig_account', label: 'IG Account' },
    { key: 'tiktok_account', label: 'TikTok Account' },
    { key: 'assigned_to', label: 'Assigned To' },
    { key: 'ig_reel_url', label: 'IG Reel URL' },
    { key: 'tiktok_post_url', label: 'TikTok Post URL' },
    { key: 'tiktok_views', label: 'TikTok Views' },
    { key: 'tiktok_likes', label: 'TikTok Likes' },
    { key: 'tiktok_comments', label: 'TikTok Comments' },
    { key: 'tiktok_shares', label: 'TikTok Shares' },
    { key: 'ig_reel_views', label: 'Reel Views' },
    { key: 'ig_reel_likes', label: 'Reel Likes' },
    { key: 'ig_reel_comments', label: 'Reel Comments' },
    { key: 'ig_reel_shares', label: 'Reel Shares' },
    { key: 'ig_story_1_views', label: 'Story Views' },
    { key: 'ig_story_1_taps', label: 'Story Taps' },
    { key: 'ig_story_1_replies', label: 'Story Replies' },
    { key: 'ig_story_1_shares', label: 'Story Shares' },
    { key: 'has_mock_data', label: 'Has Mock Data' },
  ];

  // Build CSV content
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(athlete => {
    return columns.map(col => {
      const value = (athlete as any)[col.key];
      // Escape commas and quotes in string values
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      return value ?? '';
    }).join(',');
  });

  const csvContent = [header, ...rows].join('\n');

  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `subway_athletes_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const DataTable: React.FC<Props> = ({ data, onUpdate }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: null });

  const handleCellChange = (id: string, field: keyof Athlete, value: any) => {
    const newData = data.map(athlete => {
      if (athlete.id === id) {
        return { ...athlete, [field]: value };
      }
      return athlete;
    });
    onUpdate(newData);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this athlete row?')) {
      const newData = data.filter(athlete => athlete.id !== id);
      onUpdate(newData);
    }
  };

  const handleSort = (key: string) => {
    let direction: SortDirection = 'desc'; // Default: high to low / Z to A
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') {
        direction = 'asc';
      } else if (sortConfig.direction === 'asc') {
        direction = null;
      }
    }
    setSortConfig({ key, direction });
  };

  const headers = [
    { label: '', key: 'actions', width: 'w-10', type: 'action' },
    { label: 'Name', key: 'user_name', width: 'w-48', sticky: true },
    { label: 'Phone', key: 'user_phone_number', width: 'w-32' },
    { label: 'IG Acct', key: 'ig_account', width: 'w-32' },
    { label: 'TikTok Acct', key: 'tiktok_account', width: 'w-32' },
    { label: 'Assigned To', key: 'assigned_to', width: 'w-32' },
    // URLs
    { label: 'IG Reel URL', key: 'ig_reel_url', width: 'w-48' },
    { label: 'TikTok Post URL', key: 'tiktok_post_url', width: 'w-48' },
    // Computed Rates
    { label: 'Total ER', key: 'total_er', width: 'w-24', computed: true },
    { label: 'TikTok ER', key: 'tiktok_er', width: 'w-24', computed: true },
    { label: 'IG Reel ER', key: 'ig_reel_er', width: 'w-24', computed: true },
    // TikTok Metrics
    { label: 'TT Views', key: 'tiktok_views', width: 'w-24', type: 'number' },
    { label: 'TT Likes', key: 'tiktok_likes', width: 'w-24', type: 'number' },
    { label: 'TT Comments', key: 'tiktok_comments', width: 'w-24', type: 'number' },
    { label: 'TT Shares', key: 'tiktok_shares', width: 'w-24', type: 'number' },
    // IG Reel Metrics
    { label: 'Reel Views', key: 'ig_reel_views', width: 'w-24', type: 'number' },
    { label: 'Reel Likes', key: 'ig_reel_likes', width: 'w-24', type: 'number' },
    { label: 'Reel Comm', key: 'ig_reel_comments', width: 'w-24', type: 'number' },
    { label: 'Reel Shares', key: 'ig_reel_shares', width: 'w-24', type: 'number' },
    // Story (only 1 for Subway)
    { label: 'Story Views', key: 'ig_story_1_views', width: 'w-24', type: 'number' },
    { label: 'Story Taps', key: 'ig_story_1_taps', width: 'w-24', type: 'number' },
    { label: 'Story Reply', key: 'ig_story_1_replies', width: 'w-24', type: 'number' },
    { label: 'Story Share', key: 'ig_story_1_shares', width: 'w-24', type: 'number' },
  ];

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const header = headers.find(h => h.key === sortConfig.key);
      let aVal: any, bVal: any;

      // Handle computed fields
      if (header?.computed) {
        const ratesA = calculateEngagement(a);
        const ratesB = calculateEngagement(b);
        if (sortConfig.key === 'total_er') {
          aVal = ratesA.totalRate;
          bVal = ratesB.totalRate;
        } else if (sortConfig.key === 'tiktok_er') {
          aVal = ratesA.tiktokRate;
          bVal = ratesB.tiktokRate;
        } else if (sortConfig.key === 'ig_reel_er') {
          aVal = ratesA.igReelRate;
          bVal = ratesB.igReelRate;
        }
      } else {
        aVal = a[sortConfig.key as keyof Athlete];
        bVal = b[sortConfig.key as keyof Athlete];
      }

      // Handle null/undefined
      if (aVal == null) aVal = header?.type === 'number' ? 0 : '';
      if (bVal == null) bVal = header?.type === 'number' ? 0 : '';

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });

    return sorted;
  }, [data, sortConfig]);

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="opacity-30" />;
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown size={14} className="text-hardees-yellow" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp size={14} className="text-hardees-yellow" />;
    }
    return <ArrowUpDown size={14} className="opacity-30" />;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
      {/* Header bar with export button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-sm text-gray-600">{data.length} athletes</span>
        <button
          onClick={() => exportToCSV(data)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-sm font-medium"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      <div className="overflow-auto custom-scrollbar flex-1 relative">
        <table className="min-w-max text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 font-semibold uppercase text-xs sticky top-0 z-20">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`p-3 border-b border-r border-gray-200 whitespace-nowrap ${h.sticky ? 'sticky left-0 bg-gray-100 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''} ${h.type !== 'action' ? 'cursor-pointer hover:bg-gray-200 transition-colors select-none' : ''}`}
                  onClick={() => h.type !== 'action' && handleSort(h.key)}
                >
                  <div className="flex items-center gap-1">
                    {h.label}
                    {h.type !== 'action' && getSortIcon(h.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedData.map((row) => {
              const rates = calculateEngagement(row);
              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {headers.map((h, i) => {
                    // Action column (delete button)
                    if (h.type === 'action') {
                      return (
                        <td key={i} className="p-2 border-r border-gray-100 text-center">
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      );
                    }

                    // Computed columns
                    if (h.computed) {
                      let displayVal = '';
                      if (h.key === 'total_er') displayVal = (rates.totalRate * 100).toFixed(2) + '%';
                      else if (h.key === 'tiktok_er') displayVal = (rates.tiktokRate * 100).toFixed(2) + '%';
                      else if (h.key === 'ig_reel_er') displayVal = (rates.igReelRate * 100).toFixed(2) + '%';

                      return (
                        <td key={i} className="p-3 border-r border-gray-100 bg-gray-50 text-gray-500 font-mono">
                          {displayVal}
                        </td>
                      );
                    }

                    // Editable columns
                    const val = row[h.key as keyof Athlete];

                    // Determine if this is an actual zero (from data) or empty/placeholder
                    const isActualZero = h.type === 'number' && val === 0;
                    const isEmpty = val === '' || val === null || val === undefined;
                    const displayValue = isActualZero ? '0' : (isEmpty && h.type === 'number' ? '' : val);

                    return (
                      <td
                        key={i}
                        className={`p-0 border-r border-gray-100 ${h.sticky ? 'sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`}
                      >
                        <input
                          type={h.type === 'number' ? 'number' : 'text'}
                          value={displayValue}
                          placeholder={h.type === 'number' ? '0' : '-'}
                          onChange={(e) => {
                            const newVal = h.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                            handleCellChange(row.id, h.key as keyof Athlete, newVal);
                          }}
                          className={`w-full h-full p-3 bg-transparent border-none focus:ring-2 focus:ring-hardees-yellow focus:bg-yellow-50 outline-none transition-all ${isActualZero ? 'text-gray-900 font-medium' : ''
                            }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
