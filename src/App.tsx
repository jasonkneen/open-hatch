import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, FileText, Brain, Layers3 } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { NetworkStatusBar } from './components/layout/NetworkStatusBar';
import { HomeCanvas } from './components/home/HomeCanvas';
import { FloatingWindowShell } from './components/windows/FloatingWindowShell';
import { ChatWindowContent } from './components/windows/ChatWindowContent';
import { DocWindowContent } from './components/windows/DocWindowContent';
import { MemorySection } from './components/memory/MemorySection';
import { OnboardingTour } from './components/onboarding/OnboardingTour';
import CommandPalette from './components/search/CommandPalette';
import { AuthPage } from './components/auth/AuthPage';
import { ShareDialog } from './components/sharing/ShareDialog';
import { CreateWorkspaceDialog } from './components/sharing/CreateWorkspaceDialog';
import { DrawingLayer } from './components/canvas/DrawingLayer';
import { CanvasDropZone } from './components/canvas/CanvasDropZone';
import { useAuth } from './hooks/useAuth';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useDocuments } from './hooks/useDocuments';
import { useChat } from './hooks/useChat';
import { useMemory } from './hooks/useMemory';
import { useFiles } from './hooks/useFiles';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useTheme } from './hooks/useTheme';
import { useWindows } from './hooks/useWindows';
import { useMultiplayerCursors } from './hooks/useMultiplayerCursors';
import { useSharing } from './hooks/useSharing';
import { useCanvasObjects } from './hooks/useCanvasObjects';
import { useCanvasLayers } from './hooks/useCanvasLayers';
import type { CanvasLayer } from './hooks/useCanvasLayers';
import { CursorOverlay } from './components/cursors/CursorOverlay';
import type { Document, ChatSession, MemoryFact, CanvasGroup, CanvasObject, FloatingWindow } from './types';
import bg1 from '../images/download-21.jpg';
import bg2 from '../images/download-22.jpg';
import bg3 from '../images/download-24.jpg';
import bg4 from '../images/download-25.jpg';
import bg5 from '../images/download-26.jpg';

const TOUR_KEY = 'hatch_tour_complete';
const SIDEBAR_KEY = 'hatch_sidebar_collapsed';
const CANVAS_BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5];

export default function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [showTour, setShowTour] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogTitle, setShareDialogTitle] = useState('');
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [showCanvasGrid, setShowCanvasGrid] = useState(false);
  const [canvasGridBackground] = useState(() => CANVAS_BACKGROUNDS[Math.floor(Math.random() * CANVAS_BACKGROUNDS.length)]);
  const activeSceneRef = useRef<HTMLDivElement>(null);

  const { workspaces, loading: wsLoading, createWorkspace } = useWorkspaces(user?.id);
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || null;

  useEffect(() => {
    if (!wsLoading && workspaces.length > 0 && !workspaces.find(w => w.id === activeWorkspaceId)) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [wsLoading, workspaces, activeWorkspaceId]);

  const {
    documents, recents,
    createDocument, autoSave, deleteDocument, toggleFavorite
  } = useDocuments(activeWorkspaceId);

  const {
    sessions, activeSession, setActiveSession, messages, streaming,
    createSession, sendMessage
  } = useChat(activeWorkspaceId);

  const { facts, categories, addFact, updateFact, deleteFact } = useMemory(activeWorkspaceId);
  const { uploadFiles } = useFiles(activeWorkspaceId);
  const { online, syncing, pendingCount, flushQueue } = useNetworkStatus();
  const { mode: themeMode, setTheme } = useTheme();
  const { layers, activeLayer, activeLayerId, createLayer, activateLayer, deleteLayer, baseLayerId } = useCanvasLayers(activeWorkspaceId || null);
  const { windows, openWindow, closeWindow, focusWindow, updateWindow, minimizeWindow } = useWindows();
  const canvasRef = useRef<HTMLElement>(null);
  const { cursors } = useMultiplayerCursors(
    activeWorkspaceId,
    canvasRef,
    user?.id,
    user?.email || undefined
  );

  const workspacePresenceUsers = [
    ...(user ? [{
      id: user.id,
      name: user.email?.split('@')[0] || 'You',
      color: colorFromSeed(user.id),
      isCurrentUser: true,
    }] : []),
    ...cursors.map(cursor => ({
      id: cursor.id,
      name: cursor.name,
      color: cursor.color,
      isCurrentUser: false,
    })),
  ];
  const {
    members,
    autoShare,
    toggleAutoShare,
    inviteByEmail,
    removeMember,
    updateMemberRole,
  } = useSharing(activeWorkspaceId || null, user?.id);
  const {
    objects: canvasObjects,
    groups: canvasGroups,
    addObject: addCanvasObject,
    updateObject: updateCanvasObject,
    deleteObject: deleteCanvasObject,
    deleteObjectsInLayer,
    bringToFront: bringCanvasObjectToFront,
    createGroup: createCanvasGroup,
    deleteGroup: deleteCanvasGroup,
  } = useCanvasObjects(activeWorkspaceId || null, user?.id, 'base');

  const visibleCanvasObjects = canvasObjects;
  const visibleGroupIds = new Set(visibleCanvasObjects.map(obj => obj.group_id).filter(Boolean));
  const visibleCanvasGroups = canvasGroups.filter(group => visibleGroupIds.has(group.id));
  const activeWindows = windows.filter(win => (win.canvasId || 'base') === activeLayerId);
  const minimizedActiveWindows = activeWindows.filter(win => win.minimized);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const timer = setTimeout(() => setShowTour(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleTourComplete = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setShowTour(false);
  };

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const handleNewChat = useCallback(async () => {
    const session = await createSession();
    if (session) {
      openWindow('chat', { title: session.title || 'Untitled', sessionId: session.id, canvasId: activeLayerId });
    }
  }, [createSession, openWindow, activeLayerId]);

  const handleNewDocument = useCallback(async () => {
    const doc = await createDocument();
    if (doc) {
      openWindow('document', { title: doc.title || 'Untitled', documentId: doc.id, canvasId: activeLayerId });
    }
  }, [createDocument, openWindow, activeLayerId]);

  const handleOpenMemory = useCallback(() => {
    const existing = windows.find(w => w.type === 'memory');
    if (existing) {
      focusWindow(existing.id);
      if (existing.minimized) minimizeWindow(existing.id);
      return;
    }
    openWindow('memory', { title: 'Memory', canvasId: activeLayerId });
  }, [windows, openWindow, focusWindow, minimizeWindow, activeLayerId]);

  const handleDocumentOpen = useCallback((doc: Document) => {
    openWindow('document', { title: doc.title, documentId: doc.id, canvasId: activeLayerId });
  }, [openWindow, activeLayerId]);

  const handleSessionOpen = useCallback((session: ChatSession) => {
    setActiveSession(session);
    openWindow('chat', { title: session.title, sessionId: session.id, canvasId: activeLayerId });
  }, [setActiveSession, openWindow, activeLayerId]);

  const handleHomeSendMessage = useCallback(async (
    content: string,
    model: string,
    memFacts?: MemoryFact[],
    docs?: Document[]
  ) => {
    const session = await createSession();
    if (session) {
      openWindow('chat', { title: content.slice(0, 30) || 'New Chat', sessionId: session.id, canvasId: activeLayerId });
      setTimeout(() => {
        sendMessage(content, model, memFacts, docs);
      }, 100);
    }
  }, [createSession, openWindow, sendMessage, activeLayerId]);

  const handleCreateWorkspace = useCallback(() => {
    setCreateWorkspaceDialogOpen(true);
  }, []);

  const handleCreateWorkspaceSubmit = useCallback(async ({
    name,
    description,
    icon,
  }: {
    name: string;
    description: string;
    icon: string;
  }) => {
    const ws = await createWorkspace(name.trim(), icon.trim() || '🗂️', description.trim());
    if (ws) {
      setActiveWorkspaceId(ws.id);
      setCreateWorkspaceDialogOpen(false);
    }
  }, [createWorkspace]);

  const handleCloseWindow = useCallback((winId: string) => {
    const win = windows.find(w => w.id === winId);
    if (win?.sessionId && activeSession?.id === win.sessionId) {
      setActiveSession(null as unknown as ChatSession);
    }
    closeWindow(winId);
  }, [windows, activeSession, setActiveSession, closeWindow]);

  const handleShareWindow = useCallback((title: string) => {
    setShareDialogTitle(title);
    setShareDialogOpen(true);
  }, []);

  const handleOpenCanvasGrid = useCallback(() => {
    setShowCanvasGrid(true);
  }, []);

  const handleCloseCanvasGrid = useCallback(() => {
    setShowCanvasGrid(false);
  }, []);

  const handleSelectCanvasFromGrid = useCallback((layerId: string) => {
    activateLayer(layerId);
    setShowCanvasGrid(false);
  }, [activateLayer]);

  const handleCreateCanvasFromGrid = useCallback(() => {
    createLayer();
    setShowCanvasGrid(false);
  }, [createLayer]);

  const handleDeleteCanvasFromGrid = useCallback(async (layerId: string) => {
    const layer = layers.find(item => item.id === layerId);
    if (!layer || layerId === baseLayerId) return;
    const confirmed = window.confirm(`Delete ${layer.name}? This will remove its canvas items.`);
    if (!confirmed) return;

    await deleteObjectsInLayer(layerId);
    deleteLayer(layerId);
  }, [layers, baseLayerId, deleteObjectsInLayer, deleteLayer]);


  if (authLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--canvas-base)',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />;
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--canvas-base)',
    }}>
      <Sidebar
        workspace={activeWorkspace}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onNewChat={handleNewChat}
        onNewDocument={handleNewDocument}
        onUploadFile={() => {}}
        onCreateWorkspace={handleCreateWorkspace}
        onDocumentOpen={handleDocumentOpen}
        onSessionOpen={handleSessionOpen}
        onOpenMemory={handleOpenMemory}
        recents={recents}
        sessions={sessions}
        floatingWindows={windows}
        themeMode={themeMode}
        onThemeChange={setTheme}
        userEmail={user.email || ''}
        onSignOut={signOut}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
        <NetworkStatusBar
          online={online}
          syncing={syncing}
          pendingCount={pendingCount}
          onSync={flushQueue}
        />

        <main ref={canvasRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <CanvasDropZone
            onAddObject={addCanvasObject}
            onUploadFiles={uploadFiles}
          >
            <CanvasGridButton
              activeLayerName={activeLayer.name}
              onClick={handleOpenCanvasGrid}
            />

            <WorkspacePresenceAvatars users={workspacePresenceUsers} />

            <CursorOverlay cursors={cursors} />

            <div ref={activeSceneRef} style={{ position: 'absolute', inset: 0, opacity: showCanvasGrid ? 0.12 : 1, transition: 'opacity 180ms ease' }}>
              <CanvasLayerScene
                documents={documents}
                facts={facts}
                categories={categories}
                sessions={sessions}
                activeSession={activeSession}
                messages={messages}
                streaming={streaming}
                workspaceName={activeWorkspace?.name || 'Personal'}
                canvasObjects={visibleCanvasObjects}
                canvasGroups={visibleCanvasGroups}
                windows={activeWindows}
                onHomeSendMessage={handleHomeSendMessage}
                onNewDocument={handleNewDocument}
                onNewChat={handleNewChat}
                onCloseWindow={handleCloseWindow}
                onFocusWindow={focusWindow}
                onUpdateWindow={updateWindow}
                onMinimizeWindow={minimizeWindow}
                onShareWindow={handleShareWindow}
                onSendMessage={sendMessage}
                onSetActiveSession={setActiveSession}
                onDeleteDocument={deleteDocument}
                onAutoSaveDocument={autoSave}
                onToggleFavorite={toggleFavorite}
                onAddFact={addFact}
                onUpdateFact={updateFact}
                onDeleteFact={deleteFact}
              />
            </div>

            <DrawingLayer
              objects={visibleCanvasObjects}
              groups={visibleCanvasGroups}
              drawingActive={drawingActive}
              onToggleDrawing={() => setDrawingActive(prev => !prev)}
              onAddObject={addCanvasObject}
              onUpdateObject={updateCanvasObject}
              onDeleteObject={deleteCanvasObject}
              onBringToFront={bringCanvasObjectToFront}
              onCreateGroup={createCanvasGroup}
              onDeleteGroup={deleteCanvasGroup}
            />

            {showCanvasGrid && (
              <CanvasGridOverlay
                layers={layers}
                objects={canvasObjects}
                windows={windows}
                activeLayerId={activeLayerId}
                backgroundImage={canvasGridBackground}
                onClose={handleCloseCanvasGrid}
                onSelectLayer={handleSelectCanvasFromGrid}
                onCreateLayer={handleCreateCanvasFromGrid}
                onDeleteLayer={handleDeleteCanvasFromGrid}
                baseLayerId={baseLayerId}
              />
            )}

            {minimizedActiveWindows.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: '72px',
                right: '12px',
                display: 'flex',
                gap: '6px',
                zIndex: 50,
              }}>
                {minimizedActiveWindows.map(win => (
                  <button
                    key={win.id}
                    onClick={() => minimizeWindow(win.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'var(--canvas-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 500,
                      boxShadow: 'var(--shadow-md)',
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {win.type === 'chat' ? <MessageSquare size={12} /> : win.type === 'memory' ? <Brain size={12} /> : <FileText size={12} />}
                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {win.title}
                    </span>
                  </button>
                ))}
              </div>
            )}

          </CanvasDropZone>
        </main>
      </div>

      {showTour && <OnboardingTour onComplete={handleTourComplete} />}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        documents={documents}
        sessions={sessions}
        facts={facts}
        onDocumentOpen={handleDocumentOpen}
        onSessionOpen={handleSessionOpen}
        onViewChange={() => {}}
      />

      <ShareDialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        title={shareDialogTitle}
        workspaceName={activeWorkspace?.name || 'Personal'}
        currentUserEmail={user.email || ''}
        members={members}
        autoShare={autoShare}
        onToggleAutoShare={toggleAutoShare}
        onInvite={inviteByEmail}
        onRemoveMember={removeMember}
        onUpdateRole={updateMemberRole}
      />

      <CreateWorkspaceDialog
        open={createWorkspaceDialogOpen}
        onClose={() => setCreateWorkspaceDialogOpen(false)}
        onCreate={handleCreateWorkspaceSubmit}
      />
    </div>
  );
}

function CanvasLayerScene({
  documents,
  facts,
  categories,
  sessions,
  activeSession,
  messages,
  streaming,
  workspaceName,
  canvasObjects,
  canvasGroups,
  windows,
  onHomeSendMessage,
  onNewDocument,
  onNewChat,
  onCloseWindow,
  onFocusWindow,
  onUpdateWindow,
  onMinimizeWindow,
  onShareWindow,
  onSendMessage,
  onSetActiveSession,
  onDeleteDocument,
  onAutoSaveDocument,
  onToggleFavorite,
  onAddFact,
  onUpdateFact,
  onDeleteFact,
}: {
  documents: Document[];
  facts: MemoryFact[];
  categories: string[];
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  streaming: boolean;
  workspaceName: string;
  canvasObjects: CanvasObject[];
  canvasGroups: CanvasGroup[];
  windows: FloatingWindow[];
  onHomeSendMessage: (content: string, model: string, facts?: MemoryFact[], docs?: Document[]) => void;
  onNewDocument: () => void;
  onNewChat: () => void;
  onCloseWindow: (winId: string) => void;
  onFocusWindow: (winId: string) => void;
  onUpdateWindow: (id: string, updates: Partial<FloatingWindow>) => void;
  onMinimizeWindow: (id: string) => void;
  onShareWindow: (title: string) => void;
  onSendMessage: (content: string, model: string, facts?: MemoryFact[], docs?: Document[]) => void;
  onSetActiveSession: (session: ChatSession) => void;
  onDeleteDocument: (id: string) => void;
  onAutoSaveDocument: (id: string, updates: { title?: string; content?: string }) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onAddFact: (fact: string, category: string) => void;
  onUpdateFact: (id: string, fact: string, category: string) => void;
  onDeleteFact: (id: string) => void;
}) {
  return (
    <>
      <HomeCanvas
        documents={documents}
        memoryFacts={facts}
        onSendMessage={onHomeSendMessage}
        onOpenNewDocument={onNewDocument}
        onOpenNewChat={onNewChat}
        workspaceName={workspaceName}
      />

      {windows.filter(win => !win.minimized).map(win => {
        if (win.type === 'chat') {
          const winSession = sessions.find(s => s.id === win.sessionId);
          return (
            <FloatingWindowShell
              key={win.id}
              window={win}
              onClose={onCloseWindow}
              onFocus={onFocusWindow}
              onUpdate={onUpdateWindow}
              onMinimize={onMinimizeWindow}
              onShare={() => onShareWindow(win.title)}
              titleIcon={<MessageSquare size={13} />}
              breadcrumb={workspaceName}
            >
              <ChatWindowContent
                messages={winSession && activeSession?.id === win.sessionId ? (messages as never[]) : []}
                streaming={activeSession?.id === win.sessionId ? streaming : false}
                memoryFacts={facts}
                documents={documents}
                canvasGroups={canvasGroups}
                canvasObjects={canvasObjects}
                onSendMessage={(content, model, mf, docs) => {
                  if (winSession && activeSession?.id !== win.sessionId) onSetActiveSession(winSession);
                  onSendMessage(content, model, mf, docs);
                }}
              />
            </FloatingWindowShell>
          );
        }

        if (win.type === 'document') {
          const doc = documents.find(d => d.id === win.documentId);
          if (!doc) return null;
          return (
            <FloatingWindowShell
              key={win.id}
              window={win}
              onClose={onCloseWindow}
              onFocus={onFocusWindow}
              onUpdate={onUpdateWindow}
              onMinimize={onMinimizeWindow}
              onShare={() => onShareWindow(win.title)}
              titleIcon={<FileText size={13} />}
              breadcrumb={workspaceName}
            >
              <DocWindowContent
                document={doc}
                onAutoSave={onAutoSaveDocument}
                onToggleFavorite={onToggleFavorite}
                onDelete={async (id) => {
                  const confirmed = window.confirm('Delete this document?');
                  if (!confirmed) return;
                  await onDeleteDocument(id);
                  onCloseWindow(win.id);
                }}
                onTitleChange={(title) => onUpdateWindow(win.id, { title })}
              />
            </FloatingWindowShell>
          );
        }

        if (win.type === 'memory') {
          return (
            <FloatingWindowShell
              key={win.id}
              window={win}
              onClose={onCloseWindow}
              onFocus={onFocusWindow}
              onUpdate={onUpdateWindow}
              onMinimize={onMinimizeWindow}
              onShare={() => onShareWindow(win.title)}
              titleIcon={<Brain size={13} />}
              breadcrumb={workspaceName}
            >
              <MemorySection
                facts={facts}
                categories={categories}
                onAdd={onAddFact}
                onUpdate={onUpdateFact}
                onDelete={onDeleteFact}
              />
            </FloatingWindowShell>
          );
        }

        return null;
      })}
    </>
  );
}

function colorFromSeed(seed: string): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function WorkspacePresenceAvatars({
  users,
}: {
  users: Array<{ id: string; name: string; color: string; isCurrentUser?: boolean }>;
}) {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, 5);
  const overflow = users.length - visibleUsers.length;

  return (
    <div
      style={{
        position: 'absolute',
        top: '14px',
        right: '14px',
        zIndex: 85,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        background: 'color-mix(in srgb, var(--canvas-elevated) 82%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: '999px',
        boxShadow: 'var(--shadow-md)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginRight: overflow > 0 ? '2px' : 0 }}>
        {visibleUsers.map((person, index) => (
          <div
            key={person.id}
            title={`${person.name}${person.isCurrentUser ? ' (you)' : ''}`}
            style={{
              width: '30px',
              height: '30px',
              marginLeft: index === 0 ? 0 : '-8px',
              borderRadius: '50%',
              border: '2px solid var(--canvas-base)',
              background: person.color,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              position: 'relative',
            }}
          >
            {(person.name || '?').slice(0, 2).toUpperCase()}
            {person.isCurrentUser && (
              <span
                style={{
                  position: 'absolute',
                  right: '-1px',
                  bottom: '-1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid var(--canvas-base)',
                }}
              />
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div
            title={`${overflow} more users`}
            style={{
              width: '30px',
              height: '30px',
              marginLeft: '-8px',
              borderRadius: '50%',
              border: '2px solid var(--canvas-base)',
              background: 'var(--canvas-raised)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
          {users.length === 1 ? 'Just you' : `${users.length} here now`}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.1 }}>
          Live workspace presence
        </span>
      </div>
    </div>
  );
}

function CanvasGridButton({
  activeLayerName,
  onClick,
}: {
  activeLayerName: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title="Show all canvases"
      style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--canvas-elevated)',
        boxShadow: 'var(--shadow-md)',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      <Layers3 size={15} />
      <span>{activeLayerName}</span>
    </button>
  );
}

function CanvasGridOverlay({
  layers,
  objects,
  windows,
  activeLayerId,
  backgroundImage,
  onClose,
  onSelectLayer,
  onCreateLayer,
  onDeleteLayer,
  baseLayerId,
}: {
  layers: CanvasLayer[];
  objects: CanvasObject[];
  windows: FloatingWindow[];
  activeLayerId: string;
  backgroundImage: string;
  onClose: () => void;
  onSelectLayer: (id: string) => void;
  onCreateLayer: () => void;
  onDeleteLayer: (id: string) => void;
  baseLayerId: string;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        opacity: 0.22,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--home-bg-overlay)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(8, 8, 8, 0.10)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
      }} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1200px, 100%)',
          maxHeight: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>All workspaces</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Choose a workspace or create a new one</div>
          </div>
          <button
            onClick={onCreateLayer}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--accent-border)',
              background: 'var(--accent-subtle)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <Layers3 size={15} />
            New workspace
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '18px',
        }}>
          {layers.map(layer => {
            const layerObjects = objects.filter(obj => (obj.layer_id || 'base') === layer.id);
            const layerWindows = windows.filter(win => (win.canvasId || 'base') === layer.id && !win.minimized);
            const isActive = layer.id === activeLayerId;
            return (
              <button
                key={layer.id}
                onClick={() => onSelectLayer(layer.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '18px',
                  border: isActive ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  background: isActive ? 'var(--accent-subtle)' : 'var(--canvas-elevated)',
                  boxShadow: isActive ? '0 0 0 1px var(--accent-border), var(--shadow-lg)' : 'var(--shadow-lg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  aspectRatio: '4 / 3',
                  width: '100%',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  background: 'linear-gradient(180deg, var(--canvas-elevated), var(--canvas-raised))',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 45%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.08))',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: '12px',
                    borderRadius: '10px',
                    border: '1px dashed var(--border-strong)',
                  }} />
                  {layerObjects.slice(0, 6).map((obj, index) => (
                    <div
                      key={obj.id}
                      style={{
                        position: 'absolute',
                        left: `${10 + (index % 3) * 28}%`,
                        top: `${16 + Math.floor(index / 3) * 26}%`,
                        width: obj.type === 'line' || obj.type === 'arrow' ? '18%' : '14%',
                        height: obj.type === 'line' || obj.type === 'arrow' ? '2px' : '12%',
                        borderRadius: obj.type === 'ellipse' ? '999px' : '6px',
                        background: obj.fill || 'var(--accent)',
                        opacity: 0.78,
                        transform: obj.type === 'diamond' ? 'rotate(45deg)' : obj.type === 'arrow' ? 'rotate(-20deg)' : 'none',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{layer.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{layerObjects.length} items • {layerWindows.length} windows</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isActive && <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>Current</div>}
                    {layer.id !== baseLayerId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteLayer(layer.id);
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '10px',
                          border: '1px solid rgba(248,113,113,0.3)',
                          background: 'rgba(248,113,113,0.10)',
                          color: 'var(--error)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        Delete workspace
                      </button>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
