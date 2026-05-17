/* ═══════════════════════════════════════════════════
   canvas.js — HTML5 Canvas drawing engine
═══════════════════════════════════════════════════ */

const Canvas = (() => {
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const MAX_HISTORY = 15;
  const PACKET_INTERVAL_MS = 25;

  let canvas, ctx;
  let drawing = false;
  let drawerMode = false;
  let currentTool = 'pencil';
  let currentColor = '#1a1a1a';
  let brushSize = 6;
  let lastX = 0, lastY = 0;

  const history = [];
  let pendingPackets = [];

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    canvas = document.getElementById('draw-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onMouseUp);

    const brushSlider = document.getElementById('brush-size');
    if (brushSlider) {
      brushSlider.addEventListener('input', () => {
        brushSize = parseInt(brushSlider.value);
        updateBrushPreview();
      });
    }

    const customColor = document.getElementById('custom-color');
    if (customColor) {
      customColor.addEventListener('input', () => setColor(customColor.value));
    }

    buildPalette();
    updateBrushPreview();

    // 25ms packet throttle heartbeat
    setInterval(() => {
      if (pendingPackets.length === 0) return;
      const batch = pendingPackets.splice(0);
      batch.forEach(p => socket.emit('draw_data', p));
    }, PACKET_INTERVAL_MS);
  }

  // ─── Coordinate Normalisation ──────────────────────────────────────────────
  function getNorm(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ─── Mouse Handlers ────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (!drawerMode) return;
    e.preventDefault();
    const { x, y } = getNorm(e.clientX, e.clientY);

    if (currentTool === 'fill') {
      pushHistory();
      floodFill(x, y, currentColor);
      socket.emit('fill_data', { x, y, color: currentColor });
      return;
    }

    drawing = true;
    pushHistory();
    lastX = x; lastY = y;
    // Stamp a dot for click-only
    drawSegment(x, y, x, y, getDrawColor(), brushSize, currentTool);
  }

  function onMouseMove(e) {
    if (!drawerMode || !drawing) return;
    e.preventDefault();
    const { x, y } = getNorm(e.clientX, e.clientY);
    drawSegment(lastX, lastY, x, y, getDrawColor(), brushSize, currentTool);
    pendingPackets.push({ type: 'draw', x0: lastX, y0: lastY, x1: x, y1: y, color: getDrawColor(), size: brushSize, tool: currentTool });
    lastX = x; lastY = y;
  }

  function onMouseUp() {
    drawing = false;
  }

  // ─── Touch Handlers ────────────────────────────────────────────────────────
  function onTouchStart(e) {
    if (!drawerMode) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getNorm(touch.clientX, touch.clientY);

    if (currentTool === 'fill') {
      pushHistory();
      floodFill(x, y, currentColor);
      socket.emit('fill_data', { x, y, color: currentColor });
      return;
    }

    drawing = true;
    pushHistory();
    lastX = x; lastY = y;
    drawSegment(x, y, x, y, getDrawColor(), brushSize, currentTool);
  }

  function onTouchMove(e) {
    if (!drawerMode || !drawing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getNorm(touch.clientX, touch.clientY);
    drawSegment(lastX, lastY, x, y, getDrawColor(), brushSize, currentTool);
    pendingPackets.push({ type: 'draw', x0: lastX, y0: lastY, x1: x, y1: y, color: getDrawColor(), size: brushSize, tool: currentTool });
    lastX = x; lastY = y;
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────
  function getDrawColor() {
    return currentTool === 'eraser' ? '#ffffff' : currentColor;
  }

  function drawSegment(x0, y0, x1, y1, color, size, tool) {
    ctx.beginPath();
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function renderDrawPacket(packet) {
    drawSegment(packet.x0, packet.y0, packet.x1, packet.y1, packet.color, packet.size, packet.tool);
  }

  // ─── Flood Fill ────────────────────────────────────────────────────────────
  function floodFill(startX, startY, fillColor) {
    const ix = Math.round(Math.max(0, Math.min(CANVAS_WIDTH - 1, startX)));
    const iy = Math.round(Math.max(0, Math.min(CANVAS_HEIGHT - 1, startY)));

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;
    const fill = hexToRgba(fillColor);
    const target = getPixelColor(data, ix, iy);

    if (colorsMatch(target, fill)) return;

    const stack = [[ix, iy]];
    const visited = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT);

    while (stack.length) {
      const [px, py] = stack.pop();
      if (px < 0 || px >= CANVAS_WIDTH || py < 0 || py >= CANVAS_HEIGHT) continue;
      const idx = py * CANVAS_WIDTH + px;
      if (visited[idx]) continue;
      visited[idx] = 1;

      if (!colorsMatch(getPixelColor(data, px, py), target)) continue;

      setPixelColor(data, px, py, fill);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function getPixelColor(data, x, y) {
    const i = (y * CANVAS_WIDTH + x) * 4;
    return [data[i], data[i+1], data[i+2], data[i+3]];
  }

  function setPixelColor(data, x, y, [r, g, b, a]) {
    const i = (y * CANVAS_WIDTH + x) * 4;
    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = a;
  }

  function colorsMatch([r1,g1,b1,a1], [r2,g2,b2,a2], tol = 32) {
    return Math.abs(r1-r2) <= tol && Math.abs(g1-g2) <= tol &&
           Math.abs(b1-b2) <= tol && Math.abs(a1-a2) <= tol;
  }

  function hexToRgba(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c+c).join('') : h;
    return [parseInt(full.slice(0,2),16), parseInt(full.slice(2,4),16), parseInt(full.slice(4,6),16), 255];
  }

  // ─── History / Undo ────────────────────────────────────────────────────────
  function pushHistory() {
    if (history.length >= MAX_HISTORY) history.shift();
    history.push(canvas.toDataURL('image/png', 0.6));
  }

  function doUndo() {
    if (!drawerMode || history.length === 0) return;
    const snapshot = history.pop();
    loadSnapshot(snapshot);
    socket.emit('canvas_undo', { snapshot });
  }

  function loadSnapshot(dataURL) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };
    img.src = dataURL;
  }

  // ─── Clear ─────────────────────────────────────────────────────────────────
  function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  function doClear() {
    if (!drawerMode) return;
    pushHistory();
    clearCanvas();
    socket.emit('canvas_clear');
  }

  // ─── Palette & Tool Controls ───────────────────────────────────────────────
  const PALETTE = [
    '#1a1a1a','#ffffff','#ef4444','#f97316','#eab308','#22c55e',
    '#06b6d4','#3b82f6','#8b5cf6','#ec4899','#84cc16','#14b8a6',
    '#f43f5e','#a855f7','#6366f1','#0ea5e9','#fbbf24','#4ade80',
    '#fb923c','#e879f9','#67e8f9','#a3e635','#f472b6','#94a3b8',
  ];

  function buildPalette() {
    const palette = document.getElementById('color-palette');
    if (!palette) return;
    PALETTE.forEach((color, i) => {
      const sw = document.createElement('div');
      sw.className = 'color-swatch' + (i === 0 ? ' active' : '');
      sw.style.background = color;
      sw.dataset.color = color;
      sw.title = color;
      sw.onclick = () => setColor(color);
      palette.appendChild(sw);
    });
  }

  function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tool-' + tool);
    if (btn) btn.classList.add('active');
    canvas.classList.remove('eraser-mode', 'fill-mode');
    if (tool === 'eraser') canvas.classList.add('eraser-mode');
    if (tool === 'fill') canvas.classList.add('fill-mode');
  }

  function setColor(color) {
    currentColor = color;
    if (currentTool === 'eraser') setTool('pencil');
    document.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
    updateBrushPreview();
  }

  function updateBrushPreview() {
    const preview = document.getElementById('brush-preview');
    if (!preview) return;
    let dot = preview.querySelector('.brush-preview-dot');
    if (!dot) {
      dot = document.createElement('div');
      dot.className = 'brush-preview-dot';
      preview.appendChild(dot);
    }
    const size = Math.min(brushSize, 28);
    dot.style.width = size + 'px';
    dot.style.height = size + 'px';
    dot.style.background = currentTool === 'eraser' ? '#888' : currentColor;
  }

  function setDrawerMode(enabled) {
    drawerMode = enabled;
    history.length = 0;
    drawing = false;
    if (canvas) canvas.style.cursor = enabled ? 'crosshair' : 'default';
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    setDrawerMode,
    renderDrawPacket,
    floodFill,
    loadSnapshot,
    clearCanvas,
    setTool,
    setColor,
    doUndo,
    doClear,
  };
})();

// ─── Global handlers for inline onclick attributes ─────────────────────────
function setTool(tool)  { Canvas.setTool(tool); }
function doUndo()       { Canvas.doUndo(); }
function doClear()      { Canvas.doClear(); }
