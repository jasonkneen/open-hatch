# Portable agent bundles

Agensis exports workspace templates as compressed `.agn` files. A bundle is a
ZIP archive containing:

```text
manifest.json
agent.agent.json
skills/<workspace-skill-name>/SKILL.md
```

`agent.agent.json` uses the existing `agensis.agent-template` contract. Skill
files are the existing workspace-skill rendering. Only skills referenced by the
template and present in the exporting workspace are embedded; other requested
names remain visible as setup requirements in the receiving workspace.

Import is manage-gated and review-first. The server re-validates the archive,
reuses an identical skill, stops on a same-name/different-body conflict, and
commits the template plus new skills atomically. It never creates or enables an
agent. The existing Create Agent form remains the only instantiation path.

Bundles never carry permission modes, credentials, connect tokens, host folders,
sandbox configuration, identities, live connections, memory, conversations, or
jobs. `tools`, `runtime`, and `skills` remain requests or advisory labels.

The web app accepts `.agn` files through the template picker or by dropping one
on the Create Agent chooser. The desktop app registers `.agn` with Electron, so
double-clicking a bundle or opening one while the app is already running sends
it to the same review flow.
