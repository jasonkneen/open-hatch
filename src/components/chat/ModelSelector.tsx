import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Sparkles, Zap } from 'lucide-react';
import { AI_MODELS } from '../../types';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const selected = AI_MODELS.find(m => m.id === value) || AI_MODELS[0];

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
    }
  }, []);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 10px',
          background: 'var(--canvas-raised)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
        onMouseLeave={e => { if (!open) e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      >
        {selected.id === 'auto' ? (
          <Sparkles size={12} style={{ color: 'var(--accent)' }} />
        ) : (
          <Zap size={12} style={{ color: 'var(--warning)' }} />
        )}
        <span>{selected.label}</span>
        <ChevronDown size={11} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          />
          <div style={{
            position: 'fixed',
            left: `${pos.left}px`,
            bottom: `${pos.bottom}px`,
            background: 'var(--canvas-overlay)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xl)',
            zIndex: 1000,
            minWidth: '240px',
            overflow: 'hidden',
            padding: '4px',
          }}>
            <div style={{ padding: '8px 10px 6px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Model
              </span>
            </div>
            {AI_MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => { onChange(model.id); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  background: value === model.id ? 'var(--accent-subtle)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { if (value !== model.id) e.currentTarget.style.background = 'var(--canvas-raised)'; }}
                onMouseLeave={e => { if (value !== model.id) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {model.id === 'auto' ? (
                    <Sparkles size={12} style={{ color: 'var(--accent)' }} />
                  ) : (
                    <Zap size={12} style={{ color: value === model.id ? 'var(--accent)' : 'var(--text-muted)' }} />
                  )}
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: value === model.id ? 'var(--accent)' : 'var(--text-primary)',
                  }}>
                    {model.label}
                  </span>
                  {value === model.id && (
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--accent)',
                      background: 'var(--accent-subtle)',
                      padding: '1px 5px',
                      borderRadius: '20px',
                      border: '1px solid var(--accent-border)',
                      marginLeft: '2px',
                    }}>
                      active
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '18px' }}>
                  {model.description}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
