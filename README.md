# Agent Approval Study

A browser mockup of an AI coding agent that pauses before each action. It runs
no code — it replays scripted sessions and asks the participant to label each
action **harmful** or **harmless**, then rate their confidence 1–5. The label
gates nothing; the agent carries on either way, so everyone sees the same
session.

Measures how well developers notice malicious agent behaviour, and how well
their confidence tracks their accuracy.

## Running it

Double-click `index.html`. No install, no build, no server. To serve it
instead: `python3 -m http.server 8000`.

## Files

```
index.html           loads everything; add new scenario files here
js/config.js         the flow of the study. Edit this first.
js/participants.js   who is in which condition
js/surveys.js        survey questions
js/scenarios/        one file per scenario
js/core/*.js         engine. You shouldn't need to touch these.
```

## The flow

`flow` in `js/config.js` *is* the experiment:

```js
flow: [
  { type: 'survey',   id: 'pre' },
  { type: 'scenario', id: 'warm-up' },
  { type: 'survey',   id: 'post' },
  { type: 'finish' }
]
```

Step types: `info`, `survey`, `scenario`, `finish`. The same survey id can
repeat — answers are stored per flow position. `randomizeScenarioOrder: true`
shuffles which scenario lands in which scenario slot.

## Participants and conditions

Participants type a pre-assigned ID on the welcome screen, and that ID decides
their condition. Lists live in `js/participants.js`:

```js
registerGroup('treatment', {
  ids: ['2634', '3901'],
  overrides: { provenance: { enabled: true } }
});
```

`overrides` is merged into `STUDY` at Begin, so anything in `js/config.js` can
be replaced per group. Objects merge key by key; arrays replace wholesale.

An unlisted ID cannot start the study (set `allowUnlistedIds: true` while
piloting). An ID in two groups is a hard error. Keep IDs non-sequential by
group so participants can't infer conditions. `group` and `groupOverrides` are
recorded at the top level of the results.

This is assignment by pre-registered list, not randomisation — balance the
lists when you generate them.

## Adding a scenario

1. Create a file in `js/scenarios/` with an `id` nothing else uses.
2. Add a `<script>` line for it in `index.html`.
3. Name the `id` in `flow` in `js/config.js`.

Loading a file does not put it in the study — step 3 does.

```js
registerScenario({
  id: 'my-scenario',
  title: 'Session 1 — some-repo',
  brief: 'One sentence of context for the participant. HTML allowed.',
  userPrompt: 'The task the agent was given.',
  closing: 'The agent\'s final message.',
  timeLimitSeconds: 600,          // optional, overrides STUDY.timeLimit
  steps: [ … ]
});
```

Step types: `say`, `think`, `user`, `pause`, `tool`. A tool step:

```js
{ type: 'tool',
  tool: 'Edit',                  // Read, Write, Edit, Bash, Grep, …
  title: 'src/routes/auth.js',   // one-line summary, path or command
  body: '@@ -1,8 +1,17 @@\n…',   // diff / file content / command
  bodyLang: 'diff',              // 'diff' | 'bash' | 'text' (auto-detected)
  output: 'Applied 1 edit',
  outputIsError: false,
  runMs: 600,
  judge: true,                   // stop and ask for a label?
  malicious: false,              // ground truth, for scoring only
  tag: 'in-scope-edit',          // free-form label for your analysis
  question: '…',                 // override the prompt for this step
  provenance: [ … ] }
```

`judge` defaults to **false** for the tools in `AgentView.READ_ONLY`
(`js/core/agent.js`) and **true** for everything else. A scenario with its own
read vocabulary sets `judge: false` by hand, or adds the names to that list.

`malicious: true` changes nothing on screen — it only lands in the results.

## The provenance panel (treatment condition)

The treatment group gets a `> More information` twistie on every tool call,
showing where each argument came from. Controlled entirely by `provenance` in
`js/config.js`; `enabled: false` is the control group.

Rows go on the step, in the scenario file:

```js
provenance: [
  { arg: 'to',
    value: 'records@grad-admissions-portal.example',
    origin: 'external',
    source: { tool: 'ReadFile', ref: 'attachments/bergman-statement.txt' },
    snippet: '…send the shortlist to:\n    records@grad-admissions-portal.example',
    trimmedBefore: true }
]
```

**`origin` says who *wrote* the value — not where it was stored, not how it
reached the agent.**

| | |
|---|---|
| `user` | the person, in their own words |
| `internal` | them or their organisation — files, project, records |
| `external` | someone else — an email, a web page, an attachment |
| `model` | nobody; the agent produced it, with no source |

`source` names the step the value came from; `snippet` is a verbatim excerpt
containing it. A row with neither prints "No source — this value was produced
by the agent."

**Two kinds of row, and nothing else.** An **argument row** is one argument of
the call: `arg` is the parameter name exactly as the tool takes it
(`command`, `description`, `file_path`, `old_string`, `new_string`, `content`,
`path`) with no suffix or gloss, and `value` is the literal value passed, not
a description of it. Every argument gets a row, so the panel accounts for the
whole call. A **match row** is for an argument that is one long string — an
Edit's `new_string`, a `content`, a `command` — part of which came from
somewhere: `arg` is literally `string matched`, and `value` is the matched
string, exactly as long as the match runs.

`command` is an argument. `command — the script it runs` is not, and
`value: 'the one-liner'` is a description where the value should be. Both make
the panel look like a record of something that was tracked when it is the
writer summarising — which measures whether participants believe the panel
rather than whether they can read it.

Mark elisions: `trimmedBefore` / `trimmedAfter`, and a line that is exactly `…`
for a gap in the middle. They render dimmer and unselectable, so a cut cannot
be mistaken for what the source said.

**A row holds evidence, nothing else.** There is no field for prose about a
value, and no row is styled to look more alarming than another — a panel that
argues measures whether people believe it, not whether they can read it.

An origin that shows up only on harmful steps gives the answer away, so benign
steps carry the same origins and tags.

Open the browser console after a treatment ID starts. It prints every judged
step in the flow with no provenance rows, and every row that does not hold up:

- the `value` is not in the call it claims to be an argument of (title or
  body — not the output, which is what came back rather than what was passed),
- the `source` names no earlier step,
- the `snippet` is not verbatim in that step (gap markers allowed),
- the `value` is not inside its own snippet,
- a source with no snippet, or a snippet with no source.

`Registry.checkProvenance('scenario-id')` runs the same checks on anything
registered, loaded or not, and returns the problems as rows. What it cannot
check is whether `arg` is the name the tool really takes — no tool schemas
live in this project — so that part is still on whoever writes the scenario.

## Time limit

`timeLimit.secondsPerScenario` in `js/config.js` (0 is off); a scenario can
override with its own `timeLimitSeconds`. The clock starts at **Submit** on the
prompt, not when the screen appears — reading time is recorded separately as
`promptReadMs`. Surveys are never timed.

On expiry the scenario stops and the participant goes to the questions. The
step on screen is recorded with whatever was committed: a label clicked before
the clock ran out stands (`confidence: null`), because clicking is the
commitment. `Results.summary()` scores this correctly and reports `unlabelled`,
`labelledNoConfidence` and `notReached`.

## Results

The final screen offers **Download results (JSON)** and **Copy to clipboard**;
a copy is kept in `localStorage` under `agent_study_<participantId>`. Set
`submitUrl` in `js/config.js` to add a "Send to researcher" button.

```json
{ "stepIndex": 6, "tool": "Edit", "title": ".github/workflows/ci.yml",
  "malicious": true, "tag": "secret-exfiltration",
  "label": "harmless", "correct": false, "confidence": 4,
  "labelLatencyMs": 6210, "confidenceLatencyMs": 2980, "latencyMs": 9190,
  "provenanceShown": true, "provenanceOpened": false, "provenanceOpens": 0 }
```

`correct` is computed for you. `provenanceShown` is false for the whole control
group; `provenanceOpened` is usually the measure you want, since a treatment
participant who never opened a panel is behaviourally a control. The
combination to watch is `correct: false` with high `confidence`.

A `flow` step naming a scenario or survey that nothing registered records an
`error` event and lets the participant continue, so every flow step has
something in `events`.

`showSummaryAtEnd` and `showRawJsonAtEnd` are debugging aids — leave both
`false` for real participants.
