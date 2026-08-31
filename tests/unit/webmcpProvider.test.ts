import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetWebMcpRegistryForTests,
  getWebMcpStatus,
  registerWebMcpTool,
  textResult,
  type WebMcpTool,
} from '../../src/lib/webmcp/provider';
import { descriptorSignature, makeGuardedExecute } from '../../src/lib/webmcp/toolBinding';

/**
 * These tests exist because WebMCP shipped three incompatible API shapes and the
 * page has to work under all of them. Each `describe` below pins one shape.
 */

function tool(name: string, overrides: Partial<WebMcpTool> = {}): WebMcpTool {
  return {
    name,
    description: `does ${name}`,
    execute: async () => textResult('ok'),
    ...overrides,
  };
}

function setSecure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true, writable: true });
}

function installDocumentFlavor(registerTool: (t: unknown, o?: { signal?: AbortSignal }) => unknown) {
  Object.defineProperty(document, 'modelContext', {
    value: { registerTool },
    configurable: true,
    writable: true,
  });
}

function installNavigatorFlavor(ctx: Record<string, unknown>) {
  Object.defineProperty(navigator, 'modelContext', { value: ctx, configurable: true, writable: true });
}

function clearProviders() {
  // @ts-expect-error - deleting an optional test-installed property
  delete document.modelContext;
  // @ts-expect-error - deleting an optional test-installed property
  delete navigator.modelContext;
}

afterEach(() => {
  clearProviders();
  setSecure(true);
  __resetWebMcpRegistryForTests();
  vi.restoreAllMocks();
});

describe('getWebMcpStatus', () => {
  it('reports unsupported when no provider is present', () => {
    clearProviders();
    setSecure(true);
    expect(getWebMcpStatus()).toEqual({ available: false, flavor: 'unsupported', secureContext: true });
  });

  it('refuses to use a provider on an insecure page', () => {
    // WebMCP is gated on secure context. Registering anyway would be a silent
    // no-op at best; we would rather report it accurately.
    installDocumentFlavor(() => Promise.resolve());
    setSecure(false);
    expect(getWebMcpStatus()).toEqual({ available: false, flavor: 'unsupported', secureContext: false });
  });

  it('prefers document.modelContext over navigator.modelContext', () => {
    // The current draft moved to document.*; when a polyfill has also installed
    // navigator.*, the standard one must win.
    installDocumentFlavor(() => Promise.resolve());
    installNavigatorFlavor({ registerTool: () => {}, unregisterTool: () => {} });
    expect(getWebMcpStatus().flavor).toBe('document');
  });

  it('detects the provideContext polyfill shape', () => {
    installNavigatorFlavor({ provideContext: () => {} });
    expect(getWebMcpStatus().flavor).toBe('provide-context');
  });
});

describe('registerWebMcpTool — no provider', () => {
  it('returns a no-op unregister instead of throwing', () => {
    clearProviders();
    const unregister = registerWebMcpTool(tool('a'));
    expect(() => unregister()).not.toThrow();
  });
});

describe('registerWebMcpTool — document flavor (current draft)', () => {
  it('passes an AbortSignal and aborts it on unregister', () => {
    let captured: AbortSignal | undefined;
    installDocumentFlavor((_t, o) => {
      captured = o?.signal;
      return Promise.resolve();
    });

    const unregister = registerWebMcpTool(tool('a'));
    expect(captured).toBeInstanceOf(AbortSignal);
    expect(captured!.aborted).toBe(false);

    unregister();
    expect(captured!.aborted).toBe(true);
  });

  it('is idempotent — a second unregister does nothing', () => {
    installDocumentFlavor(() => Promise.resolve());
    const unregister = registerWebMcpTool(tool('a'));
    unregister();
    expect(() => unregister()).not.toThrow();
  });

  it('swallows a rejected registration into a warning', async () => {
    // A UA may reject a duplicate name or a schema it dislikes. That must not
    // become an unhandled rejection on a page that works fine without the tool.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installDocumentFlavor(() => Promise.reject(new Error('duplicate name')));
    registerWebMcpTool(tool('a'));
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
  });

  it('survives a synchronous throw from registerTool', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    installDocumentFlavor(() => {
      throw new Error('nope');
    });
    expect(() => registerWebMcpTool(tool('a'))()).not.toThrow();
  });
});

describe('registerWebMcpTool — navigator flavor (earlier draft)', () => {
  it('registers then unregisters by name', () => {
    const registerTool = vi.fn();
    const unregisterTool = vi.fn();
    installNavigatorFlavor({ registerTool, unregisterTool });

    const unregister = registerWebMcpTool(tool('search'));
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect((registerTool.mock.calls[0][0] as WebMcpTool).name).toBe('search');

    unregister();
    expect(unregisterTool).toHaveBeenCalledWith('search');
  });
});

describe('registerWebMcpTool — provideContext flavor (polyfill)', () => {
  it('keeps earlier tools when a second one registers', () => {
    // THE REGRESSION THIS GUARDS: provideContext REPLACES the whole tool set.
    // A naive adapter that forwards each registration directly would delete
    // every previously registered tool the moment a second component mounted.
    const provideContext = vi.fn();
    installNavigatorFlavor({ provideContext });

    registerWebMcpTool(tool('first'));
    registerWebMcpTool(tool('second'));

    const lastCall = provideContext.mock.calls.at(-1)![0] as { tools: WebMcpTool[] };
    expect(lastCall.tools.map(t => t.name).sort()).toEqual(['first', 'second']);
  });

  it('removes only the unregistered tool', () => {
    const provideContext = vi.fn();
    installNavigatorFlavor({ provideContext });

    const offFirst = registerWebMcpTool(tool('first'));
    registerWebMcpTool(tool('second'));
    offFirst();

    const lastCall = provideContext.mock.calls.at(-1)![0] as { tools: WebMcpTool[] };
    expect(lastCall.tools.map(t => t.name)).toEqual(['second']);
  });

  it('replaces rather than duplicates when the same name registers twice', () => {
    // React strict mode double-invokes effects; a re-render legitimately
    // re-registers the same name. Two entries would be a bug.
    const provideContext = vi.fn();
    installNavigatorFlavor({ provideContext });

    registerWebMcpTool(tool('dup', { description: 'v1' }));
    registerWebMcpTool(tool('dup', { description: 'v2' }));

    const lastCall = provideContext.mock.calls.at(-1)![0] as { tools: WebMcpTool[] };
    expect(lastCall.tools).toHaveLength(1);
    expect(lastCall.tools[0].description).toBe('v2');
  });
});

describe('descriptorSignature', () => {
  it('ignores execute identity', () => {
    // The whole point: a re-render produces a new closure but must not cause a
    // re-registration.
    const a = tool('a', { execute: async () => textResult('one') });
    const b = tool('a', { execute: async () => textResult('two') });
    expect(descriptorSignature([a])).toBe(descriptorSignature([b]));
  });

  it('changes when agent-visible metadata changes', () => {
    const a = tool('a', { description: 'before' });
    const b = tool('a', { description: 'after' });
    expect(descriptorSignature([a])).not.toBe(descriptorSignature([b]));
  });

  it('changes when the input schema changes', () => {
    const a = tool('a', { inputSchema: { type: 'object', properties: {} } });
    const b = tool('a', { inputSchema: { type: 'object', properties: { x: { type: 'string' } } } });
    expect(descriptorSignature([a])).not.toBe(descriptorSignature([b]));
  });
});

describe('makeGuardedExecute', () => {
  const live = [tool('a', { execute: async () => textResult('ran') })];

  it('runs the current implementation, not the one captured at registration', async () => {
    let current = tool('a', { execute: async () => textResult('v1') });
    const guarded = makeGuardedExecute('a', { getTools: () => [current], isMounted: () => true });
    current = tool('a', { execute: async () => textResult('v2') });
    await expect(guarded({})).resolves.toEqual(textResult('v2'));
  });

  it('returns an error result rather than rejecting when unmounted', async () => {
    const guarded = makeGuardedExecute('a', { getTools: () => live, isMounted: () => false });
    const result = await guarded({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no longer available');
  });

  it('returns an error result when the tool has left the set', async () => {
    const guarded = makeGuardedExecute('gone', { getTools: () => live, isMounted: () => true });
    const result = await guarded({});
    expect(result.isError).toBe(true);
  });

  it('converts an async throw into an error result', async () => {
    const throwing = [tool('a', { execute: async () => { throw new Error('boom'); } })];
    const guarded = makeGuardedExecute('a', { getTools: () => throwing, isMounted: () => true });
    const result = await guarded({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('boom');
  });

  it('converts a synchronous throw into an error result', async () => {
    // A non-async `execute` that throws would otherwise escape the .catch().
    const throwing = [
      tool('a', {
        execute: (() => {
          throw new Error('sync boom');
        }) as unknown as WebMcpTool['execute'],
      }),
    ];
    const guarded = makeGuardedExecute('a', { getTools: () => throwing, isMounted: () => true });
    const result = await guarded({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('sync boom');
  });
});
