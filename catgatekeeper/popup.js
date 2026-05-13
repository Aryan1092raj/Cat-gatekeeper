const KEY = 'catgatekeeper';

const domainInput = document.getElementById('domainInput');
const minutesInput = document.getElementById('minutesInput');
const addBtn = document.getElementById('addBtn');
const error = document.getElementById('error');
const blockList = document.getElementById('blockList');
const listHeader = document.getElementById('listHeader');
const empty = document.getElementById('empty');
const toggle = document.getElementById('toggle');
const quickBtn = document.getElementById('quickBtn');

function sanitize(input) {
  try {
    const url = new URL(input.startsWith('http') ? input : 'https://' + input);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getState(data) {
  return data[KEY] || { blocklist: [], enabled: true, timers: {}, defaultMinutes: 60 };
}

function normalizeMinutes(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 60;
  return Math.round(num);
}

function saveState(state) {
  chrome.storage.local.set({ [KEY]: state });
}

async function render() {
  const data = await new Promise((res) => chrome.storage.local.get(KEY, res));
  const state = getState(data);

  toggle.textContent = state.enabled ? 'ON' : 'OFF';
  toggle.className = state.enabled ? 'toggle on' : 'toggle off';

  minutesInput.value = normalizeMinutes(state.defaultMinutes);

  if (state.blocklist.length === 0) {
    blockList.innerHTML = '';
    listHeader.style.display = 'none';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    listHeader.style.display = 'block';
    listHeader.textContent = `${state.blocklist.length} site${state.blocklist.length !== 1 ? 's' : ''} blocked`;
    blockList.innerHTML = state.blocklist
      .map((d) => {
        const minutes = normalizeMinutes(state.timers?.[d] ?? state.defaultMinutes);
        return `
          <li>
            <div class="domain-row">
              <span class="domain">${d}</span>
              <span class="timer-pill">${minutes} min</span>
            </div>
            <div class="item-controls">
              <input class="minutes" type="number" min="1" value="${minutes}" data-domain="${d}" aria-label="Minutes for ${d}">
              <button data-domain="${d}">×</button>
            </div>
          </li>
        `;
      })
      .join('');
  }
}

async function addDomain(raw) {
  const domain = sanitize(raw);
  if (!domain) {
    error.textContent = 'Invalid domain';
    setTimeout(() => { error.textContent = ''; }, 2000);
    return;
  }

  const data = await new Promise((res) => chrome.storage.local.get(KEY, res));
  const state = getState(data);
  const minutes = normalizeMinutes(minutesInput.value);

  if (state.blocklist.includes(domain)) {
    domainInput.value = '';
    return;
  }

  state.blocklist.push(domain);
  state.timers[domain] = minutes;
  state.defaultMinutes = minutes;
  saveState(state);
  domainInput.value = '';
  render();
}

async function removeDomain(domain) {
  const data = await new Promise((res) => chrome.storage.local.get(KEY, res));
  const state = getState(data);
  state.blocklist = state.blocklist.filter((d) => d !== domain);
  if (state.timers?.[domain]) {
    delete state.timers[domain];
  }
  saveState(state);
  render();
}

async function toggleEnabled() {
  const data = await new Promise((res) => chrome.storage.local.get(KEY, res));
  const state = getState(data);
  state.enabled = !state.enabled;
  saveState(state);
  render();
}

async function updateMinutes(domain, value) {
  const minutes = normalizeMinutes(value);
  const data = await new Promise((res) => chrome.storage.local.get(KEY, res));
  const state = getState(data);
  if (!state.timers) state.timers = {};
  state.timers[domain] = minutes;
  state.defaultMinutes = minutes;
  saveState(state);
  render();
}

async function quickBlock() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.url?.startsWith('http')) {
    const domain = sanitize(tabs[0].url);
    if (domain) {
      await addDomain(domain);
    }
  }
}

addBtn.addEventListener('click', () => addDomain(domainInput.value.trim()));
domainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addDomain(domainInput.value.trim());
});

blockList.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    removeDomain(e.target.dataset.domain);
  }
});

blockList.addEventListener('change', (e) => {
  if (e.target.classList.contains('minutes')) {
    updateMinutes(e.target.dataset.domain, e.target.value);
  }
});

toggle.addEventListener('click', toggleEnabled);
quickBtn.addEventListener('click', quickBlock);

chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs[0]?.url?.startsWith('http')) {
    const domain = sanitize(tabs[0].url);
    if (domain) {
      quickBtn.textContent = `📌 Block ${domain}`;
    }
  }
});

render();