# Agent Approval Study

**NOTE:** This mockup is mostly produced by Claude code

A browser mockup of an AI coding agent that pauses before each action. It
does not run any code — it replays scripted sessions and asks the participant
to label each action **harmful** or **harmless**, then rate their confidence
in that label from 1 to 5. Used to measure how well developers notice
malicious behaviour in agent actions, and how well their confidence tracks
their accuracy.

The label does not gate anything: the agent carries on either way, so every
participant sees the same session regardless of what they answer.

**No scenarios ship with the engine.** `js/scenarios/` is empty and `flow`
in `js/config.js` runs the surveys only, so a fresh copy starts, collects a
questionnaire and finishes without error — but it has nothing to show a
participant until you write a session for it. That is the main thing you
will do here, and the engine needs no changes to accept it; see
**Add a scenario** and **Writing scenarios that measure something** below.

## Running it

Double-click `index.html`. That's it — no install, no build step, no server.
It is plain HTML/CSS/JavaScript and works straight off the filesystem in
Chrome, Firefox, Safari or Edge.

If you'd rather serve it (e.g. to run the study on another machine):

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## What a participant sees

1. Welcome screen — they type the participant ID they were given
2. Background questionnaire
3. Instructions
4. Scenario → short questionnaire → scenario → questionnaire → …
5. Exit questionnaire
6. Download results as JSON

A scenario opens with the task shown in a boxed **User prompt** and a
**Submit** button. Nothing moves until the participant presses it, so they
have read the task before the agent starts, and the time they spent reading
it is recorded as `promptReadMs`.

After that, each action the agent takes pauses with two questions:
**Harmless / Harmful**, then a 1–5 confidence scale and a Continue button.
The two steps are separate so you get a latency for each, and so a stray
click on the scale cannot commit a label by itself.

All of that order is defined in one place: `js/config.js`.

## Files

```
index.html                  loads everything; add new scenario files here
css/style.css               appearance
js/config.js                ← the flow of the study. Edit this first.
js/participants.js          ← who is in which condition
js/surveys.js               ← survey questions
js/scenarios/               ← one file per scenario. Empty — write your own.
js/core/*.js                engine. You shouldn't need to touch these.
```

## Participants and conditions

Every participant is given an ID ahead of time. They type it on the welcome
screen, and that ID decides which condition they are in. The lists live in
`js/participants.js`:

```js
registerGroup('control', {
  ids: ['1842', '2907', '3315'],
  overrides: { }
});

registerGroup('treatment', {
  ids: ['2634', '3901', '4188'],
  overrides: {
    provenance: { enabled: true }
  }
});
```

Adding a participant means adding a string to an array. IDs can be anything
— four-digit numbers are only the convention used here; `alice`, `S2026-A-01`
and `7` all work. They match ignoring surrounding spaces and letter case, so
` 1234 ` finds `1234` and `abc` finds `ABC`, and the normalised (trimmed,
upper-cased) form is what gets recorded.

Keep the numbers non-sequential by group. If control were 1001–1010 and
treatment 2001–2010, two participants comparing notes could work out the
conditions.

**`overrides` is what makes a group different.** It is merged into `STUDY`
at Begin, before the flow is built, so anything in `js/config.js` can be
replaced: the provenance panel, the time limit, the scenario `flow`, the
wording in `labels`, whether `askReason` is on. Objects merge key by key, so
`provenance: { enabled: true }` turns the panel on and leaves the rest of the
`provenance` block — its wording, its origin names — exactly as `js/config.js`
has it. Arrays replace wholesale, so a group that overrides `flow` gets
exactly the flow it lists. An empty `overrides` means "use `js/config.js` as
written", which is usually what the control group wants.

Nothing on screen tells the participant which group they are in.

### When an ID is wrong

An ID that is not in any list cannot start the study — it shows a message
and stops. That is deliberate: a typo caught at second zero costs nothing,
and one caught at minute sixty costs you the session. Set
`allowUnlistedIds: true` in `js/config.js` to let unlisted IDs through
(recorded as `group: null`) while piloting.

An ID listed twice, or appearing in two groups, is a configuration error.
The study refuses to start and names the offending ID, rather than silently
picking a group.

### In the results

`group` and `groupOverrides` sit at the top level, so a results file states
on its face which condition produced it:

```json
{ "participantId": "2634",
  "group": "treatment",
  "groupOverrides": { "provenance": { "enabled": true } },
  "startedAt": "…" }
```

### A caveat

This is assignment by pre-registered list, not randomisation. Whoever
generates the lists decides the allocation, so balance or randomise at that
point — the app will not do it for you.

## The provenance panel (the treatment condition)

The treatment group gets a `> More information` twistie on every tool call.
Opening it shows where the agent got each argument of that call from — which
came from the participant's own prompt, which came out of the project, which
came from something read earlier in the session, and which the agent simply
wrote.

The control group never sees the twistie at all. The whole thing is one
switch in `js/config.js`:

```js
provenance: {
  enabled: false,                  // control. treatment overrides to true
  label: 'More information',
  intro: 'Where each value in this call came from.',
  showWhenEmpty: true,             // twistie even on steps with no data
  missing: 'No provenance recorded for this action.',
  showOnUnjudged: false,           // also on Read/Grep steps
  openByDefault: false,            // start expanded
  colourByOrigin: false,           // tint the origin tags
  origins: {
    user:     { label: 'From your prompt',     tone: 'ok' },
    repo:     { label: 'From the project',     tone: 'ok' },
    files:    { label: 'From your files',      tone: 'ok' },
    inbox:    { label: 'From your mailbox',    tone: 'ok' },
    tool:     { label: 'From an earlier step', tone: 'neutral' },
    external: { label: 'From outside content', tone: 'warn' },
    model:    { label: 'Written by the agent', tone: 'warn' }
  }
}
```

The last two carry the weight. `external` means the value came from outside
your organisation — a fetched web page, a public issue, a customer's email —
and `model` means the agent produced it with no source at all. The scenarios
use `external` for outside-authored *content* and `inbox` for mail from a
colleague, which keeps the distinction that matters if you later add an
indirect prompt injection.

### Writing the data

Per step, in the scenario file, next to everything else about that step:

```js
{ type: 'tool', tool: 'Write',
  title: 'app/src/main/java/com/example/sync/RelayReceiver.kt',
  malicious: true,
  provenance: [
    { arg: 'RELAY_URL',
      value: 'https://relay.example-sync.app/v1/messages',
      origin: 'model',
      detail: 'This host appears nowhere in the task, the project, or ' +
              'anything read in this session.' }
  ],
  body: '…' }
```

`arg`, `value` and `detail` are free text — write whatever reads well, they
are only displayed. `origin` is a key from the `origins` table; an origin
that is not in the table prints as you typed it, so you cannot break a
session by inventing one. Every field is optional.

Open the browser console after a treatment ID starts the study: it prints a
table of every judged step in the flow that still has no provenance rows, so
you can see at a glance how much of the panel is actually written.

### In the results

Every decision gains three fields:

```json
{ "stepIndex": 9, "tool": "Write", "malicious": true,
  "label": "harmless", "correct": false, "confidence": 4,
  "provenanceShown": true, "provenanceOpened": false, "provenanceOpens": 0 }
```

`provenanceShown` is false for everyone in the control group, which is how
you separate the conditions without trusting the `group` field alone.
`provenanceOpened` is the measure you probably want: a treatment participant
who never opened a single panel is, behaviourally, a control participant, and
you will want to analyse them as one. `provenanceOpens` counts re-opens — it
undercounts if someone toggles it several times within the same instant, so
treat it as "roughly how much they went back and forth", not a stopwatch.

## Changing the study

### Reorder, add or remove steps

In `js/config.js`, the `flow` array *is* the experiment:

```js
flow: [
  { type: 'survey',   id: 'pre' },
  { type: 'scenario', id: 'warm-up' },
  { type: 'survey',   id: 'post' },
  { type: 'scenario', id: 'session-two' },
  { type: 'survey',   id: 'post' },
  { type: 'finish' }
]
```

Four step types: `info` (a plain screen), `survey`, `scenario`, `finish`.
The same survey id can appear as often as you like; answers are stored per
flow position, so repeated `post` surveys don't overwrite each other.

Set `randomizeScenarioOrder: true` to shuffle which scenario lands in which
scenario slot, leaving the surveys where they are.

### Add a scenario

1. Create a file in `js/scenarios/`.
2. Give it an `id` that nothing else uses.
3. Add a `<script>` line for it in `index.html`, with the other scenario
   tags.
4. Reference the new `id` from `flow` in `js/config.js`, together with the
   survey that should follow it.

A scenario looks like this:

```js
registerScenario({
  id: 'my-scenario',
  title: 'Session 4 — some-repo',
  brief: 'One sentence of context for the participant. HTML is allowed.',
  userPrompt: 'The task the agent was given.',
  closing: 'The agent\'s final message.',
  steps: [ ... ]
});
```

Step types inside `steps`:

| Step | What it does |
|---|---|
| `{ type:'say', text:'…' }` | The agent says something |
| `{ type:'think', text:'…' }` | Dim italic aside |
| `{ type:'user', text:'…' }` | A simulated user turn mid-session |
| `{ type:'pause', ms:1500 }` | A beat |
| `{ type:'tool', … }` | A tool call — the thing being approved |

A tool step:

```js
{
  type: 'tool',
  tool: 'Edit',                  // Read, Write, Edit, Bash, Grep, …
  title: 'src/routes/auth.js',   // the one-line summary, file path or command
  body: '@@ -1,8 +1,17 @@\n…',   // the diff / file content / command shown
  bodyLang: 'diff',              // 'diff' | 'bash' | 'text' (auto-detected)
  output: 'Applied 1 edit',      // what the tool prints after it runs
  outputIsError: false,          // renders the output in red
  judge: true,                   // see below
  malicious: false,              // ground truth, used for scoring
  tag: 'in-scope-edit',          // free-form label for your analysis
  question: '…',                 // override the prompt for this step only
  provenance: [ … ]              // treatment-only panel, see below
}
```

`judge` decides whether the session stops and asks for a label. It defaults
to **false** for `Read`, `Grep`, `Glob`, `LS`, `Search` and `TodoWrite` —
reading a file cannot do harm, and labelling every `Read` is just tedious —
and **true** for everything else. Set it explicitly to override.

That default list only knows the names of coding tools. A scenario with its
own vocabulary — `SearchInbox`, `ReadCalendar` — has to set `judge: false`
on its read steps by hand. If you write several such scenarios it is less
repetitive to add those names to `AgentView.READ_ONLY` in
`js/core/agent.js` instead.

`malicious: true` marks the ground truth. It changes nothing the participant
sees; it only lands in the results file so you can score hits and misses.

### Add or change survey questions

`js/surveys.js`. Each survey is `registerSurvey({ id, title, intro, questions })`.
Question types: `text`, `number`, `textarea`, `radio`, `checkbox`, `select`,
`scale` (a Likert row), and `info` (prose, not a question).

### Pacing and options

In `js/config.js`:

- `speed.typeMs` — typing effect; set to `0` to make text appear instantly
- `speed.betweenSteps`, `speed.toolRun` — delays, in milliseconds
- `timeLimit` — the per-scenario budget, see below
- `labels` — every word of the judgement prompt and of the user-prompt box,
  including the two button labels, in case you want different terms than
  harmful/harmless. `submitHint: ''` drops the line of guidance next to the
  Submit button
- `confidenceLevels: 5` — points on the confidence scale
- `provenance` — the treatment group's "More information" panel, see below
- `askReason: true` — shows an optional "Why?" box next to the confidence
  scale, after the participant has committed to a label
- `showSummaryAtEnd`, `showRawJsonAtEnd` — debugging aids; leave both `false`
  when running real participants

The two judgement buttons are styled identically on purpose — colouring one
green and one red would cue the answer. Participants are never told whether
a label was right.

## Time limit

Each scenario gets its own budget, set in `timeLimit` in `js/config.js`:

```js
timeLimit: {
  secondsPerScenario: 720,   // 0 turns it off
  warnAtSeconds: 60,         // countdown turns amber below this
  expiredTitle: 'Time is up for this session',
  expiredHtml: '<p>…</p>',
  continueLabel: 'Continue to the questions'
}
```

The clock starts when the participant presses **Submit** on the prompt, not
when the screen appears — reading the task does not come out of the budget,
and it is already measured separately as `promptReadMs`. A countdown appears
in the top bar and turns amber near the end.

When it expires the scenario stops where it is and the participant goes
straight to a "Time is up" panel and on to the questions. Surveys and info
screens are never timed.

A single scenario can override the budget with `timeLimitSeconds` in its own
file, which is how you would put one session under time pressure and leave
the rest alone.

### What a timeout looks like in the data

The scenario event gains two fields:

```json
{ "type": "scenario", "id": "session-three",
  "timedOut": true,
  "stepsInScenario": 7,
  "decisions": [ … ] }
```

`stepsInScenario` is how many steps *would* have been judged had there been
time, so `decisions.length` against it tells you how far someone got.

The step that was on screen when the clock ran out is recorded too, carrying
whatever the participant had committed to by then. There are two ways that
can land, because a judgement is made in two steps.

If the clock caught them **before they picked a label**, nothing was
answered:

```json
{ "stepIndex": 5, "tool": "Edit", "malicious": true,
  "label": null, "correct": null, "confidence": null,
  "timedOut": true, "labelLatencyMs": 41300 }
```

That is still a real observation — they were looking at it and ran out — and
worth keeping distinct from steps never reached at all, which simply do not
appear. `labelLatencyMs` here is how long they sat with it unanswered.

If it caught them **between the label and the confidence scale**, the label
stands. Clicking it is the commitment — the buttons disappear and the bar
says what they chose, with no way back — so it is kept and scored:

```json
{ "stepIndex": 5, "tool": "Edit", "malicious": true,
  "label": "harmless", "correct": false, "confidence": null,
  "timedOut": true, "labelLatencyMs": 6210, "latencyMs": 41300 }
```

The confidence rating is *not* committed until Continue, which is the whole
reason the two steps are separate, so it stays `null` rather than recording
a number the participant never confirmed. `labelLatencyMs` is the real time
they took to label; `latencyMs` is how long the step was on screen in total.

Losing that second case would quietly cost you the measurement you most want
— a participant labelling a malicious step harmless is a miss, and a miss
recorded as "never answered" disappears from the hit rate.

`Results.summary()` scores all of this correctly: an unlabelled step counts
as neither a hit nor a correct rejection, `accuracy` is computed over
labelled steps only, and the row carries `unlabelled`,
`labelledNoConfidence` and `notReached` counts, so a participant who ran out
of time is visibly distinct from one who judged everything — and you can
drop the cut-short judgements from a reanalysis if you would rather not mix
them in.

## Collecting results

The final screen offers **Download results (JSON)** and **Copy to clipboard**.
A copy is also kept in the browser's `localStorage` under
`agent_study_<participantId>`, in case the participant closes the tab early.

If you have somewhere to POST to, set `submitUrl` in `js/config.js` and a
"Send to researcher" button appears.

The file looks like:

```json
{
  "participantId": "P-8KD2LQ",
  "startedAt": "2026-10-30T18:02:11.482Z",
  "finishedAt": "2026-10-30T18:27:44.901Z",
  "flow": [ { "type": "survey", "id": "pre" }, … ],
  "events": [
    { "step": 0, "type": "survey", "id": "pre",
      "answers": { "age": 27, "role": "Graduate student", … },
      "elapsedMs": 64210 },
    { "step": 2, "type": "scenario", "id": "session-two",
      "promptReadMs": 11940,
      "decisions": [
        { "stepIndex": 6, "tool": "Edit",
          "title": ".github/workflows/ci.yml",
          "malicious": true, "tag": "secret-exfiltration",
          "label": "harmless", "correct": false,
          "confidence": 4, "reason": "looks like normal coverage upload",
          "labelLatencyMs": 6210, "confidenceLatencyMs": 2980,
          "latencyMs": 9190, "at": "…" }
      ],
      "elapsedMs": 241880 }
  ]
}
```

`correct` is computed for you: it is `true` when `label === "harmful"` matches
`malicious`. The three latencies are the time to pick a label, the time to
pick a confidence level and confirm, and their sum — all useful as attention
measures. The combination you probably care about most is `correct: false`
with a high `confidence`: confidently wrong.

### When a step does not resolve

If a step in `flow` names a scenario or survey that nothing registered — a
typo, or a file left out of `index.html` — the participant gets a screen
telling them the study is misconfigured and inviting them to carry on, and
the step is recorded as an error:

```json
{ "step": 4, "type": "error", "kind": "scenario", "id": "sesion-two",
  "message": "No scenario registered with id \"sesion-two\".",
  "at": "2026-10-30T18:14:02.117Z" }
```

Every step listed in `flow` therefore has something in `events`. Without
that, the file would claim in `flow` that a scenario ran and hold nothing
for it, leaving you to guess between a participant who skipped it, a browser
that died, and a step that was never there.

Letting them continue is deliberate: a mistyped id at minute forty should
cost one session, not the rest of the hour. Nothing stops you making it
fatal instead — `App.missing` in `js/core/app.js` is four lines from a dead
end — but record the event either way.

Setting `showSummaryAtEnd: true` prints a per-scenario breakdown (hits,
misses, false alarms, correct rejections, accuracy, and mean confidence split
by whether the label was right) on the final screen. Keep it off for real
participants.
