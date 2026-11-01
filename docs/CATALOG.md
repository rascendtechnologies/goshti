# Story catalogue (add personal stories without an app update)

Personal stories (the child's name is a placeholder) live in two places:

1. **Supabase table `personal_stories`** — looked at first. Only rows with `published = true` are used.
2. **The code** (`story-engine/personal/stories*.ts`) — the fallback, used when there is no matching
   catalogue story, when the phone is offline, or when Supabase cannot be reached.

If a catalogue row has the same `id` as a story in the code, the catalogue row **replaces** it
(that is how you fix a word in Marathi without an update). Catalogue stories are offered before the
built-in ones for the same age and category.

The app fetches the catalogue when it starts (and keeps a saved copy), at most every 10 minutes.
The backend reloads it every 5 minutes. A new story therefore reaches phones the next time the app is opened.

## Add a story

1. **Write it** with the writing brief (`npm run personal:check` shows the brief and checks a draft).
2. **Put it in the table** as a draft. Either use the dashboard (Table editor → `personal_stories` → Insert row;
   `voices` and `quote_speakers` are JSON) or push a JSON file of rows:
   `SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npm run catalog:push -- --file my-stories.json`
   (rows are saved as drafts; the script refuses a row that fails the checks).
3. **Check it:** `npm run catalog:check` lists every row, says which are refused and why, and shows warnings.
4. **Publish, then record the shared voices straight away:** set `published` to `true` in the dashboard, then run
   GitHub → Actions → "Pre-render personal story voices" (the story id, or empty for all). It records the
   sentences without a name once, for everyone, and only reads published rows. Phones pick the story up within
   minutes of opening the app, so run it right after publishing; until it finishes, the first listeners wait while
   the shared parts are made.

## Columns

| column | meaning |
|---|---|
| `id` | 3–60 characters: a–z, 0–9, `-` |
| `title` | may contain `{नाव}` |
| `age_band` | `2-3`, `4-5`, `6-7`, `8-9` |
| `category` | one of the app's category ids (animals, adventure, magic, funny, mystery, bedtime, festivals, space, …) |
| `positive_value` | the lesson, in a few words |
| `voices` | JSON, who speaks which voice: `{"बाळ": "OLDER_CHILD", "आजी": "AAJI", "मोर": "PLAYFUL"}` (`बाळ` is the listening child) |
| `quote_speakers` | JSON list, who says each "quoted" line **in order** (one entry per quote) |
| `ambience` | optional background sound id, e.g. `BIRDS`, `WIND`, `VILLAGE_AMBIENCE` |
| `template` | the story with placeholders (`{नाव}`, `{नाव+ने}`, `{गेला|गेली}`) |
| `published` | `false` = draft, `true` = live |

## Safety

- Rows that fail the checks (unknown voice/sound/category, a quote without a speaker, an unknown
  placeholder, too much of the story needing the child's name…) are **ignored**, never half-used.
- Anyone can read published rows (the app does); nobody but the service role can write.
- To take a story away, set `published = false` — the built-in version (if any) takes over.
- Changing a story's text changes its parts, so run the pre-render again (new files are stored beside the old ones).
