import {
  MousePointer2, Pencil, Square, Circle, Diamond,
  Minus, ArrowRight, Type, Eraser, StickyNote
} from 'lucide-react';
import type { CanvasTool } from '../../types';

const TOOLS: Array<{ id: CanvasTool; icon: React.ReactNode; label: string }> = [
  { id: 'select', icon: <MousePointer2 size={16} />, label: 'Select' },
  { id: 'pen', icon: <Pencil size={16} />, label: 'Pen' },
  { id: 'rect', icon: <Square size={16} />, label: 'Rectangle' },
  { id: 'ellipse', icon: <Circle size={16} />, label: 'Ellipse' },
  { id: 'diamond', icon: <Diamond size={16} />, label: 'Diamond' },
  { id: 'line', icon: <Minus size={16} />, label: 'Line' },
  { id: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
  { id: 'text', icon: <Type size={16} />, label: 'Text' },
  { id: 'sticky_note', icon: <StickyNote size={16} />, label: 'Sticky Note' },
  { id: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
];

const PALETTE = [
  '#1e293b', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#ec4899', '#8b5cf6', '#ffffff',
];

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  activeColor: string;
  strokeWidth: number;
  onToolChange: (tool: CanvasTool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (w: number) => void;
}

export function CanvasToolbar({
  activeTool,
  activeColor,
  strokeWidth,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
}: CanvasToolbarProps) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 10px',
      background: 'var(--canvas-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 600,
      backdropFilter: 'blur(12px)',
    }}>
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
          title={tool.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            background: activeTool === tool.id ? 'var(--accent-subtle)' : 'transparent',
            color: activeTool === tool.id ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={e => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.background = 'var(--canvas-raised)';
            }
          }}
          onMouseLeave={e => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {tool.icon}
        </button>
      ))}

      <div style={{ width: '1px', height: '22px', background: 'var(--border-strong)', margin: '0 4px', flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
        {PALETTE.map(color => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            title={color}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: activeColor === color ? '2px solid var(--accent)' : '2px solid var(--border)',
              background: color,
              cursor: 'pointer',
              transition: 'transform var(--transition-fast)',
              transform: activeColor === color ? 'scale(1.15)' : 'scale(1)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      <div style={{ width: '1px', height: '22px', background: 'var(--border-strong)', margin: '0 4px', flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {[2, 4, 8].map(w => (
          <button
            key={w}
            onClick={() => onStrokeWidthChange(w)}
            title={`${w}px`}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: strokeWidth === w ? 'var(--accent-subtle)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{
              width: `${8 + w * 2}px`,
              height: `${w}px`,
              borderRadius: '2px',
              background: strokeWidth === w ? 'var(--accent)' : 'var(--text-muted)',
            }} />
          </button>
        ))}
      </div>
    </div>
  );
}
