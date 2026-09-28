(() => {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const button = form.querySelector('.contact-submit');
  const error = form.querySelector('.contact-error');
  const success = document.querySelector('.contact-success');
  const shownAt = Date.now();
  let sending = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    sending = true;
    error.textContent = '';
    button.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');

    const data = new FormData(form);
    data.set('_elapsed', String(Date.now() - shownAt));
    let message = 'Couldn’t send your message. Try again, or email hihanebox@gmail.com.';

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data,
      });
      const result = await response.json();
      if (result.ok) {
        form.hidden = true;
        success.hidden = false;
        success.focus();
        return;
      }
      if (result.message) message = result.message;
    } catch {}

    error.textContent = message;
    sending = false;
    button.textContent = 'Send message';
    form.removeAttribute('aria-busy');
  });
})();
