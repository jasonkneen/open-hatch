import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  FileText,
  MessageSquare,
  Brain,
  Plus,
  ArrowRight,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import type { ActiveView, Document, ChatSession, MemoryFact, Task } from '../../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  documents: Document[];
  sessions: ChatSession[];
  facts: MemoryFact[];
  tasks?: Task[];
  onDocumentOpen: (doc: Document) => void;
  onSessionOpen: (session: ChatSession) => void;
  onTaskOpen?: (task: Task) => void;
  onViewChange: (view: ActiveView) => void;
}

interface ResultItem {
  id: string;
  type: 'document' | 'chat' | 'memory' | 'task' | 'action';
  label: string;
  detail?: string;
  icon: React.ReactNode;
  badge: string;
  onSelect: () => void;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Smarter match: substring first (primary), then fuzzy fall-through.
 * Also returns a simple score for ranking.
 */
function scoreMatch(text: string, query: string): number {
  if (!query) return 1;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const exact = lower.indexOf(q);
  if (exact === 0) return 1000;
  if (exact > 0) return 500 - Math.min(exact, 400);
  // fuzzy
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length ? 50 : 0;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  documents,
  sessions,
  facts,
  tasks = [],
  onDocumentOpen,
  onSessionOpen,
  onTaskOpen,
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
        id: 'action-go-tasks',
        type: 'action' as const,
        label: 'Go to Tasks',
        icon: <CheckCircle2 size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('tasks');
          onClose();
        },
      },
      {
        id: 'action-go-activity',
        type: 'action' as const,
        label: 'Go to Activity',
        icon: <Activity size={16} />,
        badge: 'Action',
        onSelect: () => {
          onViewChange('activity');
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

  // Build searchable catalog. Documents get both title and plaintext content indexed.
  const catalog = useMemo(() => {
    const docs = documents.map((doc) => {
      const plainContent = stripHtml(doc.content || '');
      return {
        item: {
          id: `doc-${doc.id}`,
          type: 'document' as const,
          label: doc.title,
          detail: plainContent.slice(0, 120),
          icon: <FileText size={16} />,
          badge: 'Document',
          onSelect: () => { onDocumentOpen(doc); onClose(); },
        } as ResultItem,
        haystack: `${doc.title}\n${plainContent}`,
      };
    });

    const chats = sessions.map((session) => ({
      item: {
        id: `chat-${session.id}`,
        type: 'chat' as const,
        label: session.title,
        icon: <MessageSquare size={16} />,
        badge: 'Chat',
        onSelect: () => { onSessionOpen(session); onClose(); },
      } as ResultItem,
      haystack: session.title,
    }));

    const memories = facts.map((fact) => ({
      item: {
        id: `memory-${fact.id}`,
        type: 'memory' as const,
        label: fact.fact,
        icon: <Brain size={16} />,
        badge: fact.category || 'Memory',
        onSelect: () => { onViewChange('memory'); onClose(); },
      } as ResultItem,
      haystack: `${fact.category || ''} ${fact.fact}`,
    }));

    const taskItems = tasks.map((task) => ({
      item: {
        id: `task-${task.id}`,
        type: 'task' as const,
        label: task.title,
        detail: task.description ? task.description.slice(0, 120) : `${task.status.replace('_', ' ')} · ${task.priority}`,
        icon: <CheckCircle2 size={16} />,
        badge: task.status === 'done' ? 'Done' : 'Task',
        onSelect: () => {
          if (onTaskOpen) onTaskOpen(task);
          else onViewChange('tasks');
          onClose();
        },
      } as ResultItem,
      haystack: `${task.title} ${task.description || ''}`,
    }));

    const actionItems = actions.map((a) => ({ item: a, haystack: a.label }));

    return [...docs, ...chats, ...memories, ...taskItems, ...actionItems];
  }, [documents, sessions, facts, tasks, actions, onDocumentOpen, onSessionOpen, onTaskOpen, onViewChange, onClose]);

  const filteredResults = useMemo(() => {
    const q = query.trim();
    if (!q) return catalog.map(c => c.item);
    const scored = catalog
      .map(c => ({ item: c.item, score: scoreMatch(c.haystack, q) }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }, [catalog, query]);

  const groupedResults = useMemo(() => {
    const groups: { label: string; items: ResultItem[] }[] = [];
    const docItems = filteredResults.filter((r) => r.type === 'document');
    const chatItems = filteredResults.filter((r) => r.type === 'chat');
    const taskItems = filteredResults.filter((r) => r.type === 'task');
    const memoryItems = filteredResults.filter((r) => r.type === 'memory');
    const actionItems = filteredResults.filter((r) => r.type === 'action');

    if (docItems.length > 0) groups.push({ label: 'Documents', items: docItems });
    if (chatItems.length > 0) groups.push({ label: 'Chats', items: chatItems });
    if (taskItems.length > 0) groups.push({ label: 'Tasks', items: taskItems });
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
                          display: 'flex',
                          flexDirection: 'column',
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label}
                        </span>
                        {item.detail && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: 1,
                            }}
                          >
                            {item.detail}
                          </span>
                        )}
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
