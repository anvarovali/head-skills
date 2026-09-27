import type { Locale } from '@/i18n/locales'

/* The /submit guide, one markdown document per locale (rendered by the escaping Markdown component).
   Mirrors CONTRIBUTING.md and scripts/validate-skills.mjs: when a rule changes there, change it here.
   Uzbek uses ʻ (U+02BB) after o/g and ʼ (U+02BC) elsewhere, no em dashes. Keep the three in step. */

const TREE = `skills/
└── my-skill/          # folder name = skill name (kebab-case)
    ├── SKILL.md       # required: frontmatter + instructions for the agent
    ├── head.json      # how the site shows it (titles, summary, category, author)
    └── reference.md   # optional: extra files the skill links to`

const SKILL_MD = `---
name: my-skill
description: Writes and edits Telegram channel posts with a hook in the first line and one call to action. Use when the user asks to write, rewrite or shorten a Telegram post.
---

# My skill

Step-by-step instructions for the agent…`

const HEAD_JSON = `{
  "$schema": "../../schemas/head.schema.json",
  "title":   { "en": "My skill", "uz": "Mening skillim", "ru": "Мой скилл" },
  "summary": {
    "en": "One line for the card.",
    "uz": "Kartochka uchun bitta qator.",
    "ru": "Одна строка для карточки."
  },
  "category": "content",
  "author": { "name": "Your Name", "github": "your-github-username" },
  "youtube": {}
}`

const COPY = `cp -r templates/skill skills/my-skill`
const CHECK = `npm install
npm run validate:skills`
const TRY = `npx skills add ./ -s my-skill -a claude-code -g`

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

const uz = `## Skill nima?

Skill bu **SKILL.md** fayli bor papka. Agent (Claude Code, Codex, Cursor va boshqalar) avval faqat \`description\`ni oʻqiydi va vazifaga mos kelsa, qolgan faylni yuklaydi. Shu sabab eng muhim qator \`description\`: unda skill **nima qiladi** va **qachon ishlatiladi**, ikkalasi ham boʻlsin.

## Papka shabloni

${fence('text', TREE)}

### SKILL.md

Fayl YAML frontmatter bilan boshlanadi. \`name\` papka nomi bilan aynan bir xil. \`description\`ni inglizcha, uchinchi shaxsda yozing va “Use when...” jumlasini qoʻshing: foydalanuvchi aslida yozadigan soʻzlarni sanab oʻting.

${fence('markdown', SKILL_MD)}

### head.json

Sayt uchun: nom va qisqa tavsif (\`en\` majburiy, \`uz\` va \`ru\`ni ham yozing), \`category\` va \`author\`. Kategoriyalar: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Qadamlar

1. [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills) repozitoriysini **fork** qiling va klonlang.
2. Shablonni nusxalang. Papka nomi skill nomi boʻladi:

${fence('bash', COPY)}

3. \`SKILL.md\` va \`head.json\`ni toʻldiring.
4. Tekshiring:

${fence('bash', CHECK)}

5. Skillni oʻz agentingizda sinab koʻring va u ishga tushishini tekshiring:

${fence('bash', TRY)}

6. Skill qoʻshgan yoki nomini oʻzgartirgan boʻlsangiz, \`npm run catalog\`ni ishga tushiring va yangilangan \`.claude-plugin/marketplace.json\`ni ham commit qiling.
7. Pull request oching va shablondagi roʻyxatni belgilang.

## Avtomatik tekshiruvlar

Har bir pull requestda CI \`npm run validate:skills\`ni ishga tushiradi. Birorta xato boʻlsa, merge bloklanadi:

- **name** papka nomiga teng: kichik lotin harflari, raqamlar va \`-\`, 64 belgigacha, “claude” va “anthropic” soʻzlarisiz.
- **description** 20 dan 1024 gacha belgi, XML teglarsiz (\`<tag>\`). “Use when...” boʻlmasa, ogohlantirish chiqadi.
- **Hajm**: papka 2 MB gacha, har bir fayl 1 MB gacha. Faqat matnli fayllar va rasmlar (png, jpg, gif, webp, avif, ico, svg), symlinklarsiz.
- **Maxfiy maʼlumotlar yoʻq**: API kalitlar, tokenlar, private keylar, \`.env\` fayllar. Tasodifan qoʻshilgan boʻlsa, kalitni darhol bekor qiling (revoke).
- **Xavfli buyruqlar yoʻq**: \`curl ... | bash\`, base64 bilan yashirilgan kod, internetdan yuklangan kodni \`eval\` qilish.
- **Yashirin matn yoʻq**: koʻrinmas Unicode belgilar va “ignore previous instructions” kabi prompt-injection iboralari.
- **head.json** sxemaga mos: mavjud \`category\`, tillar faqat \`uz\`, \`ru\`, \`en\`, YouTube qiymati toʻliq havola emas, 11 belgili video id.

Skillingiz bunday iborani misol sifatida keltirishi shart boʻlsa, oʻsha qatorga \`head-skills-allow: <rule>\` deb yozing. Xato ogohlantirishga aylanadi va maintainer qatorni qoʻlda koʻradi. Maxfiy maʼlumotlar va koʻrinmas belgilarga ruxsat berilmaydi.

## Keyin nima boʻladi

CI validatorni ishga tushiradi va saytni yigʻadi. Soʻng maintainer skillni oʻqiydi, sinab koʻradi va merge qiladi. Shundan keyin u [skills.head.uz](https://skills.head.uz)da paydo boʻladi.

## Praktikum 2026 nishoni

\`badges\` va \`featured\` maydonlarini maintainerlar qoʻyadi, ularni boʻsh qoldiring. AI Praktikum talabalarining qabul qilingan skillʼlari **Praktikum 2026** nishonini oladi: PR tavsifida praktikum guruhingizni yozing.
`

const ru = `## Что такое скилл?

Скилл это папка с файлом **SKILL.md**. Агент (Claude Code, Codex, Cursor и другие) сначала читает только \`description\` и загружает остальное, когда задача подходит. Поэтому самая важная строка — \`description\`: в ней должно быть и **что делает** скилл, и **когда его использовать**.

## Шаблон папки

${fence('text', TREE)}

### SKILL.md

Файл начинается с YAML-frontmatter. \`name\` точно совпадает с именем папки. \`description\` пишите на английском, в третьем лице, и добавьте фразу «Use when...» со словами, которые пользователи реально пишут.

${fence('markdown', SKILL_MD)}

### head.json

Для сайта: название и короткое описание (\`en\` обязательно, добавьте \`uz\` и \`ru\`), \`category\` и \`author\`. Категории: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Шаги

1. Сделайте **fork** репозитория [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills) и клонируйте его.
2. Скопируйте шаблон. Имя папки станет именем скилла:

${fence('bash', COPY)}

3. Заполните \`SKILL.md\` и \`head.json\`.
4. Проверьте:

${fence('bash', CHECK)}

5. Попробуйте скилл в своём агенте и убедитесь, что он срабатывает:

${fence('bash', TRY)}

6. Если вы добавили или переименовали скилл, запустите \`npm run catalog\` и закоммитьте обновлённый \`.claude-plugin/marketplace.json\`.
7. Откройте pull request и отметьте чек-лист из шаблона.

## Автоматические проверки

На каждый pull request CI запускает \`npm run validate:skills\`. Любая ошибка блокирует merge:

- **name** совпадает с именем папки: строчные латинские буквы, цифры и \`-\`, до 64 символов, без слов «claude» и «anthropic».
- **description** от 20 до 1024 символов, без XML-тегов (\`<tag>\`). Без «Use when...» будет предупреждение.
- **Размер**: папка до 2 МБ, каждый файл до 1 МБ. Только текстовые файлы и изображения (png, jpg, gif, webp, avif, ico, svg), без симлинков.
- **Никаких секретов**: API-ключи, токены, приватные ключи, файлы \`.env\`. Если ключ попал в коммит, сразу отзовите его.
- **Никаких опасных команд**: \`curl ... | bash\`, код, спрятанный в base64, \`eval\` кода, скачанного из интернета.
- **Никакого скрытого текста**: невидимые символы Unicode и prompt-injection фразы вроде «ignore previous instructions».
- **head.json** соответствует схеме: существующая \`category\`, языки только \`uz\`, \`ru\`, \`en\`, для YouTube — 11-символьный id видео, а не ссылка.

Если скиллу действительно нужно процитировать такой шаблон как пример, добавьте на эту строку \`head-skills-allow: <rule>\`. Ошибка станет предупреждением, и мейнтейнер проверит строку вручную. Секреты и невидимые символы разрешить нельзя.

## Что дальше

CI запускает валидатор и собирает сайт. Затем мейнтейнер читает скилл, пробует его и делает merge. После этого скилл появляется на [skills.head.uz](https://skills.head.uz).

## Бейдж Praktikum 2026

Поля \`badges\` и \`featured\` ставят мейнтейнеры, оставьте их пустыми. Принятые скиллы студентов AI Praktikum получают бейдж **Praktikum 2026**: укажите свою группу практикума в описании PR.
`

const en = `## What is a skill?

A skill is a folder with a **SKILL.md** file. An agent (Claude Code, Codex, Cursor and others) first reads only the \`description\`, and loads the rest when the task matches. That makes \`description\` the most important line you write: it has to say **what the skill does** and **when to use it**.

## The folder template

${fence('text', TREE)}

### SKILL.md

The file starts with YAML frontmatter. \`name\` is exactly the folder name. Write the \`description\` in English, in the third person, with a “Use when...” sentence listing the words users actually type.

${fence('markdown', SKILL_MD)}

### head.json

For the site: the title and one-line summary (\`en\` required, please add \`uz\` and \`ru\`), \`category\` and \`author\`. Categories: \`workflow\`, \`design\`, \`frontend\`, \`backend\`, \`content\`, \`productivity\`.

${fence('json', HEAD_JSON)}

## Steps

1. **Fork** [github.com/anvarovali/head-skills](https://github.com/anvarovali/head-skills) and clone your fork.
2. Copy the template. The folder name becomes the skill name:

${fence('bash', COPY)}

3. Fill in \`SKILL.md\` and \`head.json\`.
4. Check it:

${fence('bash', CHECK)}

5. Try it in your own agent and check that it actually triggers:

${fence('bash', TRY)}

6. If you added or renamed a skill, run \`npm run catalog\` and commit the updated \`.claude-plugin/marketplace.json\`.
7. Open a pull request and tick the checklist.

## Automated checks

CI runs \`npm run validate:skills\` on every pull request. Any error blocks the merge:

- **name** equals the folder name: lowercase letters, digits and single hyphens, at most 64 characters, without the words “claude” or “anthropic”.
- **description** is 20 to 1024 characters, with no XML tags (\`<tag>\`). Missing a “Use when...” gives a warning.
- **Size**: the folder is at most 2 MB, each file at most 1 MB. Only text files and images (png, jpg, gif, webp, avif, ico, svg), no symlinks.
- **No secrets**: API keys, tokens, private keys or \`.env\` files. If one was ever committed, revoke it right away.
- **No unsafe instructions**: \`curl ... | bash\`, code hidden in base64, \`eval\` of code downloaded from the internet.
- **No hidden text**: invisible Unicode characters, or prompt-injection phrases such as “ignore previous instructions”.
- **head.json** matches the schema: a known \`category\`, languages only \`uz\`, \`ru\`, \`en\`, and YouTube values are the 11-character video id, not the full link.

If your skill genuinely has to quote a flagged pattern as an example, put \`head-skills-allow: <rule>\` on that line. The error becomes a warning and a maintainer reviews the line by hand. Secrets and hidden characters can never be allowed.

## What happens next

CI runs the validator and builds the site. A maintainer then reads the skill, tries it, and merges it. After the merge it appears on [skills.head.uz](https://skills.head.uz).

## The Praktikum 2026 badge

\`badges\` and \`featured\` are set by maintainers, so leave them out. Accepted skills by AI Praktikum students get the **Praktikum 2026** badge: mention your praktikum group in the PR description.
`

export const submitGuide: Record<Locale, string> = { uz, ru, en }

export const checksList: Record<Locale, string[]> = {
  uz: ['name papka nomiga teng, 64 belgigacha', 'description: 20–1024 belgi', 'Papka 2 MB, fayl 1 MB gacha', 'Maxfiy maʼlumotlar va .env yoʻq', 'Xavfli buyruqlar va yashirin matn yoʻq', 'head.json sxemaga mos'],
  ru: ['name = имя папки, до 64 символов', 'description: 20–1024 символа', 'Папка до 2 МБ, файл до 1 МБ', 'Никаких секретов и .env', 'Никаких опасных команд и скрытого текста', 'head.json по схеме'],
  en: ['name = folder name, ≤ 64 characters', 'description: 20–1024 characters', 'Folder ≤ 2 MB, each file ≤ 1 MB', 'No secrets or .env files', 'No unsafe commands or hidden text', 'head.json matches the schema'],
}

export const folderTemplate = COPY
export const checkCommand = 'npm run validate:skills'
