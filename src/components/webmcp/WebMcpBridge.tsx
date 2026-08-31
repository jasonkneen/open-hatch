import { useMemo } from 'react';
import { useWebMcpTools } from '../../hooks/useWebMcpTools';
import { errorResult, textResult, type WebMcpTool } from '../../lib/webmcp/provider';
import type { ChatSession, WorkspaceAgent } from '../../types';

/**
 * Exposes a small set of agensis actions to whatever AI agent is driving the
 * browser, via WebMCP (`document.modelContext`).
 *
 * WHY THIS IS NOT A SECOND MCP SERVER: `server/mcp.cjs` already implements 50
 * tools and owns authorization. These page tools are a deliberately thin,
 * curated subset that drive the *UI the human is already looking at* — they call
 * the same handlers the buttons call. Two divergent tool registries would be a
 * maintenance trap and a security one, so nothing here talks to the database.
 *
 * SECURITY MODEL — read this before adding a tool:
 *
 *  - These tools run with the human's ambient session. There is no separate
 *    credential to scope down, so a tool can do exactly what the signed-in human
 *    can do, no more and no less. Exposing what the user can already see is not
 *    an escalation; exposing something they *cannot* would be.
 *  - Nothing here mints, reads, or returns a credential. `connection-command`
 *    rotates an agent's connect token and flips its run mode, so wiring it to a
 *    page tool would let a prompt-injected agent silently re-key the workspace.
 *    If that is ever added it must go through a human confirmation in the UI and
 *    return "awaiting confirmation", never the token.
 *  - Any tool returning content agensis did not author (message bodies, doc text)
 *    must set `untrustedContentHint`. Message content is attacker-controlled:
 *    anyone who can post in a channel can write instructions aimed at the agent.
 *    That is why no message-reading tool is in this first set — `list_channels`
 *    returns titles the user already sees in their own sidebar, and stops there.
 */

export interface WebMcpBridgeProps {
  workspaceId: string | null;
  sessions: ChatSession[];
  agents: WorkspaceAgent[];
  activeSession: ChatSession | null;
  /** Opens a channel/DM window — the same path the sidebar click takes. */
  onOpenSession: (sessionId: string) => void;
  /**
   * Posts into a session. Supplied by App.tsx rather than called directly so the
   * bridge never has to guess which model a turn should use — it reuses whatever
   * the composer would have sent.
   */
  onPostMessage: (text: string, session: ChatSession) => Promise<void>;
}

/** Trimmed shape for tool output — deliberately not the raw row. */
function channelSummary(session: ChatSession) {
  return {
    id: session.id,
    title: session.title,
    folder: session.folder ?? null,
  };
}

function agentSummary(agent: WorkspaceAgent) {
  return {
    id: agent.id,
    name: agent.name,
    handle: agent.handle ?? null,
    description: agent.description ?? null,
  };
}

export function WebMcpBridge({
  workspaceId,
  sessions,
  agents,
  activeSession,
  onOpenSession,
  onPostMessage,
}: WebMcpBridgeProps) {
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!workspaceId) return [];

    const list: WebMcpTool[] = [
      {
        name: 'agensis_list_channels',
        title: 'List channels',
        description:
          'List the agensis channels and direct messages visible to the signed-in user. Returns ids and titles only, not message content.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () =>
          textResult(JSON.stringify({ channels: sessions.map(channelSummary) }, null, 2)),
      },
      {
        name: 'agensis_list_agents',
        title: 'List agents',
        description:
          'List the AI agents configured in the current agensis workspace, with their handles and descriptions.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () =>
          textResult(JSON.stringify({ agents: agents.map(agentSummary) }, null, 2)),
      },
      {
        name: 'agensis_open_channel',
        title: 'Open a channel',
        description:
          'Open a channel or direct message in the agensis UI, bringing it to the front for the user. Use agensis_list_channels first to get the id.',
        inputSchema: {
          type: 'object',
          properties: { channel_id: { type: 'string', description: 'The channel/session id to open.' } },
          required: ['channel_id'],
          additionalProperties: false,
        },
        execute: async input => {
          const channelId = typeof input.channel_id === 'string' ? input.channel_id : '';
          const target = sessions.find(s => s.id === channelId);
          if (!target) {
            return errorResult(`No channel with id "${channelId}" is visible in this workspace.`);
          }
          onOpenSession(target.id);
          return textResult(`Opened "${target.title}".`);
        },
      },
      {
        name: 'agensis_post_message',
        title: 'Post a message',
        description:
          'Post a message into an agensis channel or direct message as the signed-in user. Defaults to the channel currently open on screen. Mention an agent with @handle to wake it.',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The message body. Markdown is supported.' },
            channel_id: {
              type: 'string',
              description: 'Optional channel id. Defaults to the channel currently open.',
            },
          },
          required: ['text'],
          additionalProperties: false,
        },
        execute: async input => {
          const text = typeof input.text === 'string' ? input.text.trim() : '';
          if (!text) return errorResult('`text` is required and cannot be empty.');

          const channelId = typeof input.channel_id === 'string' ? input.channel_id : '';
          const target = channelId ? sessions.find(s => s.id === channelId) : activeSession;
          if (!target) {
            return errorResult(
              channelId
                ? `No channel with id "${channelId}" is visible in this workspace.`
                : 'No channel is currently open. Pass `channel_id`, or open one with agensis_open_channel first.'
            );
          }

          await onPostMessage(text, target);
          return textResult(`Posted to "${target.title}".`);
        },
      },
    ];

    return list;
  }, [workspaceId, sessions, agents, activeSession, onOpenSession, onPostMessage]);

  useWebMcpTools(tools);

  // Renders nothing: this is a behaviour-only global, like RegistrationApprovalPopup.
  return null;
}
