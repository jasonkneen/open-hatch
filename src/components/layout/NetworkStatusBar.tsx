import { WifiOff, RefreshCw, Check } from 'lucide-react';

interface NetworkStatusBarProps {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  onSync: () => void;
}

export function NetworkStatusBar({ online, syncing, pendingCount, onSync }: NetworkStatusBarProps) {
  if (online && pendingCount === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 16px',
      background: online
        ? (pendingCount > 0 ? 'var(--warning-subtle)' : 'var(--success-subtle)')
        : 'var(--error-subtle)',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: '12px',
      fontWeight: 500,
      transition: 'all 300ms ease',
    }}>
      {!online ? (
        <>
          <WifiOff size={13} style={{ color: 'var(--error)' }} />
          <span style={{ color: 'var(--error)' }}>
            Offline — changes will sync when you reconnect
          </span>
        </>
      ) : syncing ? (
        <>
          <RefreshCw
            size={13}
            style={{
              color: 'var(--warning)',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ color: 'var(--warning)' }}>
            Syncing {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}...
          </span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <RefreshCw size={13} style={{ color: 'var(--warning)' }} />
          <span style={{ color: 'var(--warning)' }}>
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending
          </span>
          <button
            onClick={onSync}
            style={{
              marginLeft: '4px',
              background: 'var(--warning)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-inverse)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Sync now
          </button>
        </>
      ) : (
        <>
          <Check size={13} style={{ color: 'var(--success)' }} />
          <span style={{ color: 'var(--success)' }}>All changes synced</span>
        </>
      )}
    </div>
  );
}
