import React, { useState } from 'react';
import { Brain, Plus, Trash2, CreditCard as Edit3, Check, X, Tag } from 'lucide-react';
import type { MemoryFact } from '../../types';

interface MemorySectionProps {
  facts: MemoryFact[];
  categories: string[];
  onAdd: (fact: string, category: string) => void;
  onUpdate: (id: string, fact: string, category: string) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  general: '#4f9cf9',
  'about me': '#4ade80',
  preferences: '#fbbf24',
  work: '#f472b6',
  goals: '#a78bfa',
  notes: '#38bdf8',
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] || '#9a9a9a';
}

export function MemorySection({ facts, categories, onAdd, onUpdate, onDelete }: MemorySectionProps) {
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const handleAdd = () => {
    if (!newFact.trim()) return;
    onAdd(newFact.trim(), newCategory);
    setNewFact('');
    setNewCategory('general');
    setAddingNew(false);
  };

  const handleEdit = (fact: MemoryFact) => {
    setEditingId(fact.id);
    setEditFact(fact.fact);
    setEditCategory(fact.category);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editFact.trim()) return;
    onUpdate(editingId, editFact.trim(), editCategory);
    setEditingId(null);
  };

  const allCategories = [...new Set(['general', 'about me', 'preferences', 'work', 'goals', 'notes', ...categories])];
  const filteredFacts = filterCategory ? facts.filter(f => f.category === filterCategory) : facts;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '24px 24px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Brain size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Memory
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {facts.length} persistent facts stored
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddingNew(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '7px 12px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
          >
            <Plus size={13} />
            Add Memory
          </button>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory(null)}
            style={{
              padding: '3px 10px',
              borderRadius: '20px',
              background: !filterCategory ? 'var(--accent-subtle)' : 'var(--canvas-raised)',
              border: `1px solid ${!filterCategory ? 'var(--accent-border)' : 'var(--border)'}`,
              color: !filterCategory ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            All
          </button>
          {allCategories.filter(c => facts.some(f => f.category === c)).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
              style={{
                padding: '3px 10px',
                borderRadius: '20px',
                background: filterCategory === cat ? 'var(--accent-subtle)' : 'var(--canvas-raised)',
                border: `1px solid ${filterCategory === cat ? 'var(--accent-border)' : 'var(--border)'}`,
                color: filterCategory === cat ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: getCategoryColor(cat),
                flexShrink: 0,
              }} />
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {/* Add new form */}
        {addingNew && (
          <div style={{
            background: 'var(--canvas-raised)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px',
            marginBottom: '12px',
          }}>
            <textarea
              autoFocus
              placeholder="What should Hatch remember?"
              value={newFact}
              onChange={e => setNewFact(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); } }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                marginBottom: '10px',
                minHeight: '60px',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  style={{
                    background: 'var(--canvas-overlay)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    padding: '3px 6px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {allCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setAddingNew(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={14} />
              </button>
              <button
                onClick={handleAdd}
                disabled={!newFact.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  background: newFact.trim() ? 'var(--accent)' : 'var(--canvas-overlay)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: newFact.trim() ? 'white' : 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: newFact.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Check size={13} />
                Save
              </button>
            </div>
          </div>
        )}

        {filteredFacts.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: '12px',
          }}>
            <Brain size={36} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', margin: 0 }}>
              {filterCategory ? `No facts in "${filterCategory}"` : 'No memories stored yet'}
            </p>
            {!filterCategory && (
              <button
                onClick={() => setAddingNew(true)}
                style={{
                  padding: '7px 14px',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Add your first memory
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredFacts.map(fact => (
              <div
                key={fact.id}
                style={{
                  background: 'var(--canvas-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  transition: 'border-color var(--transition-fast)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {editingId === fact.id ? (
                  <div>
                    <textarea
                      autoFocus
                      value={editFact}
                      onChange={e => setEditFact(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        resize: 'none',
                        fontFamily: 'inherit',
                        lineHeight: '1.5',
                        marginBottom: '8px',
                        minHeight: '50px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        style={{
                          background: 'var(--canvas-overlay)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          fontSize: '12px',
                          padding: '3px 6px',
                          outline: 'none',
                          flex: 1,
                        }}
                      >
                        {allCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                      >
                        <X size={13} />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          background: 'var(--accent)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          color: 'white',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={12} />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getCategoryColor(fact.category),
                      flexShrink: 0,
                      marginTop: '4px',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        {fact.fact}
                      </p>
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        background: 'var(--canvas-raised)',
                        padding: '1px 6px',
                        borderRadius: '20px',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        {fact.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleEdit(fact)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          transition: 'color var(--transition-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(fact.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          transition: 'color var(--transition-fast)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
