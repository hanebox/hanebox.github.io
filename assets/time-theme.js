(() => {
  const root = document.documentElement;
  // Local clock hours, independent of the site's publishing timezone. Interpolate
  // these stops only at integer hours so the palette stays fixed within each hour.
  const stops = [
    { hour: 0, bg: '#151b2a', light: '#9bbdf2', shadow: '#080e1c', strength: 0.10, shade: 0.18, slope: 0.30, x: 0.90 },
    { hour: 4, bg: '#191d30', light: '#b4b5e8', shadow: '#101022', strength: 0.08, shade: 0.18, slope: 0.24, x: 0.98 },
    { hour: 5, bg: '#272538', light: '#e3b2b0', shadow: '#171427', strength: 0.10, shade: 0.16, slope: 0.22, x: 1.00 },
    { hour: 6, bg: '#f3e5dc', light: '#ffd0a0', shadow: '#9c7769', strength: 0.24, shade: 0.12, slope: 0.22, x: 1.00 },
    { hour: 9, bg: '#fcf6eb', light: '#ffe6ba', shadow: '#968777', strength: 0.24, shade: 0.12, slope: 0.34, x: 0.96 },
    { hour: 12, bg: '#fdfbf7', light: '#fff3d8', shadow: '#968f80', strength: 0.22, shade: 0.14, slope: 0.48, x: 0.86 },
    { hour: 15, bg: '#faf1e2', light: '#ffda9e', shadow: '#9a8066', strength: 0.26, shade: 0.12, slope: 0.58, x: 0.78 },
    { hour: 17, bg: '#f3e3d6', light: '#ffc08c', shadow: '#9c7465', strength: 0.24, shade: 0.10, slope: 0.66, x: 0.72 },
    { hour: 18, bg: '#2b2638', light: '#e5a4a0', shadow: '#181322', strength: 0.10, shade: 0.16, slope: 0.62, x: 0.76 },
    { hour: 20, bg: '#1d2235', light: '#a9b9ec', shadow: '#0c1223', strength: 0.12, shade: 0.18, slope: 0.48, x: 0.84 },
    { hour: 24, bg: '#151b2a', light: '#9bbdf2', shadow: '#080e1c', strength: 0.10, shade: 0.18, slope: 0.30, x: 0.90 },
  ];

  function mixColor(from, to, amount) {
    const channels = [1, 3, 5].map((offset) => {
      const start = parseInt(from.slice(offset, offset + 2), 16);
      const end = parseInt(to.slice(offset, offset + 2), 16);
      return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
    });
    return `#${channels.join('')}`;
  }

  let currentHour = -1;
  let timer;
  function update() {
    clearTimeout(timer);
    const now = new Date();
    const hour = now.getHours();
    if (hour !== currentHour) {
      const end = stops.findIndex((stop) => stop.hour > hour);
      const from = stops[end - 1];
      const to = stops[end];
      const amount = (hour - from.hour) / (to.hour - from.hour);
      const mix = (key) => from[key] + (to[key] - from[key]) * amount;
      const background = mixColor(from.bg, to.bg, amount);
      const isUpdate = currentHour !== -1;
      if (isUpdate) root.classList.add('is-changing-time-theme');
      root.dataset.theme = hour >= 6 && hour < 18 ? 'light' : 'dark';
      root.dataset.localHour = String(hour);
      root.style.setProperty('--bg', background);
      root.style.setProperty('--light-color', mixColor(from.light, to.light, amount));
      root.style.setProperty('--light-shadow', mixColor(from.shadow, to.shadow, amount));
      root.style.setProperty('--light-strength', mix('strength'));
      root.style.setProperty('--light-shadow-strength', mix('shade'));
      root.style.setProperty('--light-slope', mix('slope'));
      root.style.setProperty('--light-x', mix('x'));
      root.style.setProperty('--light-angle', `${90 + Math.atan(mix('slope')) * 180 / Math.PI}deg`);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
      currentHour = hour;
      window.dispatchEvent(new Event('time-theme-change'));
      if (isUpdate) {
        void root.offsetHeight;
        requestAnimationFrame(() => root.classList.remove('is-changing-time-theme'));
      }
    }
    // Align to the next local hour, including half/quarter-hour timezones.
    // Recheck on focus/pageshow as timers can be suspended while away.
    const remaining = 3600000 - (now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds());
    if (!document.hidden) timer = setTimeout(update, remaining);
  }

  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  update();
})();
