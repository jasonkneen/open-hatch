import type { CursorPresence } from '../../hooks/useMultiplayerCursors';

interface CursorOverlayProps {
  cursors: CursorPresence[];
}

function CursorSvg({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="20"
      viewBox="0 0 16 20"
      fill="none"
      style={{ display: 'block' }}
    >
      <path
        d="M1 1L1 15.5L5.5 11.5L9.5 19L12.5 17.5L8.5 10L14 9.5L1 1Z"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CursorOverlay({ cursors }: CursorOverlayProps) {
  if (cursors.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden',
      }}
    >
      {cursors.map(cursor => (
        <div
          key={cursor.id}
          style={{
            position: 'absolute',
            left: `${cursor.x}%`,
            top: `${cursor.y}%`,
            transition: 'left 80ms linear, top 80ms linear',
            willChange: 'left, top',
          }}
        >
          <CursorSvg color={cursor.color} />
          <div
            style={{
              position: 'absolute',
              left: '14px',
              top: '14px',
              background: cursor.color,
              color: 'white',
              fontSize: '11px',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              lineHeight: '1.4',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              letterSpacing: '-0.01em',
            }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </div>
  );
}
