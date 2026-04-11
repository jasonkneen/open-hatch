import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  FileText,
  MessageSquare,
  Brain,
  Plus,
  ArrowRight,
} from 'lucide-react';
import type { ActiveView, Document, ChatSession, MemoryFact } from '../../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  documents: Document[];
  sessions: ChatSession[];
  facts: MemoryFact[];
  onDocumentOpen: (doc: Document) => void;
  onSessionOpen: (session: ChatSession) => void;
  onViewChange: (view: ActiveView) => void;
}

interface ResultItem {
  id: string;
  type: 'document' | 'chat' | 'memory' | 'action';
  label: string;
  icon: React.ReactNode;
  badge: string;
  onSelect: () => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      qi++;
    }
  }
  return qi === q.length;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  documents,
  sessions,
  facts,
  onDocumentOpen,
  onSessionOpen,
  onViewChange,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions: ResultItem[] = useMemo(
    () => [
      {
        id: 'action-new-chat',
        type: 'action' as const,
        label: 'New Chat',
        icon: <Plus size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('chat');
          onClose();
        },
      },
      {
        id: 'action-new-doc',
        type: 'action' as const,
        label: 'New Document',
        icon: <Plus size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('document');
          onClose();
        },
      },
      {
        id: 'action-go-memory',
        type: 'action' as const,
        label: 'Go to Memory',
        icon: <ArrowRight size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('memory');
          onClose();
        },
      },
      {
        id: 'action-go-files',
        type: 'action' as const,
        label: 'Go to Files',
        icon: <ArrowRight size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('files');
          onClose();
        },
      },
    ],
    [onViewChange, onClose]
  );

  const allResults = useMemo((): ResultItem[] => {
    const documentItems: ResultItem[] = documents.map((doc) => ({
      id: `doc-${doc.id}`,
      type: 'document' as const,
      label: doc.title,
      icon: <FileText size={16} />,
      badge: 'Document',
      onSelect: () => {
        onDocumentOpen(doc);
        onClose();
      },
    }));

    const chatItems: ResultItem[] = sessions.map((session) => ({
      id: `chat-${session.id}`,
      type: 'chat' as const,
      label: session.title,
      icon: <MessageSquare size={16} />,
      badge: 'Chat',
      onSelect: () => {
        onSessionOpen(session);
        onClose();
      },
    }));

    const memoryItems: ResultItem[] = facts.map((fact) => ({
      id: `memory-${fact.id}`,
      type: 'memory' as const,
      label: fact.fact,
      icon: <Brain size={16} />,
      badge: fact.category || 'Memory',
      onSelect: () => {
        onViewChange('memory');
        onClose();
      },
    }));

    return [...documentItems, ...chatItems, ...memoryItems, ...actions];
  }, [documents, sessions, facts, actions, onDocumentOpen, onSessionOpen, onViewChange, onClose]);

  const filteredResults = useMemo(() => {
    if (!query.trim()) return allResults;
    return allResults.filter((item) => fuzzyMatch(item.label, query.trim()));
  }, [allResults, query]);

  const groupedResults = useMemo(() => {
    const groups: { label: string; items: ResultItem[] }[] = [];
    const docItems = filteredResults.filter((r) => r.type === 'document');
    const chatItems = filteredResults.filter((r) => r.type === 'chat');
    const memoryItems = filteredResults.filter((r) => r.type === 'memory');
    const actionItems = filteredResults.filter((r) => r.type === 'action');

    if (docItems.length > 0) groups.push({ label: 'Documents', items: docItems });
    if (chatItems.length > 0) groups.push({ label: 'Chats', items: chatItems });
    if (memoryItems.length > 0) groups.push({ label: 'Memory', items: memoryItems });
    if (actionItems.length > 0) groups.push({ label: 'Actions', items: actionItems });

    return groups;
  }, [filteredResults]);

  const flatResults = useMemo(
    () => groupedResults.flatMap((g) => g.items),
    [groupedResults]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setIsAnimating(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(false);
        });
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % Math.max(flatResults.length, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev <= 0 ? Math.max(flatResults.length - 1, 0) : prev - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flatResults[activeIndex]) {
            flatResults[activeIndex].onSelect();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, activeIndex, onClose]
  );

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        backgroundColor: isAnimating ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.6)',
        transition: 'background-color 150ms ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 16px',
          backgroundColor: 'var(--canvas-elevated)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          transform: isAnimating ? 'translateY(-8px) scale(0.98)' : 'translateY(0) scale(1)',
          opacity: isAnimating ? 0 : 1,
          transition: 'transform 150ms ease-out, opacity 150ms ease-out',
        }}
        onKeyDown={handleKeyDown}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents, chats, memory..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 15,
              lineHeight: '24px',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              fontSize: 11,
              fontFamily: 'inherit',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--canvas-raised)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '8px 0',
          }}
        >
          {groupedResults.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 14,
              }}
            >
              No results
            </div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.label}>
                <div
                  style={{
                    padding: '8px 16px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const currentIndex = flatIndex++;
                  const isActive = currentIndex === activeIndex;
                  return (
                    <div
                      key={item.id}
                      data-active={isActive}
                      onClick={() => item.onSelect()}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                        transition: `background-color var(--transition-fast)`,
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isActive
                            ? 'var(--accent)'
                            : 'var(--canvas-raised)',
                          color: isActive
                            ? '#ffffff'
                            : 'var(--text-secondary)',
                          flexShrink: 0,
                          transition: `background-color var(--transition-fast), color var(--transition-fast)`,
                        }}
                      >
                        {item.icon}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--canvas-raised)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                          flexShrink: 0,
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd
              style={{
                padding: '1px 5px',
                fontSize: 11,
                fontFamily: 'inherit',
                backgroundColor: 'var(--canvas-raised)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              &uarr;
            </kbd>
            <kbd
              style={{
                padding: '1px 5px',
                fontSize: 11,
                fontFamily: 'inherit',
                backgroundColor: 'var(--canvas-raised)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              &darr;
            </kbd>
            <span style={{ marginLeft: 2 }}>navigate</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd
              style={{
                padding: '1px 5px',
                fontSize: 11,
                fontFamily: 'inherit',
                backgroundColor: 'var(--canvas-raised)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              &crarr;
            </kbd>
            <span style={{ marginLeft: 2 }}>select</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd
              style={{
                padding: '1px 5px',
                fontSize: 11,
                fontFamily: 'inherit',
                backgroundColor: 'var(--canvas-raised)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              esc
            </kbd>
            <span style={{ marginLeft: 2 }}>close</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
