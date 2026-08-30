'use strict';

// ============================================================================
// Compressed .agn agent bundles.
//
// The archive is a transport wrapper, not a second authority model. Its agent
// file is the existing agent-template export, and its SKILL.md files are the
// existing workspace-skill rendering. Keeping those two validators in charge
// means a new client cannot accidentally invent a way to carry permissions,
// credentials, host folders, sandbox configuration or live identity.
// ============================================================================

const { strFromU8, unzipSync } = require('fflate');
const {
 readTemplateExport,
 templateFingerprint,
} = require('./agentTemplates.cjs');
const {
 MAX_BODY_BYTES,
 WORKSPACE_SKILL_NAME_RE,
 parseWorkspaceSkillMarkdown,
 skillFingerprint,
} = require('./workspaceSkills.cjs');

const AGENT_BUNDLE_FORMAT = 'agensis.agent-bundle';
const AGENT_BUNDLE_VERSION = 1;
const AGENT_BUNDLE_EXTENSION = '.agn';
const AGENT_BUNDLE_MANIFEST_PATH = 'manifest.json';
const AGENT_BUNDLE_TEMPLATE_PATH = 'agent.agent.json';
const AGENT_BUNDLE_SKILLS_PREFIX = 'skills/';
const AGENT_BUNDLE_MAX_ENTRIES = 128;
const AGENT_BUNDLE_MAX_SKILLS = 64;
const AGENT_BUNDLE_MAX_COMPRESSED_BYTES = 5 * 1024 * 1024;
const AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES = 5 * 1024 * 1024;
const AGENT_BUNDLE_MAX_MANIFEST_BYTES = 64 * 1024;
const AGENT_BUNDLE_MAX_TEMPLATE_BYTES = 256 * 1024;
const AGENT_BUNDLE_SKILL_PATH_RE = /^skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md$/;

function invalid(...errors) {
 return { ok: false, errors: errors.filter(Boolean), bundle: null };
}

function objectOrNull(value) {
 return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function parseJsonFile(files, filePath, label, maxBytes) {
 const bytes = files[filePath];
 if (!(bytes instanceof Uint8Array)) return { ok: false, error: `${label} is missing` };
 if (bytes.byteLength > maxBytes) return { ok: false, error: `${label} is too large` };
 try {
  const value = JSON.parse(strFromU8(bytes));
  if (!objectOrNull(value)) return { ok: false, error: `${label} must contain an object` };
  return { ok: true, value };
 } catch {
  return { ok: false, error: `${label} is not valid JSON` };
 }
}

function validateManifest(raw, fileNames) {
 const manifest = objectOrNull(raw);
 if (!manifest) return invalid('manifest.json must contain an object');
 if (String(manifest.format || '') !== AGENT_BUNDLE_FORMAT) {
  return invalid('that file is not an agensis agent bundle');
 }
 const version = Number(manifest.formatVersion);
 if (!Number.isFinite(version) || version < 1) return invalid('the bundle does not say which format version it uses');
 if (version > AGENT_BUNDLE_VERSION) {
  return invalid(`that bundle was written by a newer version of agensis (format ${version}, this one reads ${AGENT_BUNDLE_VERSION})`);
 }
 if (manifest.templatePath !== AGENT_BUNDLE_TEMPLATE_PATH) {
  return invalid(`the bundle template must be at ${AGENT_BUNDLE_TEMPLATE_PATH}`);
 }
 if (manifest.exportedAt !== undefined && typeof manifest.exportedAt !== 'string') {
  return invalid('manifest exportedAt must be a string');
 }
 if (!Array.isArray(manifest.skillPaths)) return invalid('manifest skillPaths must be an array');
 if (manifest.skillPaths.length > AGENT_BUNDLE_MAX_SKILLS) {
  return invalid(`a bundle may include at most ${AGENT_BUNDLE_MAX_SKILLS} skills`);
 }

 const expected = new Set([AGENT_BUNDLE_MANIFEST_PATH, AGENT_BUNDLE_TEMPLATE_PATH]);
 const skillNames = new Set();
 for (const rawPath of manifest.skillPaths) {
  const skillPath = String(rawPath || '');
  const match = AGENT_BUNDLE_SKILL_PATH_RE.exec(skillPath);
  if (!match) return invalid(`invalid bundled skill path: ${skillPath || 'missing'}`);
  const name = match[1];
  if (!WORKSPACE_SKILL_NAME_RE.test(name)) return invalid(`invalid bundled skill name: ${name}`);
  if (skillNames.has(name)) return invalid(`skill ${name} appears more than once in the bundle`);
  skillNames.add(name);
  expected.add(skillPath);
 }

 const actual = new Set(fileNames);
 if (actual.size !== expected.size || [...actual].some((name) => !expected.has(name))) {
  return invalid('the bundle contains an unexpected file; only its manifest, agent template and SKILL.md files are allowed');
 }
 return { ok: true, manifest, skillNames, skillPaths: [...manifest.skillPaths] };
}

function parseAgentBundleArchive(input) {
 const data = input instanceof Uint8Array ? input : Buffer.isBuffer(input) ? new Uint8Array(input) : null;
 if (!data) return invalid('the bundle data is not binary');
 if (data.byteLength === 0) return invalid('the bundle is empty');
 if (data.byteLength > AGENT_BUNDLE_MAX_COMPRESSED_BYTES) {
  return invalid(`the compressed bundle is larger than ${AGENT_BUNDLE_MAX_COMPRESSED_BYTES} bytes`);
 }

 let files;
 let uncompressedBytes = 0;
 const seenEntries = new Set();
 try {
  files = unzipSync(data, {
   filter(file) {
    const name = String(file.name || '');
    if (seenEntries.has(name)) throw new Error('duplicate archive entry');
    seenEntries.add(name);
    if (seenEntries.size > AGENT_BUNDLE_MAX_ENTRIES) throw new Error('too many archive entries');
    if (!name || name.endsWith('/') || name.includes('\\') || name.startsWith('/') || name.includes('../') || name.includes('/../')) {
     throw new Error('unsafe archive path');
    }
    const originalSize = Number(file.originalSize);
    if (!Number.isFinite(originalSize) || originalSize < 0 || originalSize > AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES) {
     throw new Error('archive entry is too large');
    }
    uncompressedBytes += originalSize;
    if (uncompressedBytes > AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES) throw new Error('bundle expands beyond its size limit');
    return true;
   },
  });
 } catch (error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('too large') || message.includes('size limit') || message.includes('too many')) {
   return invalid('the bundle exceeds its size limits');
  }
  if (message.includes('unsafe') || message.includes('duplicate')) return invalid('the bundle contains an unsafe or duplicate archive path');
  return invalid('the bundle is not a readable ZIP archive');
 }

 const manifestFile = files[AGENT_BUNDLE_MANIFEST_PATH];
 if (!(manifestFile instanceof Uint8Array) || manifestFile.byteLength > AGENT_BUNDLE_MAX_MANIFEST_BYTES) {
  return invalid('manifest.json is missing or too large');
 }
 const manifestJson = parseJsonFile(files, AGENT_BUNDLE_MANIFEST_PATH, 'manifest.json', AGENT_BUNDLE_MAX_MANIFEST_BYTES);
 if (!manifestJson.ok) return invalid(manifestJson.error);
 const manifestResult = validateManifest(manifestJson.value, Object.keys(files));
 if (!manifestResult.ok) return manifestResult;

 const templateJson = parseJsonFile(files, AGENT_BUNDLE_TEMPLATE_PATH, AGENT_BUNDLE_TEMPLATE_PATH, AGENT_BUNDLE_MAX_TEMPLATE_BYTES);
 if (!templateJson.ok) return invalid(templateJson.error);
 const templateResult = readTemplateExport(templateJson.value);
 if (!templateResult.ok) return invalid(...templateResult.errors);

 const templateSkills = new Set((templateResult.template.skills || []).map((name) => String(name).trim().toLowerCase()).filter(Boolean));
 const skills = [];
 for (const skillPath of manifestResult.skillPaths) {
  const match = AGENT_BUNDLE_SKILL_PATH_RE.exec(skillPath);
  const expectedName = match[1];
  const bytes = files[skillPath];
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BODY_BYTES + 16 * 1024) {
   return invalid(`bundled skill ${expectedName} is missing or too large`);
  }
  const result = parseWorkspaceSkillMarkdown(strFromU8(bytes));
  if (!result.ok) return invalid(`skill ${expectedName}: ${result.errors.join('; ')}`);
  if (result.skill.name !== expectedName) {
   return invalid(`skill ${expectedName} has a different frontmatter name`);
  }
  if (!templateSkills.has(expectedName.toLowerCase())) {
   return invalid(`skill ${expectedName} is not requested by the agent template`);
  }
  skills.push(result.skill);
 }

 return {
  ok: true,
  errors: [],
  bundle: {
   manifest: manifestResult.manifest,
   template: templateResult.template,
   skills,
   compressedBytes: data.byteLength,
   uncompressedBytes,
   templateFingerprint: templateFingerprint(templateResult.template),
   skillFingerprints: Object.fromEntries(skills.map((skill) => [skill.name, skillFingerprint(skill)])),
  },
 };
}

module.exports = {
 AGENT_BUNDLE_FORMAT,
 AGENT_BUNDLE_VERSION,
 AGENT_BUNDLE_EXTENSION,
 AGENT_BUNDLE_MANIFEST_PATH,
 AGENT_BUNDLE_TEMPLATE_PATH,
 AGENT_BUNDLE_SKILLS_PREFIX,
 AGENT_BUNDLE_MAX_ENTRIES,
 AGENT_BUNDLE_MAX_SKILLS,
 AGENT_BUNDLE_MAX_COMPRESSED_BYTES,
 AGENT_BUNDLE_MAX_UNCOMPRESSED_BYTES,
 AGENT_BUNDLE_MAX_MANIFEST_BYTES,
 AGENT_BUNDLE_MAX_TEMPLATE_BYTES,
 parseAgentBundleArchive,
};
