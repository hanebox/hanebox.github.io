(() => {
  const playlist = document.querySelector('.playlist');
  if (!playlist) return;

  const tracks = [...playlist.querySelectorAll('.pill')].map((link) => {
    const image = link.querySelector('img');
    const slug = new URL(image.src).pathname.split('/').pop().replace(/\.jpg$/, '');
    return {
      link,
      title: link.querySelector('.pill-title').textContent.trim(),
      artist: link.querySelector('.pill-sub').textContent.trim(),
      image: image.src,
      preview: playlist.dataset.previewBase + slug + '.m4a',
    };
  });
  if (!tracks.length) return;

  const find = (selector) => playlist.querySelector(selector);
  const audio = new Audio();
  audio.preload = 'none';
  const playButton = find('#play-btn');
  const playLabel = find('.play-label');
  const progress = find('.preview-progress');
  const status = find('.player-status');
  const stack = find('.record-stack');
  let index = 0;
  let loadedIndex = -1;
  let wantsPlayback = false;
  let requestId = 0;

  const formatTime = (seconds) => {
    const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };

  function setState(state) {
    const playing = state === 'playing';
    playButton.classList.toggle('is-playing', playing);
    stack.classList.toggle('is-playing', playing);
    playLabel.textContent = state === 'loading' ? 'Loading…' : playing ? 'Pause' : 'Play preview';
    playButton.title = state === 'loading' ? 'Cancel loading' : playing ? 'Pause preview' : 'Play preview';
    playButton.setAttribute('aria-label', `${state === 'loading' ? 'Cancel loading' : playing ? 'Pause preview' : 'Play preview'}: ${tracks[index].title}`);
  }

  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    progress.value = duration ? Math.min(1, audio.currentTime / duration) : 0;
    find('.elapsed').textContent = formatTime(audio.currentTime);
    find('.duration').textContent = formatTime(duration);
  }

  function render(announce = false) {
    const track = tracks[index];
    const title = find('.now-title');
    title.textContent = track.title;
    title.href = track.link.href;
    title.setAttribute('aria-label', `${track.title} by ${track.artist} on Spotify`);
    find('.now-artist').textContent = track.artist;
    find('.vinyl-label').src = track.image;
    tracks.forEach((item, i) => {
      if (i === index) item.link.setAttribute('aria-current', 'true');
      else item.link.removeAttribute('aria-current');
    });
    find('.elapsed').textContent = '0:00';
    find('.duration').textContent = '0:00';
    progress.value = 0;
    status.textContent = '';
    find('.track-announcement').textContent = announce ? `${track.title} — ${track.artist}` : '';
    setState('paused');
  }

  function showError() {
    wantsPlayback = false;
    setState('paused');
    status.textContent = 'Preview unavailable.';
  }

  async function play() {
    const currentRequest = ++requestId;
    wantsPlayback = true;
    status.textContent = '';
    setState('loading');
    if (loadedIndex !== index || audio.error) {
      audio.src = tracks[index].preview;
      loadedIndex = index;
    }
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
      if (currentRequest === requestId && wantsPlayback) setState('playing');
    } catch (error) {
      if (currentRequest !== requestId || !wantsPlayback) return;
      if (error.name !== 'AbortError') showError();
    }
  }

  function select(next) {
    const resume = wantsPlayback;
    ++requestId;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    loadedIndex = -1;
    index = (next + tracks.length) % tracks.length;
    render(true);

    if (resume) play();
  }

  playButton.addEventListener('click', () => {
    if (wantsPlayback) {
      wantsPlayback = false;
      ++requestId;
      audio.pause();
      setState('paused');
    } else play();
  });
  find('#prev-btn').addEventListener('click', () => select(index - 1));
  find('#next-btn').addEventListener('click', () => select(index + 1));
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('playing', () => { if (wantsPlayback) setState('playing'); });
  audio.addEventListener('waiting', () => { if (wantsPlayback) setState('loading'); });
  audio.addEventListener('pause', () => { if (audio.paused && !wantsPlayback) setState('paused'); });
  audio.addEventListener('ended', () => {
    wantsPlayback = false;
    setState('paused');
    status.textContent = '';
  });
  audio.addEventListener('error', () => { if (audio.error && wantsPlayback) showError(); });
  window.addEventListener('pagehide', () => {
    wantsPlayback = false;
    ++requestId;
    audio.pause();
    setState('paused');
  });

  render();
  find('.record-player').hidden = false;
})();
