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
