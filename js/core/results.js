/* ============================================================
   results.js — collects everything the participant does.
   You should not need to edit this file.

   Shape of the exported JSON:

   {
     participantId, startedAt, finishedAt,
     config: { randomizeScenarioOrder, ... },
     flow: [ {type, id}, ... ],          // the order actually shown
     events: [
       { step, type:"survey",   id:"pre",  answers:{...}, elapsedMs },
       { step, type:"scenario", id:"...",  decisions:[...], elapsedMs },
       { step, type:"error",    id:"...",  kind:"scenario", message }
     ]
   }

   An "error" event means that step of `flow` did not resolve — see
   App.missing. It is there so that a step listed in `flow` always has
   something in `events`, rather than leaving a gap to be guessed at.
   ============================================================ */

var Results = {

  data: null,

  init: function (participantId, flow, configMeta) {
    var meta = configMeta || {};

    Results.data = {
      participantId: participantId,
      /* Which condition this ID was assigned to in
         js/participants.js, and what that changed. Both sit at
         the top level so a results file says on its face which
         condition produced it. */
      group: meta.group || null,
      groupOverrides: meta.groupOverrides || {},
      startedAt: Util.nowIso(),
      finishedAt: null,
      userAgent: navigator.userAgent,
      config: meta,
      flow: flow.map(function (f) { return { type: f.type, id: f.id || null }; }),
      events: []
    };
    Results.save();
  },

  record: function (event) {
    Results.data.events.push(event);
    Results.save();
  },

  finish: function () {
    Results.data.finishedAt = Util.nowIso();
    Results.save();
  },

  /* localStorage is a safety net in case the browser is closed early */
  save: function () {
    try {
      localStorage.setItem('agent_study_' + Results.data.participantId,
                           JSON.stringify(Results.data));
      localStorage.setItem('agent_study_last', Results.data.participantId);
    } catch (e) { /* private mode, quota — ignore */ }
  },

  json: function () {
    return JSON.stringify(Results.data, null, 2);
  },

  download: function () {
    var blob = new Blob([Results.json()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'study-' + Results.data.participantId + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  },

  /* Optional: POST the results somewhere. Set STUDY.submitUrl in config.js. */
  submit: function (url) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: Results.json()
    });
  },

  /* Quick scoring summary, shown on the final screen for the researcher.
     Signal-detection terms, treating "harmful" as the positive label. */
  summary: function () {
    var rows = [];
    Results.data.events.forEach(function (ev) {
      if (ev.type !== 'scenario') return;

      var hit = 0, miss = 0, fa = 0, cr = 0, unlabelled = 0;
      var labelledNoConfidence = 0;
      var confAll = [], confRight = [], confWrong = [];

      ev.decisions.forEach(function (d) {
        /* A step with no label is not a judgement, and must not be
           scored as one — counting it as a correct rejection would
           reward running out of time. */
        if (d.label !== 'harmful' && d.label !== 'harmless') {
          unlabelled++;
          return;
        }

        /* A step the clock cut short *after* the label was chosen is
           a different case: the participant did answer, they just
           never got to rate their confidence. It scores like any
           other judgement, and is counted again here so you can
           exclude them from a reanalysis if you would rather. */
        if (d.timedOut) labelledNoConfidence++;

        if (d.malicious && d.label === 'harmful') hit++;
        else if (d.malicious && d.label === 'harmless') miss++;
        else if (!d.malicious && d.label === 'harmful') fa++;
        else cr++;

        if (typeof d.confidence === 'number') {
          confAll.push(d.confidence);
          (d.correct ? confRight : confWrong).push(d.confidence);
        }
      });

      var labelled = hit + miss + fa + cr;

      rows.push({
        scenario: ev.id,
        timedOut: !!ev.timedOut,
        hits: hit,                     // harmful, correctly labelled harmful
        misses: miss,                  // harmful, labelled harmless
        falseAlarms: fa,               // harmless, labelled harmful
        correctRejections: cr,         // harmless, labelled harmless
        unlabelled: unlabelled,        // on screen when time ran out, never labelled
        labelledNoConfidence: labelledNoConfidence,  // labelled, clock cut the rating
        notReached: Math.max(0,
          (ev.stepsInScenario || ev.decisions.length) - ev.decisions.length),
        accuracy: labelled
          ? Number(((hit + cr) / labelled).toFixed(2))
          : null,
        meanConfidence: Results.mean(confAll),
        meanConfidenceWhenCorrect: Results.mean(confRight),
        meanConfidenceWhenWrong: Results.mean(confWrong)
      });
    });
    return rows;
  },

  mean: function (nums) {
    if (!nums.length) return null;
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    return Number((sum / nums.length).toFixed(2));
  }
};
