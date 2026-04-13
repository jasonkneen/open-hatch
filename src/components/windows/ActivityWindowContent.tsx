import React from 'react';
import {
  FileText, CheckCircle2, MessageSquare, Brain, MessageCircle,
  UserPlus, Palette, Activity,
} from 'lucide-react';
import type { ActivityEvent, ActivityEventType } from '../../types';

interface ActivityWindowContentProps {
  events: ActivityEvent[];
  loading: boolean;
}

function iconFor(type: ActivityEventType): React.ReactNode {
  switch (type) {
    case 'document_created':
    case 'document_updated':
    case 'document_deleted':
      return <FileText size={13} />;
    case 'task_created':
    case 'task_completed':
    case 'task_updated':
      return <CheckCircle2 size={13} />;
    case 'chat_created':
      return <MessageSquare size={13} />;
    case 'memory_added':
      return <Brain size={13} />;
    case 'comment_created':
      return <MessageCircle size={13} />;
    case 'member_joined':
      return <UserPlus size={13} />;
    case 'canvas_updated':
      return <Palette size={13} />;
    default:
      return <Activity size={13} />;
  }
}

function colorFor(type: ActivityEventType): string {
  switch (type) {
    case 'task_completed':
      return '#22c55e';
    case 'document_deleted':
      return '#ef4444';
    case 'member_joined':
      return '#8b5cf6';
    case 'comment_created':
      return '#f59e0b';
    default:
      return 'var(--accent)';
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function groupByDay(events: ActivityEvent[]): Array<{ label: string; items: ActivityEvent[] }> {
  const groups: Record<string, ActivityEvent[]> = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  events.forEach(event => {
    const d = new Date(event.created_at);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    let label: string;
    if (dayStart.getTime() === today.getTime()) label = 'Today';
    else if (dayStart.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = dayStart.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    (groups[label] = groups[label] || []).push(event);
  });

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export function ActivityWindowContent({ events, loading }: ActivityWindowContentProps) {
  if (loading && events.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: '12px',
      }}>
        Loading activity…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: '10px', padding: '24px', textAlign: 'center',
      }}>
        <Activity size={32} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 4px', fontWeight: 500 }}>
            No activity yet
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            Team actions will show up here as they happen.
          </p>
        </div>
      </div>
    );
  }

  const grouped = groupByDay(events);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '6px 0' }}>
      {grouped.map(group => (
        <div key={group.label}>
          <div style={{
            padding: '10px 16px 4px',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            {group.label}
          </div>
          {group.items.map(event => (
            <div
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '8px 16px',
                borderLeft: '2px solid transparent',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--canvas-raised)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: `color-mix(in srgb, ${colorFor(event.event_type)} 18%, var(--canvas-raised))`,
                color: colorFor(event.event_type),
                flexShrink: 0,
                marginTop: '1px',
              }}>
                {iconFor(event.event_type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  margin: 0,
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}>
                  {event.title}
                </p>
                <p style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  margin: '2px 0 0',
                }}>
                  {formatTime(event.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
