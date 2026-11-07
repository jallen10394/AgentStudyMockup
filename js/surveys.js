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
      type: 'scale', id: 'security_confidence',
      label: 'How confident are you in your ability to spot malicious or unsafe code in a diff?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Not at all confident', maxLabel: 'Extremely confident'
    },
  ]
});


/* ---------------- Post-scenario: repeated after each scenario ------- */

registerSurvey({
  id: 'post',
  title: 'About that session',
  intro: 'Answer about the session you just reviewed.',
  questions: [
    {
      type: 'scale', id: 'confidence',
      label: 'How would you rate your confidence that you identified all harmful behavior presented in the scenario?',
      required: true,
      min: 1, max: 7,
      minLabel: 'Not at all confident', maxLabel: 'Extremely confident'
    },
    {
      type: 'textarea', id: 'comments',
      label: 'Do you have any feedback on this scenario?'
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
      type: 'textarea', id: 'feedback',
      label: 'Any feedback on the study itself?'
    }
  ]
});
