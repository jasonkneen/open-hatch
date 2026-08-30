'use strict';

// The .agn lane deliberately sits beside agent-template routes rather than
// creating a second create-agent path. It imports reusable template/skill rows;
// the existing Create Agent form remains the only path that can instantiate an
// agent.

const {
 AGENT_BUNDLE_FORMAT,
 AGENT_BUNDLE_VERSION,
 parseAgentBundleArchive,
} = require('../shared/agentBundles.cjs');
const {
 MAX_SKILLS_PER_WORKSPACE,
 normalizeWorkspaceSkill,
 skillFingerprint,
} = require('../shared/workspaceSkills.cjs');

function badRequest(message) {
 return Object.assign(new Error(message), { status: 400 });
}

function conflict(message, details) {
 return Object.assign(new Error(message), { status: 409, details });
}

function decodeBundle(value) {
 if (value instanceof Uint8Array) return value;
 if (typeof value !== 'string' || !value.trim()) throw badRequest('the bundle payload is missing');
 const encoded = value.trim();
 if (encoded.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
  throw badRequest('the bundle payload is not valid base64');
 }
 let bytes;
 try {
  bytes = Buffer.from(encoded, 'base64');
 } catch {
  throw badRequest('the bundle payload is not valid base64');
 }
 if (!bytes.length) throw badRequest('the bundle payload is empty');
 return new Uint8Array(bytes);
}

function rowSkill(row) {
 const result = normalizeWorkspaceSkill({
  name: row?.name,
  title: row?.title,
  summary: row?.summary,
  body: row?.body,
 });
 return result.ok ? result.skill : null;
}

function skillKey(value) {
 return String(value || '').trim().toLowerCase();
}

function buildSkillReview(bundle, existingRows) {
 const existing = new Map();
 for (const row of existingRows || []) {
  const skill = rowSkill(row);
  if (skill) existing.set(skillKey(skill.name), { row, skill });
 }

 const embedded = new Map();
 for (const skill of bundle.skills) embedded.set(skillKey(skill.name), skill);

 const skills = bundle.skills.map((skill) => {
  const current = existing.get(skillKey(skill.name));
  const incomingFingerprint = skillFingerprint(skill);
  const existingFingerprint = current ? skillFingerprint(current.skill) : '';
  const status = !current ? 'add' : incomingFingerprint === existingFingerprint ? 'reuse' : 'conflict';
  return {
   name: skill.name,
   title: skill.title,
   summary: skill.summary,
   bodyBytes: Buffer.byteLength(skill.body, 'utf8'),
   fingerprint: incomingFingerprint,
   status,
  };
 });

 const requirements = [];
 const seenRequirements = new Set();
 for (const rawName of bundle.template.skills || []) {
  const name = String(rawName || '').trim();
  const key = skillKey(name);
  if (!key || seenRequirements.has(key)) continue;
  seenRequirements.add(key);
  requirements.push({
   name,
   status: embedded.has(key) ? 'embedded' : existing.has(key) ? 'available' : 'needs_setup',
  });
 }

 const conflicts = skills.filter((skill) => skill.status === 'conflict').map((skill) => skill.name);
 const addedSkillNames = skills.filter((skill) => skill.status === 'add').map((skill) => skill.name);
 const reusedSkillNames = skills.filter((skill) => skill.status === 'reuse').map((skill) => skill.name);
 const needsSetup = requirements.filter((entry) => entry.status === 'needs_setup').map((entry) => entry.name);

 return {
  template: bundle.template,
  templateFingerprint: bundle.templateFingerprint,
  skills,
  requirements,
  conflicts,
  addedSkillNames,
  reusedSkillNames,
  needsSetup,
  tools: [...(bundle.template.tools || [])],
  requestedRuntime: bundle.template.runtime || '',
  compressedBytes: bundle.compressedBytes,
  uncompressedBytes: bundle.uncompressedBytes,
 };
}

function createAgentBundles(deps = {}) {
 const {
  getDb,
  notifyDbSubscribers,
  enforceWorkspaceRole,
  writeTemplate,
  writeSkill,
  publicTemplate,
  recordAudit,
 } = deps;

 function parseOrThrow(bytes) {
  const result = parseAgentBundleArchive(bytes);
  if (!result.ok) throw badRequest(result.errors.join('; '));
  return result.bundle;
 }

 async function existingSkills(database, workspaceId) {
  return database.unsafe(
   'select * from workspace_skills where workspace_id = $1 order by name asc limit $2',
   [workspaceId, MAX_SKILLS_PER_WORKSPACE],
  );
 }

 async function previewAgentBundle({ userId, workspaceId, bytes } = {}) {
  const id = String(workspaceId || '').trim();
  if (!id) throw badRequest('workspace id is required');
  await enforceWorkspaceRole(userId, id, 'manage');
  const bundle = parseOrThrow(bytes);
  const rows = await existingSkills(getDb(), id);
  return buildSkillReview(bundle, rows);
 }

 async function importAgentBundle({ userId, workspaceId, bytes, requestIp } = {}) {
  const id = String(workspaceId || '').trim();
  if (!id) throw badRequest('workspace id is required');
  await enforceWorkspaceRole(userId, id, 'manage');
  const bundle = parseOrThrow(bytes);

  const outcome = await getDb().begin(async (transactionDb) => {
   const rows = await existingSkills(transactionDb, id);
   const review = buildSkillReview(bundle, rows);
   if (review.conflicts.length) {
    throw conflict(
     `This bundle conflicts with existing skill${review.conflicts.length === 1 ? '' : 's'}: ${review.conflicts.join(', ')}. No changes were made.`,
     review,
    );
   }

   if (review.addedSkillNames.length > 0) {
    const count = await transactionDb.unsafe(
     'select count(*)::int as total from workspace_skills where workspace_id = $1',
     [id],
    );
    if (Number(count[0]?.total || 0) + review.addedSkillNames.length > MAX_SKILLS_PER_WORKSPACE) {
     throw badRequest(`This workspace cannot hold the bundle: it would exceed ${MAX_SKILLS_PER_WORKSPACE} skills.`);
    }
   }

   const row = await writeTemplate({
    db: transactionDb,
    workspaceId: id,
    template: bundle.template,
    userId,
    source: 'imported',
    origin: {
     importedAt: new Date().toISOString(),
     format: AGENT_BUNDLE_FORMAT,
     formatVersion: AGENT_BUNDLE_VERSION,
     claimedExportedAt: String(bundle.manifest.exportedAt || ''),
     fingerprint: bundle.templateFingerprint,
     embeddedSkillCount: bundle.skills.length,
    },
   });

   const addedRows = [];
   const toAdd = new Set(review.addedSkillNames.map(skillKey));
   for (const skill of bundle.skills) {
    if (!toAdd.has(skillKey(skill.name))) continue;
    const added = await writeSkill({
     db: transactionDb,
     workspaceId: id,
     skill,
     userId,
     source: 'imported',
     origin: {
      importedAt: new Date().toISOString(),
      format: AGENT_BUNDLE_FORMAT,
      formatVersion: AGENT_BUNDLE_VERSION,
      fingerprint: skillFingerprint(skill),
     },
    });
    if (added) addedRows.push(added);
   }

   return { row, review, addedRows };
  });

  if (outcome.row) notifyDbSubscribers('workspace_agent_templates', 'INSERT', [outcome.row]);
  if (outcome.addedRows.length) notifyDbSubscribers('workspace_skills', 'INSERT', outcome.addedRows);

  if (typeof recordAudit === 'function') {
   await recordAudit({
    workspaceId: id,
    actor: { userId: String(userId || '') },
    action: 'agent_template.imported',
    target: { type: 'agent_template', id: String(outcome.row?.id || ''), label: bundle.template.name },
    after: bundle.template.slug,
    detail: {
     format: AGENT_BUNDLE_FORMAT,
     embeddedSkills: bundle.skills.length,
     addedSkills: outcome.review.addedSkillNames.length,
     reusedSkills: outcome.review.reusedSkillNames.length,
     needsSetup: outcome.review.needsSetup.length,
    },
    requestIp: requestIp || '',
   });
  }

  return {
   template: publicTemplate(outcome.row),
   addedSkillNames: outcome.review.addedSkillNames,
   reusedSkillNames: outcome.review.reusedSkillNames,
   needsSetup: outcome.review.needsSetup,
   requirements: outcome.review.requirements,
  };
 }

 return { previewAgentBundle, importAgentBundle, decodeBundle };
}

function mountAgentBundleRoutes(app, deps = {}) {
 const { requireAuth, jsonError, clientIpFromReq, previewAgentBundle, importAgentBundle, decodeBundle } = deps;

 app.post('/backend/workspaces/:id/agent-templates/import-bundle/preview', requireAuth, async (req, res) => {
  try {
   const data = await previewAgentBundle({
    userId: req.userId,
    workspaceId: req.params.id,
    bytes: decodeBundle(req.body?.bundle),
   });
   res.json({ data, error: null });
  } catch (error) {
   jsonError(res, error.status || 500, error);
  }
 });

 app.post('/backend/workspaces/:id/agent-templates/import-bundle', requireAuth, async (req, res) => {
  try {
   const data = await importAgentBundle({
    userId: req.userId,
    workspaceId: req.params.id,
    bytes: decodeBundle(req.body?.bundle),
    requestIp: clientIpFromReq ? clientIpFromReq(req) : '',
   });
   res.status(201).json({ data, error: null });
  } catch (error) {
   const body = error.details ? { data: error.details, error: { message: error.message } } : null;
   if (body) return res.status(error.status || 500).json(body);
   jsonError(res, error.status || 500, error);
  }
 });
}

module.exports = { createAgentBundles, mountAgentBundleRoutes };
