(function () {
  'use strict';

  var fixing = false;

  function fixPart(part) {
    if (fixing) return;
    var av = part.closest ? part.closest('.avatar') : null;
    if (!av) {
      var p = part.parentElement;
      while (p) { if (p.className && p.className.indexOf('avatar') !== -1) { av = p; break; } p = p.parentElement; }
    }
    if (!av) return;

    var pos = part.style.backgroundPosition;
    if (!pos) return;

    var match = pos.match(/^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/);
    if (!match) return;

    var pxPct = parseFloat(match[1]);
    var pyPct = parseFloat(match[2]);

    var col = -pxPct / 100;
    var row = -pyPct / 100;

    var w = av.offsetWidth || 96;
    var h = av.offsetHeight || 96;

    fixing = true;
    part.style.backgroundPosition = (-col * w) + 'px ' + (-row * h) + 'px';
    fixing = false;
  }

  function fixAvatar(av) {
    var parts = av.querySelectorAll('.color, .eyes, .mouth, .special');
    for (var i = 0; i < parts.length; i++) fixPart(parts[i]);
  }

  function fixAll() {
    var avs = document.querySelectorAll('.avatar');
    for (var i = 0; i < avs.length; i++) fixAvatar(avs[i]);
  }

  var observer = new MutationObserver(function (mutations) {
    if (fixing) return;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'attributes') {
        fixPart(m.target);
      } else if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType !== 1) continue;
          var cls = node.className || '';
          if (cls.indexOf('avatar') !== -1) {
            (function (n) { setTimeout(function () { fixAvatar(n); }, 0); }(node));
          }
          if (node.querySelectorAll) {
            var avs2 = node.querySelectorAll('.avatar');
            for (var k = 0; k < avs2.length; k++) {
              (function (n) { setTimeout(function () { fixAvatar(n); }, 0); }(avs2[k]));
            }
          }
        }
      }
    }
  });

  function start() {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    fixAll();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
}());
