/* ============================================================
   registry.js — holds the surveys and scenarios you define.
   You should not need to edit this file.
   ============================================================ */

var Registry = {
  surveys: {},
  scenarios: {},
  scenarioOrder: [],
  groups: {},        /* name -> { ids: [...], overrides: {...} } */
  idIndex: {}         /* normalised id -> group name */
};

function registerSurvey(def) {
  if (!def.id) throw new Error('registerSurvey: survey needs an "id"');
  Registry.surveys[def.id] = def;
}

function registerScenario(def) {
  if (!def.id) throw new Error('registerScenario: scenario needs an "id"');
  Registry.scenarios[def.id] = def;
  Registry.scenarioOrder.push(def.id);
}

/* Participant groups — see js/participants.js.
   `ids` is the list of participant IDs in this condition.
   `overrides` is merged into STUDY before the study starts, so a
   group can change anything in js/config.js. */
function registerGroup(name, def) {
  if (!name) throw new Error('registerGroup: group needs a name');
  Registry.groups[name] = {
    ids: (def && def.ids) || [],
    overrides: (def && def.overrides) || {}
  };
}

/* Builds the id -> group lookup and reports anything wrong with
   the lists. Returns an array of problem strings; empty is good. */
Registry.indexParticipants = function () {
  Registry.idIndex = {};
  var problems = [];

  Object.keys(Registry.groups).forEach(function (name) {
    var group = Registry.groups[name];

    if (!group.ids.length) {
      problems.push('Group "' + name + '" has no participant IDs.');
      return;
    }

    group.ids.forEach(function (raw) {
      var key = Util.normalizeId(raw);

      if (!key) {
        problems.push('Group "' + name + '" contains an empty ID.');
        return;
      }
      if (Registry.idIndex[key]) {
        var other = Registry.idIndex[key];
        problems.push(other === name
          ? 'ID "' + key + '" is listed twice in group "' + name + '".'
          : 'ID "' + key + '" is in both "' + other + '" and "' + name + '".');
        return;
      }
      Registry.idIndex[key] = name;
    });
  });

  return problems;
};

Registry.groupFor = function (id) {
  return Registry.idIndex[Util.normalizeId(id)] || null;
};

Registry.hasGroups = function () {
  return Object.keys(Registry.groups).length > 0;
};

/* How much of the provenance panel is actually written. Counts
   the judged steps in each scenario of `flow` and how many of
   them carry a `provenance` array. Console only — a half-written
   panel is a gap in the material, not a reason to stop a session
   that is already under way. */
Registry.auditProvenance = function (flow) {
  var report = [];

  flow.forEach(function (entry) {
    if (entry.type !== 'scenario') return;
    var scn = Registry.scenarios[entry.id];
    if (!scn) return;

    var judged = 0, written = 0;
    (scn.steps || []).forEach(function (s) {
      if (s.type !== 'tool') return;
      var needs = (s.judge !== undefined)
        ? s.judge
        : AgentView.READ_ONLY.indexOf(s.tool) === -1;
      if (!needs) return;
      judged++;
      if (s.provenance && s.provenance.length) written++;
    });

    report.push({
      scenario: entry.id,
      judgedSteps: judged,
      withProvenance: written,
      missing: judged - written,
      problems: Registry.checkProvenance(scn).length
    });
  });

  return report;
};

/* Does each provenance row say something the transcript bears out?
   Console only, like the audit above, and for the same reason: a
   wrong row is a flaw in the material, not a reason to stop a
   session that is already under way.

   A row makes two claims and both are checkable, because every
   source is a step the participant has already watched go past:

     - `value` is an argument of THIS call, so it appears in the
       call — its title or its body. Not its output: the output is
       what came back, not what was passed.
     - `snippet` is a verbatim excerpt of the step named in
       `source`, and the value appears inside it.

   What this cannot check is the part that matters most — whether
   the row names the argument the tool actually takes. `arg` is a
   string and no tool schema lives in this project. It can only
   catch a row that quotes something nobody said.

   Run it over anything registered:  Registry.checkProvenance('my-id')

   Returns an array of { scenario, step, tool, arg, problem }. */
Registry.checkProvenance = function (scenario) {
  var scn = (typeof scenario === 'string')
    ? Registry.scenarios[scenario]
    : scenario;

  var problems = [];
  if (!scn) return problems;

  var ELLIPSIS = (window.AgentView && AgentView.ELLIPSIS) || '…';
  var steps = scn.steps || [];

  /* What the agent passed. */
  function callText(step) {
    return [step.title || '', step.body || ''].join('\n');
  }

  /* Everything of a step the participant saw, which is where a
     snippet may legitimately come from. */
  function stepText(step) {
    return [step.title || '', step.body || '', step.output || '',
            step.text || ''].join('\n');
  }

  /* A value too long to print is shown cut, with … where it was
     cut. The longest run between the cuts is the part quoted
     literally, and the only part that can be checked. */
  function literal(value) {
    return String(value === undefined || value === null ? '' : value)
      .split(ELLIPSIS)
      .map(function (part) { return part.trim(); })
      .sort(function (a, b) { return b.length - a.length; })[0];
  }

  /* A snippet may carry its own gap markers — a line that is
     exactly … — so it is checked in pieces, each of which must
     appear, in order. */
  function verbatimIn(text, snippet) {
    var pieces = String(snippet).split('\n').reduce(function (acc, line) {
      var bare = line.trim();
      if (bare === ELLIPSIS || bare === '...') acc.push([]);
      else acc[acc.length - 1].push(line);
      return acc;
    }, [[]]).map(function (lines) {
      return lines.join('\n').trim();
    }).filter(function (piece) {
      return piece.length > 0;
    });

    var from = 0;
    return pieces.every(function (piece) {
      var at = text.indexOf(piece, from);
      if (at === -1) return false;
      from = at + piece.length;
      return true;
    });
  }

  steps.forEach(function (step, i) {
    (step.provenance || []).forEach(function (row) {

      function problem(text) {
        problems.push({
          scenario: scn.id,
          step: i,
          tool: step.tool || step.type,
          arg: row.arg || '(unnamed)',
          problem: text
        });
      }

      var value = literal(row.value);

      if (!row.arg) problem('row has no arg');

      if (value && callText(step).indexOf(value) === -1) {
        problem('value is not in the call: ' + JSON.stringify(value));
      }

      if (row.source && !row.snippet) problem('source with no snippet');
      if (!row.source && row.snippet) problem('snippet with no source');
      if (!row.snippet) return;

      /* Resolve the source. An object names an earlier step by tool
         and title; a plain string is the person, meaning the prompt
         they submitted or a turn they took before this step. */
      var sourceText = null;

      if (typeof row.source === 'object') {
        /* `ref` is a label for the reader, not an id, so a title it
           is the start of counts — as long as only one step answers
           to it. Anything looser and a renamed title stops being
           caught, which is the drift this is here for. */
        var exact = [], starts = [];
        for (var j = 0; j < i; j++) {
          if (steps[j].tool !== row.source.tool) continue;
          var title = steps[j].title || '';
          if (title === row.source.ref) exact.push(steps[j]);
          else if (title.indexOf(row.source.ref) === 0) starts.push(steps[j]);
        }
        var found = exact.length ? exact : starts;

        if (found.length === 1) {
          sourceText = stepText(found[0]);
        } else if (found.length > 1) {
          problem('source names more than one earlier step: ' +
                  row.source.tool + ' · ' + row.source.ref);
        } else {
          problem('source names no earlier step: ' +
                  row.source.tool + ' · ' + row.source.ref);
        }
      } else {
        /* A plain-string source names something in its own words —
           the task, the user mid-session, the agent's own reasoning
           — so the snippet is checked against everything that had
           already happened when this call was made. */
        var earlier = [scn.userPrompt || ''];
        for (var k = 0; k < i; k++) earlier.push(stepText(steps[k]));
        sourceText = earlier.join('\n');
      }

      if (sourceText !== null && !verbatimIn(sourceText, row.snippet)) {
        problem(typeof row.source === 'string'
          ? 'snippet is not verbatim in anything earlier in the session'
          : 'snippet is not verbatim in that step');
      }

      if (value && String(row.snippet).indexOf(value) === -1) {
        problem('value is not inside its own snippet: ' +
                JSON.stringify(value));
      }
    });
  });

  return problems;
};

/* ---------- small shared helpers ---------- */

var Util = {

  el: function (tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  },

  clear: function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  },

  // Fisher-Yates
  shuffle: function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  },

  randomId: function () {
    return 'P-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  },

  /* Participant IDs are matched trimmed and upper-cased, so
     "p-001 " and "P-001" are the same person. */
  normalizeId: function (value) {
    return String(value === null || value === undefined ? '' : value)
      .trim()
      .toUpperCase();
  },

  /* Deep-merges `source` into `target`, in place.
     Plain objects merge key by key; arrays and everything else
     replace wholesale — so a group that overrides `flow` gets its
     own flow rather than one spliced into the default. */
  mergeInto: function (target, source) {
    Object.keys(source).forEach(function (key) {
      var value = source[key];
      var isPlain = value && typeof value === 'object' && !Array.isArray(value);
      var targetIsPlain = target[key] && typeof target[key] === 'object' &&
                          !Array.isArray(target[key]);

      if (isPlain && targetIsPlain) {
        Util.mergeInto(target[key], value);
      } else {
        target[key] = Array.isArray(value) ? value.slice() : value;
      }
    });
    return target;
  },

  nowIso: function () {
    return new Date().toISOString();
  },

  sleep: function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  },

  toast: function (msg) {
    var t = Util.el('div', 'toast', msg);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2000);
  }
};
