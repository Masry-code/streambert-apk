/* StreamBERT phone probe (APK plan phase 2, 5 Nov 2026). Android injects this
   into EVERY frame at document start (MainActivity). It only reads: in a
   player frame with a <video> it posts the time to the app once a second, and
   it obeys { __sbSeek: t } from its parent frame. See src/android/frame-progress.js. */
(function () {
  if (window.top === window || window.__sbProbe) return;
  window.__sbProbe = 1;
  var seekAt = 0, seekTo = null;
  function pick() {
    var vs = document.getElementsByTagName("video"), best = null;
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (!v.duration || !isFinite(v.duration)) continue;
      if (!best || (best.paused && !v.paused) || v.duration > best.duration) best = v;
    }
    return best;
  }
  function track(v) {
    if (v.__sbSeekTracked) return;
    v.__sbSeekTracked = 1;
    v.addEventListener("seeked", function () { seekAt = Date.now(); seekTo = v.currentTime; });
  }
  setInterval(function () {
    var v = pick();
    if (!v) return;
    track(v);
    try {
      window.top.postMessage({ __sbVideo: 1, t: v.currentTime, d: v.duration, paused: v.paused, seekAt: seekAt, seekTo: seekTo, h: v.videoHeight || 0 }, "*");
    } catch (e) {}
  }, 1000);
  /* Parental 18+ (7 Nov 2026, his pick "Lists + picture check"): on request,
     a small JPEG of the picture for the app's detector, and hide / mute. The
     detector runs in the app's own page - this only draws and hides. */
  var canvas = null;
  function grab(v, m) {
    var out = { __sbFrame: 1, req: m.__sbGrab, t: v.currentTime, d: v.duration, paused: v.paused, seeking: !!v.seeking, frame: null };
    if (!m.noFrame && v.readyState >= 2 && v.videoWidth > 0) {
      try {
        canvas = canvas || document.createElement("canvas");
        canvas.width = m.w;
        canvas.height = Math.max(32, Math.round(m.w * v.videoHeight / v.videoWidth));
        canvas.getContext("2d").drawImage(v, 0, 0, canvas.width, canvas.height);
        out.frame = canvas.toDataURL("image/jpeg", 0.85);
      } catch (err) {
        out.frame = "tainted";
      }
    }
    try { window.top.postMessage(out, "*"); } catch (err) {}
  }
  function hide(h) {
    var vs = document.getElementsByTagName("video");
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (h.picture) v.style.setProperty("opacity", "0", "important");
      else v.style.removeProperty("opacity");
      if (h.sound) {
        if (v.__sbGuardMuted == null) v.__sbGuardMuted = v.muted;
        v.muted = true;
      } else if (v.__sbGuardMuted != null) {
        v.muted = v.__sbGuardMuted;
        v.__sbGuardMuted = null;
      }
    }
  }
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || e.source !== window.parent) return;
    var seek = typeof m.__sbSeek === "number";
    var wantGrab = typeof m.__sbGrab === "number" && m.w > 0;
    var wantHide = !!m.__sbHide && typeof m.__sbHide === "object";
    /* TV remote (Fable #33, 20 Nov 2026): OK = play / pause, Left / Right = a relative seek. */
    var toggle = m.__sbToggle === 1;
    var seekBy = typeof m.__sbSeekBy === "number";
    if (!seek && !wantGrab && !wantHide && !toggle && !seekBy) return;
    var v = pick();
    if (seek && v) { try { v.currentTime = m.__sbSeek; } catch (err) {} }
    if (toggle && v) {
      try {
        if (v.paused) { var pp = v.play(); if (pp && pp.catch) pp.catch(function () {}); } else v.pause();
      } catch (err) {}
    }
    if (seekBy && v) {
      try {
        var to = v.currentTime + m.__sbSeekBy;
        v.currentTime = Math.max(0, Math.min(to, (v.duration || to) - 1));
      } catch (err) {}
    }
    if (wantGrab && v) grab(v, m);
    if (wantHide) hide(m.__sbHide);
    for (var i = 0; i < window.frames.length; i++) {
      try { window.frames[i].postMessage(m, "*"); } catch (err) {}
    }
  });
})();
