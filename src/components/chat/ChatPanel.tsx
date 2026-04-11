import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send, Plus, Paperclip, AtSign, Trash2, FileText,
  Sparkles, MessageSquare, X
} from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import type { ChatSession, Message, MemoryFact, Document } from '../../types';

interface ChatPanelProps {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: Message[];
  streaming: boolean;
  loading: boolean;
  memoryFacts: MemoryFact[];
  documents: Document[];
  onNewSession: () => void;
  onSendMessage: (content: string, model: string, memoryFacts?: MemoryFact[], linkedDocs?: Document[]) => void;
  onSessionSelect: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onNavigateToDocuments: () => void;
}

function MessageBubble({ msg, isStreaming }: { msg: Message; isStreaming?: boolean }) {
  const isUser = msg.role === 'user';

  return (
    <div
      className="msg-animate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '16px',
        gap: '4px',
      }}
    >
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent), #60a5fa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            flexShrink: 0,
          }}>
            <Sparkles size={10} color="white" />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Hatch AI</span>
        </div>
      )}

      <div style={{
        maxWidth: '85%',
        padding: isUser ? '8px 12px' : '10px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? 'var(--accent)' : 'var(--canvas-raised)',
        border: isUser ? 'none' : '1px solid var(--border)',
        color: isUser ? 'white' : 'var(--text-primary)',
        fontSize: '13px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content || (isStreaming && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' }}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="pulse-dot"
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        ))}
        {isStreaming && msg.content && <span className="typing-cursor" />}
      </div>
    </div>
  );
}

function DocPicker({
  documents,
  query,
  onSelect,
  activeIndex,
}: {
  documents: Document[];
  query: string;
  onSelect: (doc: Document) => void;
  activeIndex: number;
}) {
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return documents.filter(d => d.title.toLowerCase().includes(q));
  }, [documents, query]);

  if (filtered.length === 0) {
    return (
      <div style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '4px',
        background: 'var(--canvas-overlay)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        padding: '12px 16px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        zIndex: 50,
      }}>
        No documents found
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: 0,
      right: 0,
      marginBottom: '4px',
      background: 'var(--canvas-overlay)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      maxHeight: '200px',
      overflowY: 'auto',
      zIndex: 50,
    }}>
      <div style={{
        padding: '6px 12px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        Link a document
      </div>
      {filtered.map((doc, idx) => (
        <button
          key={doc.id}
          onClick={() => onSelect(doc)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: idx === activeIndex ? 'var(--accent-subtle)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: idx === activeIndex ? 'var(--accent)' : 'var(--text-primary)',
            fontSize: '13px',
            textAlign: 'left',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
          onMouseLeave={e => { if (idx !== activeIndex) e.currentTarget.style.background = 'transparent'; }}
        >
          <FileText size={13} style={{ flexShrink: 0, color: idx === activeIndex ? 'var(--accent)' : 'var(--text-muted)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
        </button>
      ))}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function ChatPanel({
  sessions,
  activeSession,
  messages,
  streaming,
  loading,
  memoryFacts,
  documents,
  onNewSession,
  onSendMessage,
  onSessionSelect,
  onDeleteSession,
  onNavigateToDocuments,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('auto');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docPickerQuery, setDocPickerQuery] = useState('');
  const [docPickerIndex, setDocPickerIndex] = useState(0);
  const [linkedDocs, setLinkedDocs] = useState<Document[]>([]);
  const [atStartPos, setAtStartPos] = useState(-1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showDocPicker) {
      setDocPickerIndex(0);
    }
  }, [docPickerQuery, showDocPicker]);

  const filteredPickerDocs = useMemo(() => {
    const q = docPickerQuery.toLowerCase();
    return documents.filter(d => d.title.toLowerCase().includes(q));
  }, [documents, docPickerQuery]);

  const handleDocSelect = (doc: Document) => {
    if (!linkedDocs.find(d => d.id === doc.id)) {
      setLinkedDocs(prev => [...prev, doc]);
    }
    const before = input.slice(0, atStartPos);
    const after = input.slice(inputRef.current?.selectionStart || input.length);
    setInput(before + after);
    setShowDocPicker(false);
    setDocPickerQuery('');
    setAtStartPos(-1);
    inputRef.current?.focus();
  };

  const handleRemoveLinkedDoc = (docId: string) => {
    setLinkedDocs(prev => prev.filter(d => d.id !== docId));
  };

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    onSendMessage(input.trim(), selectedModel, memoryFacts, linkedDocs.length > 0 ? linkedDocs : undefined);
    setInput('');
    setLinkedDocs([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDocPicker) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDocPickerIndex(prev => Math.min(prev + 1, filteredPickerDocs.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDocPickerIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredPickerDocs[docPickerIndex]) {
          handleDocSelect(filteredPickerDocs[docPickerIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDocPicker(false);
        setDocPickerQuery('');
        setAtStartPos(-1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    if (showDocPicker && atStartPos >= 0) {
      const afterAt = val.slice(atStartPos + 1);
      const spaceIdx = afterAt.indexOf(' ');
      if (spaceIdx === -1) {
        setDocPickerQuery(afterAt);
      } else {
        setShowDocPicker(false);
        setDocPickerQuery('');
        setAtStartPos(-1);
      }
    }

    const cursor = e.target.selectionStart || 0;
    if (val[cursor - 1] === '@' && !showDocPicker) {
      setShowDocPicker(true);
      setDocPickerQuery('');
      setAtStartPos(cursor - 1);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{
        width: '200px',
        flexShrink: 0,
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onNewSession}
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
              transition: 'all var(--transition-fast)',
            }}
          >
            <Plus size={13} />
            New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {sessions.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '16px 8px' }}>
              No chats yet
            </p>
          ) : sessions.map(session => (
            <div
              key={session.id}
              onMouseEnter={() => setHoveredSession(session.id)}
              onMouseLeave={() => setHoveredSession(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: activeSession?.id === session.id ? 'var(--accent-subtle)' : 'transparent',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
                marginBottom: '2px',
              }}
              onClick={() => onSessionSelect(session)}
            >
              <MessageSquare
                size={12}
                style={{
                  flexShrink: 0,
                  color: activeSession?.id === session.id ? 'var(--accent)' : 'var(--text-muted)',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: activeSession?.id === session.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: activeSession?.id === session.id ? 500 : 400,
                }}>
                  {session.title}
                </span>
                <span style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  opacity: 0.7,
                }}>
                  {formatRelativeTime(session.updated_at || session.created_at)}
                </span>
              </div>
              {hoveredSession === session.id && (
                <button
                  onClick={e => { e.stopPropagation(); onDeleteSession(session.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '2px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    display: 'flex',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          {!activeSession ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '12px',
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-subtle), var(--canvas-raised))',
                border: '1px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  What's on your mind?
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Type a message below to begin
                </p>
              </div>
              <button
                onClick={onNewSession}
                style={{
                  padding: '8px 16px',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  marginTop: '4px',
                }}
              >
                New Chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px',
            }}>
              <Sparkles size={32} style={{ color: 'var(--accent)', opacity: 0.5 }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                  What's on your mind?
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Type @ to reference documents
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '380px' }}>
                {[
                  'Summarize my documents',
                  'Help me brainstorm ideas',
                  'Write a draft',
                  'Explain a concept',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--canvas-raised)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isStreaming={streaming && idx === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div
          id="chat-input"
          style={{
            padding: '12px 16px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--canvas-elevated)',
          }}
        >
          {linkedDocs.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}>
              {linkedDocs.map(doc => (
                <span
                  key={doc.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: 'var(--accent)',
                    fontWeight: 500,
                  }}
                >
                  <FileText size={10} />
                  {doc.title}
                  <button
                    onClick={() => handleRemoveLinkedDoc(doc.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--accent)',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: '2px',
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            {showDocPicker && (
              <DocPicker
                documents={documents}
                query={docPickerQuery}
                onSelect={handleDocSelect}
                activeIndex={docPickerIndex}
              />
            )}

            <div style={{
              background: 'var(--canvas-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              transition: 'border-color var(--transition-fast)',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (@ to link documents)"
                disabled={streaming}
                rows={1}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  padding: '12px 14px 8px',
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  maxHeight: '120px',
                  overflowY: 'auto',
                }}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px 8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ModelSelector value={selectedModel} onChange={setSelectedModel} />
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '12px',
                      transition: 'color var(--transition-fast)',
                    }}
                    title="Attach file"
                  >
                    <Paperclip size={13} />
                  </button>
                  <button
                    onClick={() => {
                      setInput(prev => prev + '@');
                      setShowDocPicker(true);
                      setDocPickerQuery('');
                      setAtStartPos(input.length);
                      inputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '12px',
                      transition: 'color var(--transition-fast)',
                    }}
                    title="Link document"
                  >
                    <AtSign size={13} />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: input.trim() && !streaming ? 'var(--accent)' : 'var(--canvas-overlay)',
                    border: 'none',
                    cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                    color: input.trim() && !streaming ? 'white' : 'var(--text-muted)',
                    transition: 'all var(--transition-fast)',
                    flexShrink: 0,
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: '6px',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
              AI can make mistakes. Use @ to link documents for context.
            </p>
            <button
              onClick={onNavigateToDocuments}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
                fontSize: '10px',
                fontWeight: 500,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <FileText size={10} />
              Write a document...
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
