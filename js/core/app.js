/* ============================================================
   app.js — walks the participant through STUDY.flow.
   You should not need to edit this file; edit js/config.js.
   ============================================================ */

var App = {

  flow: [],
  index: 0,
  participantId: null,
  group: null,
  groupOverrides: {},

  start: function () {
    document.getElementById('study-title').textContent =
      STUDY.title || 'Agent Approval Study';
    Timer.mount();

    /* A broken participant list is not something to discover
       halfway through a session, so check it before anything. */
    var problems = Registry.indexParticipants();
    if (problems.length) {
      App.configError(problems);
      return;
    }

    /* The flow is built on Begin, not here — a group may
       override it, and we do not know the group until the
       participant has identified themselves. */
    App.welcome();
  },

  /* Apply optional randomisation of scenario order, keeping the
     surveys/info screens exactly where they are in the flow. */
  buildFlow: function () {
    var flow = (STUDY.flow || []).map(function (s) {
      return Object.assign({}, s);
    });

    if (STUDY.randomizeScenarioOrder) {
      var slots = [];
      flow.forEach(function (s, i) { if (s.type === 'scenario') slots.push(i); });
      var ids = Util.shuffle(slots.map(function (i) { return flow[i].id; }));
      slots.forEach(function (slot, n) { flow[slot].id = ids[n]; });
    }
    return flow;
  },

  screen: function () { return document.getElementById('screen'); },

  /* ---------- welcome ---------- */

  welcome: function () {
    var root = App.screen();
    Util.clear(root);
    App.progress('');

    var w = STUDY.welcome || {};
    root.appendChild(Util.el('h1', null, w.title || STUDY.title || 'Welcome'));

    var card = Util.el('div', 'card');
    var body = Util.el('div');
    body.innerHTML = w.html || '';
    card.appendChild(body);

    var qWrap = Util.el('div', 'question');
    var lab = Util.el('label', 'q-label', 'Participant ID');
    qWrap.appendChild(lab);
    qWrap.appendChild(Util.el('div', 'q-help',
      w.idHelp || 'Enter the ID the researcher gave you.'));
    var input = Util.el('input');
    input.type = 'text';
    input.placeholder = w.idPlaceholder || 'e.g. P-001';
    qWrap.appendChild(input);
    card.appendChild(qWrap);

    var msg = Util.el('div', 'validation-msg');
    card.appendChild(msg);

    var row = Util.el('div', 'btn-row');
    var go = Util.el('button', 'primary', w.startLabel || 'Begin');
    row.appendChild(go);
    card.appendChild(row);

    function begin() {
      var typed = input.value.trim();

      if (!typed) {
        msg.textContent = 'Please enter your participant ID.';
        input.focus();
        return;
      }

      var group = Registry.groupFor(typed);

      /* Unknown ID: stop here rather than collecting an hour of
         data nobody can assign to a condition. */
      if (Registry.hasGroups() && !group && !STUDY.allowUnlistedIds) {
        msg.textContent = STUDY.unknownIdMessage ||
          'That ID is not recognised. Please check with the researcher.';
        input.focus();
        input.select();
        return;
      }

      App.participantId = Util.normalizeId(typed);
      App.group = group;
      App.groupOverrides = (group && Registry.groups[group].overrides) || {};

      /* The condition is applied here, before the flow is built,
         so a group may override the flow itself. */
      Util.mergeInto(STUDY, App.groupOverrides);
      App.flow = App.buildFlow();

      /* Which judged steps still have no provenance written. The
         participant never sees this; it is for whoever is
         authoring the scenarios. */
      if ((STUDY.provenance || {}).enabled && window.console) {
        var audit = Registry.auditProvenance(App.flow);
        var gaps = audit.filter(function (r) { return r.missing > 0; });
        if (gaps.length && console.table) {
          console.warn('Provenance panel is on. Steps still missing data:');
          console.table(gaps);
        }

        /* And rows that are written but do not hold up: a value
           that is not in the call it claims to be an argument of,
           a snippet that is not verbatim where it says it came
           from. Those are the two things a participant can check
           by reading, so they are the two things that must be
           true before anyone is shown them. */
        var wrong = [];
        App.flow.forEach(function (entry) {
          if (entry.type !== 'scenario') return;
          wrong = wrong.concat(Registry.checkProvenance(entry.id));
        });
        if (wrong.length && console.table) {
          console.warn('Provenance rows that do not check out:');
          console.table(wrong);
        }
      }

      Results.init(App.participantId, App.flow, {
        group: App.group,
        groupOverrides: App.groupOverrides,
        randomizeScenarioOrder: !!STUDY.randomizeScenarioOrder,
        askReason: !!STUDY.askReason,
        confidenceLevels: STUDY.confidenceLevels || 5,
        timeLimit: STUDY.timeLimit || null
      });

      App.index = 0;
      App.step();
    }

    go.addEventListener('click', begin);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); begin(); }
    });

    root.appendChild(card);
    input.focus();
    window.scrollTo(0, 0);
  },

  /* ---------- a broken participant list ---------- */

  configError: function (problems) {
    var root = App.screen();
    Util.clear(root);
    App.progress('');

    root.appendChild(Util.el('h1', null, 'Configuration error'));

    var card = Util.el('div', 'card');
    card.appendChild(Util.el('p', null,
      'The study cannot start because the participant lists are not valid:'));

    var list = Util.el('ul');
    problems.forEach(function (p) {
      list.appendChild(Util.el('li', null, p));
    });
    card.appendChild(list);

    card.appendChild(Util.el('p', 'hint',
      'Fix js/participants.js and reload. No participant data has been ' +
      'recorded.'));

    root.appendChild(card);
    window.scrollTo(0, 0);
  },

  /* ---------- flow driver ---------- */

  step: function () {
    var root = App.screen();

    /* Nothing outside a scenario is timed. */
    Timer.stop();
    AgentView.current = null;

    if (App.index >= App.flow.length) {
      App.finish();
      return;
    }

    var entry = App.flow[App.index];
    App.progress('Step ' + (App.index + 1) + ' of ' + App.flow.length);
    var stepNo = App.index;

    switch (entry.type) {

      case 'info':
        App.info(root, entry);
        break;

      case 'survey': {
        var def = Registry.surveys[entry.id];
        if (!def) return App.missing(root, 'survey', entry.id);
        SurveyView.render(root, def, function (answers, elapsed) {
          Results.record({
            step: stepNo, type: 'survey', id: entry.id,
            answers: answers, elapsedMs: elapsed
          });
          App.advance();
        });
        break;
      }

      case 'scenario': {
        var scn = Registry.scenarios[entry.id];
        if (!scn) return App.missing(root, 'scenario', entry.id);
        AgentView.render(root, scn, function (decisions, elapsed, promptReadMs, timedOut) {
          Results.record({
            step: stepNo, type: 'scenario', id: entry.id,
            title: scn.title || null,
            decisions: decisions,
            promptReadMs: promptReadMs,
            elapsedMs: elapsed,
            timedOut: !!timedOut,
            stepsInScenario: (scn.steps || []).filter(function (s) {
              return s.type === 'tool' &&
                (s.judge !== undefined
                  ? s.judge
                  : AgentView.READ_ONLY.indexOf(s.tool) === -1);
            }).length
          });
          App.advance();
        });
        break;
      }

      case 'finish':
        App.finish();
        break;

      default:
        App.missing(root, 'step type', entry.type);
    }
  },

  advance: function () {
    App.index++;
    App.step();
  },

  progress: function (text) {
    document.getElementById('progress').textContent = text;
  },

  /* ---------- plain info screen ---------- */

  info: function (root, entry) {
    Util.clear(root);
    root.appendChild(Util.el('h1', null, entry.title || ''));
    var card = Util.el('div', 'card');
    var body = Util.el('div');
    body.innerHTML = entry.html || '';
    card.appendChild(body);

    var row = Util.el('div', 'btn-row');
    var btn = Util.el('button', 'primary', entry.buttonLabel || 'Continue');
    btn.addEventListener('click', App.advance);
    row.appendChild(btn);
    card.appendChild(row);
    root.appendChild(card);
    window.scrollTo(0, 0);
  },

  /* ---------- finish ---------- */

  finish: function () {
    Results.finish();
    var root = App.screen();
    Util.clear(root);
    App.progress('Complete');

    var f = STUDY.finish || {};
    root.appendChild(Util.el('h1', null, f.title || 'Thank you'));

    var card = Util.el('div', 'card');
    var body = Util.el('div');
    body.innerHTML = f.html ||
      '<p>Your responses are recorded. Please save the data file and ' +
      'hand it to the researcher.</p>';
    card.appendChild(body);

    var row = Util.el('div', 'btn-row');

    var dl = Util.el('button', 'primary', 'Download results (JSON)');
    dl.addEventListener('click', Results.download);
    row.appendChild(dl);

    var copy = Util.el('button', null, 'Copy results to clipboard');
    copy.addEventListener('click', function () {
      navigator.clipboard.writeText(Results.json())
        .then(function () { Util.toast('Copied.'); })
        .catch(function () { Util.toast('Copy failed — use Download.'); });
    });
    row.appendChild(copy);

    if (STUDY.submitUrl) {
      var send = Util.el('button', null, 'Send to researcher');
      send.addEventListener('click', function () {
        send.disabled = true;
        send.textContent = 'Sending…';
        Results.submit(STUDY.submitUrl)
          .then(function (r) {
            send.textContent = r.ok ? 'Sent ✓' : 'Failed — use Download';
          })
          .catch(function () {
            send.textContent = 'Failed — use Download';
            send.disabled = false;
          });
      });
      row.appendChild(send);
    }

    card.appendChild(row);
    root.appendChild(card);

    if (STUDY.showSummaryAtEnd) {
      var sum = Util.el('div', 'card');
      sum.appendChild(Util.el('h2', null, 'Researcher summary'));
      var pre = Util.el('pre', 'tool-body',
        JSON.stringify(Results.summary(), null, 2));
      sum.appendChild(pre);
      root.appendChild(sum);
    }

    if (STUDY.showRawJsonAtEnd) {
      var raw = Util.el('div', 'card');
      raw.appendChild(Util.el('h2', null, 'Raw data'));
      var ta = Util.el('textarea');
      ta.id = 'export-json';
      ta.readOnly = true;
      ta.value = Results.json();
      raw.appendChild(ta);
      root.appendChild(raw);
    }

    window.scrollTo(0, 0);
  },

  /* A step in `flow` that does not resolve: a scenario or survey id
     with nothing registered under it, or a step type that does not
     exist.

     Recorded, not merely displayed. Without an event here the results
     file lists the step in `flow` and holds nothing for it in
     `events`, and whoever analyses it has to guess between a
     participant who skipped it, a browser that died, and a step that
     was never there — a silent gap is the one thing a results file
     must not have.

     The participant carries on rather than being stopped: a mistyped
     id at minute forty should not cost the rest of the session. The
     screen is written for them, with what the researcher needs
     underneath it. */
  missing: function (root, kind, id) {
    var message = (kind === 'step type')
      ? 'Unknown step type "' + id + '".'
      : 'No ' + kind + ' registered with id "' + id + '".';

    Results.record({
      step: App.index,
      type: 'error',
      kind: kind,
      id: id,
      message: message,
      at: Util.nowIso()
    });

    Util.clear(root);
    root.appendChild(Util.el('h1', null, 'This part is unavailable'));

    var card = Util.el('div', 'card');
    card.appendChild(Util.el('p', null,
      'Something in the study is set up wrong — it is not anything you ' +
      'did, and nothing you have already answered is lost. Please let ' +
      'the researcher know. You can carry on with the rest of the ' +
      'session.'));
    card.appendChild(Util.el('p', 'hint',
      'For the researcher: ' + message + ' Check js/config.js, and make ' +
      'sure the file that defines it is listed in index.html. This step ' +
      'is recorded in the results file as an "error" event.'));

    var row = Util.el('div', 'btn-row');
    var skip = Util.el('button', 'primary', 'Continue');
    skip.addEventListener('click', App.advance);
    row.appendChild(skip);
    card.appendChild(row);
    root.appendChild(card);
    window.scrollTo(0, 0);
  }
};

document.addEventListener('DOMContentLoaded', App.start);
