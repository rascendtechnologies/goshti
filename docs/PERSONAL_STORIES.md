# Personal stories (name filled in, no AI call per child)

A personal story is written once with placeholders (`story-engine/personal/stories.ts`):

| Placeholder | Meaning | Example (girl सई / boy राम) |
|---|---|---|
| `{नाव}` | the child's name | सई / राम |
| `{नाव+ने}` | name + Marathi ending | सईने / रामाने |
| `{गेला\|गेली}` | boy form \| girl form | गेली / गेला |

**Voice.** The story is cut into parts (about a sentence each). A part with no name or boy/girl
word is the same for every child: it is recorded once and kept in the public bucket
`library-voice/personal/<story>/<young|older>/shared-<n>-<hash>.wav`. Only the other parts are
recorded per child. If the story text changes, the hash changes and that part is recorded again.

**Safety.** The backend actions `personal-plan` and `personal-render` never take text from a
request: the words come from the stored story. The only input is a plain Devanagari name
(1–15 letters, no digits or punctuation) and BOY or GIRL. Every part goes through the normal
length and listening checks.

**Try it.** GitHub → Actions → *Personal story voice (test)* → Run workflow (name in Devanagari,
gender, age). The run summary has a link to listen and shows which parts were reused.

**Not done yet (app side).** The app does not play personal stories yet. It would fetch the plan,
download the shared parts, ask the backend for the personal parts once per child, and keep them on
the phone. Names typed in English letters need turning into Devanagari first.

**Needs a native-Marathi review.** Wording, gender forms and name endings (names ending in a
consonant take "ा" before an ending; some names are irregular).

## In the app

- "आजीने गोष्ट निवडावी" plays a personal story first (for the child's age band and the chosen category) when the child's name is known in Devanagari and boy/girl is set. When the typed name is in English letters, setup asks for the Marathi spelling. A child hears each personal story once; after that, the usual AI story or library story follows. "माझ्या कल्पनेची गोष्ट" never uses them.
- A personal story counts towards the monthly allowance like any new story.
- The phone downloads the shared parts from `library-voice/personal/<story>/<young|older>/shared-<part>-<hash>.wav` and asks the server only for the parts with the child's name (`personal-render`, with the part's hash so an old app and a new server can never mix versions). If a shared part is not stored yet, the server makes it.
- After adding or changing a story, run **Pre-render personal story voices** (Actions) so every shared part is stored.
- Writing a new one: `npm run personal:check -- --prompt 4-5` prints the brief; `npm run personal:check-all` checks every story.
