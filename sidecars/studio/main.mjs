import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, watchFile, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SidecarApp } from 'sidecar_sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-restart sidecar when main.mjs is updated on disk (restart_policy: "always" respawns it immediately)
watchFile(__filename, { interval: 1000 }, () => {
  process.exit(0);
});

const HOME = homedir();
const GEMINI_DIR = join(HOME, '.gemini');
const CONFIG_DIR = join(GEMINI_DIR, 'config');
const STUDIO_DIR = join(CONFIG_DIR, 'plugins', 'agent-studio');
const STUDIO_AGENTS_DIR = join(STUDIO_DIR, 'agents');
const HIDDEN_AGENTS_FILE = join(STUDIO_DIR, 'hidden_agents.json');
const PRESETS_FILE = join(STUDIO_DIR, 'presets.json');
const SETTINGS_FILE = join(STUDIO_DIR, 'settings.json');
const GLOBAL_SKILLS_DIR = join(CONFIG_DIR, 'skills');

const DEFAULT_PRESETS = [
  {
    id: 'preset-qa',
    label: '🎯 Строгий QA',
    roleTitle: 'Строгий QA-инженер и специалист по автотестам',
    persona:
      'Ты — въедливый и строгий QA-инженер. Проверяй все граничные случаи и обработку ошибок. Никогда не редактируй чужой код сам — возвращай баг-репорт разработчику.',
  },
  {
    id: 'preset-coder',
    label: '⚡ Senior Coder',
    roleTitle: 'Ведущий разработчик архитектуры и чистого кода',
    persona:
      'Ты — лаконичный Senior-разработчик. Пиши чистый, модульный код без лишних зависимостей. Отвечай коротко и только по делу.',
  },
  {
    id: 'preset-sec',
    label: '🛡️ Security & Review',
    roleTitle: 'Архитектор и аудитор информационной безопасности',
    persona:
      'Ты — архитектор и ревьюер безопасности. Проверяй код на утечки, ошибки доступа, читаемость и соответствие лучшим практикам.',
  },
  {
    id: 'preset-mentor',
    label: '🎓 Наставник',
    roleTitle: 'Технический наставник и архитектор решений',
    persona:
      'Ты — терпеливый технический наставник. Объясняй каждое решение простыми словами и приводи наглядные примеры.',
  },
];

function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function safeRead(file) {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function getSettings() {
  try {
    const raw = safeRead(SETTINGS_FILE);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      lang: ['ru', 'en', 'uz'].includes(parsed?.lang) ? parsed.lang : 'ru',
    };
  } catch {
    return { lang: 'ru' };
  }
}

function saveSettings(obj) {
  mkdirSync(STUDIO_DIR, { recursive: true });
  const current = getSettings();
  const next = { ...current, ...obj };
  writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

function getPresets() {
  try {
    const raw = safeRead(PRESETS_FILE);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

function savePresets(list) {
  mkdirSync(STUDIO_DIR, { recursive: true });
  writeFileSync(PRESETS_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function getHiddenAgents() {
  try {
    const raw = safeRead(HIDDEN_AGENTS_FILE);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveHiddenAgents(set) {
  try {
    mkdirSync(STUDIO_DIR, { recursive: true });
    writeFileSync(HIDDEN_AGENTS_FILE, JSON.stringify([...set], null, 2), 'utf-8');
  } catch {}
}

function parseFrontmatter(raw) {
  if (!raw) return { meta: {}, body: '' };
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { meta: {}, body: raw.trim() };
  const yaml = match[1];
  const body = match[2].trim();
  const meta = {};
  let currentKey = null;
  for (const line of yaml.split(/\r?\n/)) {
    const kv = /^([a-zA-Z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      const k = kv[1];
      let v = kv[2].trim();
      if (v === '>-' || v === '|' || v === '') {
        currentKey = k;
        meta[k] = '';
      } else if (v.startsWith('[') && v.endsWith(']')) {
        meta[k] = v
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        currentKey = null;
      } else {
        meta[k] = v.replace(/^['"]|['"]$/g, '');
        currentKey = null;
      }
    } else if (currentKey && (line.startsWith('  ') || line.startsWith('\t'))) {
      meta[currentKey] = (meta[currentKey] ? meta[currentKey] + ' ' : '') + line.trim();
    }
  }
  return { meta, body };
}

function discoverSkills() {
  const skillsMap = new Map();

  const scanSkillsRoot = (rootDir, sourceLabel, category) => {
    for (const folder of safeReaddir(rootDir)) {
      const skillFile = join(rootDir, folder, 'SKILL.md');
      const raw = safeRead(skillFile);
      if (!raw) continue;
      const { meta, body } = parseFrontmatter(raw);
      const name = meta.name || folder;
      if (!skillsMap.has(name)) {
        skillsMap.set(name, {
          name,
          folder,
          description: meta.description || body.slice(0, 180) || 'Antigravity Skill',
          body: body || '',
          source: sourceLabel,
          category,
          path: skillFile,
          canDelete: category === 'global',
        });
      }
    }
  };

  scanSkillsRoot(GLOBAL_SKILLS_DIR, 'Global (~/.gemini/config/skills)', 'global');

  const scratchRoot = join(GEMINI_DIR, 'antigravity', 'scratch');
  for (const proj of safeReaddir(scratchRoot)) {
    scanSkillsRoot(join(scratchRoot, proj, '.agents', 'skills'), `Project: ${proj}`, 'project');
  }

  const pluginsRoot = join(CONFIG_DIR, 'plugins');
  for (const plug of safeReaddir(pluginsRoot)) {
    scanSkillsRoot(join(pluginsRoot, plug, 'skills'), `Plugin: ${plug}`, 'plugin');
  }

  scanSkillsRoot(join(GEMINI_DIR, 'antigravity', 'builtin', 'skills'), 'Built-in', 'builtin');

  return [...skillsMap.values()];
}

function readSwarmForConversation(convId) {
  if (!convId || !/^[0-9a-f-]{8,}$/i.test(convId)) return null;
  const brainRoot = join(GEMINI_DIR, 'antigravity', 'brain');

  const parseSwarmAt = (cId) => {
    const swarmDir = join(brainRoot, cId, '.system_generated', 'swarm');
    const membersRaw = safeRead(join(swarmDir, 'members.json'));
    if (!membersRaw) return null;
    try {
      const parsed = JSON.parse(membersRaw);
      const boardRaw = safeRead(join(swarmDir, 'board.jsonl')) || '';
      const boardLines = boardRaw
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const memberEntries = Object.entries(parsed.members || {});
      return {
        convId: cId,
        title: parsed.title || `Swarm ${cId.slice(0, 8)}`,
        members: memberEntries.map(([mName, mObj]) => {
          const briefMsg = boardLines.find(
            (msg) => msg.agent === 'coordinator' && String(msg.text || '').includes(`@${mName}`)
          );
          return {
            name: mName,
            role: mObj.role || 'worker',
            model: mObj.model || '',
            conversation_id: mObj.conversation_id || '',
            killed: Boolean(mObj.killed),
            brief: briefMsg ? briefMsg.text : '',
          };
        }),
      };
    } catch {
      return null;
    }
  };

  const direct = parseSwarmAt(convId);
  if (direct) return direct;

  for (const cand of safeReaddir(brainRoot)) {
    const sw = parseSwarmAt(cand);
    if (sw && sw.members.some((m) => m.conversation_id === convId)) {
      return sw;
    }
  }
  return null;
}

function discoverAgentsAndSwarms(currentConvId) {
  const agents = [];
  const hidden = getHiddenAgents();

  const pluginsRoot = join(CONFIG_DIR, 'plugins');
  for (const plug of safeReaddir(pluginsRoot)) {
    const agentsDir = join(pluginsRoot, plug, 'agents');
    for (const file of safeReaddir(agentsDir)) {
      if (!file.endsWith('.md')) continue;
      const fullPath = join(agentsDir, file);
      const raw = safeRead(fullPath);
      if (!raw) continue;
      const { meta, body } = parseFrontmatter(raw);
      const cleanBody = body.replace(/\n*## Назначенные скиллы[\s\S]*$/, '').trim();
      const slug = basename(file, '.md');
      agents.push({
        id: slug,
        name: meta.name || slug,
        roleTitle: meta.description || 'Global Agent Template',
        model: meta.studio_model || meta.model || 'gemini-3.8-flash-medium',
        tools: Array.isArray(meta.tools)
          ? meta.tools
          : ['read_file', 'edit_file', 'write_file', 'run_command', 'manage_task'],
        skills: Array.isArray(meta.skills) ? meta.skills : [],
        persona: cleanBody,
        source: plug === 'agent-studio' ? '🌍 Template' : `Plugin: ${plug}`,
        scopeType: 'global_template',
        canDelete: true,
        path: fullPath,
        swarmStatus: null,
      });
    }
  }

  const currentSwarm = readSwarmForConversation(currentConvId);

  if (currentSwarm) {
    for (const sm of currentSwarm.members) {
      if (sm.killed || hidden.has(sm.name)) continue;
      const existing = agents.find(
        (a) => a.id === sm.name || a.name === sm.name || a.name === `studio-${sm.name}`
      );
      if (existing) {
        existing.swarmStatus = {
          swarmTitle: currentSwarm.title,
          role: sm.role,
          liveModel: sm.model,
          brief: sm.brief,
        };
      } else {
        agents.push({
          id: sm.name,
          name: sm.name,
          roleTitle: sm.role === 'coordinator' ? 'Swarm Coordinator' : 'Swarm Worker',
          model: sm.model || 'gemini-3.8-flash-medium',
          tools: ['read_file', 'edit_file', 'write_file', 'run_command', 'manage_task', 'search_web'],
          skills: [],
          persona: sm.brief || `Swarm member "${currentSwarm.title}" (${sm.name}).`,
          source: `🐝 Chat Swarm`,
          scopeType: 'chat_swarm_only',
          canDelete: true,
          path: join(STUDIO_AGENTS_DIR, `${sm.name}.md`),
          swarmStatus: {
            swarmTitle: currentSwarm.title,
            role: sm.role,
            liveModel: sm.model,
            brief: sm.brief,
          },
        });
      }
    }
  }

  return { agents, latestSwarm: currentSwarm };
}

function decodePayload(data) {
  if (!data || !data.payload) return null;
  try {
    const jsonStr = Buffer.from(String(data.payload), 'base64').toString('utf-8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

const app = new SidecarApp();

app.page('/', () => readFileSync(join(__dirname, 'index.html'), 'utf-8'));

app.api(
  '/api/state',
  (data) => {
    const convId = (data && data.conversationId) || app.config?.conversationId || '';
    const skills = discoverSkills();
    const { agents, latestSwarm } = discoverAgentsAndSwarms(convId);
    const presets = getPresets();
    const settings = getSettings();
    return {
      ok: true,
      conversationId: convId,
      skills,
      agents,
      latestSwarm,
      presets,
      settings,
    };
  },
  'GET'
);

app.api(
  '/api/save-settings',
  (data) => {
    const p = decodePayload(data);
    if (!p) return { ok: false };
    const next = saveSettings(p);
    return { ok: true, settings: next };
  },
  'GET'
);

app.api(
  '/api/save-presets',
  (data) => {
    const p = decodePayload(data);
    if (!p || !Array.isArray(p.presets)) return { ok: false, error: 'Invalid presets list' };
    const clean = p.presets
      .map((item, idx) => ({
        id: String(item.id || `preset-${idx + 1}`),
        label: String(item.label || 'Preset').trim(),
        roleTitle: String(item.roleTitle || '').trim(),
        persona: String(item.persona || '').trim(),
      }))
      .filter((item) => item.label);
    savePresets(clean);
    return {
      ok: true,
      presets: clean,
    };
  },
  'GET'
);

app.api(
  '/api/save-agent',
  (data) => {
    const p = decodePayload(data);
    if (!p || !p.id) return { ok: false, error: 'Invalid agent data' };
    const slug = String(p.id)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-agent';

    const hidden = getHiddenAgents();
    if (hidden.has(slug)) {
      hidden.delete(slug);
      saveHiddenAgents(hidden);
    }

    mkdirSync(STUDIO_AGENTS_DIR, { recursive: true });
    const agentName = slug.startsWith('studio-') ? slug : `studio-${slug}`;
    const toolsList = Array.isArray(p.tools) ? p.tools : ['read_file'];
    const skillsList = Array.isArray(p.skills) ? p.skills : [];
    const desc = String(p.roleTitle || 'Custom Agent').replace(/\r?\n/g, ' ').trim();
    const model = String(p.model || 'gemini-3.8-flash-medium').trim();
    const persona = String(p.persona || '').trim();

    let skillsBlock = '';
    if (skillsList.length > 0) {
      skillsBlock =
        '\n\n## Назначенные скиллы\nПри выполнении задач своей роли обязательно используй следующие скиллы:\n' +
        skillsList.map((s) => `- \`${s}\``).join('\n') +
        '\n';
    }

    const content = [
      '---',
      `name: ${agentName}`,
      `description: ${desc}`,
      'subagent: true',
      'mainAgent: false',
      `tools: [${toolsList.join(', ')}]`,
      `skills: [${skillsList.join(', ')}]`,
      `studio_model: ${model}`,
      '---',
      '',
      persona + skillsBlock,
    ].join('\n');

    const targetPath = join(STUDIO_AGENTS_DIR, `${slug}.md`);
    writeFileSync(targetPath, content, 'utf-8');

    return {
      ok: true,
      savedPath: targetPath,
      id: slug,
    };
  },
  'GET'
);

app.api(
  '/api/delete-agent',
  (data) => {
    const p = decodePayload(data);
    if (!p || !p.id) return { ok: false, error: 'Missing agent ID' };
    const slug = String(p.id)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '');

    const candidates = [p.path, join(STUDIO_AGENTS_DIR, `${slug}.md`)].filter(Boolean);
    let deletedFile = false;
    for (const file of candidates) {
      try {
        if (existsSync(file) && String(file).startsWith(CONFIG_DIR)) {
          unlinkSync(file);
          deletedFile = true;
        }
      } catch {}
    }

    const hidden = getHiddenAgents();
    hidden.add(slug);
    saveHiddenAgents(hidden);

    return {
      ok: true,
      deleted: deletedFile,
      id: slug,
    };
  },
  'GET'
);

app.api(
  '/api/create-skill',
  (data) => {
    const p = decodePayload(data);
    if (!p || !p.name) return { ok: false, error: 'Missing skill name' };
    const slug = String(p.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) return { ok: false, error: 'Invalid skill name (use latin letters and hyphens)' };

    const skillDir = join(GLOBAL_SKILLS_DIR, slug);
    mkdirSync(skillDir, { recursive: true });
    const desc = String(p.description || 'Custom skill').replace(/\r?\n/g, ' ').trim();
    const body = String(p.instructions || '# Instructions\nDescribe the workflow steps.').trim();

    const content = ['---', `name: ${slug}`, 'description: >-', `  ${desc}`, '---', '', body, ''].join('\n');
    const skillPath = join(skillDir, 'SKILL.md');
    writeFileSync(skillPath, content, 'utf-8');

    return {
      ok: true,
      name: slug,
      savedPath: skillPath,
    };
  },
  'GET'
);

app.api(
  '/api/save-skill',
  (data) => {
    const p = decodePayload(data);
    if (!p || !p.name) return { ok: false, error: 'Missing skill name' };
    const slug = String(p.folder || p.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '');
    const desc = String(p.description || 'Antigravity Skill').replace(/\r?\n/g, ' ').trim();
    const body = String(p.body || '').trim();

    const content = ['---', `name: ${p.name}`, 'description: >-', `  ${desc}`, '---', '', body, ''].join('\n');

    let targetPath = p.path;
    let isOverride = false;
    if (!targetPath || p.category === 'builtin' || String(targetPath).includes('/builtin/skills/')) {
      const overrideDir = join(GLOBAL_SKILLS_DIR, slug);
      mkdirSync(overrideDir, { recursive: true });
      targetPath = join(overrideDir, 'SKILL.md');
      isOverride = true;
    } else {
      mkdirSync(dirname(targetPath), { recursive: true });
    }

    writeFileSync(targetPath, content, 'utf-8');
    return {
      ok: true,
      name: p.name,
      savedPath: targetPath,
      isOverride,
    };
  },
  'GET'
);

app.api(
  '/api/delete-skill',
  (data) => {
    const p = decodePayload(data);
    if (!p || !p.folder) return { ok: false, error: 'Missing skill folder' };
    const slug = String(p.folder)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '');
    const targetDir = join(GLOBAL_SKILLS_DIR, slug);
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
      return { ok: true, deleted: true };
    }
    return { ok: false, error: 'Only custom global skills can be deleted' };
  },
  'GET'
);

app.run();
