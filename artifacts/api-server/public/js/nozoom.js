(function () {
  // Prevent pinch-to-zoom and double-tap zoom everywhere
  document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

  // Prevent multi-touch zoom on the canvas specifically
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Double-tap zoom prevention
  var lastTap = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  // Set touch-action on canvas once DOM is ready
  function patchCanvas() {
    var canvas = document.querySelector('#game-canvas canvas');
    if (canvas) {
      canvas.style.touchAction = 'none';
    } else {
      // Retry until the canvas exists
      setTimeout(patchCanvas, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchCanvas);
  } else {
    patchCanvas();
  }
})();
