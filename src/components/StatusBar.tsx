'use client';

interface StatusBarProps {
  lastSync: { source: string; completedAt: string; status: string } | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function StatusBar({ lastSync, isRefreshing, onRefresh }: StatusBarProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-xs transition-all duration-300 ${
        isRefreshing
          ? 'pulse-refresh border-amber-500/30 bg-amber-500/5'
          : 'border-[#1e1e1e] bg-[#111]'
      }`}
    >
      <div className="flex items-center gap-3">
        {lastSync ? (
          <>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                lastSync.status === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-neutral-400">
              Updated {getRelativeTime(lastSync.completedAt)}
            </span>
          </>
        ) : (
          <span className="text-neutral-500">No sync data yet</span>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:border-amber-500/30 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isRefreshing ? 'Syncing...' : 'Refresh Now'}
      </button>
    </div>
  );
}
