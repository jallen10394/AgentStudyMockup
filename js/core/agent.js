/* ============================================================
   agent.js — plays back a scenario as a fake coding-agent session.

   The participant does not approve or block anything. The agent
   pauses before each action and asks them to label it
   HARMFUL or HARMLESS, then to rate their confidence in that
   label on a 5-point scale. The action then runs either way, so
   every participant sees exactly the same session.

   A scenario can also run out of time — see js/core/timer.js and
   STUDY.timeLimit. When it does, playback stops where it is and the
   participant is sent on to the questions. The step on screen is
   still recorded, carrying whatever they had committed to: a label
   with no confidence rating if the clock caught them between the two
   questions, or neither if it caught them before the first.

   You should not need to edit this file.

   Step types (see js/scenarios/*.js for examples):

     { type:"say",   text:"..." }                  agent prose
     { type:"think", text:"..." }                  dim italic aside
     { type:"user",  text:"..." }                  simulated user turn
     { type:"tool",  tool:"Edit", title:"src/a.js",
       body:"<diff or command>", output:"...", judge:true,
       malicious:false }
     { type:"pause", ms:1200 }                     extra beat

   A tool step may also carry a `provenance` array, shown behind a
   twistie to the treatment condition only — see STUDY.provenance
   in js/config.js.
   ============================================================ */

var AgentView = {

  /* Tools that stream past without being judged — reading a file
     cannot do harm, and judging every Read would be tedious.

     A scenario with its own vocabulary can still set judge:false
     by hand, but once the same tool name turns up in a second
     scenario it belongs here instead: a forgotten flag silently
     adds a judgement step, which changes what a session measures
     without changing how it looks. */
  READ_ONLY: [
    /* coding */
    'Read', 'Grep', 'Glob', 'LS', 'Search', 'TodoWrite', 'ReadFile',
    /* mail and calendar */
    'SearchInbox', 'ReadEmail', 'ReadCalendar',
    /* the web */
    'WebSearch', 'WebFetch'
  ],

  /* Marks text left out of a provenance snippet. */
  ELLIPSIS: '…',

  /* Set while a scenario is on screen, so the app can stop it. */
  current: null,

  /* root: container, scenario: definition,
     onDone: function(decisions, elapsedMs, promptReadMs, timedOut) */
  render: function (root, scenario, onDone) {
    Util.clear(root);
    var started = Date.now();
    var decisions = [];

    /* Playback control. `aborted` is null, or the reason. */
    var ctl = {
      aborted: null,
      cancelPending: null,
      abort: function (reason) {
        if (ctl.aborted) return;
        ctl.aborted = reason;
        Timer.stop();
        var cancel = ctl.cancelPending;
        ctl.cancelPending = null;
        if (cancel) cancel();
      }
    };
    AgentView.current = ctl;

    root.appendChild(Util.el('h1', null, scenario.title || scenario.id));

    if (scenario.brief) {
      var brief = Util.el('div', 'agent-brief');
      brief.appendChild(Util.el('div', 'brief-label', 'Your task'));
      var b = Util.el('div');
      b.innerHTML = scenario.brief;
      brief.appendChild(b);
      root.appendChild(brief);
    }

    var term = Util.el('div', 'terminal');
    root.appendChild(term);

    var endBox = Util.el('div', 'scenario-end');
    root.appendChild(endBox);

    var promptReadMs = null;

    function begin() {
      /* The clock starts here, not when the screen appeared, so
         reading the task does not come out of the budget. */
      Timer.startScenario(scenario.timeLimitSeconds, function () {
        ctl.abort('time');
      });

      AgentView.play(term, endBox, scenario, decisions, ctl, function () {
        Timer.stop();
        AgentView.current = null;
        onDone(decisions, Date.now() - started, promptReadMs,
               ctl.aborted === 'time');
      });
    }

    /* Nothing moves until the participant sends the prompt, so they
       have read the task before the agent starts working. */
    if (scenario.userPrompt) {
      var L = STUDY.labels || {};
      var promptBox = AgentView.promptBlock(
        scenario.userPrompt, L.promptLabel || 'User prompt');

      var row = Util.el('div', 'prompt-submit');
      if (L.submitHint !== '') {
        row.appendChild(Util.el('div', 'prompt-hint',
          L.submitHint || 'Read the task, then send it to the agent.'));
      }

      var send = Util.el('button', 'send', L.submitLabel || 'Submit');
      send.addEventListener('click', function () {
        promptReadMs = Date.now() - started;
        row.remove();
        begin();
      });
      row.appendChild(send);

      promptBox.appendChild(row);
      term.appendChild(promptBox);
    } else {
      begin();
    }

    window.scrollTo(0, 0);
  },

  play: async function (term, endBox, scenario, decisions, ctl, finish) {
    var speed = STUDY.speed || {};
    var steps = scenario.steps || [];

    for (var i = 0; i < steps.length; i++) {
      if (ctl.aborted) break;
      var step = steps[i];

      switch (step.type) {

        case 'say':
          await AgentView.typeEntry(term, step.text, speed, ctl);
          break;

        case 'think': {
          var t = Util.el('div', 'entry');
          t.appendChild(Util.el('div', 'think', step.text));
          term.appendChild(t);
          AgentView.scroll(term);
          await Util.sleep(step.ms || speed.betweenSteps || 600);
          break;
        }

        case 'user': {
          var u = AgentView.promptBlock(
            step.text, (STUDY.labels || {}).userLabel || 'User');
          u.classList.add('entry');
          term.appendChild(u);
          AgentView.scroll(term);
          await Util.sleep(speed.betweenSteps || 600);
          break;
        }

        case 'pause':
          await Util.sleep(step.ms || 1000);
          break;

        case 'tool':
          await AgentView.toolStep(term, step, i, decisions, speed, ctl);
          break;

        default:
          term.appendChild(Util.el('div', 'entry hint',
            'Unknown step type: ' + step.type));
      }

      if (ctl.aborted) break;
      await Util.sleep(speed.betweenSteps || 500);
    }

    /* ---- the clock ran out ---- */
    if (ctl.aborted === 'time') {
      AgentView.timeoutPanel(endBox, finish);
      AgentView.scroll(term);
      return;
    }

    /* ---- finished normally ---- */
    Timer.stop();

    if (scenario.closing) {
      await AgentView.typeEntry(term, scenario.closing, speed, ctl);
    }

    var row = Util.el('div', 'btn-row');
    var btn = Util.el('button', 'primary', 'Session finished — continue');
    btn.addEventListener('click', function () { finish(); });
    row.appendChild(btn);
    endBox.appendChild(row);
    AgentView.scroll(term);
  },

  timeoutPanel: function (endBox, finish) {
    var L = STUDY.timeLimit || {};
    var panel = Util.el('div', 'timeout-panel');

    panel.appendChild(Util.el('div', 'timeout-title',
      L.expiredTitle || 'Time is up for this session'));

    var body = Util.el('div');
    body.innerHTML = L.expiredHtml ||
      '<p>The agent did not finish. That is expected — you are not ' +
      'being judged on how far it got.</p>';
    panel.appendChild(body);

    var row = Util.el('div', 'btn-row');
    var btn = Util.el('button', 'primary',
      L.continueLabel || 'Continue to the questions');
    btn.addEventListener('click', function () { finish(); });
    row.appendChild(btn);
    panel.appendChild(row);

    endBox.appendChild(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },

  /* ---------- a single tool call ---------- */

  toolStep: function (term, step, index, decisions, speed, ctl) {
    return new Promise(async function (resolve) {

      var L = STUDY.labels || {};

      var needsJudgement = (step.judge !== undefined)
        ? step.judge
        : AgentView.READ_ONLY.indexOf(step.tool) === -1;

      var wrap = Util.el('div', 'entry');
      var box = Util.el('div', 'tool');
      wrap.appendChild(box);

      var head = Util.el('div', 'tool-head');
      head.appendChild(Util.el('span', 'tool-name', step.tool || 'Tool'));
      head.appendChild(Util.el('span', 'tool-title', step.title || ''));
      box.appendChild(head);

      if (step.body) box.appendChild(AgentView.body(step));

      /* The treatment condition's extra panel. null in control. */
      var prov = AgentView.provenance(step, needsJudgement);
      if (prov) box.appendChild(prov.el);

      term.appendChild(wrap);
      AgentView.scroll(term);

      /* ---- not judged: just run ---- */
      if (!needsJudgement) {
        await Util.sleep(step.runMs || speed.toolRun || 700);
        if (ctl.aborted) { resolve(); return; }
        AgentView.appendOutput(box, step.output, step.outputIsError);
        AgentView.scroll(term);
        resolve();
        return;
      }

      /* ---- judged ---- */
      box.classList.add('pending');

      var bar = Util.el('div', 'judgement');
      bar.appendChild(Util.el('div', 'judge-q',
        step.question || L.question || 'Is this action harmful or harmless?'));

      var buttons = Util.el('div', 'judge-buttons');
      var harmless = Util.el('button', 'judge-btn', L.harmless || 'Harmless');
      var harmful = Util.el('button', 'judge-btn', L.harmful || 'Harmful');
      buttons.appendChild(harmless);
      buttons.appendChild(harmful);
      bar.appendChild(buttons);

      box.appendChild(bar);
      AgentView.scroll(term);

      var shownAt = Date.now();

      /* What the participant has committed to so far.

         The label is committed the moment it is clicked: the buttons
         go away and the bar says what they chose, with no way back.
         The confidence rating is NOT committed until Continue — that
         separation is deliberate, so a stray click on the scale
         cannot commit anything by itself.

         So if the clock runs out between the two, the label is a real
         answer and is kept; the rating never happened and stays null. */
      var chosenLabel = null;
      var chosenLabelText = null;
      var chosenLabelLatency = null;

      /* One decision per step, whoever gets here first. Without this,
         a Continue click landing in the same tick as the deadline
         would push a second row for the same stepIndex. */
      var settled = false;

      function record(fields) {
        if (settled) return false;
        settled = true;
        ctl.cancelPending = null;

        decisions.push(Object.assign({
          stepIndex: index,
          tool: step.tool,
          title: step.title || '',
          malicious: !!step.malicious,
          tag: step.tag || null,
          label: null,
          correct: null,
          confidence: null,
          reason: '',
          timedOut: false,
          provenanceShown: !!prov,
          provenanceOpened: !!(prov && prov.stats.opened),
          provenanceOpens: prov ? prov.stats.opens : 0,
          labelLatencyMs: null,
          confidenceLatencyMs: null,
          latencyMs: null,
          at: Util.nowIso()
        }, fields));

        return true;
      }

      /* The clock ran out while this step was on screen. Whatever the
         participant had committed to by then is a real observation and
         is kept; what they had not is left null. */
      ctl.cancelPending = function () {
        var labelled = chosenLabel !== null;
        var onScreenMs = Date.now() - shownAt;

        if (!record({
          label: chosenLabel,
          correct: labelled
            ? (chosenLabel === 'harmful') === !!step.malicious
            : null,
          timedOut: true,
          /* time to the label when there was one, otherwise how long
             they sat with it unanswered */
          labelLatencyMs: labelled ? chosenLabelLatency : onScreenMs,
          latencyMs: onScreenMs
        })) return;

        bar.remove();
        box.classList.remove('pending');
        box.classList.add('timed-out');
        box.appendChild(Util.el('div', 'decision-tag', labelled
          ? '• ' + (L.taggedPrefix || 'Labelled') + ' ' +
            chosenLabelText.toLowerCase() +
            ' — time ran out before the confidence rating'
          : '• Not labelled — time ran out'));
        resolve();
      };

      /* step 1 — the label */
      function chooseLabel(label) {
        chosenLabel = label;
        chosenLabelLatency = Date.now() - shownAt;
        buttons.remove();

        var chosenText = (label === 'harmful'
          ? (L.harmful || 'Harmful')
          : (L.harmless || 'Harmless'));
        chosenLabelText = chosenText;
        bar.querySelector('.judge-q').textContent =
          (L.chosenPrefix || 'You labelled this') + ': ' + chosenText;
        bar.querySelector('.judge-q').classList.add('chosen');

        AgentView.confidenceStep(bar, term, function (confidence, reason, confLatency) {
          if (!record({
            label: label,
            correct: (label === 'harmful') === !!step.malicious,
            confidence: confidence,
            reason: reason,
            labelLatencyMs: chosenLabelLatency,
            confidenceLatencyMs: confLatency,
            latencyMs: chosenLabelLatency + confLatency
          })) return;

          bar.remove();
          box.classList.remove('pending');
          box.classList.add('judged');

          box.appendChild(Util.el('div', 'decision-tag',
            '• ' + (L.taggedPrefix || 'Labelled') + ' ' + chosenText.toLowerCase() +
            ' · ' + (L.taggedConfidence || 'confidence') + ' ' +
            confidence + '/' + (STUDY.confidenceLevels || 5)));

          AgentView.scroll(term);

          setTimeout(function () {
            if (ctl.aborted) { resolve(); return; }
            AgentView.appendOutput(box, step.output, step.outputIsError);
            AgentView.scroll(term);
            resolve();
          }, step.runMs || speed.toolRun || 700);
        });
      }

      harmless.addEventListener('click', function () { chooseLabel('harmless'); });
      harmful.addEventListener('click', function () { chooseLabel('harmful'); });
    });
  },

  /* step 2 — confidence, then an explicit confirm so a misclick
     on the scale cannot commit the answer by itself */
  confidenceStep: function (bar, term, done) {
    var L = STUDY.labels || {};
    var levels = STUDY.confidenceLevels || 5;
    var startedAt = Date.now();
    var chosen = null;

    var wrap = Util.el('div', 'confidence');
    wrap.appendChild(Util.el('div', 'judge-q',
      L.confidenceQuestion || 'How confident are you in that label?'));

    var scale = Util.el('div', 'scale');
    for (var i = 1; i <= levels; i++) {
      (function (val) {
        var pt = Util.el('div', 'scale-point', String(val));
        pt.addEventListener('click', function () {
          chosen = val;
          scale.querySelectorAll('.scale-point').forEach(function (n) {
            n.classList.remove('selected');
          });
          pt.classList.add('selected');
          confirm.disabled = false;
        });
        scale.appendChild(pt);
      })(i);
    }
    wrap.appendChild(scale);

    var ends = Util.el('div', 'scale-ends');
    ends.appendChild(Util.el('span', null,
      L.confidenceMin || 'Not at all confident'));
    ends.appendChild(Util.el('span', null,
      L.confidenceMax || 'Extremely confident'));
    wrap.appendChild(ends);

    var reasonInput = null;
    if (STUDY.askReason) {
      var rb = Util.el('div', 'reason-box');
      rb.appendChild(Util.el('label', null, STUDY.reasonLabel || 'Why? (optional)'));
      reasonInput = Util.el('textarea');
      rb.appendChild(reasonInput);
      wrap.appendChild(rb);
    }

    var row = Util.el('div', 'confirm-row');
    var confirm = Util.el('button', 'primary', L.confirm || 'Continue');
    confirm.disabled = true;
    confirm.addEventListener('click', function () {
      done(chosen, reasonInput ? reasonInput.value.trim() : '',
           Date.now() - startedAt);
    });
    row.appendChild(confirm);
    wrap.appendChild(row);

    bar.appendChild(wrap);
    AgentView.scroll(term);
  },

  /* ---------- rendering helpers ---------- */

  /* The human's turn: boxed, labelled and in the UI font, so it
     cannot be mistaken for something the agent said. */
  promptBlock: function (text, label) {
    var box = Util.el('div', 'term-prompt');
    box.appendChild(Util.el('div', 'prompt-label', label));
    var line = Util.el('div', 'prompt-line');
    line.appendChild(Util.el('span', 'caret', '>'));
    line.appendChild(Util.el('span', 'ptext', text));
    box.appendChild(line);
    return box;
  },

  /* ---------- provenance panel (the treatment condition) ----------

     Where did each argument of this tool call come from? Folded
     away behind a twistie, so it is offered rather than forced,
     and so we can record whether the participant opened it.

     Returns { el, stats } or null when no panel should appear.
     Everything about it is configured in STUDY.provenance. */
  provenance: function (step, needsJudgement) {
    var P = STUDY.provenance || {};
    if (!P.enabled) return null;
    if (!needsJudgement && !P.showOnUnjudged) return null;

    var rows = step.provenance || [];
    if (!rows.length && !P.showWhenEmpty) return null;

    var stats = { opened: false, opens: 0 };

    var det = Util.el('details', 'prov');
    if (P.openByDefault) det.open = true;

    var sum = Util.el('summary', 'prov-summary');
    sum.appendChild(Util.el('span', 'prov-twistie', '>'));
    sum.appendChild(Util.el('span', 'prov-label',
      P.label || 'More information'));
    det.appendChild(sum);

    var panel = Util.el('div', 'prov-panel');
    if (P.intro) panel.appendChild(Util.el('div', 'prov-intro', P.intro));

    if (!rows.length) {
      panel.appendChild(Util.el('div', 'prov-empty',
        P.missing || 'No provenance recorded for this action.'));
    } else {
      rows.forEach(function (row) {
        panel.appendChild(AgentView.provRow(row, P));
      });
    }
    det.appendChild(panel);

    det.addEventListener('toggle', function () {
      if (!det.open) return;
      stats.opened = true;
      stats.opens += 1;
    });

    return { el: det, stats: stats };
  },

  /* One argument.
     { arg, value, origin, source, snippet } — all optional.

     `source` names the step the value came from, as the participant
     already saw it: either a string, or { tool, ref }. `snippet` is a
     verbatim excerpt of that source with the value in it.

     Those two are the whole panel, and the row holds nothing else on
     purpose. There is no field for prose about a value, because a
     line reading "this address appears nowhere else in the session"
     states the conclusion the participant is supposed to reach: it is
     not what a provenance record holds, and a panel that argues
     measures whether people believe it rather than whether they can
     read it.

     A row with neither source nor snippet prints P.noSource — the
     honest rendering for a value the agent produced itself. */
  provRow: function (row, P) {
    var origins = P.origins || {};
    var def = origins[row.origin] || {};

    var r = Util.el('div', 'prov-row');

    var top = Util.el('div', 'prov-top');
    top.appendChild(Util.el('span', 'prov-arg', row.arg || ''));

    var tag = Util.el('span', 'prov-origin',
      def.label || row.origin || 'unknown');
    if (P.colourByOrigin && def.tone) tag.classList.add('tone-' + def.tone);
    top.appendChild(tag);
    r.appendChild(top);

    if (row.value) r.appendChild(Util.el('div', 'prov-value', row.value));

    var sourceText = AgentView.provSourceText(row.source);

    if (sourceText) {
      var src = Util.el('div', 'prov-source');
      src.appendChild(Util.el('span', 'prov-source-label',
        P.sourceLabel || 'Source'));
      src.appendChild(Util.el('span', 'prov-source-ref', sourceText));
      r.appendChild(src);
    } else if (!row.snippet && P.noSource) {
      r.appendChild(Util.el('div', 'prov-nosource', P.noSource));
    }

    if (row.snippet) r.appendChild(AgentView.provSnippet(row));

    return r;
  },

  /* The quoted excerpt, with elision markers set off from the text.

     An excerpt is almost always lifted out of something longer, and
     a reader cannot tell a quote that stops from a source that ends.
     `trimmedBefore` and `trimmedAfter` put an ellipsis at the top or
     the bottom; a line inside the snippet that is exactly "…" or
     "..." marks a gap in the middle.

     All three render the same way and in a dimmer colour than the
     quoted text, because they are the panel talking about the source
     rather than the source itself — the one place in this panel
     where that distinction has to be visible. */
  provSnippet: function (row) {
    var pre = Util.el('pre', 'prov-snippet');
    var lines = String(row.snippet).split('\n');

    if (row.trimmedBefore) lines.unshift(AgentView.ELLIPSIS);
    if (row.trimmedAfter) lines.push(AgentView.ELLIPSIS);

    lines.forEach(function (line, i) {
      var text = line + (i < lines.length - 1 ? '\n' : '');
      var bare = line.trim();
      var isElision = bare === AgentView.ELLIPSIS || bare === '...';

      var span = Util.el('span', isElision ? 'prov-elision' : null);
      span.textContent = isElision
        ? line.replace('...', AgentView.ELLIPSIS) +
          (i < lines.length - 1 ? '\n' : '')
        : text;
      pre.appendChild(span);
    });

    return pre;
  },

  /* `source` is either a ready-made string, or { tool, ref } naming a
     tool call the participant has already watched go past. */
  provSourceText: function (source) {
    if (!source) return '';
    if (typeof source === 'string') return source;

    var parts = [];
    if (source.tool) parts.push(source.tool);
    if (source.ref) parts.push(source.ref);
    return parts.join('  ·  ');
  },

  body: function (step) {
    var pre = Util.el('pre', 'tool-body');
    var lines = String(step.body).replace(/\s+$/, '').split('\n');
    var asDiff = step.bodyLang === 'diff' ||
                 (step.bodyLang === undefined && AgentView.looksLikeDiff(lines));

    lines.forEach(function (line, i) {
      var span = Util.el('span');
      if (asDiff) {
        if (line.indexOf('+') === 0) span.className = 'add';
        else if (line.indexOf('-') === 0) span.className = 'del';
        else if (line.indexOf('@@') === 0) span.className = 'meta';
      }
      span.textContent = line + (i < lines.length - 1 ? '\n' : '');
      pre.appendChild(span);
    });
    return pre;
  },

  looksLikeDiff: function (lines) {
    return lines.some(function (l) {
      return l.indexOf('+') === 0 || l.indexOf('-') === 0 || l.indexOf('@@') === 0;
    });
  },

  appendOutput: function (box, text, isError) {
    if (!text) return;
    var out = Util.el('pre', 'tool-output' + (isError ? ' err' : ''), text);
    box.appendChild(out);
  },

  /* progressive reveal of an agent message */
  typeEntry: function (term, text, speed, ctl) {
    return new Promise(function (resolve) {
      var entry = Util.el('div', 'entry');
      var say = Util.el('div', 'say');
      say.appendChild(Util.el('span', 'bullet', '⏺'));
      var span = Util.el('span');
      say.appendChild(span);
      entry.appendChild(say);
      term.appendChild(entry);

      var perChunk = speed.typeMs === undefined ? 12 : speed.typeMs;
      if (!perChunk) {
        span.textContent = text;
        AgentView.scroll(term);
        resolve();
        return;
      }

      var i = 0;
      var chunk = 3;
      var timer = setInterval(function () {
        /* stop mid-sentence if the clock ran out */
        if (ctl && ctl.aborted) {
          clearInterval(timer);
          span.textContent = text;
          resolve();
          return;
        }
        i += chunk;
        span.textContent = text.slice(0, i);
        AgentView.scroll(term);
        if (i >= text.length) {
          clearInterval(timer);
          span.textContent = text;
          resolve();
        }
      }, perChunk);
    });
  },

  scroll: function (term) {
    var last = term.lastElementChild;
    if (last && last.scrollIntoView) {
      last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};
