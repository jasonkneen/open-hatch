export interface Workspace {
  id: string;
  name: string;
  description: string;
  icon: string;
  user_id?: string | null;
  auto_share?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  workspace_id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface MemoryFact {
  id: string;
  workspace_id: string;
  fact: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface UploadedFile {
  id: string;
  workspace_id: string;
  name: string;
  size: number;
  type: string;
  storage_path: string;
  created_at: string;
}

export type CanvasObjectType = 'rect' | 'ellipse' | 'diamond' | 'arrow' | 'line' | 'pen' | 'text' | 'image' | 'video' | 'file' | 'sticky_note';

export interface CanvasObject {
  id: string;
  workspace_id: string;
  user_id: string | null;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  stroke_width: number;
  opacity: number;
  points: Array<{ x: number; y: number }>;
  text_content: string;
  src: string;
  file_name: string;
  z_index: number;
  locked: boolean;
  group_id: string | null;
  attached_to: string | null;
  font_size: number;
  layer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanvasGroup {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

export type CanvasTool = 'select' | 'pen' | 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'text' | 'eraser' | 'sticky_note';

export type ActiveView = 'chat' | 'document' | 'memory' | 'files';

export type FloatingWindowType = 'chat' | 'document' | 'memory';

export interface FloatingWindow {
  id: string;
  type: FloatingWindowType;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  canvasId?: string;
  sessionId?: string;
  documentId?: string;
}

export interface ItemPresenceUser {
  userId: string;
  name: string;
  color: string;
  typing?: boolean;
}

export type AIModel = {
  id: string;
  label: string;
  description: string;
};

export const AI_MODELS: AIModel[] = [
  { id: 'auto', label: 'Auto', description: 'Automatically selects the best model' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', description: 'Most capable model' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Balanced performance' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Fastest model' },
];

export interface OnboardingStep {
  id: number;
  title: string;
  body: string;
  target: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Documents are powerful.',
    body: 'Create, organize, and edit rich documents right in your workspace. Use formatting, headings, and more.',
    target: 'doc-editor-area',
    placement: 'right',
  },
  {
    id: 2,
    title: 'Link documents in chats.',
    body: 'Type @ in any chat message to reference and link a document directly into your conversation.',
    target: 'chat-input',
    placement: 'top',
  },
];
