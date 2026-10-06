(() => {
  const pageContent = document.getElementById('page-content');
  const audio = document.getElementById('site-radio-audio');
  if (!pageContent || !audio) return;

  const stations = [
    { name: 'Rai Radio 3', page: 'https://www.raiplaysound.it/radio3', stream: 'https://icestreaming.rai.it/3.mp3' },
    { name: 'Radio Popolare', page: 'https://www.radiopopolare.it/', stream: 'https://livex.radiopopolare.it/radiopop2' },
    { name: 'NTS Radio', page: 'https://www.nts.live/', stream: 'https://stream-relay-geo.ntslive.net/stream' },
  ];
  const desktopQuery = window.matchMedia('(min-width: 841px)');
  let stationIndex = Math.floor(Math.random() * stations.length);
  let rotationTimer = null;
  let navigationPending = false;

  function syncRadioControls() {
    const station = stations[stationIndex];
    const link = document.getElementById('radio-station');
    const button = document.getElementById('radio-toggle');
    const playing = !audio.paused && !audio.ended;

    if (link) {
      link.href = station.page;
      link.textContent = station.name;
    }

    if (button) {
      button.textContent = playing ? '(pause)' : '(play)';
      button.setAttribute('aria-label', playing ? 'Pause radio' : 'Play radio');
      button.setAttribute('aria-pressed', String(playing));
    }
  }

  function loadStation(index, resumePlayback = false) {
    const wasPlaying = resumePlayback && !audio.paused;
    stationIndex = index;
    audio.pause();
    audio.src = stations[stationIndex].stream;
    audio.dataset.stationIndex = String(stationIndex);
    audio.load();
    syncRadioControls();

    if (wasPlaying) {
      audio.play().catch(() => {
        audio.pause();
        syncRadioControls();
      });
    }
  }

  function rotateStation() {
    const choices = stations.map((_, index) => index).filter(index => index !== stationIndex);
    const nextIndex = choices[Math.floor(Math.random() * choices.length)];
    loadStation(nextIndex, !audio.paused);
  }

  function syncRotation() {
    window.clearInterval(rotationTimer);
    rotationTimer = null;

    if (desktopQuery.matches) {
      rotationTimer = window.setInterval(rotateStation, 8 * 60 * 60 * 1000);
    }
  }

  function toggleRadio() {
    if (audio.paused) {
      if (audio.dataset.stationIndex !== String(stationIndex)) {
        audio.src = stations[stationIndex].stream;
        audio.dataset.stationIndex = String(stationIndex);
        audio.load();
      }
      audio.play().then(syncRadioControls).catch(() => {
        audio.pause();
        syncRadioControls();
      });
      return;
    }

    audio.pause();
  }

  function getInternalPageUrl(anchor) {
    if (anchor.target || anchor.hasAttribute('download')) return null;

    const target = new URL(anchor.href, window.location.href);
    if (target.origin !== window.location.origin) return null;

    const filename = target.pathname.split('/').pop();
    if (filename !== 'index.html' && filename !== 'about.html') return null;
    return target;
  }

  async function navigateTo(target, updateHistory = true) {
    if (navigationPending) return;
    navigationPending = true;

    try {
      const response = await fetch(target.href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Page request failed: ${response.status}`);

      const nextDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextContent = nextDocument.getElementById('page-content');
      if (!nextContent) throw new Error('Page content container is missing.');

      window.sitePageCleanup?.();
      window.sitePageCleanup = null;

      const scripts = [...nextContent.querySelectorAll('script')].map(script => script.textContent);
      nextContent.querySelectorAll('script').forEach(script => script.remove());
      pageContent.replaceChildren(...[...nextContent.childNodes].map(node => document.importNode(node, true)));
      document.title = nextDocument.title;
      document.body.className = nextDocument.body.className;

      if (updateHistory) {
        window.history.pushState({}, '', `${target.pathname}${target.search}${target.hash}`);
      }

      syncRadioControls();
      for (const source of scripts) {
        const script = document.createElement('script');
        script.textContent = source;
        document.body.appendChild(script);
        script.remove();
      }

      syncRadioControls();
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Unable to navigate without reloading:', error);
      window.location.assign(target.href);
    } finally {
      navigationPending = false;
    }
  }

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const target = getInternalPageUrl(anchor);
    if (!target || target.pathname === window.location.pathname) return;

    event.preventDefault();
    navigateTo(target);
  });

  document.addEventListener('click', event => {
    if (event.target.closest('#radio-toggle')) {
      event.preventDefault();
      toggleRadio();
    }
  });

  window.addEventListener('popstate', () => {
    navigateTo(new URL(window.location.href), false);
  });

  audio.addEventListener('play', syncRadioControls);
  audio.addEventListener('pause', syncRadioControls);
  audio.addEventListener('ended', syncRadioControls);
  audio.addEventListener('error', syncRadioControls);
  desktopQuery.addEventListener('change', syncRotation);

  syncRotation();
  syncRadioControls();
})();