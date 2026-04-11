import type { CanvasObject } from '../../types';

interface CanvasObjectRendererProps {
  obj: CanvasObject;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  attachHighlight?: boolean;
}

export function CanvasObjectRenderer({
  obj,
  canvasWidth,
  canvasHeight,
  selected,
  onSelect,
  attachHighlight = false,
}: CanvasObjectRendererProps) {
  void onSelect;

  const px = (obj.x / 100) * canvasWidth;
  const py = (obj.y / 100) * canvasHeight;
  const pw = (obj.width / 100) * canvasWidth;
  const ph = (obj.height / 100) * canvasHeight;

  if (obj.type === 'pen') {
    return (
      <PenStroke
        obj={obj}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        selected={selected}
        attachHighlight={attachHighlight}
      />
    );
  }

  if (obj.type === 'sticky_note') {
    return (
      <StickyNoteObject
        obj={obj}
        px={px} py={py} pw={pw} ph={ph}
        selected={selected}
        attachHighlight={attachHighlight}
      />
    );
  }

  if (obj.type === 'image' || obj.type === 'video') {
    return (
      <MediaObject
        obj={obj}
        px={px} py={py} pw={pw} ph={ph}
        selected={selected}
        attachHighlight={attachHighlight}
      />
    );
  }

  if (obj.type === 'file') {
    return (
      <FileObject
        obj={obj}
        px={px} py={py} pw={pw} ph={ph}
        selected={selected}
        attachHighlight={attachHighlight}
      />
    );
  }

  if (obj.type === 'text') {
    return (
      <div
        style={{
          position: 'absolute',
          left: px,
          top: py,
          width: pw,
          minHeight: ph,
          transform: `rotate(${obj.rotation}deg)`,
          opacity: obj.opacity,
          cursor: 'move',
          padding: '8px 12px',
          color: obj.fill,
          fontSize: `${obj.font_size || Math.max(12, ph * 0.4)}px`,
          fontWeight: 500,
          lineHeight: 1.4,
          wordBreak: 'break-word',
          outline: selected ? '2px solid var(--accent)' : attachHighlight ? '2px dashed var(--accent-border)' : 'none',
          outlineOffset: '2px',
          borderRadius: 'var(--radius-sm)',
          userSelect: 'none',
        }}
      >
        {obj.text_content || 'Text'}
      </div>
    );
  }

  return (
    <ShapeObject
      obj={obj}
      px={px} py={py} pw={pw} ph={ph}
      selected={selected}
      attachHighlight={attachHighlight}
    />
  );
}

function StickyNoteObject({
  obj, px, py, pw, ph, selected, attachHighlight,
}: {
  obj: CanvasObject;
  px: number; py: number; pw: number; ph: number;
  selected: boolean;
  attachHighlight: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: px,
        top: py,
        width: pw,
        height: ph,
        background: obj.fill || '#fef08a',
        borderRadius: '4px',
        transform: 'rotate(-1deg)',
        opacity: obj.opacity,
        cursor: 'move',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
        outline: selected
          ? '2px solid var(--accent)'
          : attachHighlight
            ? '2px dashed var(--accent-border)'
            : 'none',
        outlineOffset: '2px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div style={{
        height: '6px',
        background: 'rgba(0,0,0,0.06)',
        flexShrink: 0,
      }} />
      <div style={{
        flex: 1,
        padding: '8px 12px',
        fontSize: `${obj.font_size || 14}px`,
        lineHeight: 1.5,
        color: '#1a1a1a',
        fontFamily: "'Space Grotesk', sans-serif",
        wordBreak: 'break-word',
        overflow: 'hidden',
      }}>
        {obj.text_content || (
          <span style={{ color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>
            Double-click to edit
          </span>
        )}
      </div>
    </div>
  );
}

function ShapeObject({
  obj, px, py, pw, ph, selected, attachHighlight,
}: {
  obj: CanvasObject;
  px: number; py: number; pw: number; ph: number;
  selected: boolean;
  attachHighlight: boolean;
}) {
  const svgW = pw + 4;
  const svgH = ph + 4;

  let shapeEl: React.ReactNode = null;
  const commonProps = {
    fill: obj.fill,
    stroke: obj.stroke === 'transparent' ? 'none' : obj.stroke,
    strokeWidth: obj.stroke_width,
  };

  switch (obj.type) {
    case 'rect':
      shapeEl = <rect x={2} y={2} width={pw} height={ph} rx={4} {...commonProps} />;
      break;
    case 'ellipse':
      shapeEl = <ellipse cx={pw / 2 + 2} cy={ph / 2 + 2} rx={pw / 2} ry={ph / 2} {...commonProps} />;
      break;
    case 'diamond':
      shapeEl = (
        <polygon
          points={`${pw / 2 + 2},2 ${pw + 2},${ph / 2 + 2} ${pw / 2 + 2},${ph + 2} 2,${ph / 2 + 2}`}
          {...commonProps}
        />
      );
      break;
    case 'line': {
      if (obj.points && obj.points.length >= 2) {
        const [start, end] = obj.points;
        const x1 = ((start.x - obj.x) / obj.width) * pw + 2;
        const y1 = ((start.y - obj.y) / obj.height) * ph + 2;
        const x2 = ((end.x - obj.x) / obj.width) * pw + 2;
        const y2 = ((end.y - obj.y) / obj.height) * ph + 2;
        shapeEl = (
          <line
            x1={x1} y1={y1}
            x2={x2} y2={y2}
            stroke={obj.fill}
            strokeWidth={obj.stroke_width}
            strokeLinecap="round"
          />
        );
      } else {
        shapeEl = (
          <line
            x1={2} y1={ph / 2 + 2}
            x2={pw + 2} y2={ph / 2 + 2}
            stroke={obj.fill}
            strokeWidth={obj.stroke_width}
            strokeLinecap="round"
          />
        );
      }
      break;
    }
    case 'arrow': {
      if (obj.points && obj.points.length >= 2) {
        const [start, end] = obj.points;
        const x1 = ((start.x - obj.x) / obj.width) * pw + 2;
        const y1 = ((start.y - obj.y) / obj.height) * ph + 2;
        const x2 = ((end.x - obj.x) / obj.width) * pw + 2;
        const y2 = ((end.y - obj.y) / obj.height) * ph + 2;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 12;
        const hx1 = x2 - head * Math.cos(angle - Math.PI / 6);
        const hy1 = y2 - head * Math.sin(angle - Math.PI / 6);
        const hx2 = x2 - head * Math.cos(angle + Math.PI / 6);
        const hy2 = y2 - head * Math.sin(angle + Math.PI / 6);
        shapeEl = (
          <>
            <line
              x1={x1} y1={y1}
              x2={x2} y2={y2}
              stroke={obj.fill}
              strokeWidth={obj.stroke_width}
              strokeLinecap="round"
            />
            <polygon
              points={`${x2},${y2} ${hx1},${hy1} ${hx2},${hy2}`}
              fill={obj.fill}
            />
          </>
        );
      } else {
        shapeEl = (
          <>
            <line
              x1={2} y1={ph / 2 + 2}
              x2={pw - 8} y2={ph / 2 + 2}
              stroke={obj.fill}
              strokeWidth={obj.stroke_width}
              strokeLinecap="round"
            />
            <polygon
              points={`${pw + 2},${ph / 2 + 2} ${pw - 10},${ph / 2 - 6} ${pw - 10},${ph / 2 + 10}`}
              fill={obj.fill}
            />
          </>
        );
      }
      break;
    }
    default:
      shapeEl = <rect x={2} y={2} width={pw} height={ph} rx={4} {...commonProps} />;
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      style={{
        position: 'absolute',
        left: px - 2,
        top: py - 2,
        transform: `rotate(${obj.rotation}deg)`,
        opacity: obj.opacity,
        cursor: 'move',
        outline: selected ? '2px solid var(--accent)' : attachHighlight ? '2px dashed var(--accent-border)' : 'none',
        outlineOffset: '2px',
        borderRadius: '4px',
        overflow: 'visible',
      }}
    >
      {shapeEl}
    </svg>
  );
}

function PenStroke({
  obj, canvasWidth, canvasHeight, selected, attachHighlight,
}: {
  obj: CanvasObject;
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  attachHighlight: boolean;
}) {
  const pts = obj.points || [];
  if (pts.length < 2) return null;

  const absPoints = pts.map(p => ({
    x: (p.x / 100) * canvasWidth,
    y: (p.y / 100) * canvasHeight,
  }));

  const minX = Math.min(...absPoints.map(p => p.x));
  const minY = Math.min(...absPoints.map(p => p.y));
  const maxX = Math.max(...absPoints.map(p => p.x));
  const maxY = Math.max(...absPoints.map(p => p.y));
  const pad = obj.stroke_width + 4;

  const pathD = absPoints.reduce((acc, p, i) => {
    const relX = p.x - minX + pad;
    const relY = p.y - minY + pad;
    return acc + (i === 0 ? `M${relX},${relY}` : `L${relX},${relY}`);
  }, '');

  return (
    <svg
      width={maxX - minX + pad * 2}
      height={maxY - minY + pad * 2}
      style={{
        position: 'absolute',
        left: minX - pad,
        top: minY - pad,
        opacity: obj.opacity,
        cursor: 'move',
        outline: selected ? '2px solid var(--accent)' : attachHighlight ? '2px dashed var(--accent-border)' : 'none',
        outlineOffset: '2px',
        borderRadius: '4px',
        overflow: 'visible',
        pointerEvents: 'all',
      }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={obj.fill}
        strokeWidth={obj.stroke_width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MediaObject({
  obj, px, py, pw, ph, selected, attachHighlight,
}: {
  obj: CanvasObject;
  px: number; py: number; pw: number; ph: number;
  selected: boolean;
  attachHighlight: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: px,
        top: py,
        width: pw,
        height: ph,
        transform: `rotate(${obj.rotation}deg)`,
        opacity: obj.opacity,
        cursor: 'move',
        outline: selected ? '2px solid var(--accent)' : attachHighlight ? '2px dashed var(--accent-border)' : 'none',
        outlineOffset: '2px',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--canvas-raised)',
      }}
    >
      {obj.type === 'image' ? (
        <img
          src={obj.src}
          alt={obj.file_name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <video
          src={obj.src}
          controls
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
    </div>
  );
}

function FileObject({
  obj, px, py, pw, ph, selected, attachHighlight,
}: {
  obj: CanvasObject;
  px: number; py: number; pw: number; ph: number;
  selected: boolean;
  attachHighlight: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: px,
        top: py,
        width: pw,
        height: ph,
        transform: `rotate(${obj.rotation}deg)`,
        opacity: obj.opacity,
        cursor: 'move',
        outline: selected ? '2px solid var(--accent)' : attachHighlight ? '2px dashed var(--accent-border)' : 'none',
        outlineOffset: '2px',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--canvas-raised)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        color: 'var(--text-muted)',
        fontSize: '12px',
      }}
    >
      <span style={{ fontSize: '24px' }}>📄</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
        {obj.file_name || 'File'}
      </span>
    </div>
  );
}
