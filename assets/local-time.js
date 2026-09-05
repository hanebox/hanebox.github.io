(() => {
  const description = document.querySelector('.time-context');
  if (!description) return;
  const homeTime = description.querySelector('.home-time');
  const visitorTime = description.querySelector('.visitor-time');
  const footer = document.querySelector('.time-footer');
  const clock = footer?.querySelector('.sun-clock');
  const clockTime = clock?.querySelector('.sun-clock-time');
  const marker = clock?.querySelector('.sun-clock-marker');
  let timer;

  function update() {
    clearTimeout(timer);
    const now = new Date();
    const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    const home = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: description.dataset.homeTimezone });
    const visitor = new Intl.DateTimeFormat('en-GB', options);
    for (const [element, formatter] of [[homeTime, home], [visitorTime, visitor]]) {
      element.textContent = formatter.format(now);
      element.dateTime = now.toISOString();
      element.title = formatter.resolvedOptions().timeZone;
    }
    description.hidden = false;
    if (clock) {
      clockTime.textContent = visitor.format(now);
      clockTime.dateTime = now.toISOString();
      clockTime.title = visitor.resolvedOptions().timeZone;
      // One step per local hour, matching the lighting and theme. Midnight is
      // the left of the arc, noon its peak, and the next midnight its right.
      const hour = now.getHours();
      const angle = Math.PI * (1 - hour / 24);
      marker.setAttribute('transform', `translate(${140 + 116 * Math.cos(angle)} ${100 - 60 * Math.sin(angle)})`);
      footer.hidden = false;
    }
    if (!document.hidden) timer = setTimeout(update, 60000 - now.getSeconds() * 1000 - now.getMilliseconds());
  }

  document.addEventListener('visibilitychange', update);
  window.addEventListener('focus', update);
  window.addEventListener('pageshow', update);
  window.addEventListener('pagehide', () => clearTimeout(timer));
  update();
})();
