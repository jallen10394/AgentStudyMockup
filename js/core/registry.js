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
      missing: judged - written
    });
  });

  return report;
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
