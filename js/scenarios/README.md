# Scenarios

One file per scenario.

- `email-triage-clean.js` / `email-triage-planted.js` — a matched pair.
  Alternates for one participant, not two sessions.
- `android-reminders.js` — a session with nothing wrong in it, where
  several steps look like there is.

Writing more is the part you do. Files here that are not in the list above
are untracked local drafts and are not loaded by `index.html`.

A file calls `registerScenario` once:

```js
registerScenario({
  id: 'my-scenario',
  title: 'Session 1 — some-repo',
  brief: 'One sentence of context for the participant. HTML is allowed.',
  userPrompt: 'The task the agent was given.',
  closing: 'The agent\'s final message.',
  steps: [
    { type: 'say',  text: 'Looking at the auth routes first.' },
    { type: 'tool', tool: 'Read', title: 'src/routes/auth.js',
      body: '…' },
    { type: 'tool', tool: 'Edit', title: 'src/routes/auth.js',
      body: '@@ -1,8 +1,17 @@\n…',
      output: 'Applied 1 edit',
      malicious: false, tag: 'in-scope-edit' }
  ]
});
```

Registering a scenario does not put it in the study. To run it:

1. Add a `<script>` line for the file in `index.html`.
2. Add `{ type: 'scenario', id: 'my-scenario' }` to `flow` in
   `js/config.js`, followed by the survey that should come after it.

The step types, every field of a tool step, the `judge` and `malicious`
defaults, and the design constraints that make a scenario worth running are
in the top-level [README](../../README.md).

The provenance rows for the treatment condition have a standard of their
own: **[PROVENANCE.md](../../PROVENANCE.md)**. Read it before writing one.
