/* ============================================================
   timer.js — the per-scenario time limit.

   One scenario gets one budget. The clock starts when the
   participant submits the prompt, not when the screen appears,
   so reading the task does not eat into it. When it runs out the
   scenario stops where it is and the participant moves on to the
   questions.

   Configure it in js/config.js under STUDY.timeLimit. Setting
   secondsPerScenario to 0 turns the whole thing off.

   You should not need to edit this file.
   ============================================================ */

var Timer = {

  el: null,
  deadlineMs: null,
  intervalId: null,
  onExpire: null,

  cfg: function () {
    return (typeof STUDY !== 'undefined' && STUDY.timeLimit) || {};
  },

  mount: function () {
    Timer.el = document.getElementById('timer');
  },

  /* seconds: overrides the configured budget (a scenario may set
     its own). onExpire: called once, after the clock is stopped. */
  startScenario: function (seconds, onExpire) {
    Timer.stop();

    var budget = (seconds === undefined || seconds === null)
      ? Timer.cfg().secondsPerScenario
      : seconds;

    if (!budget || budget <= 0) return;      /* disabled */

    Timer.onExpire = onExpire;
    Timer.deadlineMs = Date.now() + budget * 1000;
    Timer.paint();
    Timer.intervalId = setInterval(Timer.tick, 250);
  },

  stop: function () {
    if (Timer.intervalId) clearInterval(Timer.intervalId);
    Timer.intervalId = null;
    Timer.deadlineMs = null;
    Timer.onExpire = null;
    if (Timer.el) {
      Timer.el.textContent = '';
      Timer.el.className = 'topbar-timer';
    }
  },

  running: function () { return Timer.deadlineMs !== null; },

  remainingMs: function () {
    return Timer.deadlineMs === null
      ? null
      : Math.max(0, Timer.deadlineMs - Date.now());
  },

  tick: function () {
    var left = Timer.remainingMs();
    if (left === null) return;
    Timer.paint();
    if (left <= 0) {
      var fn = Timer.onExpire;
      Timer.stop();
      if (fn) fn();
    }
  },

  paint: function () {
    if (!Timer.el) return;
    var left = Timer.remainingMs();
    if (left === null) {
      Timer.el.textContent = '';
      Timer.el.className = 'topbar-timer';
      return;
    }
    var total = Math.ceil(left / 1000);
    var mins = Math.floor(total / 60);
    var secs = total % 60;

    Timer.el.textContent =
      mins + ':' + (secs < 10 ? '0' : '') + secs + ' left';

    var warnAt = Timer.cfg().warnAtSeconds;
    Timer.el.className = 'topbar-timer' +
      (warnAt && total <= warnAt ? ' warn' : '');
  }
};
