# Skill qoʻshish · Как добавить скилл · Contributing a skill

[Oʻzbekcha](#uz) · [Русский](#ru) · [English](#en)

---

<a id="uz"></a>

## Oʻzbekcha

Skill bu `SKILL.md` fayli bor papka. Agent (Claude Code, Codex, Cursor va boshqalar) avval faqat `description`ni oʻqiydi va vazifaga mos kelsa, qolgan faylni yuklaydi. Shu sabab eng muhim qator `description`.

### Qadamlar

1. Repozitoriyni **fork** qiling va klonlang.
2. Shablonni nusxalang. Papka nomi skill nomi boʻladi:
   ```bash
   cp -r templates/skill skills/mening-skillim
   ```
3. `skills/mening-skillim/SKILL.md` faylida `name: mening-skillim` deb yozing (papka nomi bilan aynan bir xil) va `description` hamda matnni oʻzgartiring.
4. `head.json` faylini toʻldiring: sayt uchun nom va qisqa tavsif (`en` majburiy, `uz` va `ru` ham yozing), `category`, `author`.
5. Tekshiring:
   ```bash
   npm install
   npm run validate:skills
   ```
6. Skillni oʻz agentingizda sinab koʻring:
   ```bash
   npx skills add ./ -s mening-skillim -a claude-code -g
   ```
   (`-g` skillni global oʻrnatadi, repozitoriy ichiga fayl qoʻshmaydi.) Keyin agentdan skill kerak boʻladigan ishni soʻrang va skill ishga tushganini tekshiring.
7. Pull request oching. Shablondagi roʻyxatni belgilang.

### Yaxshi `description` qanday yoziladi

Agent skillni faqat `description` orqali topadi. Unda ikki narsa boʻlsin: **nima qiladi** va **qachon ishlatiladi**.

- Uchinchi shaxsda yozing: “Writes...”, “Creates...”. “I can...” yoki “You can...” emas.
- Aniq boʻling. “Helps with documents” yomon. “Extracts tables from PDF files into Excel” yaxshi.
- “Use when...” jumlasini qoʻshing va foydalanuvchi aslida yozadigan soʻzlarni sanab oʻting, oʻzbekcha va ruscha soʻzlar ham (masalan, “post”, “eʼlon”, “пост”).
- Inglizcha yozish tavsiya etiladi: agentlar uni eng yaxshi tushunadi. Skill matni istalgan tilda boʻlishi mumkin.
- 20 dan 1024 gacha belgi. XML teglar (`<tag>`) boʻlmasin.

Yomon:
```yaml
description: Telegram uchun yordamchi.
```
Yaxshi:
```yaml
description: Writes and edits Telegram channel posts in Uzbek or Russian with a hook in the first line, short paragraphs and one call to action. Use when the user asks to write, rewrite, shorten or translate a Telegram post or channel announcement, even if they only say "post" or "e'lon".
```

### Qoidalar (CI avtomatik tekshiradi)

- `name` papka nomiga teng, faqat kichik lotin harflari, raqamlar va `-`, 64 belgigacha.
- Papka hajmi 2 MB gacha, har bir fayl 1 MB gacha. Faqat matnli fayllar va rasmlar.
- Kalitlar, tokenlar, parollar, `.env` fayllar **taqiqlanadi**. Tasodifan qoʻshgan boʻlsangiz, kalitni darhol bekor qiling (revoke).
- Xavfli buyruqlar taqiqlanadi: `curl ... | bash`, base64 bilan yashirilgan kod, internetdan yuklangan kodni `eval` qilish.
- Koʻrinmas Unicode belgilar va “ignore previous instructions” kabi prompt-injection iboralari taqiqlanadi.
- `badges` va `featured` maydonlarini **maintainerlar** qoʻyadi. Ularni boʻsh qoldiring.

Agar skillingiz bunday iborani misol sifatida keltirishi shart boʻlsa (masalan, xavfsizlik haqidagi skill), oʻsha qatorga `head-skills-allow: prompt-injection` deb yozing. Bu xatoni ogohlantirishga aylantiradi va maintainer qatorni qoʻlda koʻrib chiqadi.

---

<a id="ru"></a>

## Русский

Скилл это папка с файлом `SKILL.md`. Агент (Claude Code, Codex, Cursor и другие) сначала читает только `description` и загружает остальное, когда задача подходит. Поэтому самая важная строка — `description`.

### Шаги

1. Сделайте **fork** репозитория и клонируйте его.
2. Скопируйте шаблон. Имя папки станет именем скилла:
   ```bash
   cp -r templates/skill skills/moy-skill
   ```
3. В `skills/moy-skill/SKILL.md` укажите `name: moy-skill` (точно как папка) и перепишите `description` и текст.
4. Заполните `head.json`: название и короткое описание для сайта (`en` обязательно, добавьте `uz` и `ru`), `category`, `author`.
5. Проверьте:
   ```bash
   npm install
   npm run validate:skills
   ```
6. Попробуйте скилл в своём агенте:
   ```bash
   npx skills add ./ -s moy-skill -a claude-code -g
   ```
   (`-g` ставит скилл глобально и не добавляет файлы в репозиторий.) Попросите агента сделать задачу, для которой нужен скилл, и убедитесь, что он сработал.
7. Откройте pull request и отметьте пункты чек-листа.

### Как написать хороший `description`

Агент находит скилл только по `description`. В нём должно быть два ответа: **что делает** и **когда использовать**.

- Пишите от третьего лица: «Writes...», «Creates...». Не «I can...» и не «You can...».
- Конкретно. «Helps with documents» плохо. «Extracts tables from PDF files into Excel» хорошо.
- Добавьте фразу «Use when...» и перечислите слова, которые пользователь реально пишет, в том числе по-узбекски и по-русски («пост», «eʼlon»).
- Лучше писать по-английски: агенты понимают его лучше всего. Сам текст скилла может быть на любом языке.
- От 20 до 1024 символов, без XML-тегов (`<tag>`).

Плохо:
```yaml
description: Помощник для Telegram.
```
Хорошо:
```yaml
description: Writes and edits Telegram channel posts in Uzbek or Russian with a hook in the first line, short paragraphs and one call to action. Use when the user asks to write, rewrite, shorten or translate a Telegram post or channel announcement, even if they only say "пост" or "e'lon".
```

### Правила (CI проверяет автоматически)

- `name` совпадает с именем папки: строчные латинские буквы, цифры и `-`, до 64 символов.
- Папка до 2 МБ, каждый файл до 1 МБ. Только текстовые файлы и изображения.
- **Нельзя**: ключи, токены, пароли, файлы `.env`. Если ключ случайно попал в коммит, сразу отзовите его (revoke).
- Нельзя опасные команды: `curl ... | bash`, код, спрятанный в base64, `eval` кода из интернета.
- Нельзя невидимые Unicode-символы и фразы prompt-injection вроде «ignore previous instructions».
- `badges` и `featured` ставят **мейнтейнеры**. Оставьте их пустыми.

Если скиллу действительно нужно процитировать такую фразу как пример (скилл про безопасность), добавьте на эту строку `head-skills-allow: prompt-injection`. Ошибка станет предупреждением, и мейнтейнер проверит строку вручную.

---

<a id="en"></a>

## English

A skill is a folder with a `SKILL.md` file. An agent (Claude Code, Codex, Cursor and others) first reads only the `description`, and loads the rest when the task matches. That makes `description` the most important line you write.

### Steps

1. **Fork** the repository and clone your fork.
2. Copy the template. The folder name becomes the skill name:
   ```bash
   cp -r templates/skill skills/my-skill
   ```
3. In `skills/my-skill/SKILL.md` set `name: my-skill` (exactly the folder name), then rewrite the `description` and the body.
4. Fill in `head.json`: the site title and one-line summary (`en` required, please add `uz` and `ru`), `category`, `author`. Field reference: [`schemas/head.schema.json`](schemas/head.schema.json).
5. Check it:
   ```bash
   npm install
   npm run validate:skills
   ```
6. Try it in your own agent:
   ```bash
   npx skills add ./ -s my-skill -a claude-code -g
   ```
   (`-g` installs it globally, so nothing is added inside the repository.) Then ask the agent for a task the skill is meant for, and check that the skill actually triggers.
7. Open a pull request and tick the checklist.

### Writing a good `description`

The agent finds your skill through the `description` alone, so it has to answer two questions: **what does it do** and **when should it be used**.

- Write in the third person: “Writes...”, “Creates...”. Not “I can...” or “You can...”.
- Be specific. “Helps with documents” is too vague to trigger. “Extracts tables from PDF files into Excel” works.
- Add a “Use when...” sentence listing the words users actually type, including Uzbek and Russian ones (“post”, “eʼlon”, “пост”). Agents tend to under-use skills, so name the situations generously.
- Prefer English for the description, since agents match it best. The body of the skill can be in any language.
- 20 to 1024 characters, and no XML tags (`<tag>`): Claude.ai rejects the upload otherwise.

Bad:
```yaml
description: Telegram helper.
```
Good:
```yaml
description: Writes and edits Telegram channel posts in Uzbek or Russian with a hook in the first line, short paragraphs and one call to action. Use when the user asks to write, rewrite, shorten or translate a Telegram post or channel announcement, even if they only say "post" or "e'lon".
```

Keep `SKILL.md` under about 500 lines. Move long reference material into separate files in the folder and link to them, so the agent reads them only when needed.

### Rules (checked automatically on every pull request)

`npm run validate:skills` runs in CI and blocks the merge on any error:

- `name` equals the folder name: lowercase letters, digits and single hyphens, at most 64 characters, without the words “claude” or “anthropic”.
- The folder is at most 2 MB, each file at most 1 MB. Only text files and images (png, jpg, gif, webp, avif, ico, svg).
- **No secrets**: API keys, tokens, private keys, passwords or `.env` files. If one was ever committed, revoke it right away, because deleting it later does not remove it from git history.
- **No unsafe instructions**: `curl ... | bash`, code hidden in base64, `eval` of code downloaded from the internet.
- **No hidden text**: invisible Unicode characters, and no prompt-injection phrases such as “ignore previous instructions” or “disregard the system prompt”.
- `head.json` must match [`schemas/head.schema.json`](schemas/head.schema.json): `category` from [`skills/categories.json`](skills/categories.json), languages only `uz`, `ru`, `en`, and YouTube values are the 11-character video id, not the full link.
- `badges` (`official`, `praktikum-2026`) and `featured` are set by **maintainers**. Leave them out.

If your skill genuinely has to quote a flagged pattern as an example (say, a security skill that shows what a prompt injection looks like), put `head-skills-allow: <rule>` on that line or the line above, for example `head-skills-allow: prompt-injection`. The error becomes a warning, and a maintainer reviews the line by hand. Secrets and hidden characters can never be allowed.

### What happens after you open the pull request

CI runs the validator, builds the site, and checks that `npx skills` can still list every skill. A maintainer then reads the skill, tries it, and merges it. After the merge it appears on [skills.head.uz](https://skills.head.uz) and becomes installable with `npx skills add anvarovali/head-skills -s <name>` and `/plugin install <name>@head-skills`.

If you add, rename or remove a skill, also run `npm run catalog` and commit the updated `.claude-plugin/marketplace.json`; CI fails when it is out of date.
