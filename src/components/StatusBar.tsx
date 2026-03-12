'use client';

interface StatusBarProps {
  lastSync: { source: string; completedAt: string; status: string } | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function getRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function StatusBar({ lastSync, isRefreshing, onRefresh }: StatusBarProps) {
  return (
    <div className="flex items-center gap-3">
      {lastSync && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              lastSync.status === 'success' ? 'bg-emerald-500 pulse-dot' : 'bg-red-500'
            }`}
          />
          Updated {getRelativeTime(lastSync.completedAt)}
        </div>
      )}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
      >
        <svg
          className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isRefreshing ? 'Syncing...' : 'Refresh'}
      </button>
    </div>
  );
}
