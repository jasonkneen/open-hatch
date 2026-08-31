import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backendClient } from '../lib/backendClient';
import {
  applyTypingFrame,
  buildTypingFrame,
  decideTypingEmit,
  mergeTypingIntoPresence,
  pruneExpiredTyping,
  type TypingEmitState,
  type TypingFrame,
  type TypingState,
} from '../lib/typingPresence';
import type { FloatingWindow, ItemPresenceUser, WorkspaceInstanceShareMode } from '../types';
import type { RealtimeChannel, BroadcastPayload } from '../types/realtime';

interface PresenceSnapshotItem {
  type: 'chat' | 'document';
  itemId: string;
  /**
   * Legacy. Typing rides its own lean `typing` broadcast now — see
   * src/lib/typingPresence.ts for why it is not folded back into this ~2 KB
   * snapshot. Still read on the way in so a frame from an older tab is
   * tolerated; never written on the way out.
   */
  typing?: boolean;
}

interface PresenceSnapshotPayload {
  userId: string;
  name: string;
  color: string;
  items: PresenceSnapshotItem[];
  windows?: FloatingWindow[];
  activeLayerId?: string;
  lastSeen: number;
}

interface RemotePresenceState {
  userId: string;
  name: string;
  color: string;
  items: PresenceSnapshotItem[];
  windows: FloatingWindow[];
  activeLayerId: string | null;
  /**
   * The beat that last carried a CHANGE, not the peer's liveness clock.
   * Liveness lives in `remoteLastSeenRef` instead — see the presence_snapshot
   * handler: writing every keepalive into render state re-rendered the App root
   * twice a second per idle collaborator for a number nothing draws.
   */
  lastSeen: number;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#84cc16', '#f59e0b', '#6366f1',
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function publicWindowSnapshot(win: FloatingWindow, ownerUserId?: string): FloatingWindow {
  return {
    id: win.id,
    type: win.type,
    title: win.title,
    x: win.x,
    y: win.y,
    width: win.width,
    height: win.height,
    zIndex: win.zIndex,
    minimized: win.minimized,
    maximized: !!win.maximized,
    restoreBounds: win.restoreBounds ? { ...win.restoreBounds } : undefined,
    canvasId: win.canvasId,
    sessionId: win.sessionId,
    documentId: win.documentId,
    ownerUserId: ownerUserId || win.ownerUserId || null,
    isPrivate: !!win.isPrivate,
    locked: !!win.locked,
    shared: !!win.shared,
  };
}

function sameSnapshotItems(previous: PresenceSnapshotItem[], next: PresenceSnapshotItem[]): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    if (
      previous[i].type !== next[i].type
      || previous[i].itemId !== next[i].itemId
      || !!previous[i].typing !== !!next[i].typing
    ) return false;
  }
  return true;
}

function sameSharedWindows(previous: FloatingWindow[], next: FloatingWindow[]): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    const before = previous[i];
    const after = next[i];
    if (
      before.id !== after.id
      || before.type !== after.type
      || before.title !== after.title
      || before.x !== after.x
      || before.y !== after.y
      || before.width !== after.width
      || before.height !== after.height
      || before.zIndex !== after.zIndex
      || before.minimized !== after.minimized
      || !!before.maximized !== !!after.maximized
      || before.canvasId !== after.canvasId
      || before.sessionId !== after.sessionId
      || before.documentId !== after.documentId
      || (before.ownerUserId || null) !== (after.ownerUserId || null)
      || !!before.isPrivate !== !!after.isPrivate
      || !!before.locked !== !!after.locked
      || !!before.shared !== !!after.shared
    ) return false;
    const beforeBounds = before.restoreBounds;
    const afterBounds = after.restoreBounds;
    if (!!beforeBounds !== !!afterBounds) return false;
    if (beforeBounds && afterBounds && (
      beforeBounds.x !== afterBounds.x
      || beforeBounds.y !== afterBounds.y
      || beforeBounds.width !== afterBounds.width
      || beforeBounds.height !== afterBounds.height
    )) return false;
  }
  return true;
}

/**
 * Does this frame draw the same as what we already hold? Deliberately ignores
 * `lastSeen`: it is the one field that differs on EVERY beat and the one field
 * nothing renders. Everything compared here is something the roster, the shared
 * window layer or the per-item avatars actually paint.
 */
function samePresenceSnapshot(
  previous: RemotePresenceState | undefined,
  snapshot: PresenceSnapshotPayload,
): boolean {
  if (!previous) return false;
  return previous.name === snapshot.name
    && previous.color === snapshot.color
    && previous.activeLayerId === (snapshot.activeLayerId || null)
    && sameSnapshotItems(previous.items, snapshot.items || [])
    && sameSharedWindows(previous.windows, snapshot.windows || []);
}

export function useItemPresence(
  workspaceId: string | null,
  windows: FloatingWindow[],
  activeLayerId: string = 'base',
  userId?: string,
  userEmail?: string,
  shareMode: WorkspaceInstanceShareMode = 'all',
) {
  const [remotePresence, setRemotePresence] = useState<Record<string, RemotePresenceState>>({});
  const [typingState, setTypingState] = useState<TypingState>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingEmitRef = useRef<TypingEmitState>({});
  const windowsRef = useRef<FloatingWindow[]>(windows);
  const heartbeatRef = useRef<number | null>(null);
  const knownRemoteIdsRef = useRef<Set<string>>(new Set());
  // Peer liveness, deliberately outside React state — see RemotePresenceState.
  const remoteLastSeenRef = useRef<Map<string, number>>(new Map());
  const displayName = userEmail?.split('@')[0] || 'Anonymous';
  const color = userId ? pickColor(userId) : '#3b82f6';

  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const buildItems = useCallback((): PresenceSnapshotItem[] => {
    const seen = new Set<string>();
    const items: PresenceSnapshotItem[] = [];

    windowsRef.current
      .filter(win => !win.minimized)
      .forEach(win => {
        if (win.type === 'chat' && win.sessionId) {
          const key = `chat:${win.sessionId}`;
          if (seen.has(key)) return;
          seen.add(key);
          items.push({
            type: 'chat',
            itemId: win.sessionId,
          });
        }

        if (win.type === 'document' && win.documentId) {
          const key = `document:${win.documentId}`;
          if (seen.has(key)) return;
          seen.add(key);
          items.push({
            type: 'document',
            itemId: win.documentId,
          });
        }
      });

    return items;
  }, []);

  const buildSharedWindows = useCallback((): FloatingWindow[] => {
    if (shareMode === 'off') return [];

    return windowsRef.current
      .filter(win => !win.isPrivate)
      .filter(win => shareMode === 'all' || win.shared)
      .map(win => publicWindowSnapshot(win, userId));
  }, [shareMode, userId]);

  const sendSnapshot = useCallback(() => {
    if (!channelRef.current || !userId) return;

    const payload: PresenceSnapshotPayload = {
      userId,
      name: displayName,
      color,
      items: buildItems(),
      windows: buildSharedWindows(),
      activeLayerId,
      lastSeen: Date.now(),
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'presence_snapshot',
      payload,
    });
  }, [activeLayerId, buildItems, buildSharedWindows, color, displayName, userId]);

  const pruneStaleUsers = useCallback(() => {
    const cutoff = Date.now() - 7000;
    // Reads the liveness ref, not the state entries, because the state entries
    // are no longer re-stamped by a beat that changed nothing. Nothing is
    // written to React state unless somebody actually has to disappear, so this
    // costs zero renders on the (overwhelmingly common) tick where every peer is
    // still there.
    let expired: string[] | null = null;
    for (const [id, lastSeen] of remoteLastSeenRef.current) {
      if (lastSeen < cutoff) (expired ||= []).push(id);
    }
    if (!expired) return;
    const expiredIds = expired;
    for (const id of expiredIds) {
      remoteLastSeenRef.current.delete(id);
      knownRemoteIdsRef.current.delete(id);
    }
    setRemotePresence(prev => {
      let changed = false;
      const next = { ...prev };
      for (const id of expiredIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const pruneTyping = useCallback(() => {
    setTypingState(prev => pruneExpiredTyping(prev, Date.now()));
  }, []);

  /**
   * Safe to call on every keystroke — the throttle is here, not at the call
   * site. `decideTypingEmit` lets at most one frame per TYPING_REARM_MS (4s)
   * per target onto the wire, so a 60wpm typist produces 0.25 sends/sec.
   *
   * Do NOT route this through `sendSnapshot()` (which is what it used to do):
   * that is a ~2 KB window payload and this is ~150 bytes. See the header of
   * src/lib/typingPresence.ts.
   */
  const setTyping = useCallback((type: 'chat' | 'document', itemId: string, typing: boolean) => {
    if (!channelRef.current || !userId || !itemId) return;
    const decision = decideTypingEmit(typingEmitRef.current, type, itemId, typing, Date.now());
    typingEmitRef.current = decision.state;
    if (!decision.emit) return;

    const payload: TypingFrame = buildTypingFrame({
      userId,
      name: displayName,
      color,
      scope: type,
      itemId,
      typing,
    });

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload,
    });
  }, [color, displayName, userId]);

  useEffect(() => {
    if (!workspaceId || !userId) {
      remoteLastSeenRef.current.clear();
      setRemotePresence(prev => Object.keys(prev).length ? {} : prev);
      setTypingState(prev => Object.keys(prev).length ? {} : prev);
      return;
    }

    // Narrowing does not survive into the callbacks below, and the self-echo
    // check depends on this being a definite string.
    const localUserId: string = userId;
    const channel = backendClient.channel(`item-presence:${workspaceId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'presence_snapshot' }, ({ payload }: BroadcastPayload<PresenceSnapshotPayload>) => {
        const snapshot = payload;
        if (!snapshot.userId || snapshot.userId === userId) return;
        const isNewPeer = !knownRemoteIdsRef.current.has(snapshot.userId);
        if (isNewPeer) knownRemoteIdsRef.current.add(snapshot.userId);
        // Liveness always lands, in a ref: every peer beats at 2s and the beat
        // is what keeps them out of pruneStaleUsers, but the timestamp itself is
        // never drawn.
        remoteLastSeenRef.current.set(snapshot.userId, snapshot.lastSeen || Date.now());
        setRemotePresence(prev => {
          // Almost every frame IS just that beat — same name, same colour, same
          // layer, same items, same windows. This hook is mounted at the App
          // root, so committing it anyway cost a full-tree re-render per peer
          // per 2s in a workspace where nobody was doing anything.
          if (samePresenceSnapshot(prev[snapshot.userId], snapshot)) return prev;
          return {
            ...prev,
            [snapshot.userId]: {
              userId: snapshot.userId,
              name: snapshot.name,
              color: snapshot.color,
              items: snapshot.items || [],
              windows: snapshot.windows || [],
              activeLayerId: snapshot.activeLayerId || null,
              lastSeen: snapshot.lastSeen || Date.now(),
            },
          };
        });
        if (isNewPeer) sendSnapshot();
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: BroadcastPayload<TypingFrame>) => {
        // The deadline is computed HERE, from this browser's clock, so a peer
        // with a skewed clock cannot shorten or extend the indicator.
        setTypingState(prev => applyTypingFrame(prev, payload, localUserId, Date.now()));
      })
      .on('broadcast', { event: 'presence_leave' }, ({ payload }: BroadcastPayload<{ userId?: string }>) => {
        const leavingId = payload.userId;
        if (!leavingId) return;
        knownRemoteIdsRef.current.delete(leavingId);
        remoteLastSeenRef.current.delete(leavingId);
        setRemotePresence(prev => {
          // A leave for somebody we never held (a peer known only through a
          // typing frame, a duplicate unload beat) must not rebuild the roster.
          if (!(leavingId in prev)) return prev;
          const next = { ...prev };
          delete next[leavingId];
          return next;
        });
        setTypingState(prev => {
          let changed = false;
          const next: TypingState = {};
          for (const [key, bucket] of Object.entries(prev)) {
            if (!bucket[leavingId]) {
              next[key] = bucket;
              continue;
            }
            changed = true;
            const kept = { ...bucket };
            delete kept[leavingId];
            if (Object.keys(kept).length > 0) next[key] = kept;
          }
          return changed ? next : prev;
        });
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          sendSnapshot();
        }
      });

    const handleBeforeUnload = () => {
      channel.send({
        type: 'broadcast',
        event: 'presence_leave',
        payload: { userId },
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [workspaceId, userId, sendSnapshot, pruneStaleUsers]);

  useEffect(() => {
    if (!workspaceId || !userId) return;
    sendSnapshot();
  }, [workspaceId, userId, windows, activeLayerId, sendSnapshot]);

  // A typing frame is itself proof of a peer, and it may arrive before that
  // peer's first snapshot does. Counting it here keeps the heartbeat — and so
  // the typing prune that rides it — at 2s rather than on the slow solo
  // keepalive, which is what bounds an indicator's life to its TTL plus one
  // tick instead of plus the whole keepalive period.
  const hasRemotePeers = Object.keys(remotePresence).length > 0 || Object.keys(typingState).length > 0;

  useEffect(() => {
    if (!workspaceId || !userId) return;

    // Typing expiry rides the existing heartbeat rather than adding a timer:
    // it ticks every 2s while there are peers, which bounds an indicator's
    // overshoot past its 6s TTL to one tick. With no peers it drops right back,
    // and with no peers nobody can be typing at you anyway.
    //
    // Alone in a workspace — the common case — that beat has no listener at all:
    // it serialises every shared window into a ~2 KB frame and pushes it at a
    // socket nobody is on the other end of. Discovery does not depend on it
    // either (a joiner broadcasts on SUBSCRIBED and every peer answers that with
    // a snapshot of its own), so the solo cadence is a slow keepalive.
    heartbeatRef.current = window.setInterval(() => {
      sendSnapshot();
      pruneStaleUsers();
      pruneTyping();
    }, hasRemotePeers ? 2000 : 30000);

    return () => {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [workspaceId, userId, hasRemotePeers, sendSnapshot, pruneStaleUsers, pruneTyping]);

  const { documentPresence, chatPresence, remotePresenceUsers, sharedWindows } = useMemo(() => {
    const documents: Record<string, ItemPresenceUser[]> = {};
    const chats: Record<string, ItemPresenceUser[]> = {};
    const users = Object.values(remotePresence);
    const remoteWindows = users.flatMap(remoteUser =>
      remoteUser.windows.map(win => ({
        ...win,
        id: `remote:${remoteUser.userId}:${win.id}`,
        ownerUserId: remoteUser.userId,
      }))
    );

    users.forEach(user => {
      user.items.forEach(item => {
        const target = item.type === 'document' ? documents : chats;
        if (!target[item.itemId]) target[item.itemId] = [];
        target[item.itemId].push({
          userId: user.userId,
          name: user.name,
          color: user.color,
          typing: !!item.typing,
        });
      });
    });

    // Expiry is applied here as well as on the prune tick: a render triggered
    // by anything else must not resurrect an indicator whose deadline passed
    // between ticks.
    const now = Date.now();

    return {
      documentPresence: mergeTypingIntoPresence(documents, typingState, 'document', now),
      chatPresence: mergeTypingIntoPresence(chats, typingState, 'chat', now),
      remotePresenceUsers: users,
      sharedWindows: remoteWindows,
    };
  }, [remotePresence, typingState]);

  return {
    documentPresence,
    chatPresence,
    remotePresenceUsers,
    sharedWindows,
    setTyping,
  };
}
