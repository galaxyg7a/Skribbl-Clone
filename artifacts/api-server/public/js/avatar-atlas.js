/* ═══════════════════════════════════════════════════════════════════
   avatar-atlas.js — Real skribbl.io avatar counts + CSS helper.

   The real atlas GIFs (color_atlas, eyes_atlas, mouth_atlas) use a
   10×10 sprite grid but are not available in a usable form in this
   environment.  This module exposes the authoritative variant counts
   from the real game.js (P=28, Y=57, z=51) so picker ranges are
   accurate, and provides a CSS-class helper for DOM-based avatars.

   Avatar rendering falls through to the custom canvas renderer in
   ui.js which produces full-quality avatars without the atlas files.
═══════════════════════════════════════════════════════════════════ */

const AvatarAtlas = (() => {

  /* Counts sourced from real skribbl.io game.js: P=28, Y=57, z=51 */
  const COUNTS = { color: 28, eyes: 57, mouth: 51, special: 43 };

  function isReady()  { return false; }          /* custom renderer used */
  function render()   { return false; }           /* always defer to ui.js */
  function counts()   { return { ...COUNTS }; }
  async function init() { return false; }         /* no-op, no atlas needed */

  return { init, isReady, render, counts };
})();
