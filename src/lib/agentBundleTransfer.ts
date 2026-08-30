import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { StoredAgentTemplate } from './agentTemplates';
import type { WorkspaceSkill } from './workspaceSkills';
import {
  TEMPLATE_EXPORT_FORMAT,
  TEMPLATE_EXPORT_VERSION,
  buildTemplateExport,
  parseTemplateExport,
  type TemplateExportEnvelope,
} from './agentTemplateTransfer';

export const AGENT_BUNDLE_FORMAT = 'agensis.agent-bundle';
export const AGENT_BUNDLE_VERSION = 1;
export const AGENT_BUNDLE_EXTENSION = '.agn';
export const AGENT_BUNDLE_MANIFEST_PATH = 'manifest.json';
export const AGENT_BUNDLE_TEMPLATE_PATH = 'agent.agent.json';
export const AGENT_BUNDLE_MAX_ENTRIES = 128;
export const AGENT_BUNDLE_MAX_SKILLS = 64;
export const AGENT_BUNDLE_MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;
export const AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024;

const SKILL_PATH_RE = /^skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md$/;

export interface AgentBundleManifest {
  format: string;
  formatVersion: number;
  exportedAt: string;
  templatePath: typeof AGENT_BUNDLE_TEMPLATE_PATH;
  skillPaths: string[];
}

export interface AgentBundleInspection {
  manifest: AgentBundleManifest;
  template: Record<string, unknown>;
  templateEnvelope: TemplateExportEnvelope | null;
  skillNames: string[];
  compressedBytes: number;
  uncompressedBytes: number;
}

export interface BuiltAgentBundle {
  bytes: Uint8Array;
  embeddedSkillNames: string[];
  omittedSkillNames: string[];
}

function safeFilenamePart(value: string): string {
  return String(value || 'agent-template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function quotedFrontmatter(value: string): string {
  return JSON.stringify(String(value || '').replace(/[\r\n]+/g, ' ').trim());
}

function renderWorkspaceSkillMarkdown(skill: WorkspaceSkill): string {
  const frontmatter = [
    '---',
    `name: ${skill.name}`,
    ...(skill.title ? [`title: ${quotedFrontmatter(skill.title)}`] : []),
    ...(skill.summary ? [`description: ${quotedFrontmatter(skill.summary)}`] : []),
    'source: agensis workspace skill',
    '---',
  ];
  return `${frontmatter.join('\n')}\n\n${String(skill.body || '')}\n`;
}

/** Build a ZIP archive with only the template and its workspace-owned skills. */
export function buildAgentBundle(
  template: StoredAgentTemplate,
  workspaceSkills: readonly WorkspaceSkill[] = [],
  now: Date = new Date(),
): BuiltAgentBundle {
  const envelope = buildTemplateExport(template, now);
  const requested = new Set((template.skills || []).map(skill => String(skill || '').trim().toLowerCase()).filter(Boolean));
  const embedded = new Map<string, WorkspaceSkill>();
  for (const skill of workspaceSkills) {
    const name = String(skill.name || '').trim();
    const key = name.toLowerCase();
    if (requested.has(key) && !embedded.has(key)) embedded.set(key, skill);
  }

  const embeddedSkillNames = [...embedded.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(skill => skill.name);
  const omittedSkillNames = [...requested].filter(name => !embedded.has(name));
  const skillPaths = embeddedSkillNames.map(name => `skills/${name}/SKILL.md`);
  const manifest: AgentBundleManifest = {
    format: AGENT_BUNDLE_FORMAT,
    formatVersion: AGENT_BUNDLE_VERSION,
    exportedAt: envelope.exportedAt,
    templatePath: AGENT_BUNDLE_TEMPLATE_PATH,
    skillPaths,
  };

  const files: Record<string, Uint8Array> = {
    [AGENT_BUNDLE_MANIFEST_PATH]: strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
    [AGENT_BUNDLE_TEMPLATE_PATH]: strToU8(`${JSON.stringify(envelope, null, 2)}\n`),
  };
  for (const skill of [...embedded.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    files[`skills/${skill.name}/SKILL.md`] = strToU8(renderWorkspaceSkillMarkdown(skill));
  }

  return {
    bytes: zipSync(files, { level: 6 }),
    embeddedSkillNames,
    omittedSkillNames,
  };
}

export function agentBundleFilename(template: Pick<StoredAgentTemplate, 'slug' | 'name'>): string {
  return `${safeFilenamePart(template.slug || template.name) || 'agent-template'}${AGENT_BUNDLE_EXTENSION}`;
}

function invalid(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * A cheap client-side check used before the server preview request. The server
 * repeats every check and remains the security boundary.
 */
export function parseAgentBundle(data: Uint8Array): { ok: true; inspection: AgentBundleInspection } | { ok: false; error: string } {
  if (!(data instanceof Uint8Array) || data.byteLength === 0) return invalid('That bundle is empty.');
  if (data.byteLength > AGENT_BUNDLE_MAX_COMPRESSED_BYTES) return invalid('That bundle is too large.');

  let files: Record<string, Uint8Array>;
  let uncompressedBytes = 0;
  const seen = new Set<string>();
  try {
    files = unzipSync(data, {
      filter(file) {
        const name = String(file.name || '');
        if (seen.has(name)) throw new Error('duplicate archive entry');
        seen.add(name);
        if (seen.size > AGENT_BUNDLE_MAX_ENTRIES) throw new Error('too many archive entries');
        if (!name || name.endsWith('/') || name.includes('\\') || name.startsWith('/') || name.includes('../') || name.includes('/../')) {
          throw new Error('unsafe archive path');
        }
        uncompressedBytes += Number(file.originalSize) || 0;
        if (uncompressedBytes > AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES) throw new Error('bundle expands beyond its size limit');
        return true;
      },
    });
  } catch {
    return invalid('That file is not a readable .agn bundle.');
  }

  const manifestBytes = files[AGENT_BUNDLE_MANIFEST_PATH];
  if (!manifestBytes) return invalid('That bundle has no manifest.');
  let manifest: AgentBundleManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as AgentBundleManifest;
  } catch {
    return invalid('That bundle manifest is not valid JSON.');
  }
  if (manifest.format !== AGENT_BUNDLE_FORMAT) return invalid('That file is not an agensis agent bundle.');
  if (Number(manifest.formatVersion) > AGENT_BUNDLE_VERSION) return invalid('That bundle was written by a newer version of agensis.');
  if (manifest.templatePath !== AGENT_BUNDLE_TEMPLATE_PATH || !Array.isArray(manifest.skillPaths)) {
    return invalid('That bundle manifest is invalid.');
  }
  if (manifest.skillPaths.length > AGENT_BUNDLE_MAX_SKILLS) return invalid('That bundle contains too many skills.');

  const expected = new Set([AGENT_BUNDLE_MANIFEST_PATH, AGENT_BUNDLE_TEMPLATE_PATH]);
  const skillNames: string[] = [];
  const nameSet = new Set<string>();
  for (const rawPath of manifest.skillPaths) {
    const path = String(rawPath || '');
    const match = SKILL_PATH_RE.exec(path);
    if (!match || nameSet.has(match[1])) return invalid('That bundle contains an invalid or duplicate skill path.');
    nameSet.add(match[1]);
    skillNames.push(match[1]);
    expected.add(path);
  }
  const actual = Object.keys(files);
  if (actual.length !== expected.size || actual.some(path => !expected.has(path))) {
    return invalid('That bundle contains an unexpected file.');
  }

  const templateBytes = files[AGENT_BUNDLE_TEMPLATE_PATH];
  if (!templateBytes) return invalid('That bundle has no agent template.');
  const parsedTemplate = parseTemplateExport(strFromU8(templateBytes));
  if (!parsedTemplate.ok) return invalid(parsedTemplate.error);
  const envelope = parsedTemplate.envelope;
  const envelopeRecord = envelope && typeof envelope === 'object' && !Array.isArray(envelope)
    ? envelope as Record<string, unknown>
    : null;
  const template = envelopeRecord && envelopeRecord.template && typeof envelopeRecord.template === 'object'
    && !Array.isArray(envelopeRecord.template)
    ? envelopeRecord.template as Record<string, unknown>
    : envelopeRecord || {};
  const requested = new Set(Array.isArray(template.skills) ? template.skills.map(skill => String(skill || '').toLowerCase()) : []);
  if (skillNames.some(name => !requested.has(name.toLowerCase()))) return invalid('A bundled skill is not requested by the agent template.');

  return {
    ok: true,
    inspection: {
      manifest,
      template,
      templateEnvelope: envelopeRecord && envelopeRecord.format === TEMPLATE_EXPORT_FORMAT
        && Number(envelopeRecord.formatVersion) <= TEMPLATE_EXPORT_VERSION
        ? envelopeRecord as unknown as TemplateExportEnvelope
        : null,
      skillNames,
      compressedBytes: data.byteLength,
      uncompressedBytes,
    },
  };
}

/** Encode the archive for the JSON transport to the manage-gated server route. */
export function agentBundleBase64(data: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

