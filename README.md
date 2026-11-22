# 🎛️ Agent Studio (Hermes UI) for Google Antigravity

Визуальная боковая панель управления агентами, участниками роя (Swarm), их характером, инструментами и матрицей скиллов для **Google Antigravity** и **Antigravity IDE** (на 3 языках: **RU / EN / UZ**).

---

## ✨ Возможности / Features

- **Команда и Характер (Team & Persona):**
  - Единый обзор всех глобальных шаблонов агентов (`agents/*.md`) и участников активного роя текущего чата (`🐝 Chat Swarm`).
  - Быстрые настраиваемые кнопки-шаблоны (**Специализация + Характер**) с отдельным окном редактирования (`⚙️ Шаблоны`).
  - Управление разрешёнными инструментами (`read_file`, `write_file`, `edit_file`, `run_command`, `manage_task`, `search_web`).
- **Матрица скиллов (Hermes-style Skills Matrix):**
  - Таблица «Все агенты × Все скиллы» для назначения навыков в один клик.
  - Встроенный просмотр и редактирование полного текста `SKILL.md` любого навыка прямо в панели.
  - Создание и удаление пользовательских глобальных скиллов (`~/.gemini/config/skills/`).
- **Мультиязычный интерфейс:**
  - Мгновенное переключение языка панели: **Русский (`RU`)**, **English (`EN`)**, **O‘zbekcha (`UZ`)**.

---

## 🚀 Установка одной командой / One-Command Install

На любом компьютере с установленным **Google Antigravity** выполните в терминале:

```bash
git clone https://github.com/msanorin-droid/antigravity-agent-studio.git ~/.gemini/config/plugins/agent-studio
```

Плагин подхватится автоматически (без перезапуска). Откройте правую боковую панель в любом чате, нажмите **`+`** и выберите **Agent Studio**.

### Обновление на других компьютерах / Updating

```bash
git -C ~/.gemini/config/plugins/agent-studio pull
```

### Проверка валидатором Antigravity CLI

```bash
~/.gemini/bin/agy plugin validate ~/.gemini/config/plugins/agent-studio
```

---

## 📂 Структура плагина

```text
agent-studio/
├── plugin.json                  # Манифест плагина Antigravity
├── presets.json                 # Быстрые кнопки-шаблоны (Специализация + Характер)
├── assets/
│   └── logo.svg                 # Иконка плагина
├── agents/                      # Сохранённые глобальные профили агентов (.md)
│   ├── coder.md
│   └── tester.md
└── sidecars/
    └── studio/                  # Сервер и веб-интерфейс боковой панели
        ├── sidecar.json
        ├── package.json
        ├── main.mjs
        └── index.html
```

---

## 📄 Лицензия / License

MIT License
