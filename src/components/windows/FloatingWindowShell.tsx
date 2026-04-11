import React, { useRef, useCallback, useState } from 'react';
import { X, Minus, Maximize2, MoreHorizontal, Share2, Copy, Trash2 } from 'lucide-react';
import type { FloatingWindow } from '../../types';

interface FloatingWindowShellProps {
  window: FloatingWindow;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, updates: Partial<FloatingWindow>) => void;
  onMinimize: (id: string) => void;
  onShare?: () => void;
  titleIcon?: React.ReactNode;
  breadcrumb?: string;
  children: React.ReactNode;
}

export function FloatingWindowShell({
  window: win,
  onClose,
  onFocus,
  onUpdate,
  onMinimize,
  onShare,
  titleIcon,
  breadcrumb,
  children,
}: FloatingWindowShellProps) {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; winW: number; winH: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    onFocus(win.id);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      winX: win.x,
      winY: win.y,
    };
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      onUpdate(win.id, {
        x: Math.max(0, dragRef.current.winX + dx),
        y: Math.max(0, dragRef.current.winY + dy),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [win.id, win.x, win.y, onFocus, onUpdate]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFocus(win.id);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      winW: win.width,
      winH: win.height,
    };
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      onUpdate(win.id, {
        width: Math.max(300, resizeRef.current.winW + dx),
        height: Math.max(250, resizeRef.current.winH + dy),
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [win.id, win.width, win.height, onFocus, onUpdate]);

  if (win.minimized) return null;

  return (
    <div
      data-floating-window
      onMouseDown={() => onFocus(win.id)}
      style={{
        position: 'absolute',
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--canvas-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        userSelect: isDragging || isResizing ? 'none' : 'auto',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--canvas-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          cursor: 'grab',
          flexShrink: 0,
          minHeight: '40px',
        }}
      >
        {titleIcon && (
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
            {titleIcon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {breadcrumb && (
            <>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{breadcrumb}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{'>'}</span>
            </>
          )}
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {win.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button
            onClick={() => onMinimize(win.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                background: menuOpen ? 'var(--canvas-raised)' : 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: menuOpen ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
              title="More"
            >
              <MoreHorizontal size={13} />
            </button>

            {menuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                  onClick={() => setMenuOpen(false)}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  background: 'var(--canvas-overlay)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 101,
                  minWidth: '160px',
                  overflow: 'hidden',
                  animation: 'fadeSlideIn 0.15s ease forwards',
                }}>
                  <MenuButton
                    icon={<Share2 size={13} />}
                    label="Share..."
                    onClick={() => { setMenuOpen(false); onShare?.(); }}
                  />
                  <MenuButton
                    icon={<Copy size={13} />}
                    label="Duplicate"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <MenuButton
                    icon={<Maximize2 size={13} />}
                    label="Maximize"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <MenuButton
                    icon={<Trash2 size={13} />}
                    label="Close window"
                    onClick={() => { setMenuOpen(false); onClose(win.id); }}
                    danger
                  />
                </div>
              </>
            )}
          </div>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            title="Maximize"
          >
            <Maximize2 size={12} />
          </button>
          <button
            onClick={() => onClose(win.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              background: 'none',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>

      <div
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '16px',
          height: '16px',
          cursor: 'nwse-resize',
          zIndex: 10,
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          style={{ position: 'absolute', right: '3px', bottom: '3px', opacity: 0.3 }}
        >
          <line x1="9" y1="1" x2="1" y2="9" stroke="var(--text-muted)" strokeWidth="1" />
          <line x1="9" y1="4" x2="4" y2="9" stroke="var(--text-muted)" strokeWidth="1" />
          <line x1="9" y1="7" x2="7" y2="9" stroke="var(--text-muted)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: danger ? 'var(--error)' : 'var(--text-primary)',
        fontSize: '12px',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'background var(--transition-fast)',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--canvas-raised)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ display: 'flex', color: danger ? 'var(--error)' : 'var(--text-muted)' }}>{icon}</span>
      {label}
    </button>
  );
}
