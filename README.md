# 🎛️ Agent Studio (Hermes UI) for Google Antigravity

A native visual side-pane dashboard for managing AI agents, active Swarm members, personas, tool permissions, and an interactive **Agent × Skills Matrix** inside **Google Antigravity** and **Antigravity IDE**.

Supports instant UI localization in **English (`EN`)**, **Russian (`RU`)**, and **Uzbek (`UZ`)**.

---

## ✨ Key Features

- **Team & Persona Manager:**
  - Unified view of global agent templates (`agents/*.md`) and active conversation Swarm members (`🐝 Chat Swarm`).
  - Customizable one-click **Specialization + Persona** preset buttons with a dedicated settings modal (`⚙️ Presets`).
  - Fine-grained tool permission toggles (`read_file`, `write_file`, `edit_file`, `run_command`, `manage_task`, `search_web`).
  - Safe deletion of agents and custom skills with confirmation dialogs.
- **Hermes-Style Skills Matrix:**
  - Full **Agents × Skills** overview table allowing one-click skill assignment across your entire team.
  - Built-in `SKILL.md` inspector and live code editor: click any skill to view or edit its activation description and full Markdown instructions directly inside the panel.
  - Create new global skills (`~/.gemini/config/skills/<name>/SKILL.md`) or save safe global overrides for built-in skills without modifying system files.
- **Multi-Language Interface (`EN | RU | UZ`):**
  - Instant header language switcher (**English**, **Русский**, **O‘zbekcha**) persisted in `settings.json`.
- **Native Antigravity Design & Hot Reload:**
  - Uses Antigravity's native theme variables and typography (**Google Sans Flex** & **Google Sans Code**), adapting automatically to dark and light themes.

---

## 🚀 One-Command Installation

Run this single command in your terminal on any machine with **Google Antigravity** installed:

```bash
git clone https://github.com/msanorin-droid/antigravity-agent-studio.git ~/.gemini/config/plugins/agent-studio
```

Antigravity discovers plugins in `~/.gemini/config/plugins/` automatically (no restart required).
To open the panel in any conversation or project, click the **`+`** button in the top bar of the right-hand Auxiliary Side Pane and select **Agent Studio**.

### Updating on Other Machines

```bash
git -C ~/.gemini/config/plugins/agent-studio pull
```

### Validating with Antigravity CLI

```bash
~/.gemini/bin/agy plugin validate ~/.gemini/config/plugins/agent-studio
```

---

## 📂 Repository Structure

```text
agent-studio/
├── plugin.json                  # Antigravity plugin manifest
├── presets.json                 # Custom quick-preset buttons (Specialization + Persona)
├── assets/
│   └── logo.svg                 # Plugin icon
├── agents/                      # Saved global agent profiles (.md)
│   ├── coder.md
│   └── tester.md
└── sidecars/
    └── studio/                  # Sidecar backend & web UI
        ├── sidecar.json
        ├── package.json
        ├── main.mjs
        └── index.html
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
