import { useEffect, useMemo, useRef } from 'react';
import { registerWebMcpTool, type WebMcpTool, type WebMcpUnregister } from '../lib/webmcp/provider';
import { descriptorSignature, makeGuardedExecute } from '../lib/webmcp/toolBinding';

/**
 * Register WebMCP tools for as long as a component is mounted.
 *
 * Tools are scoped to the component that declares them, which is the point: an
 * agent looking at a channel should see `post_message`; an agent on the agents
 * screen should see `list_agents`. Navigate away and the tool set narrows by
 * itself, because the component unmounted. No central registry to keep in sync,
 * and no way for a stale tool to linger and act on a view the human has left.
 *
 * The interesting behaviour (when re-registration is warranted, and what an agent
 * sees when it calls a tool whose view has closed) lives in `webmcp/toolBinding`
 * so it can be tested without a DOM renderer.
 */
export function useWebMcpTools(tools: WebMcpTool[]): void {
  // Latest tools, readable from inside a registration made on an earlier render.
  const latest = useRef<WebMcpTool[]>(tools);
  latest.current = tools;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const signature = useMemo(() => descriptorSignature(tools), [tools]);

  useEffect(() => {
    const snapshot = latest.current;
    if (snapshot.length === 0) return;

    const unregisters: WebMcpUnregister[] = snapshot.map(tool =>
      registerWebMcpTool({
        ...tool,
        execute: makeGuardedExecute(tool.name, {
          getTools: () => latest.current,
          isMounted: () => mounted.current,
        }),
      })
    );

    return () => {
      for (const unregister of unregisters) unregister();
    };
    // `signature` is the real dependency: it changes only when the browser-visible
    // shape of the tools changes, never merely because `execute` was re-created
    // by a re-render. See descriptorSignature.
  }, [signature]);
}

/** Single-tool convenience. Pass `null` to register nothing (e.g. no active channel). */
export function useWebMcpTool(tool: WebMcpTool | null): void {
  const tools = useMemo(() => (tool ? [tool] : []), [tool]);
  useWebMcpTools(tools);
}
