import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiAuthHeaders, apiUrl } from '../lib/backendClient';
import { useTableSubscription, useRealtimeDeduper } from './useTableSubscription';
import { useWorkspaceListState } from './useWorkspaceState';
import type { AgentConnection } from '../types';

// The daemon heartbeats every 15s (AGENSIS_HEARTBEAT_MS). A connection whose
// last_seen_at is older than this is treated as offline regardless of its stored
// `status`, so the UI stops showing a dead daemon as "online" even if the
// lifecycle event that flips the DB row never reaches us. 3x the heartbeat gives
// margin for a single missed beat / network jitter.
const STALE_AFTER_MS = 45_000;
// Safety-net refetch cadence. Staleness itself no longer waits for this poll —
// the effect below schedules a single timer for the exact instant the next
// heartbeat crosses STALE_AFTER_MS — so all this has to catch is the case where
// realtime is not delivering at all (a socket that died quietly, a row inserted
// while we were disconnected). That is rare, an idle workspace is the norm, and
// every poll used to cost four App-root re-renders, so it runs a minute apart,
// only while the window is visible, and commits nothing when the rows come back
// unchanged.
const POLL_INTERVAL_MS = 60_000;

// Rows are only re-committed when something we derive from them actually moved.
// A poll response is byte-identical to what realtime already delivered nearly
// every time, and replacing the array anyway hands every consumer (sidebar dot,
// presence list, participant chips, useWorkspacePresence's memo) a new identity
// and defeats their memoisation. `updated_at` is bumped by every server-side
// write to the row, so it covers the columns not compared field-by-field here
// (metadata, capabilities).
function sameConnectionRow(before: AgentConnection, after: AgentConnection): boolean {
  return before === after || (
    before.id === after.id
    && before.status === after.status
    && before.last_seen_at === after.last_seen_at
    && before.updated_at === after.updated_at
    && before.agent_id === after.agent_id
    && before.name === after.name
    && before.handle === after.handle
    && before.host === after.host
    && before.cwd === after.cwd
    && before.connected_at === after.connected_at
  );
}

function sameConnectionRows(previous: AgentConnection[], next: AgentConnection[]): boolean {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    if (!sameConnectionRow(previous[i], next[i])) return false;
  }
  return true;
}

function isConnectionStale(connection: AgentConnection, nowMs: number): boolean {
  const seen = connection.last_seen_at ? new Date(connection.last_seen_at).getTime() : NaN;
  if (Number.isNaN(seen)) return false; // unparseable timestamp: trust stored status
  return nowMs - seen > STALE_AFTER_MS;
}

// Coerce a connection's status to 'offline' when its heartbeat has gone stale.
function withEffectiveStatus(connection: AgentConnection, nowMs: number): AgentConnection {
  if (connection.status !== 'offline' && isConnectionStale(connection, nowMs)) {
    return { ...connection, status: 'offline' };
  }
  return connection;
}

export function useAgentConnections(workspaceId: string | null, seed?: AgentConnection[] | null) {
  const workspaceKey = normalizeWorkspaceId(workspaceId);
  const [connections, setConnections] = useWorkspaceListState<AgentConnection>(
    workspaceKey || null,
    (seed || []).filter(connection => connection.workspace_id === workspaceKey),
  );
  const [loading, setLoading] = useState(false);
  const [realtimeWorkspaceId, setRealtimeWorkspaceId] = useState<string | null>(null);
  const workspaceRequestRef = useRef({ workspaceKey, generation: 0 });
  if (workspaceRequestRef.current.workspaceKey !== workspaceKey) {
    workspaceRequestRef.current = {
      workspaceKey,
      generation: workspaceRequestRef.current.generation + 1,
    };
  }
  // Bootstrap seed is a one-shot cold paint. Once the dedicated connections
  // endpoint has answered for this workspace, it is authoritative (it reconciles
  // against live sockets). Letting seed re-apply after that fetch was the
  // "green for ~10s then offline" flash: bootstrap painted DB-online rows, then
  // the poll/reconcile corrected them — or worse, a late seed stomped a correct
  // offline fetch back to green until the next poll.
  const fetchedForWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    fetchedForWorkspaceRef.current = null;
  }, [workspaceKey]);

  useEffect(() => {
    if (!seed) return;
    if (fetchedForWorkspaceRef.current === workspaceKey) return;
    const seeded = seed.filter(connection => connection.workspace_id === workspaceKey);
    setConnections(prev => sameConnectionRows(prev, seeded) ? prev : seeded);
  }, [seed, setConnections, workspaceKey]);

  // `quiet` is what the background poll passes: the spinner belongs to the cold
  // fetch and to the explicit "refresh" in settings, where somebody is waiting
  // on it. On a poll the await splits the batch, so the true/false pair alone
  // was two whole App renders every cycle for a fetch nobody asked for.
  const fetchConnections = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true;
    const request = workspaceRequestRef.current;
    const isCurrent = () => workspaceRequestRef.current === request;
    if (!workspaceKey) {
      setConnections(prev => prev.length === 0 ? prev : []);
      setRealtimeWorkspaceId(null);
      setLoading(false);
      fetchedForWorkspaceRef.current = null;
      return;
    }
    setRealtimeWorkspaceId(prev => prev === workspaceKey ? prev : null);
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(apiUrl(`/backend/agents/connections?workspaceId=${encodeURIComponent(workspaceKey)}`), {
        headers: apiAuthHeaders(),
      });
      const payload = await response.json().catch(() => null);
      if (!isCurrent()) return;
      if (response.ok && Array.isArray(payload?.data)) {
        fetchedForWorkspaceRef.current = workspaceKey;
        const rows = payload.data as AgentConnection[];
        setConnections(prev => sameConnectionRows(prev, rows) ? prev : rows);
        setRealtimeWorkspaceId(workspaceKey);
        return;
      }
      fetchedForWorkspaceRef.current = workspaceKey;
      setConnections(prev => prev.length === 0 ? prev : []);
      setRealtimeWorkspaceId(null);
    } catch {
      if (!isCurrent()) return;
      // Keep seed / last good paint on transient network errors — do not mark
      // fetched, so a later seed can still apply if we never got a 2xx.
      setRealtimeWorkspaceId(null);
    } finally {
      if (isCurrent() && !quiet) setLoading(false);
    }
  }, [setConnections, workspaceKey]);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  // Poll so a row that realtime never told us about (an INSERT we missed while
  // disconnected, a status that changed behind a dead socket) is still picked up.
  // A hidden window shows nobody a wrong light, so it does not poll at all; the
  // visibilitychange handler refetches once on the way back so the first glance
  // after switching to the app is current rather than up to a minute old.
  useEffect(() => {
    if (!workspaceKey) return;
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      void fetchConnections({ quiet: true });
    };
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchConnections({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [workspaceKey, fetchConnections]);

  // Re-derivation of staleness between fetches/events, so a light goes out on
  // schedule even with no incoming data. This used to be a blind interval, which
  // meant a re-render of the App root every POLL_INTERVAL_MS forever to compute
  // an answer that changes only at a known instant. Instead: aim ONE timer at
  // the earliest moment a heartbeat can cross the cutoff. When nothing can go
  // stale — every row already offline, or none carries a parseable heartbeat —
  // no timer is installed at all, which is the idle-workspace case.
  const [staleTick, setStaleTick] = useState(0);
  useEffect(() => {
    const nowMs = Date.now();
    let soonest = Infinity;
    for (const connection of connections) {
      if (connection.status === 'offline') continue;
      const seen = connection.last_seen_at ? new Date(connection.last_seen_at).getTime() : NaN;
      if (Number.isNaN(seen)) continue;
      const goesStaleAt = seen + STALE_AFTER_MS;
      if (goesStaleAt > nowMs && goesStaleAt < soonest) soonest = goesStaleAt;
    }
    if (soonest === Infinity) return;
    // A row dated far in the future (a daemon with a skewed clock) would ask
    // setTimeout for a delay past its 32-bit ceiling, which fires immediately
    // and spins. Cap it: the poll re-reads such a row long before an hour is up.
    // The small margin past the cutoff guarantees the re-derivation below sees
    // the row as stale, so this effect cannot re-arm for the same instant.
    const delay = Math.min(soonest - nowMs + 250, 3_600_000);
    const id = window.setTimeout(() => setStaleTick(tick => tick + 1), delay);
    return () => window.clearTimeout(id);
  }, [connections, staleTick]);

  const deduper = useRealtimeDeduper();
  useTableSubscription<AgentConnection>(
    {
      enabled: !!workspaceKey && realtimeWorkspaceId === workspaceKey,
      channelName: `agent_connections:${workspaceKey}`,
      table: 'agent_connections',
      event: '*',
      schema: 'public',
      filter: `workspace_id=eq.${workspaceKey}`,
    },
    (payload) => {
      if (workspaceRequestRef.current.workspaceKey !== workspaceKey) return;
      const rowWorkspaceId = payload.new?.workspace_id || payload.old?.workspace_id;
      if (rowWorkspaceId !== workspaceKey) return;
      if (!deduper.shouldProcess(payload)) return;
      if (payload.eventType === 'INSERT') {
        const row = payload.new;
        if (!row) return;
        setConnections(prev => [row, ...prev.filter(connection => connection.id !== row.id)]);
      } else if (payload.eventType === 'UPDATE') {
        const row = payload.new;
        if (!row) return;
        setConnections(prev => {
          // `map` allocated a new array even when it changed nothing — for a row
          // we do not hold (already deleted locally, or older than the 24h window
          // the fetch selects) or for a re-delivery of one we already have. Both
          // are no-ops that used to re-render the App root and every consumer.
          const index = prev.findIndex(connection => connection.id === row.id);
          if (index === -1) return prev;
          if (sameConnectionRow(prev[index], row)) return prev;
          const next = [...prev];
          next[index] = row;
          return next;
        });
      } else if (payload.eventType === 'DELETE') {
        const row = payload.old;
        if (!row?.id) return;
        setConnections(prev => prev.some(connection => connection.id === row.id)
          ? prev.filter(connection => connection.id !== row.id)
          : prev);
      }
    },
  );

  // Expose connections with heartbeat-derived status so every consumer (sidebar
  // status dot, presence list, chat participant chip) reflects real liveness.
  const effectiveConnections = useMemo(() => {
    void staleTick; // recompute when a heartbeat crosses the cutoff
    const nowMs = Date.now();
    let flipped = false;
    const derived = connections.map(connection => {
      const next = withEffectiveStatus(connection, nowMs);
      if (next !== connection) flipped = true;
      return next;
    });
    // Hand back the SAME array when no row's derived status differs. A tick that
    // flips nothing must cost nothing: this value is a dependency of
    // useWorkspacePresence and is passed down to the sidebar and every chat
    // window, so a gratuitous new identity re-renders all of them.
    return flipped ? derived : connections;
  }, [connections, staleTick]);

  return { connections: effectiveConnections, loading, refetch: fetchConnections };
}

function normalizeWorkspaceId(value: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}
