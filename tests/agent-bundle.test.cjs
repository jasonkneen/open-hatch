'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { strToU8, zipSync } = require('fflate');
const {
 AGENT_BUNDLE_FORMAT,
 AGENT_BUNDLE_VERSION,
 parseAgentBundleArchive,
} = require('../shared/agentBundles.cjs');
const {
 buildTemplateExport,
 normalizeAgentTemplate,
 readTemplateExport,
 templateFingerprint,
} = require('../shared/agentTemplates.cjs');
const {
 normalizeWorkspaceSkill,
 renderWorkspaceSkillMarkdown,
 skillFingerprint,
} = require('../shared/workspaceSkills.cjs');
const { createAgentTemplates } = require('../server/agent-templates-routes.cjs');
const { createWorkspaceSkills } = require('../server/workspace-skills-routes.cjs');
const { createAgentBundles } = require('../server/agent-bundles-routes.cjs');

const WORKSPACE = 'ws-1';
const USER = 'user-1';

function template(overrides = {}) {
 const result = normalizeAgentTemplate({
  name: 'Researcher',
  systemPrompt: 'Review the supplied sources.',
  skills: ['source-review', 'missing-runtime-skill'],
  tools: ['search'],
  ...overrides,
 });
 assert.equal(result.ok, true, result.errors.join('; '));
 return result.template;
}

function skill(overrides = {}) {
 const result = normalizeWorkspaceSkill({
  name: 'source-review',
  title: 'Source review',
  summary: 'Check the source before trusting it.',
  body: 'Read the source. Record the evidence.',
  ...overrides,
 });
 assert.equal(result.ok, true, result.errors.join('; '));
 return result.skill;
}

function archive({ agent = template(), skills = [skill()], extra = {} } = {}) {
 const exported = buildTemplateExport(agent, { exportedAt: '2026-08-24T12:00:00.000Z' });
 const skillPaths = skills.map(entry => `skills/${entry.name}/SKILL.md`);
 return zipSync({
  'manifest.json': strToU8(JSON.stringify({
   format: AGENT_BUNDLE_FORMAT,
   formatVersion: AGENT_BUNDLE_VERSION,
   exportedAt: exported.exportedAt,
   templatePath: 'agent.agent.json',
   skillPaths,
  })),
  'agent.agent.json': strToU8(JSON.stringify(exported)),
  ...Object.fromEntries(skills.map(entry => [`skills/${entry.name}/SKILL.md`, strToU8(renderWorkspaceSkillMarkdown(entry))])),
  ...extra,
 });
}

test('a valid .agn archive round-trips the existing template and skill contracts', () => {
 const result = parseAgentBundleArchive(archive());
 assert.equal(result.ok, true, result.errors?.join('; '));
 assert.deepEqual(result.bundle.template, template());
 assert.deepEqual(result.bundle.skills, [skill()]);
 assert.equal(result.bundle.templateFingerprint, templateFingerprint(template()));
 assert.equal(result.bundle.skillFingerprints['source-review'], skillFingerprint(skill()));
});

test('archive paths are closed and hostile files never reach either validator', () => {
 const result = parseAgentBundleArchive(archive({ extra: { '../outside.txt': strToU8('no') } }));
 assert.equal(result.ok, false);
 assert.match(result.errors.join(' '), /unsafe/i);

 const authority = buildTemplateExport({
  ...template(),
  permissionMode: 'yolo',
 });
 const poisoned = zipSync({
  'manifest.json': strToU8(JSON.stringify({
   format: AGENT_BUNDLE_FORMAT, formatVersion: 1, templatePath: 'agent.agent.json', skillPaths: [],
  })),
  'agent.agent.json': strToU8(JSON.stringify({ ...authority, template: { ...authority.template, permissionMode: 'yolo' } })),
 });
 const rejected = parseAgentBundleArchive(poisoned);
 assert.equal(rejected.ok, false);
 assert.match(rejected.errors.join(' '), /permissionMode/);
});

function makeDb(existingSkills = []) {
 const queries = [];
 const insertedSkills = [];
 const db = {
  queries,
  insertedSkills,
  async unsafe(sql, params = []) {
   const normalized = String(sql).replace(/\s+/g, ' ').trim();
   const lower = normalized.toLowerCase();
   queries.push({ sql: normalized, params });
   if (lower.startsWith('select * from workspace_skills')) return [...existingSkills, ...insertedSkills];
   if (lower.startsWith('select count(*)::int as total from workspace_skills')) return [{ total: existingSkills.length + insertedSkills.length }];
   if (lower.startsWith('insert into workspace_agent_templates')) {
    const row = {
     id: 'template-1', workspace_id: WORKSPACE, slug: params[1], name: params[2],
     category: params[3], description: params[4], handle_hint: params[5],
     system_prompt: params[6], soul: params[7], instructions: params[8],
     tools: params[9], skills: params[10], purpose: params[11], resource_facets: params[12],
     model: params[13], run_mode: params[14], runtime: params[15], avatar: params[16],
     accent_color: params[17], source: params[18], origin: params[19], created_by: params[20],
    };
    return [row];
   }
   if (lower.startsWith('insert into workspace_skills')) {
    const row = {
     id: `skill-${insertedSkills.length + 1}`, workspace_id: WORKSPACE,
     name: params[1], title: params[2], summary: params[3], body: params[4],
     source: params[5], origin: params[6], created_by: params[7], revision: 1,
    };
    insertedSkills.push(row);
    return [row];
   }
   return [];
  },
  async begin(callback) { return callback(this); },
 };
 return db;
}

function engine(db, audits = []) {
 const templates = createAgentTemplates({
  getDb: () => db,
  notifyDbSubscribers: () => {},
  enforceWorkspaceRole: async () => true,
  normalizeAgentTemplate,
  readTemplateExport,
  templateFingerprint,
 });
 const skills = createWorkspaceSkills({
  getDb: () => db,
  notifyDbSubscribers: () => {},
  enforceWorkspaceRole: async () => true,
 });
 return createAgentBundles({
  getDb: () => db,
  notifyDbSubscribers: () => {},
  enforceWorkspaceRole: async () => true,
  writeTemplate: templates.writeTemplate,
  writeSkill: skills.writeSkill,
  publicTemplate: templates.publicTemplate,
  recordAudit: async entry => { audits.push(entry); },
 });
}

test('preview distinguishes embedded, reusable, and still-missing requirements', async () => {
 const db = makeDb([]);
 const review = await engine(db).previewAgentBundle({ userId: USER, workspaceId: WORKSPACE, bytes: archive() });
 assert.equal(review.skills[0].status, 'add');
 assert.deepEqual(review.requirements, [
  { name: 'source-review', status: 'embedded' },
  { name: 'missing-runtime-skill', status: 'needs_setup' },
 ]);
 assert.deepEqual(review.addedSkillNames, ['source-review']);
 assert.deepEqual(review.needsSetup, ['missing-runtime-skill']);
});

test('same-content skills are reused and new skills plus the template commit together', async () => {
 const existing = [{
  id: 'old-skill', workspace_id: WORKSPACE, ...skill(), revision: 2, source: 'authored', origin: {},
 }];
 const db = makeDb(existing);
 const audits = [];
 const imported = await engine(db, audits).importAgentBundle({
  userId: USER,
  workspaceId: WORKSPACE,
  bytes: archive({
   agent: template({ skills: ['source-review', 'second-skill'] }),
   skills: [skill(), skill({ name: 'second-skill', title: 'Second skill' })],
  }),
 });
 assert.deepEqual(imported.reusedSkillNames, ['source-review']);
 assert.deepEqual(imported.addedSkillNames, ['second-skill']);
 assert.equal(db.insertedSkills.length, 1);
 assert.equal(db.queries.some(query => query.sql.toLowerCase().startsWith('insert into workspace_agent_templates')), true);
 assert.equal(audits[0].action, 'agent_template.imported');
 assert.equal(audits[0].detail.addedSkills, 1);
});

test('a divergent same-name skill stops the entire import before any row is written', async () => {
 const existing = [{
  id: 'old-skill', workspace_id: WORKSPACE, ...skill({ body: 'Different procedure.' }), revision: 1, source: 'authored', origin: {},
 }];
 const db = makeDb(existing);
 await assert.rejects(
  () => engine(db).importAgentBundle({ userId: USER, workspaceId: WORKSPACE, bytes: archive() }),
  error => error.status === 409 && /source-review/.test(error.message),
 );
 assert.equal(db.insertedSkills.length, 0);
 assert.equal(db.queries.some(query => query.sql.toLowerCase().startsWith('insert into workspace_agent_templates')), false);
});

