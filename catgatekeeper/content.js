const KEY = 'catgatekeeper';
const DEFAULT_MINUTES = 60;
const OVERLAY_ID = 'catgatekeeper-overlay';
const STYLE_ID = 'catgatekeeper-style';

let contextInvalidated = false;

function isInvalidatedError(err) {
  return String(err || '').includes('Extension context invalidated');
}

function markContextInvalidated(err) {
  if (!isInvalidatedError(err)) return false;
  contextInvalidated = true;
  return true;
}

function isExtensionContextValid() {
  if (contextInvalidated) return false;
  try {
    if (typeof chrome === 'undefined') return false;
    if (!chrome.runtime || !chrome.runtime.id) return false;
    if (!chrome.storage || !chrome.storage.local) return false;
    return true;
  } catch (err) {
    markContextInvalidated(err);
    return false;
  }
}

function safeGetURL(path) {
  try {
    if (!isExtensionContextValid()) return '';
    return chrome.runtime.getURL(path);
  } catch (err) {
    markContextInvalidated(err);
    return '';
  }
}

window.addEventListener('unhandledrejection', (event) => {
  if (markContextInvalidated(event.reason)) {
    event.preventDefault();
  }
});

const CAT_ASSET = safeGetURL('animated-cat-tail.gif');
const BG_ASSET = safeGetURL('cat-bg.gif');

let timerId = null;
let activeDomain = null;
let activeMinutes = DEFAULT_MINUTES;
let prevHtmlOverflow = '';
let prevBodyOverflow = '';

function getDefaultStatePayload() {
  return {
    [KEY]: {
      blocklist: [],
      enabled: true,
      timers: {},
      defaultMinutes: DEFAULT_MINUTES
    }
  };
}

function safeStorageGet(key, callback) {
  let called = false;
  const finish = (data) => {
    if (called) return;
    called = true;
    callback(data);
  };

  if (!isExtensionContextValid()) {
    finish(getDefaultStatePayload());
    return;
  }

  try {
    const maybePromise = chrome.storage.local.get(key, (data) => {
      try {
        const err = chrome.runtime?.lastError;
        if (err && markContextInvalidated(err.message)) {
          finish(getDefaultStatePayload());
          return;
        }

        finish(data || getDefaultStatePayload());
      } catch (callbackError) {
        markContextInvalidated(callbackError);
        finish(getDefaultStatePayload());
      }
    });

    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => {
        markContextInvalidated(err);
        finish(getDefaultStatePayload());
      });
    }
  } catch (err) {
    markContextInvalidated(err);
    finish(getDefaultStatePayload());
  }
}

function safeStorageSet(payload, callback) {
  let called = false;
  const finish = (ok) => {
    if (called) return;
    called = true;
    if (callback) callback(ok);
  };

  if (!isExtensionContextValid()) {
    finish(false);
    return;
  }

  try {
    const maybePromise = chrome.storage.local.set(payload, () => {
      try {
        const err = chrome.runtime?.lastError;
        if (err && markContextInvalidated(err.message)) {
          finish(false);
          return;
        }

        finish(true);
      } catch (callbackError) {
        markContextInvalidated(callbackError);
        finish(false);
      }
    });

    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => {
        markContextInvalidated(err);
        finish(false);
      });
    }
  } catch (err) {
    markContextInvalidated(err);
    finish(false);
  }
}

function sanitizeHost(host) {
  return host.replace(/^www\./, '');
}

function normalizeMinutes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_MINUTES;
  return Math.round(num);
}

function findMatch(host, blocklist) {
  const cleanHost = sanitizeHost(host);
  let match = null;
  for (const domain of blocklist) {
    if (!domain) continue;
    if (cleanHost === domain || cleanHost.endsWith(`.${domain}`)) {
      if (!match || domain.length > match.length) match = domain;
    }
  }
  return match;
}

function getState() {
  return new Promise((resolve) => {
    safeStorageGet(KEY, resolve);
  });
}

function clearTimer() {
  if (timerId) clearTimeout(timerId);
  timerId = null;
  activeDomain = null;
}

function setStart(domain) {
  const key = `catgatekeeper-start-${domain}`;
  const stored = Number(sessionStorage.getItem(key));
  if (Number.isFinite(stored) && stored > 0) return stored;
  const now = Date.now();
  sessionStorage.setItem(key, String(now));
  return now;
}

function resetStart(domain) {
  const key = `catgatekeeper-start-${domain}`;
  const now = Date.now();
  sessionStorage.setItem(key, String(now));
  return now;
}

function clearStart(domain) {
  const key = `catgatekeeper-start-${domain}`;
  sessionStorage.removeItem(key);
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at 20% 10%, rgba(255, 232, 200, 0.9), rgba(245, 232, 216, 0.95) 35%, rgba(233, 221, 205, 0.96) 70%);
      backdrop-filter: blur(2px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
      color: #3b2c20;
    }
    #${OVERLAY_ID} .cgk-bg {
      position: absolute;
      inset: 0;
      background-image: url("${BG_ASSET}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: cover;
      opacity: 0.22;
      filter: saturate(0.95);
    }
    #${OVERLAY_ID} .cgk-wrap {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    #${OVERLAY_ID} .cgk-cat {
      position: absolute;
      bottom: 8vh;
      left: -40vw;
      width: min(80vw, 920px);
      height: auto;
      animation: cgk-walk 9s linear infinite;
      filter: drop-shadow(0 18px 40px rgba(59, 44, 32, 0.35));
    }
    #${OVERLAY_ID} .cgk-panel {
      position: absolute;
      left: 50%;
      bottom: 7vh;
      transform: translateX(-50%);
      background: rgba(255, 246, 235, 0.92);
      border: 1px solid rgba(74, 55, 36, 0.18);
      border-radius: 18px;
      padding: 18px 22px;
      box-shadow: 0 20px 60px rgba(59, 44, 32, 0.2);
      text-align: center;
      min-width: min(520px, 86vw);
      backdrop-filter: blur(6px);
    }
    #${OVERLAY_ID} .cgk-title {
      font-size: 26px;
      font-weight: 800;
      margin-bottom: 6px;
      letter-spacing: 0.02em;
      color: #1e140d;
    }
    #${OVERLAY_ID} .cgk-sub {
      color: #2a1f16;
      font-size: 15px;
      margin-bottom: 14px;
    }
    #${OVERLAY_ID} .cgk-domain {
      display: inline-block;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(120, 82, 52, 0.35);
      background: rgba(255, 255, 255, 0.55);
      color: #1e140d;
      font-family: 'Consolas', monospace;
      font-size: 14px;
      margin-bottom: 16px;
    }
    #${OVERLAY_ID} .cgk-actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    #${OVERLAY_ID} .cgk-btn {
      border: none;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    #${OVERLAY_ID} .cgk-back {
      background: rgba(255, 255, 255, 0.7);
      color: #4a3724;
      border: 1px solid rgba(74, 55, 36, 0.2);
    }
    #${OVERLAY_ID} .cgk-back:hover {
      background: rgba(255, 255, 255, 0.9);
    }
    #${OVERLAY_ID} .cgk-dismiss {
      background: #2a2017;
      color: #f8f1e8;
    }
    #${OVERLAY_ID} .cgk-dismiss:hover {
      background: #3b2c20;
    }
    #${OVERLAY_ID} .cgk-unblock {
      background: #f5b25d;
      color: #3b2c20;
    }
    #${OVERLAY_ID} .cgk-unblock:hover {
      background: #f0a642;
    }
    @keyframes cgk-walk {
      0% { transform: translateX(0); }
      100% { transform: translateX(140vw); }
    }
  `;
  document.documentElement.appendChild(style);
}

function showOverlay(domain) {
  if (document.getElementById(OVERLAY_ID)) return;
  ensureStyles();
  resetStart(domain);

  prevHtmlOverflow = document.documentElement.style.overflow;
  prevBodyOverflow = document.body.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="cgk-wrap" role="dialog" aria-modal="true">
      <div class="cgk-bg" aria-hidden="true"></div>
      <div class="cgk-panel">
        <div class="cgk-title">Time's up</div>
        <div class="cgk-sub">The cat says take a break.</div>
        <div class="cgk-domain"></div>
        <div class="cgk-actions">
          <button class="cgk-btn cgk-back">Go back</button>
          <button class="cgk-btn cgk-dismiss">Dismiss</button>
          <button class="cgk-btn cgk-unblock">Unblock this site</button>
        </div>
      </div>
    </div>
  `;

  if (CAT_ASSET) {
    const catImg = document.createElement('img');
    catImg.className = 'cgk-cat';
    catImg.src = CAT_ASSET;
    catImg.alt = 'Cat walking';
    catImg.addEventListener('error', () => {
      catImg.remove();
    });
    overlay.querySelector('.cgk-wrap')?.appendChild(catImg);
  }

  overlay.querySelector('.cgk-domain').textContent = domain;

  overlay.querySelector('.cgk-back').addEventListener('click', () => {
    history.back();
  });

  overlay.querySelector('.cgk-dismiss').addEventListener('click', () => {
    if (!activeDomain) return;
    const domain = activeDomain;
    clearTimer();
    removeOverlay();
    resetStart(domain);
    activeDomain = domain;
    scheduleOverlay(domain, activeMinutes);
  });

  overlay.querySelector('.cgk-unblock').addEventListener('click', () => {
    if (!isExtensionContextValid()) {
      removeOverlay();
      return;
    }

    try {
      safeStorageGet(KEY, (data) => {
        const state = data?.[KEY] || { blocklist: [], timers: {} };
        state.blocklist = state.blocklist.filter((d) => d !== domain);
        if (state.timers?.[domain]) delete state.timers[domain];

        safeStorageSet({ [KEY]: state }, (ok) => {
          if (!ok) {
            removeOverlay();
            return;
          }

          clearStart(domain);
          removeOverlay();
        });
      });
    } catch (err) {
      markContextInvalidated(err);
      removeOverlay();
    }
  });

  document.body.appendChild(overlay);
}

function removeOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.remove();
  document.documentElement.style.overflow = prevHtmlOverflow;
  document.body.style.overflow = prevBodyOverflow;
}

function scheduleOverlay(domain, minutes) {
  const start = setStart(domain);
  activeMinutes = minutes;
  const duration = normalizeMinutes(minutes) * 60 * 1000;
  const elapsed = Date.now() - start;
  const remaining = duration - elapsed;

  if (remaining <= 0) {
    showOverlay(domain);
    return;
  }

  timerId = setTimeout(() => showOverlay(domain), remaining);
}

async function evaluate() {
  if (!isExtensionContextValid()) return;
  clearTimer();
  removeOverlay();

  const data = await getState();
  const state = data[KEY] || { blocklist: [], enabled: true, timers: {}, defaultMinutes: DEFAULT_MINUTES };

  if (!state.enabled) return;

  if (!location.hostname) return;

  const domain = findMatch(location.hostname, state.blocklist || []);
  if (!domain) return;

  activeDomain = domain;
  const minutes = normalizeMinutes(state.timers?.[domain] ?? state.defaultMinutes ?? DEFAULT_MINUTES);
  scheduleOverlay(domain, minutes);
}

function safeEvaluate() {
  evaluate().catch((err) => {
    markContextInvalidated(err);
  });
}

if (isExtensionContextValid()) {
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!isExtensionContextValid()) return;
      if (area !== 'local' || !changes[KEY]) return;
      safeEvaluate();
    });
  } catch (err) {
    markContextInvalidated(err);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (activeDomain) clearStart(activeDomain);
    clearTimer();
    removeOverlay();
    return;
  }

  safeEvaluate();
});

safeEvaluate();
