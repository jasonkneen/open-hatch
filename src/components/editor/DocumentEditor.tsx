import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, List, ListOrdered, Code, Heading1, Heading2,
  Star, Trash2, Plus, FileText, Quote
} from 'lucide-react';
import type { Document } from '../../types';

interface DocumentEditorProps {
  document: Document | null;
  documents: Document[];
  onSave: (id: string, updates: { title?: string; content?: string }) => void;
  onAutoSave: (id: string, updates: { title?: string; content?: string }) => void;
  onNew: () => void;
  onOpen: (doc: Document) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  savedStatus: 'idle' | 'saving' | 'saved';
  onSavedStatusChange: (status: 'idle' | 'saving' | 'saved') => void;
}

type FormatAction = 'bold' | 'italic' | 'h1' | 'h2' | 'ul' | 'ol' | 'code' | 'quote';

function execFormat(action: FormatAction) {
  switch (action) {
    case 'bold': document.execCommand('bold'); break;
    case 'italic': document.execCommand('italic'); break;
    case 'code': document.execCommand('insertHTML', false, '<code>code</code>'); break;
    case 'h1': document.execCommand('formatBlock', false, 'h1'); break;
    case 'h2': document.execCommand('formatBlock', false, 'h2'); break;
    case 'ul': document.execCommand('insertUnorderedList'); break;
    case 'ol': document.execCommand('insertOrderedList'); break;
    case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
  }
}

const TOOLBAR_ITEMS: Array<{ action?: FormatAction; icon?: React.ReactNode; label?: string; divider?: boolean }> = [
  { action: 'h1', icon: <Heading1 size={15} />, label: 'H1' },
  { action: 'h2', icon: <Heading2 size={15} />, label: 'H2' },
  { divider: true },
  { action: 'bold', icon: <Bold size={15} />, label: 'Bold' },
  { action: 'italic', icon: <Italic size={15} />, label: 'Italic' },
  { action: 'code', icon: <Code size={15} />, label: 'Code' },
  { action: 'quote', icon: <Quote size={15} />, label: 'Quote' },
  { divider: true },
  { action: 'ul', icon: <List size={15} />, label: 'Bullets' },
  { action: 'ol', icon: <ListOrdered size={15} />, label: 'Numbers' },
];

function DocSidebar({
  documents, activeId, onOpen, onNew,
}: {
  documents: Document[];
  activeId: string | null;
  onOpen: (doc: Document) => void;
  onNew: () => void;
}) {
  return (
    <div style={{
      width: '220px',
      flexShrink: 0,
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={onNew}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px',
            background: 'var(--accent-subtle)',
            border: '1px dashed var(--accent-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={13} />
          New Document
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {documents.map(d => (
          <button
            key={d.id}
            onClick={() => onOpen(d)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: d.id === activeId ? 'var(--accent-subtle)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: d.id === activeId ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '12px',
              textAlign: 'left',
              transition: 'background var(--transition-fast)',
              marginBottom: '2px',
            }}
            onMouseEnter={e => { if (d.id !== activeId) e.currentTarget.style.background = 'var(--canvas-raised)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = d.id === activeId ? 'var(--accent-subtle)' : 'transparent'; }}
          >
            <FileText size={13} style={{ flexShrink: 0, color: d.id === activeId ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: d.id === activeId ? 500 : 400 }}>
              {d.title}
            </span>
            {d.is_favorite && <Star size={10} style={{ color: 'var(--warning)', flexShrink: 0 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DocumentEditor({
  document: doc,
  documents,
  onSave,
  onAutoSave,
  onNew,
  onOpen,
  onDelete,
  onToggleFavorite,
  savedStatus,
  onSavedStatusChange,
}: DocumentEditorProps) {
  const [title, setTitle] = useState(doc?.title || '');
  const contentRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(doc?.title || '');
    if (contentRef.current && doc) {
      contentRef.current.innerHTML = doc.content || '';
    }
  }, [doc?.id]);

  const triggerAutoSave = useCallback((newTitle?: string, newContent?: string) => {
    if (!doc) return;
    onSavedStatusChange('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onAutoSave(doc.id, {
        title: newTitle ?? title,
        content: newContent ?? contentRef.current?.innerHTML ?? '',
      });
      onSavedStatusChange('saved');
      setTimeout(() => onSavedStatusChange('idle'), 2000);
    }, 800);
  }, [doc, title, onAutoSave, onSavedStatusChange]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    triggerAutoSave(e.target.value, undefined);
  };

  const handleContentInput = () => {
    triggerAutoSave(undefined, contentRef.current?.innerHTML || '');
  };

  if (!doc) {
    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <DocSidebar documents={documents} activeId={null} onOpen={onOpen} onNew={onNew} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <FileText size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Select or create a document</p>
          <button
            onClick={onNew}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            New Document
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <DocSidebar documents={documents} activeId={doc.id} onOpen={onOpen} onNew={onNew} />

      <div id="doc-editor-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--canvas-elevated)',
          overflowX: 'auto',
          flexShrink: 0,
        }}>
          {TOOLBAR_ITEMS.map((item, idx) => (
            item.divider ? (
              <div key={idx} style={{ width: '1px', height: '20px', background: 'var(--border-strong)', margin: '0 6px', flexShrink: 0 }} />
            ) : (
              <button
                key={item.action}
                title={item.label}
                onMouseDown={e => { e.preventDefault(); execFormat(item.action!); handleContentInput(); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  background: 'var(--canvas-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-fast)',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas-overlay)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--canvas-raised)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              >
                {item.icon}
              </button>
            )
          ))}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => onToggleFavorite(doc.id, doc.is_favorite)}
            title={doc.is_favorite ? 'Unfavorite' : 'Favorite'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: doc.is_favorite ? 'var(--warning-subtle)' : 'var(--canvas-raised)',
              border: `1px solid ${doc.is_favorite ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: doc.is_favorite ? 'var(--warning)' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Star size={14} fill={doc.is_favorite ? 'var(--warning)' : 'none'} />
          </button>

          <button
            onClick={() => onDelete(doc.id)}
            title="Delete document"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'var(--canvas-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--error)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; e.currentTarget.style.background = 'var(--error-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--canvas-raised)'; }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Title + Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 60px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              width: '100%',
              marginBottom: '20px',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              fontFamily: 'inherit',
            }}
          />
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className="doc-editor"
            onInput={handleContentInput}
            data-placeholder="Start writing..."
            style={{
              minHeight: '400px',
              outline: 'none',
              fontSize: '14px',
              lineHeight: '1.7',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
