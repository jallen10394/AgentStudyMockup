/* ============================================================
   survey.js — renders a survey definition and returns answers.
   You should not need to edit this file.

   Supported question types (see js/surveys.js for examples):
     text, number, textarea, radio, checkbox, select, scale, info
   ============================================================ */

var SurveyView = {

  /* def: a survey definition; onDone: function(answers) */
  render: function (root, def, onDone) {
    Util.clear(root);
    var started = Date.now();

    if (def.title) root.appendChild(Util.el('h1', null, def.title));
    if (def.intro) {
      var p = Util.el('p', 'lede');
      p.innerHTML = def.intro;
      root.appendChild(p);
    }

    var form = Util.el('form', 'card');
    form.setAttribute('novalidate', 'novalidate');

    def.questions.forEach(function (q) {
      form.appendChild(SurveyView.question(q));
    });

    var msg = Util.el('div', 'validation-msg');
    var row = Util.el('div', 'btn-row');
    var next = Util.el('button', 'primary', def.submitLabel || 'Continue');
    next.type = 'submit';
    row.appendChild(next);

    form.appendChild(msg);
    form.appendChild(row);
    root.appendChild(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var answers = {};
      var missing = [];

      def.questions.forEach(function (q) {
        if (q.type === 'info') return;
        var v = SurveyView.readValue(form, q);
        answers[q.id] = v;
        var empty = (v === null || v === '' ||
                     (Array.isArray(v) && v.length === 0));
        if (q.required && empty) missing.push(q.label || q.id);
      });

      if (missing.length) {
        msg.textContent = 'Please answer: ' + missing.join(' · ');
        msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      onDone(answers, Date.now() - started);
    });

    window.scrollTo(0, 0);
  },

  question: function (q) {
    var wrap = Util.el('div', 'question');

    if (q.type === 'info') {
      var box = Util.el('div');
      box.innerHTML = q.html || q.label || '';
      wrap.appendChild(box);
      return wrap;
    }

    var label = Util.el('label', 'q-label');
    label.textContent = q.label || q.id;
    if (q.required) {
      label.appendChild(Util.el('span', 'required-star', '*'));
    }
    wrap.appendChild(label);

    if (q.help) wrap.appendChild(Util.el('div', 'q-help', q.help));

    var name = 'q_' + q.id;

    switch (q.type) {

      case 'text':
      case 'number': {
        var input = Util.el('input');
        input.type = q.type;
        input.name = name;
        if (q.placeholder) input.placeholder = q.placeholder;
        if (q.min !== undefined) input.min = q.min;
        if (q.max !== undefined) input.max = q.max;
        wrap.appendChild(input);
        break;
      }

      case 'textarea': {
        var ta = Util.el('textarea');
        ta.name = name;
        if (q.placeholder) ta.placeholder = q.placeholder;
        wrap.appendChild(ta);
        break;
      }

      case 'select': {
        var sel = Util.el('select');
        sel.name = name;
        sel.appendChild(Util.el('option', null, q.placeholder || '— choose —'));
        sel.firstChild.value = '';
        (q.options || []).forEach(function (o) {
          var opt = Util.el('option', null, SurveyView.optLabel(o));
          opt.value = SurveyView.optValue(o);
          sel.appendChild(opt);
        });
        wrap.appendChild(sel);
        break;
      }

      case 'radio':
      case 'checkbox': {
        (q.options || []).forEach(function (o) {
          var lab = Util.el('label', 'option');
          var inp = Util.el('input');
          inp.type = q.type;
          inp.name = name;
          inp.value = SurveyView.optValue(o);
          lab.appendChild(inp);
          lab.appendChild(Util.el('span', null, SurveyView.optLabel(o)));
          wrap.appendChild(lab);
        });
        break;
      }

      case 'scale': {
        var min = q.min === undefined ? 1 : q.min;
        var max = q.max === undefined ? 5 : q.max;
        var scale = Util.el('div', 'scale');
        for (var i = min; i <= max; i++) {
          (function (val) {
            var pt = Util.el('label', 'scale-point', String(val));
            var inp = Util.el('input');
            inp.type = 'radio';
            inp.name = name;
            inp.value = String(val);
            inp.addEventListener('change', function () {
              scale.querySelectorAll('.scale-point')
                   .forEach(function (n) { n.classList.remove('selected'); });
              pt.classList.add('selected');
            });
            pt.appendChild(inp);
            scale.appendChild(pt);
          })(i);
        }
        wrap.appendChild(scale);
        if (q.minLabel || q.maxLabel) {
          var ends = Util.el('div', 'scale-ends');
          ends.appendChild(Util.el('span', null, q.minLabel || ''));
          ends.appendChild(Util.el('span', null, q.maxLabel || ''));
          wrap.appendChild(ends);
        }
        break;
      }

      default:
        wrap.appendChild(Util.el('div', 'hint',
          'Unknown question type: ' + q.type));
    }

    return wrap;
  },

  optValue: function (o) { return typeof o === 'string' ? o : o.value; },
  optLabel: function (o) { return typeof o === 'string' ? o : (o.label || o.value); },

  readValue: function (form, q) {
    var name = 'q_' + q.id;
    if (q.type === 'checkbox') {
      return Array.prototype.slice
        .call(form.querySelectorAll('[name="' + name + '"]:checked'))
        .map(function (n) { return n.value; });
    }
    if (q.type === 'radio' || q.type === 'scale') {
      var sel = form.querySelector('[name="' + name + '"]:checked');
      if (!sel) return null;
      return q.type === 'scale' ? Number(sel.value) : sel.value;
    }
    var node = form.querySelector('[name="' + name + '"]');
    if (!node) return null;
    var v = node.value.trim();
    if (q.type === 'number') return v === '' ? null : Number(v);
    return v;
  }
};
