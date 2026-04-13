import { useCallback } from 'react';
import type { Document, MemoryFact, Task, CanvasObject } from '../types';

export interface WorkspaceContextSnapshot {
  workspace: string;
  memory: string | null;
  documents: string | null;
  tasks: string | null;
  canvas: string | null;
}

export interface WorkspaceContextSources {
  workspaceName: string;
  documents: Document[];
  memoryFacts: MemoryFact[];
  tasks: Task[];
  canvasObjects: CanvasObject[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

/**
 * Aggregates workspace knowledge (docs, memory, tasks, canvas) into a
 * structured snapshot for injection into the AI chat system prompt.
 */
export function useWorkspaceContext(sources: WorkspaceContextSources) {
  const { workspaceName, documents, memoryFacts, tasks, canvasObjects } = sources;

  const buildSnapshot = useCallback((): WorkspaceContextSnapshot => {
    // Memory: all facts (capped for safety)
    const memory = memoryFacts.length > 0
      ? memoryFacts.slice(0, 40).map(f => `[${f.category || 'general'}] ${f.fact}`).join('\n')
      : null;

    // Documents: favorites first, then most recent, up to 6 docs, 600 chars each
    const favDocs = documents.filter(d => d.is_favorite);
    const otherDocs = documents.filter(d => !d.is_favorite).slice(0, 6 - favDocs.length);
    const picked = [...favDocs.slice(0, 6), ...otherDocs].slice(0, 6);
    const docContext = picked.length > 0
      ? picked.map(d => {
          const text = truncate(stripHtml(d.content || ''), 600);
          const marker = d.is_favorite ? '★' : '•';
          return `${marker} ${d.title}\n${text || '(empty)'}`;
        }).join('\n\n')
      : null;

    // Tasks: open tasks only, up to 20
    const openTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').slice(0, 20);
    const taskContext = openTasks.length > 0
      ? openTasks.map(t => {
          const parts = [`[${t.status}] ${t.title}`];
          if (t.priority && t.priority !== 'normal') parts.push(`(${t.priority})`);
          if (t.due_date) parts.push(`due ${new Date(t.due_date).toLocaleDateString()}`);
          return parts.join(' ');
        }).join('\n')
      : null;

    // Canvas: text + sticky_note objects only, up to 15
    const canvasText = canvasObjects
      .filter(o => (o.type === 'text' || o.type === 'sticky_note') && o.text_content)
      .slice(0, 15)
      .map(o => `- ${truncate(o.text_content, 200)}`)
      .join('\n');
    const canvasContext = canvasText || null;

    return {
      workspace: workspaceName,
      memory,
      documents: docContext,
      tasks: taskContext,
      canvas: canvasContext,
    };
  }, [workspaceName, documents, memoryFacts, tasks, canvasObjects]);

  return { buildSnapshot };
}
