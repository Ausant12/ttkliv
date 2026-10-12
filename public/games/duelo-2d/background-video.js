(() => {
  const video = document.getElementById('arenaVideo');
  if (!video) return;

  video.volume = 0;
  video.muted = true;
  video.defaultMuted = true;

  // Reinicia o loop antes do último segundo, sem alterar o MP4 original.
  const trimEndSeconds = 1;
  let frame = null;
  function skipEnding() {
    if (Number.isFinite(video.duration) && video.duration > trimEndSeconds &&
        video.currentTime >= video.duration - trimEndSeconds) {
      video.currentTime = 0;
    }
  }
  function checkFrame() {
    frame = null;
    skipEnding();
    if (!video.paused && !video.ended) frame = requestAnimationFrame(checkFrame);
  }
  function stopChecking() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  video.addEventListener('playing', () => {
    stopChecking();
    frame = requestAnimationFrame(checkFrame);
  });
  video.addEventListener('pause', stopChecking);
  video.addEventListener('ended', stopChecking);
  // Também verifica quando a janela está em segundo plano.
  video.addEventListener('timeupdate', skipEnding);

  video.play().catch(error => {
    if (error.name !== 'AbortError') {
      console.warn('[Duelo] Não foi possível reproduzir ufc.mp4:', error);
    }
  });
})();
