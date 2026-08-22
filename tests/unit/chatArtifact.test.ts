import { describe, it, expect } from 'vitest';
import { extractHtmlArtifact } from '../../src/components/chat/ChatArtifact';

// The bug this file exists for: a prose answer that MENTIONED `<html>` inside a
// code span had its tail sliced off and re-rendered as an applet iframe, so the
// rest of the message arrived as a white box of raw markdown.
describe('extractHtmlArtifact', () => {
  it('does not turn a code review that mentions <html> into an artifact', () => {
    const content = [
      'Two amplifiers worth closing:',
      '',
      '- `CanvasObjectRenderer.tsx:219` observes the `style` attribute on `<html>`.',
      '- `Sidebar.tsx:601` writes four `--workspace-viewport-*` properties to `<html>`',
      '  on every animation frame of a sidebar drag.',
      '',
      'Neither is what your log shows, but both are real.',
    ].join('\n');
    expect(extractHtmlArtifact(content)).toBeNull();
  });

  it('ignores a document start that only appears inside a fenced block', () => {
    const content = `Here is the shape an applet has to take:

\`\`\`
<html><body>${'x'.repeat(400)}</body></html>
\`\`\`

That is the whole contract.`;
    expect(extractHtmlArtifact(content)).toBeNull();
  });

  it('refuses a bare tag with no document behind it', () => {
    expect(extractHtmlArtifact('The parser bails on <html> when the doctype is missing.')).toBeNull();
  });

  it('still extracts a real unfenced document, and keeps the prose before it', () => {
    const body = `<p>${'a'.repeat(400)}</p>`;
    const content = `Here is the applet you asked for.\n\n<!doctype html>\n<html><head><title>Timer</title></head><body>${body}</body></html>`;
    const artifact = extractHtmlArtifact(content);
    expect(artifact).not.toBeNull();
    expect(artifact?.title).toBe('Timer');
    expect(artifact?.remainingText).toBe('Here is the applet you asked for.');
    expect(artifact?.html.startsWith('<!doctype html>')).toBe(true);
  });

  it('still extracts a fenced html applet', () => {
    const html = `<html><head><title>Counter</title></head><body>${'b'.repeat(400)}</body></html>`;
    const artifact = extractHtmlArtifact(`Done:\n\n\`\`\`html\n${html}\n\`\`\``);
    expect(artifact?.title).toBe('Counter');
    expect(artifact?.remainingText).toBe('Done:');
  });

  it('still refuses a fenced snippet that is too short to be an applet', () => {
    expect(extractHtmlArtifact('```html\n<b>hi</b>\n```')).toBeNull();
  });
});
