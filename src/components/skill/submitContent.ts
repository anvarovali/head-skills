import type { Locale } from '@/i18n/locales'

/* The /submit guide, one markdown document per locale (rendered by the escaping Markdown component).
   Uzbek uses ʻ (U+02BB) / ‘ apostrophes. Keep the three in step when editing. */

const TREE = `skills/
└── my-skill/          # folder name = the skill name (lowercase, hyphens)
    ├── SKILL.md       # required: frontmatter + instructions for the agent
    ├── head.json      # required: how the site shows it (titles, summary, category, author)
    └── references/    # optional: extra files the skill reads (scripts, examples, docs)`

const SKILL_MD = `---
name: my-skill
description: What this skill does and exactly when the agent should use it. Write it in English — agents read it to decide whether to trigger.
---

# My skill

Step-by-step instructions for the agent…`

const HEAD_JSON = `{
  "title":   { "en": "My skill", "uz": "Mening skillʼim", "ru": "Мой скилл" },
  "summary": {
    "en": "One line for the card.",
    "uz": "Kartochka uchun bitta qator.",
    "ru": "Одна строка для карточки."
  },
  "category": "productivity",
  "author": { "name": "Your Name", "github": "your-github" }
}`

const GIT = `git clone https://github.com/<you>/head-skills
cd head-skills
git checkout -b add-my-skill
# add skills/my-skill/SKILL.md and skills/my-skill/head.json
git add skills/my-skill
git commit -m "Add my-skill"
git push -u origin add-my-skill`

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

const uz = `## Skill nima?

Skill - bu agent uchun yozilgan qoʻllanma: bitta papka, ichida **SKILL.md** fayli. Agent (Claude Code, Codex, Cursor va boshqalar) vazifa skill tavsifiga mos kelganda uni oʻqiydi va koʻrsatmalarga amal qiladi. Yaxshi skill bitta aniq ishni puxta bajaradi: masalan, dizaynni tekshirish, hisobot tayyorlash yoki kodni maʼlum qoidalar boʻyicha yozish.

## Papka shabloni

Har bir skill \`skills/\` ichida alohida papkada turadi:

${fence('text', TREE)}

### SKILL.md

Faylning boshida YAML frontmatter boʻlishi shart. \`name\` papka nomiga teng boʻlishi kerak. \`description\`ni ingliz tilida yozing - agent aynan shu matnga qarab skillʼni qachon ishlatishni hal qiladi.

${fence('markdown', SKILL_MD)}

### head.json

Bu fayl faqat sayt uchun: skillʼning nomi va qisqa tavsifi uch tilda, kategoriya va muallif. Kategoriyalar: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Pull request ochish

1. [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills) repozitoriysini fork qiling.
2. Yangi branch oching va papkangizni qoʻshing:

${fence('bash', GIT)}

3. GitHubʼda **Compare & pull request** tugmasini bosing. Tavsifda skill nima qilishini va uni qanday sinab koʻrganingizni yozing.

## Avtomatik tekshiruvlar

PR ochilishi bilan quyidagilar avtomatik tekshiriladi:

- **Frontmatter** - \`SKILL.md\`da \`name\` va \`description\` bor, \`name\` papka nomiga teng.
- **head.json** - sxemaga mos: uch tildagi \`title\` va \`summary\`, mavjud kategoriya, muallif.
- **Hajm chegarasi** - papka belgilangan hajmdan oshmaydi; katta media fayllar qoʻshmang.
- **Maxfiy maʼlumotlar yoʻq** - API kalitlar, tokenlar, parollar topilsa PR toʻxtatiladi.
- **Xavfli andozalar yoʻq** - masalan, \`curl … | sh\` kabi internetdan yuklab darhol ishga tushirish.

## Koʻrib chiqish

Tekshiruvlardan oʻtgan har bir PRʼni maintainer qoʻlda koʻrib chiqadi: koʻrsatmalar aniqmi, skill haqiqatan foydalimi va xavfsizmi. Kerak boʻlsa, izohlar qoldiriladi - ularni tuzatib, oʻsha branchʼga push qiling.

## Praktikum 2026 nishoni

AI Praktikum talabalarining qabul qilingan skillʼlari **Praktikum 2026** nishonini oladi va marketplaceʼda alohida koʻrsatiladi. PR tavsifida praktikum guruhingizni koʻrsating.
`

const ru = `## Что такое скилл?

Скилл — это инструкция для агента: одна папка с файлом **SKILL.md** внутри. Агент (Claude Code, Codex, Cursor и другие) читает её, когда задача подходит под описание скилла, и следует инструкциям. Хороший скилл хорошо делает одну конкретную вещь: например, проверяет дизайн, готовит отчёт или пишет код по определённым правилам.

## Шаблон папки

Каждый скилл лежит в отдельной папке внутри \`skills/\`:

${fence('text', TREE)}

### SKILL.md

В начале файла обязателен YAML-frontmatter. \`name\` должен совпадать с именем папки. \`description\` пишите на английском — именно по нему агент решает, когда использовать скилл.

${fence('markdown', SKILL_MD)}

### head.json

Этот файл нужен только сайту: название и короткое описание на трёх языках, категория и автор. Категории: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Как открыть pull request

1. Сделайте fork репозитория [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills).
2. Создайте ветку и добавьте свою папку:

${fence('bash', GIT)}

3. На GitHub нажмите **Compare & pull request**. В описании расскажите, что делает скилл и как вы его проверили.

## Автоматические проверки

Сразу после открытия PR автоматически проверяется:

- **Frontmatter** — в \`SKILL.md\` есть \`name\` и \`description\`, \`name\` совпадает с именем папки.
- **head.json** — соответствует схеме: \`title\` и \`summary\` на трёх языках, существующая категория, автор.
- **Лимит размера** — папка не превышает допустимый размер; не добавляйте тяжёлые медиафайлы.
- **Никаких секретов** — если найдены API-ключи, токены или пароли, PR останавливается.
- **Никаких опасных шаблонов** — например, \`curl … | sh\`, то есть скачать из интернета и сразу выполнить.

## Ревью

Каждый PR, прошедший проверки, вручную просматривает мейнтейнер: понятны ли инструкции, полезен ли скилл и безопасен ли он. Если нужны правки, он оставит комментарии — исправьте и сделайте push в ту же ветку.

## Бейдж Praktikum 2026

Принятые скиллы студентов AI Praktikum получают бейдж **Praktikum 2026** и отдельно отмечаются в маркетплейсе. Укажите в описании PR свою группу практикума.
`

const en = `## What is a skill?

A skill is a playbook for an agent: one folder with a **SKILL.md** file in it. An agent (Claude Code, Codex, Cursor and others) reads it when a task matches the skill’s description, then follows the instructions. A good skill does one specific job well: reviewing a design, preparing a report, writing code to a set of rules.

## The folder template

Every skill lives in its own folder under \`skills/\`:

${fence('text', TREE)}

### SKILL.md

The file must start with YAML frontmatter. \`name\` must equal the folder name. Write \`description\` in English — it is what the agent reads to decide when to use the skill.

${fence('markdown', SKILL_MD)}

### head.json

This file is for the site only: the skill’s title and one-line summary in three languages, its category and its author. Categories: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Open a pull request

1. Fork [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills).
2. Create a branch and add your folder:

${fence('bash', GIT)}

3. On GitHub, click **Compare & pull request**. In the description, say what the skill does and how you tested it.

## Automated checks

As soon as the PR is opened, these run automatically:

- **Frontmatter** — \`SKILL.md\` has \`name\` and \`description\`, and \`name\` equals the folder name.
- **head.json** — matches the schema: \`title\` and \`summary\` in three languages, a known category, an author.
- **Size limit** — the folder stays under the size limit; don’t commit large media.
- **No secrets** — API keys, tokens or passwords stop the PR.
- **No unsafe patterns** — for example \`curl … | sh\`, downloading and running code in one go.

## Review

A maintainer reads every PR that passes the checks: are the instructions clear, is the skill useful, is it safe. If something needs a change you’ll get comments — fix them and push to the same branch.

## The Praktikum 2026 badge

Accepted skills by AI Praktikum students get the **Praktikum 2026** badge and are highlighted in the marketplace. Mention your praktikum group in the PR description.
`

export const submitGuide: Record<Locale, string> = { uz, ru, en }

export const checksList: Record<Locale, string[]> = {
  uz: ['Frontmatter: name va description', 'head.json sxemasi', 'Hajm chegarasi', 'Maxfiy maʼlumotlar yoʻq', 'Xavfli andozalar yoʻq (curl | sh)'],
  ru: ['Frontmatter: name и description', 'Схема head.json', 'Лимит размера', 'Никаких секретов', 'Никаких опасных шаблонов (curl | sh)'],
  en: ['Frontmatter: name and description', 'head.json schema', 'Size limit', 'No secrets', 'No unsafe patterns (curl | sh)'],
}

export const folderTemplate = `skills/my-skill/SKILL.md\nskills/my-skill/head.json`
