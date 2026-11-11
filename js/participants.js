/* ============================================================
   participants.js — EDIT ME.

   Who is in which condition. Every participant is given an ID
   ahead of time and types it on the welcome screen; the ID
   decides their group. An ID that is not listed here cannot
   start the study (unless you set allowUnlistedIds in
   js/config.js).

   To add a participant, add their ID to one of the lists below.
   IDs can be anything — the four-digit numbers here are only a
   convention. They are matched ignoring surrounding spaces and
   letter case, so " 1234 " matches "1234" and "abc" matches
   "ABC" (which also means two IDs differing only in case count
   as the same person).

   The numbers below are deliberately not sequential by group:
   if control were 1001-1010 and treatment 2001-2010, anyone
   comparing notes could work out the conditions.

   An ID listed twice, or in two groups, is a configuration
   error — the study refuses to start and says which ID, so a
   broken list cannot quietly corrupt an experiment.

   ---------------------------------------------------------
   `overrides` is what makes a group different. Anything in
   js/config.js can be replaced. Examples:

       overrides: {
         timeLimit: { secondsPerScenario: 180 }
       }

       overrides: {
         flow: [
           { type: 'survey',   id: 'pre' },
           { type: 'scenario', id: 'my-scenario' },
           { type: 'survey',   id: 'post' },
           { type: 'finish' }
         ]
       }

   Objects merge key by key, so the first example changes only
   secondsPerScenario and leaves the rest of timeLimit alone.
   Arrays replace wholesale, so a group that overrides `flow`
   gets exactly the flow it lists.

   An empty `overrides` means "use js/config.js as written" —
   which is what you normally want for the control group.
   ---------------------------------------------------------

   NOTE: this is assignment by pre-registered list, not
   randomisation. Whoever writes these lists decides the
   allocation, so balance or randomise when you generate the
   IDs, not here.
   ============================================================ */


registerGroup('control', {

  ids: [
    '4117', '4600', '8317', '5933', '2260',
    '6116', '7728', '5499', '3459', '4396'
  ],

  overrides: {
    /* control runs js/config.js exactly as written */
  }
});


registerGroup('treatment', {

  ids: [
    '6966', '8623', '7055', '6822', '3096',
    '5800', '6628', '8158', '9862', '9652'
  ],

  overrides: {

    /* The treatment: every tool call gets a "More information"
       twistie showing where the agent got each argument from.
       Control runs with this off and sees no twistie at all.

       Everything else about the panel — its wording, whether it
       starts open, how origins are named — is in the
       `provenance` block of js/config.js. Set any of those keys
       here too and they win for this group only, e.g.

           provenance: { enabled: true, openByDefault: true } */

    provenance: { enabled: true }
  }
});
