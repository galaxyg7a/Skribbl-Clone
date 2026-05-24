(function () {
  const ADMIN_NAME = 'eonmaster6767';

  function intercept(e) {
    var nameInput = document.querySelector('.input-name');
    if (!nameInput) return;
    if (nameInput.value.trim() === ADMIN_NAME) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.location.href = '/admin.html';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var playBtn   = document.querySelector('.button-play');
    var createBtn = document.querySelector('.button-create');
    if (playBtn)   playBtn.addEventListener('click',   intercept, true);
    if (createBtn) createBtn.addEventListener('click', intercept, true);
  });
})();
