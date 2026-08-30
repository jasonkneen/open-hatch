import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  AGENT_BUNDLE_FORMAT,
  AGENT_BUNDLE_TEMPLATE_PATH,
  agentBundleFilename,
  buildAgentBundle,
  parseAgentBundle,
} from '../../src/lib/agentBundleTransfer';
import type { StoredAgentTemplate } from '../../src/lib/agentTemplates';
import type { WorkspaceSkill } from '../../src/lib/workspaceSkills';

const template: StoredAgentTemplate = {
  id: 'template-1',
  workspace_id: 'workspace-1',
  slug: 'researcher',
  name: 'Researcher',
  category: 'Saved',
  description: 'Reviews sources.',
  handleHint: 'researcher',
  systemPrompt: 'Review sources carefully.',
  soul: '',
  instructions: '',
  tools: ['search'],
  skills: ['source-review', 'needs-setup'],
  purpose: 'collaborator',
  resourceFacets: [],
  model: 'auto',
  runMode: 'builtin',
  runtime: '',
  avatar: 'AI',
  accentColor: '#111111',
  revision: 1,
  source: 'derived',
  origin: {},
  created_by: 'user-1',
};

const skill: WorkspaceSkill = {
  id: 'skill-1',
  workspace_id: 'workspace-1',
  name: 'source-review',
  title: 'Source review',
  summary: 'Check the evidence.',
  body: 'Read the source and record the evidence.',
  revision: 1,
  source: 'authored',
  origin: {},
  created_by: 'user-1',
};

describe('compressed .agn bundles', () => {
  it('embeds only referenced workspace skills and retains unresolved names', () => {
    const built = buildAgentBundle(template, [skill], new Date('2026-08-24T12:00:00.000Z'));
    expect(built.bytes.length).toBeGreaterThan(0);
    expect(built.embeddedSkillNames).toEqual(['source-review']);
    expect(built.omittedSkillNames).toEqual(['needs-setup']);

    const parsed = parseAgentBundle(built.bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.inspection.manifest.format).toBe(AGENT_BUNDLE_FORMAT);
    expect(parsed.inspection.manifest.templatePath).toBe(AGENT_BUNDLE_TEMPLATE_PATH);
    expect(parsed.inspection.skillNames).toEqual(['source-review']);
    expect(parsed.inspection.template).toMatchObject({ name: 'Researcher', skills: ['source-review', 'needs-setup'] });
  });

  it('uses the portable extension and rejects unexpected archive entries', () => {
    expect(agentBundleFilename(template)).toBe('researcher.agn');
    const archive = zipSync({
      'manifest.json': strToU8(JSON.stringify({
        format: AGENT_BUNDLE_FORMAT,
        formatVersion: 1,
        exportedAt: '2026-08-24T12:00:00.000Z',
        templatePath: AGENT_BUNDLE_TEMPLATE_PATH,
        skillPaths: [],
      })),
      [AGENT_BUNDLE_TEMPLATE_PATH]: strToU8(JSON.stringify({
        format: 'agensis.agent-template', formatVersion: 1, template: { name: 'Researcher' },
      })),
      'unexpected.txt': strToU8('no'),
    });
    expect(parseAgentBundle(archive)).toEqual({ ok: false, error: 'That bundle contains an unexpected file.' });
  });
});

