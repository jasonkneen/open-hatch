import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// THE BUG: the bell said "What's new" and clicking it did nothing.
//
// The 'updated' row rendered that phrase as a heading with no control beneath
// it and no handler on the row, so the only thing that ever opened the release
// notes was the dialog opening itself. Worse, the row was gated on that dialog
// being OPEN — so it mirrored a panel already on screen and disappeared the
// moment you dismissed it, leaving no route back.
//
// These assert the row is reachable and actionable, which is the whole point of
// putting an update in a notification centre.
//
// NOTE: .ts, not .tsx — the runner's include glob is tests/unit/**/*.test.ts,
// so a .tsx file here is collected by nothing and silently never runs.

vi.mock('../../src/hooks/useAgentRegistrations', () => ({
  useAgentRegistrations: () => ({ pending: [], approve: vi.fn(), deny: vi.fn() }),
}));
vi.mock('../../src/hooks/useActivity', () => ({ useActivity: () => ({ events: [] }) }));

const { NotificationsBell } = await import('../../src/components/notifications/NotificationsBell');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function mount(updateNotif: unknown) {
  act(() => {
    root.render(createElement(NotificationsBell, {
      workspaceId: 'w1',
      variant: 'inline',
      updateNotif,
    } as never));
  });
}

/** Opens the bell popover, then returns every button on the page. */
function openBell(): HTMLButtonElement[] {
  const trigger = container.querySelector('button');
  act(() => { trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  // The popover portals to document.body, not into `container`.
  return Array.from(document.body.querySelectorAll('button'));
}

const WHATS_NEW = 'What’s new';

const notif = (over: Record<string, unknown> = {}) => ({
  open: false,
  mode: 'updated',
  hasUnseenNotes: true,
  onReload: vi.fn(),
  onShowNotes: vi.fn(),
  ...over,
});

describe('the update row in the notifications bell', () => {
  it('offers a What’s new control that opens the notes', () => {
    const update = notif();
    mount(update);

    const whatsNew = openBell().find(b => b.textContent?.includes(WHATS_NEW));
    expect(whatsNew, 'the bell renders no What’s new control').toBeDefined();

    act(() => { whatsNew?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(update.onShowNotes).toHaveBeenCalledTimes(1);
  });

  it('survives the dialog being closed', () => {
    // open:false is the case that used to render nothing at all.
    mount(notif({ open: false }));
    expect(openBell().some(b => b.textContent?.includes(WHATS_NEW))).toBe(true);
  });

  it('still offers Reload when a newer build is waiting', () => {
    const update = notif({ mode: 'available' });
    mount(update);

    const reload = openBell().find(b => b.textContent?.includes('Reload now'));
    expect(reload).toBeDefined();
    act(() => { reload?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(update.onReload).toHaveBeenCalledTimes(1);
  });

  it('shows no update row when there is nothing to announce', () => {
    mount(null);
    expect(openBell().some(b => b.textContent?.includes(WHATS_NEW))).toBe(false);
  });
});
