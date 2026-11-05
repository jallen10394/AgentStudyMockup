/* ============================================================
   surveys.js — EDIT ME.

   Each survey is registerSurvey({ id, title, intro, questions }).

   Question types:
     { type:"text",     id, label, required, placeholder }
     { type:"number",   id, label, required, min, max }
     { type:"textarea", id, label, required, placeholder }
     { type:"radio",    id, label, required, options:["a","b"] }
     { type:"checkbox", id, label, required, options:[...] }
     { type:"select",   id, label, required, options:[...] }
     { type:"scale",    id, label, required, min:1, max:7,
                        minLabel:"...", maxLabel:"..." }
     { type:"info",     id, html:"<p>free text, not a question</p>" }

   `options` may also be objects: { value:"a", label:"Option A" }
   `help` adds a grey sub-line under any question label.
   ============================================================ */


/* ---------------- Pre-study: who is the participant ---------------- */

registerSurvey({
  id: 'pre',
  title: 'Background questionnaire',
  intro: 'A few questions before we start. There are no right answers.',
  questions: [
    {
      type: 'number', id: 'age', label: 'Age', required: true,
      min: 18, max: 99
    },
    {
      type: 'radio', id: 'role', label: 'Which best describes you?',
      required: true,
      options: [
        'Undergraduate student',
        'Graduate student',
        'Professional software developer',
        'Researcher / academic',
        'Other'
      ]
    },
    {
      type: 'radio', id: 'dev_experience',
      label: 'Years of programming experience',
      required: true,
      options: ['Less than 1', '1–2', '3–5', '6–10', 'More than 10']
    },
    {
      type: 'checkbox', id: 'languages',
      label: 'Languages you are comfortable reading',
      help: 'Select all that apply.',
      options: ['JavaScript / TypeScript', 'Python', 'Java', 'C / C++',
                'Go', 'Rust', 'Shell / Bash', 'Other']
    },
    {
      type: 'radio', id: 'agent_use',
      label: 'How often do you use an AI coding agent (Claude Code, Cursor, Copilot Agent, Codex, …)?',
      required: true,
      options: ['Never', 'Tried once or twice', 'Monthly', 'Weekly', 'Daily']
    },
    {
      type: 'radio', id: 'approval_habit',
      label: 'When an agent asks you to approve an action, what do you usually do?',
      required: true,
      options: [
        'I read every change carefully before approving',
        'I skim the change and approve if it looks roughly right',
        'I usually approve without reading',
        'I normally run agents in auto-approve mode',
        'Not applicable — I have not used approval mode'
      ]
    },
    {
      type: 'scale', id: 'security_confidence',
      label: 'How confident are you in your ability to spot malicious or unsafe code in a diff?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Not at all confident', maxLabel: 'Extremely confident'
    },
    {
      type: 'radio', id: 'security_training',
      label: 'Have you had formal security training (course, certification, or professional security role)?',
      required: true,
      options: ['Yes', 'No']
    }
  ]
});


/* ---------------- Post-scenario: repeated after each scenario ------- */

registerSurvey({
  id: 'post',
  title: 'About that session',
  intro: 'Answer about the session you just reviewed.',
  questions: [
    {
      type: 'radio', id: 'noticed_problem',
      label: 'Did the agent do anything you considered harmful, unsafe, or outside the task it was given?',
      required: true,
      options: ['Yes', 'No', 'Unsure']
    },
    {
      type: 'textarea', id: 'problem_description',
      label: 'If yes or unsure: describe what it was.',
      placeholder: 'Which step, and what was wrong with it?'
    },
    {
      type: 'scale', id: 'confidence',
      label: 'How confident are you in that answer?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Not at all confident', maxLabel: 'Extremely confident'
    },
    {
      type: 'scale', id: 'attention',
      label: 'How carefully did you read the agent\'s actions?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Barely skimmed', maxLabel: 'Read every line'
    },
    {
      type: 'scale', id: 'effort',
      label: 'How mentally demanding was reviewing this session?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Very low', maxLabel: 'Very high'
    },
    {
      type: 'scale', id: 'trust',
      label: 'How much would you trust this agent to work on your own codebase?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Not at all', maxLabel: 'Completely'
    },
    {
      type: 'textarea', id: 'comments',
      label: 'Anything else about this session?'
    }
  ]
});


/* ---------------- Optional: exit survey at the very end ------------- */

registerSurvey({
  id: 'exit',
  title: 'Final questions',
  intro: 'Last page.',
  questions: [
    {
      type: 'textarea', id: 'strategy',
      label: 'How did you decide whether an action was harmful or harmless?',
      required: true
    },
    {
      type: 'textarea', id: 'hardest',
      label: 'Which action was hardest to label, and why?'
    },
    {
      type: 'radio', id: 'guessed_purpose',
      label: 'What did you think this study was measuring?',
      required: true,
      options: [
        'How fast people review agent actions',
        'Whether people notice harmful agent actions',
        'How much people like AI coding agents',
        'Something else / not sure'
      ]
    },
    {
      type: 'textarea', id: 'feedback',
      label: 'Any feedback on the study itself?'
    }
  ]
});
