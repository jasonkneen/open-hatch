/**
 * WebMCP provider adapter.
 *
 * WebMCP (W3C Web Machine Learning CG) lets a page hand an in-browser AI agent a
 * set of callable tools instead of making it screen-scrape the DOM. For agensis
 * this is the inverse of `server/mcp.cjs`: that door is "an external client dials
 * our HTTP server with a bearer token"; this one is "the page the human is already
 * signed into offers tools to whatever agent is driving the browser". No token, no
 * config file — which is the entire point.
 *
 * THE REASON THIS FILE EXISTS: the API moved, and the ecosystem did not move with
 * it. Three incompatible shapes are in the wild right now:
 *
 *   1. `document.modelContext.registerTool(tool, { signal })`  — the current draft.
 *      Async, and you unregister by aborting the signal you passed in.
 *   2. `navigator.modelContext.registerTool(tool)`             — the earlier draft,
 *      still what Chrome's origin trial and most tutorials expose. Sync, paired
 *      with `unregisterTool(name)`.
 *   3. `navigator.modelContext.provideContext({ tools: [...] })` — what the popular
 *      `@mcp-b/global` polyfill ships. There is no per-tool registration at all:
 *      every call REPLACES the whole tool set, so a caller that naively calls it
 *      twice silently deletes the first tool.
 *
 * Callers must not care which one is present. Everything above this file talks to
 * `registerWebMcpTool()` and gets back a plain sync unregister function; the three
 * flavours are normalised here and nowhere else.
 */

/** An MCP tool result. Matches the MCP content-block convention that the polyfill
 *  bridges expect when they forward a page tool to Claude/ChatGPT. */
export interface WebMcpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface WebMcpToolAnnotations {
  /** Tool has no side effects. Lets an agent call it without confirming. */
  readOnlyHint?: boolean;
  /**
   * Tool returns content agensis did not author — message bodies, doc text, agent
   * output. Every one of those is attacker-reachable: anyone who can post in a
   * channel can write "ignore previous instructions" into a tool result. Setting
   * this tells the consuming agent to treat the payload as data, not instruction.
   */
  untrustedContentHint?: boolean;
}

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMcpToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ) => Promise<WebMcpToolResult>;
}

/** Which of the three shapes we found, or why we found none. */
export type WebMcpFlavor =
  | 'document'          // current draft: document.modelContext.registerTool
  | 'navigator'         // earlier draft: navigator.modelContext.registerTool
  | 'provide-context'   // @mcp-b/global polyfill: provideContext({ tools })
  | 'unsupported';

export interface WebMcpStatus {
  available: boolean;
  flavor: WebMcpFlavor;
  /** WebMCP is gated on secure context. http:// pages get nothing (localhost counts). */
  secureContext: boolean;
}

/** Unregister handle. Safe to call twice, and safe to call before an async
 *  registration has settled — see `registerWebMcpTool`. */
export type WebMcpUnregister = () => void;

interface ModelContextLike {
  registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown;
  unregisterTool?: (name: string) => unknown;
  provideContext?: (context: { tools: unknown[] }) => unknown;
}

function globalDocument(): (Document & { modelContext?: ModelContextLike }) | null {
  return typeof document === 'undefined' ? null : (document as Document & { modelContext?: ModelContextLike });
}

function globalNavigator(): (Navigator & { modelContext?: ModelContextLike }) | null {
  return typeof navigator === 'undefined' ? null : (navigator as Navigator & { modelContext?: ModelContextLike });
}

function isSecure(): boolean {
  if (typeof window === 'undefined') return false;
  // isSecureContext is true for https:// AND http://localhost, so local dev works.
  return window.isSecureContext !== false;
}

/**
 * Resolve the host object once per call rather than caching it at module load.
 *
 * Deliberate: the `@mcp-b/global` polyfill installs itself asynchronously, and an
 * extension-injected provider can appear after first paint. A module-level cache
 * would latch "unsupported" from whenever this file happened to be imported and
 * never recover, so every registration re-checks.
 */
function resolveTarget(): { ctx: ModelContextLike; flavor: WebMcpFlavor } | null {
  if (!isSecure()) return null;

  const doc = globalDocument();
  if (doc?.modelContext && typeof doc.modelContext.registerTool === 'function') {
    return { ctx: doc.modelContext, flavor: 'document' };
  }

  const nav = globalNavigator();
  if (nav?.modelContext) {
    if (typeof nav.modelContext.registerTool === 'function') {
      return { ctx: nav.modelContext, flavor: 'navigator' };
    }
    if (typeof nav.modelContext.provideContext === 'function') {
      return { ctx: nav.modelContext, flavor: 'provide-context' };
    }
  }

  return null;
}

export function getWebMcpStatus(): WebMcpStatus {
  const secureContext = isSecure();
  const target = resolveTarget();
  return {
    available: target !== null,
    flavor: target?.flavor ?? 'unsupported',
    secureContext,
  };
}

/**
 * Live tool set for the `provide-context` flavour.
 *
 * That API has no concept of "add one tool" — `provideContext` swaps the entire
 * set. So we own the set here and re-provide the whole thing on every add/remove.
 * Without this, mounting a second component would wipe the first one's tools.
 */
const provideContextRegistry = new Map<string, WebMcpTool>();

function republishProvideContext(ctx: ModelContextLike): void {
  ctx.provideContext?.({ tools: Array.from(provideContextRegistry.values()) });
}

/**
 * Register one tool. Returns a sync unregister function.
 *
 * Registering a duplicate name replaces the previous one rather than throwing:
 * React strict mode double-invokes effects, and a route re-render legitimately
 * re-registers the same tool. Throwing there would make correct code crash in dev.
 */
export function registerWebMcpTool(tool: WebMcpTool): WebMcpUnregister {
  const target = resolveTarget();
  if (!target) return () => {};

  const { ctx, flavor } = target;

  if (flavor === 'provide-context') {
    provideContextRegistry.set(tool.name, tool);
    republishProvideContext(ctx);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      provideContextRegistry.delete(tool.name);
      republishProvideContext(ctx);
    };
  }

  if (flavor === 'document') {
    // Current draft: unregistration is the abort signal, and registerTool is async.
    const controller = new AbortController();
    let done = false;
    try {
      const result = ctx.registerTool?.(tool, { signal: controller.signal });
      // Async and may reject (duplicate name, schema rejected by the UA). An
      // unhandled rejection here would surface as a page error for something the
      // page can function perfectly well without, so swallow it to a warning.
      void Promise.resolve(result).catch((err: unknown) => {
        console.warn(`[webmcp] registerTool("${tool.name}") rejected`, err);
      });
    } catch (err) {
      console.warn(`[webmcp] registerTool("${tool.name}") threw`, err);
      return () => {};
    }
    return () => {
      if (done) return;
      done = true;
      // Aborting before the promise settles is fine and is the documented way to
      // cancel an in-flight registration — this is why unregister stays sync.
      controller.abort();
    };
  }

  // flavor === 'navigator': earlier draft, sync register + unregisterTool(name).
  try {
    ctx.registerTool?.(tool);
  } catch (err) {
    console.warn(`[webmcp] registerTool("${tool.name}") threw`, err);
    return () => {};
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    try {
      ctx.unregisterTool?.(tool.name);
    } catch (err) {
      console.warn(`[webmcp] unregisterTool("${tool.name}") threw`, err);
    }
  };
}

/** Convenience builders so tool implementations stop hand-rolling the content shape. */
export function textResult(text: string): WebMcpToolResult {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(text: string): WebMcpToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/** Test seam: `provide-context` state is module-level, so tests must be able to
 *  reset it between cases. Not for production callers. */
export function __resetWebMcpRegistryForTests(): void {
  provideContextRegistry.clear();
}
