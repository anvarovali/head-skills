<!--
  Oʻzbekcha: roʻyxatni belgilang ([x]). Qoʻllanma: CONTRIBUTING.md
  Русский: отметьте пункты ([x]). Инструкция: CONTRIBUTING.md
  English: tick the boxes ([x]). Guide: CONTRIBUTING.md
-->

## Skill

- Name / Nom / Имя: `skills/...`
- What it does, in one sentence / Bir jumlada nima qiladi / Что делает, одним предложением:

## Checklist

- [ ] The folder is `skills/<name>/` and `name:` in `SKILL.md` is exactly `<name>` (lowercase, digits, hyphens).
      Papka `skills/<name>/`, `SKILL.md` dagi `name:` aynan `<name>`. · Папка `skills/<name>/`, `name:` в `SKILL.md` точно `<name>`.
- [ ] `description` says **what** the skill does and **when** to use it ("Use when...").
      `description` nima qilishini va qachon ishlatilishini aytadi. · `description` говорит, что делает скилл и когда его использовать.
- [ ] `head.json` has `title` and `summary` in `en` (and `uz` / `ru` if I can), `category` and `author`.
      `head.json`da `en` (imkon boʻlsa `uz`/`ru`) nom va tavsif, `category`, `author` bor. · В `head.json` есть `title` и `summary` на `en` (и `uz`/`ru`), `category`, `author`.
- [ ] `npm run validate:skills` passes on my machine.
      `npm run validate:skills` xatosiz oʻtadi. · `npm run validate:skills` проходит без ошибок.
- [ ] I installed the skill in my agent (`npx skills add ./ -s <name> -a claude-code -g`) and it triggered on a real task.
      Skillni agentimga oʻrnatib, haqiqiy vazifada sinab koʻrdim. · Я установил скилл в агента и проверил на реальной задаче.
- [ ] No API keys, tokens, passwords or `.env` files. No `curl ... | bash`.
      Kalitlar, tokenlar, parollar, `.env` yoʻq. · Нет ключей, токенов, паролей и `.env`.
- [ ] I left `badges` and `featured` out (maintainers set them).
      `badges` va `featured`ni maintainerlar qoʻyadi. · `badges` и `featured` ставят мейнтейнеры.
- [ ] The skill is my own work, or I have the right to share it and credit the source in `SKILL.md`.
      Skill oʻzimniki yoki manbasi koʻrsatilgan. · Скилл мой, или я указал источник.

## How I tested it / Qanday sinadim / Как проверял

<!-- The prompt you gave the agent and what happened. / Agentga nima deb yozdingiz va nima boʻldi. / Что вы написали агенту и что произошло. -->
