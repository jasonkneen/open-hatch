import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import type { CanvasObject, CanvasObjectType } from '../../types';

interface CanvasDropZoneProps {
  onAddObject: (type: CanvasObjectType, overrides?: Partial<CanvasObject>) => Promise<CanvasObject | null>;
  onUploadFiles: (files: File[]) => void;
  children: React.ReactNode;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function CanvasDropZone({ onAddObject, onUploadFiles, children }: CanvasDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const counterRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current--;
    if (counterRef.current <= 0) {
      counterRef.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    counterRef.current = 0;
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const dropX = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50;
    const dropY = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50;

    const allFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const offsetX = dropX + (i * 2);
      const offsetY = dropY + (i * 2);

      if (file.type.startsWith('image/')) {
        const dataUrl = await fileToDataUrl(file);
        await onAddObject('image', {
          x: offsetX - 10,
          y: offsetY - 8,
          width: 20,
          height: 16,
          src: dataUrl,
          file_name: file.name,
          fill: 'transparent',
          stroke: 'transparent',
          stroke_width: 0,
        });
      } else if (file.type.startsWith('video/')) {
        const dataUrl = await fileToDataUrl(file);
        await onAddObject('video', {
          x: offsetX - 12,
          y: offsetY - 8,
          width: 24,
          height: 16,
          src: dataUrl,
          file_name: file.name,
          fill: 'transparent',
          stroke: 'transparent',
          stroke_width: 0,
        });
      } else {
        await onAddObject('file', {
          x: offsetX - 6,
          y: offsetY - 4,
          width: 12,
          height: 8,
          file_name: file.name,
          fill: 'var(--canvas-raised)',
          stroke: 'var(--border)',
          stroke_width: 1,
        });
      }

      allFiles.push(file);
    }

    if (allFiles.length > 0) {
      onUploadFiles(allFiles);
    }
  }, [onAddObject, onUploadFiles]);

  return (
    <div
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {children}

      {dragging && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9000,
          background: 'rgba(79, 156, 249, 0.08)',
          border: '3px dashed var(--accent)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          pointerEvents: 'none',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-subtle)',
            border: '2px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Upload size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--accent)',
            }}>Drop to add to canvas</p>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}>Images, videos, and files will appear on the canvas</p>
          </div>
        </div>
      )}
    </div>
  );
}
