import { Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '../../hooks/useTheme';

interface ThemeToggleProps {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}

const options: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle({ mode, onModeChange }: ThemeToggleProps) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      padding: '3px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--canvas-raised)',
      border: '1px solid var(--border-subtle)',
    }}>
      {options.map(opt => {
        const active = mode === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => onModeChange(opt.value)}
            title={opt.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '26px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--canvas-overlay)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
