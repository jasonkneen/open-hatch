/**
 * The parts of WebMCP tool binding that do not need React.
 *
 * `useWebMcpTools` is a thin shell over these two functions. Keeping them here
 * means the tricky behaviour — when a re-registration is warranted, and what an
 * agent sees when it calls a tool whose view has closed — is testable without a
 * DOM renderer.
 */

import { errorResult, type WebMcpTool, type WebMcpToolResult } from './provider';

/**
 * Everything the browser is told about a set of tools, as a comparable string.
 *
 * `execute` is deliberately excluded. It is a fresh closure on every React render,
 * so including it would re-register on every render — pointless churn, and with
 * the `provide-context` polyfill flavour every re-registration is a full swap of
 * the tool list, so an agent enumerating tools at the wrong moment could see a
 * partial set. Everything the agent actually *reads* is in here, and nothing else.
 */
export function descriptorSignature(tools: WebMcpTool[]): string {
  return JSON.stringify(
    tools.map(t => [
      t.name,
      t.title ?? null,
      t.description,
      t.inputSchema ?? null,
      t.annotations ?? null,
    ])
  );
}

export interface GuardedExecuteContext {
  /** Current tools. Read at call time, not at registration time, so a tool always
   *  runs against current props rather than the render that registered it. */
  getTools: () => WebMcpTool[];
  /** False once the owning view has unmounted. */
  isMounted: () => boolean;
}

/**
 * Wrap a tool's `execute` so that a call is always answered.
 *
 * Three things can go wrong between an agent picking a tool and the call landing,
 * and none of them may surface as a rejected promise — an MCP client treats a
 * rejection as a transport fault, whereas a result with `isError` is something the
 * agent can read and recover from:
 *
 *  - the view unmounted (user navigated away mid-call)
 *  - the tool was removed from the set but the agent still holds its name
 *  - the implementation threw, synchronously or asynchronously
 */
export function makeGuardedExecute(
  name: string,
  ctx: GuardedExecuteContext
): WebMcpTool['execute'] {
  return (input, options): Promise<WebMcpToolResult> => {
    if (!ctx.isMounted()) {
      return Promise.resolve(
        errorResult(`Tool "${name}" is no longer available — the view that provided it has closed.`)
      );
    }
    const live = ctx.getTools().find(t => t.name === name);
    if (!live) {
      return Promise.resolve(errorResult(`Tool "${name}" is no longer available.`));
    }
    try {
      return Promise.resolve(live.execute(input, options)).catch((err: unknown) =>
        errorResult(`Tool "${name}" failed: ${describe(err)}`)
      );
    } catch (err) {
      // A synchronous throw from a non-async `execute`.
      return Promise.resolve(errorResult(`Tool "${name}" failed: ${describe(err)}`));
    }
  };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
