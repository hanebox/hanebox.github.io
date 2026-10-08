(() => {
  const player = document.querySelector('.player');
  if (!player) return;

  const tracks = [...player.querySelectorAll('.track')].map((row) => ({
    row,
    title: row.querySelector('.track-title').textContent.trim(),
    artist: row.querySelector('.track-artist').textContent.trim(),
    href: row.dataset.href,
    cover: player.dataset.coverBase + row.dataset.slug + '.jpg',
    preview: player.dataset.previewBase + row.dataset.slug + '.m4a',
  }));
  if (!tracks.length) return;

  const find = (selector) => player.querySelector(selector);
  const audio = new Audio();
  audio.preload = 'none';
  const playButton = find('#play-btn');
  const meter = find('.meter');
  const status = find('.player-status');
  const link = find('.now-title');
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
    const label = state === 'loading' ? 'Cancel loading' : playing ? 'Pause preview' : 'Play preview';
    player.classList.toggle('is-playing', playing);
    player.classList.toggle('is-loading', state === 'loading');
    playButton.title = label;
    playButton.setAttribute('aria-label', `${label}: ${tracks[index].title}`);
    if (state === 'loading') status.textContent = 'Loading';
    else if (status.textContent === 'Loading') status.textContent = '';
  }

  function updateProgress() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    meter.value = duration ? Math.min(1, audio.currentTime / duration) : 0;
    find('.elapsed').textContent = formatTime(audio.currentTime);
    find('.duration').textContent = formatTime(duration);
  }

  function render(announce = false) {
    const track = tracks[index];
    link.textContent = track.title;
    find('.now-artist').textContent = track.artist;
    find('.now-cover').src = track.cover;
    link.href = track.href;
    link.setAttribute('aria-label', `Open ${track.title} by ${track.artist} on Spotify`);
    tracks.forEach((item, i) => {
      if (i === index) item.row.setAttribute('aria-current', 'true');
      else item.row.removeAttribute('aria-current');
    });
    find('.elapsed').textContent = '0:00';
    find('.duration').textContent = '0:00';
    meter.value = 0;
    status.textContent = '';
    find('.track-announcement').textContent = announce ? `${track.title} by ${track.artist}` : '';
    setState('paused');
  }

  function showError() {
    wantsPlayback = false;
    setState('paused');
    status.textContent = 'Preview unavailable';
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

  function pause() {
    wantsPlayback = false;
    ++requestId;
    audio.pause();
    setState('paused');
  }

  function select(next, resume = wantsPlayback) {
    ++requestId;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    loadedIndex = -1;
    wantsPlayback = false;
    index = (next + tracks.length) % tracks.length;
    render(true);
    if (resume) play();
  }

  playButton.addEventListener('click', () => (wantsPlayback ? pause() : play()));
  find('#prev-btn').addEventListener('click', () => select(index - 1));
  find('#next-btn').addEventListener('click', () => select(index + 1));
  tracks.forEach((track, i) => {
    track.row.addEventListener('click', () => {
      if (i !== index) select(i, true);
      else if (wantsPlayback) pause();
      else play();
    });
  });
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', updateProgress);
  audio.addEventListener('playing', () => { if (wantsPlayback) setState('playing'); });
  audio.addEventListener('waiting', () => { if (wantsPlayback) setState('loading'); });
  audio.addEventListener('pause', () => { if (audio.paused && !wantsPlayback) setState('paused'); });
  audio.addEventListener('ended', () => {
    if (index < tracks.length - 1) select(index + 1, true);
    else {
      wantsPlayback = false;
      setState('paused');
    }
  });
  audio.addEventListener('error', () => { if (audio.error && wantsPlayback) showError(); });
  window.addEventListener('pagehide', pause);

  render();
  player.hidden = false;
})();
