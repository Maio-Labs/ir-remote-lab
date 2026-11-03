// The visual remote: encodes a key press with the C library, sends it through
// the "air" to a TV, and decodes what the receiver saw.

const DIGIT_CODES_NEC = [0x16, 0x0c, 0x18, 0x5e, 0x08, 0x1c, 0x5a, 0x42, 0x52, 0x4a];

// Example keymap. Each key has a command code per protocol.
const KEYS = [
  { id: 'power', label: '⏻', name: 'Power', cls: 'power', nec: 0x45, rc5: 0x0c },
  { id: 'menu', label: 'MENU', name: 'Menu', cls: 'small', nec: 0x0d, rc5: 0x2e },
  { id: 'mute', label: 'MUTE', name: 'Mute', cls: 'small', nec: 0x09, rc5: 0x0d },
  'gap',
  'blank',
  { id: 'up', label: '▲', name: 'Up', nec: 0x46, rc5: 0x1e },
  'blank',
  { id: 'left', label: '◀', name: 'Left', nec: 0x44, rc5: 0x15 },
  { id: 'ok', label: 'OK', name: 'OK', cls: 'ok', nec: 0x40, rc5: 0x17 },
  { id: 'right', label: '▶', name: 'Right', nec: 0x43, rc5: 0x16 },
  { id: 'back', label: 'BACK', name: 'Back', cls: 'small', nec: 0x47, rc5: 0x22 },
  { id: 'down', label: '▼', name: 'Down', nec: 0x19, rc5: 0x1f },
  'blank',
  'gap',
  { id: 'volup', label: 'VOL +', name: 'Volume up', cls: 'small', nec: 0x15, rc5: 0x10 },
  'blank',
  { id: 'chup', label: 'CH +', name: 'Channel up', cls: 'small', nec: 0x5c, rc5: 0x20 },
  { id: 'voldown', label: 'VOL −', name: 'Volume down', cls: 'small', nec: 0x07, rc5: 0x11 },
  'blank',
  { id: 'chdown', label: 'CH −', name: 'Channel down', cls: 'small', nec: 0x5d, rc5: 0x21 },
  'gap',
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digitKey),
  'blank',
  digitKey(0),
  'blank',
];

const FIELD_COLORS = {
  leader: '#8c9bff',
  start: '#8c9bff',
  toggle: '#ff7ad9',
  address: '#ffb547',
  'address inverse': '#b98a3e',
  command: '#4fe0d2',
  'command inverse': '#2f9d93',
  stop: '#8c9bff',
};

const CARRIER = '38 kHz';

const state = {
  protocol: 'nec',
  protocols: [],
  toggle: 0,
  sent: null,
  received: null,
  busy: false,
  progress: 1,
  tv: { on: true, channel: 1, volume: 8, muted: false },
};

const $ = (selector) => document.querySelector(selector);

function digitKey(digit) {
  return { id: 'd' + digit, label: String(digit), name: 'Digit ' + digit, digit, nec: DIGIT_CODES_NEC[digit], rc5: digit };
}

function hex(value) {
  return '0x' + value.toString(16).toUpperCase().padStart(2, '0');
}

function parseNumber(text) {
  const value = Number(String(text).trim());
  return String(text).trim() !== '' && Number.isInteger(value) ? value : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function restart(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

async function api(path, body) {
  try {
    const options = body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    const response = await fetch(path, options);
    return await response.json();
  } catch (error) {
    return { ok: false, error: 'server not reachable' };
  }
}

function protocolTitle(name) {
  const protocol = state.protocols.find((p) => p.name === name);
  return protocol ? protocol.title : name;
}

// ---------- Remote ----------

function renderProtocols() {
  const box = $('#protocols');
  box.innerHTML = '';
  for (const protocol of state.protocols) {
    const button = document.createElement('button');
    button.className = 'proto';
    button.textContent = protocol.name.toUpperCase();
    if (!protocol.implemented) {
      button.classList.add('locked');
      button.title = protocol.title + ': not implemented yet (see ROADMAP.md)';
    } else {
      button.title = protocol.title + ' · ' + protocol.encoding + ' · ' + protocol.carrier_hz / 1000 + ' kHz';
      button.classList.toggle('active', protocol.name === state.protocol);
      button.addEventListener('click', () => {
        state.protocol = protocol.name;
        renderProtocols();
      });
    }
    box.appendChild(button);
  }

  const select = $('#rawProtocol');
  select.length = 1;
  for (const protocol of state.protocols.filter((p) => p.implemented)) {
    select.add(new Option(protocol.title, protocol.name));
  }
}

function renderKeys() {
  const box = $('#keys');
  for (const key of KEYS) {
    if (key === 'gap' || key === 'blank') {
      const spacer = document.createElement('div');
      spacer.className = key === 'gap' ? 'gap' : 'key blank';
      box.appendChild(spacer);
      continue;
    }
    const button = document.createElement('button');
    button.className = 'key ' + (key.cls || '');
    button.textContent = key.label;
    button.title = key.name;
    button.addEventListener('click', () => send(key[state.protocol], key.name, button));
    box.appendChild(button);
  }

  $('#custom').addEventListener('submit', (event) => {
    event.preventDefault();
    const text = $('#customCommand').value.trim();
    if (text) send(text, 'Custom ' + text);
  });
}

// ---------- Sending and receiving ----------

function addJitter(durations, percent) {
  return durations.map((d) => Math.max(1, Math.round(d * (1 + ((Math.random() * 2 - 1) * percent) / 100))));
}

async function send(command, keyName, button) {
  if (state.busy) return;
  state.busy = true;
  if (button) {
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 140);
  }

  const protocol = state.protocol;
  if (protocol === 'rc5') state.toggle ^= 1;
  const toggle = protocol === 'rc5' ? state.toggle : 0;
  const addressText = $('#address').value.trim();
  const intended = { protocol, address: parseNumber(addressText), command: parseNumber(command), toggle };

  restart($('#led'), 'fire');
  const sent = await api('/api/encode', { protocol, address: addressText, command, toggle });
  if (!sent.ok) {
    showStatus('bad', 'Not sent', sent.error);
    renderCompare(intended, null);
    addLog(protocol, keyName, false, sent.error);
    state.busy = false;
    return;
  }

  const received = addJitter(sent.durations, Number($('#jitter').value));
  state.sent = sent;
  state.received = received;
  $('#raw').value = received.join(' ');
  flyPacket(sent);
  animateWave();
  renderLegend(sent.fields);

  await sleep(560);
  restart($('#rxEye'), 'blink');
  const decoded = await api('/api/decode', { protocol: 'auto', durations: received });
  showDecoded(intended, decoded, keyName);
  state.busy = false;
}

async function decodeRaw() {
  const durations = $('#raw').value.split(/[\s,]+/).filter(Boolean).map((text) => Math.abs(Number(text)));
  if (!durations.length || durations.some((d) => !Number.isFinite(d))) {
    showStatus('bad', 'Not decoded', 'timings must be numbers in microseconds');
    return;
  }
  state.sent = null;
  state.received = durations;
  renderLegend([]);
  animateWave();
  restart($('#rxEye'), 'blink');
  const decoded = await api('/api/decode', { protocol: $('#rawProtocol').value, durations });
  showDecoded(null, decoded, 'Raw timings');
}

function showDecoded(intended, decoded, keyName) {
  if (decoded.ok) {
    const key = KEYS.find((k) => k.id && k[decoded.protocol] === decoded.command);
    const differs = intended && (decoded.address !== intended.address || decoded.command !== intended.command);
    const detail = protocolTitle(decoded.protocol) + ' · ' + (key ? key.name : 'command ' + hex(decoded.command));
    showStatus(differs ? 'bad' : 'ok', differs ? 'Decoded something else' : 'Decoded', detail);
  } else {
    showStatus('bad', 'No match', decoded.error);
  }
  renderCompare(intended, decoded);
  tvReact(decoded);
  addLog(decoded.protocol || (intended && intended.protocol) || 'auto', keyName, decoded.ok, decoded.ok ? null : decoded.error);
}

function showStatus(kind, title, detail) {
  const box = $('#status');
  box.className = 'status ' + kind;
  box.innerHTML = '';
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = kind === 'ok' ? '✓' : kind === 'bad' ? '✗' : '·';
  const text = document.createElement('div');
  text.textContent = title;
  const small = document.createElement('small');
  small.textContent = detail || '';
  text.appendChild(small);
  box.append(icon, text);
}

function renderCompare(intended, decoded) {
  const got = decoded && decoded.ok ? decoded : null;
  const show = (value) => (value === null || value === undefined ? '—' : typeof value === 'number' ? hex(value) : value);
  const rows = [
    ['Protocol', intended && intended.protocol, got && got.protocol],
    ['Address', intended && (intended.address ?? $('#address').value), got && got.address],
    ['Command', intended && intended.command, got && got.command],
    ['Toggle', intended && intended.protocol === 'rc5' ? String(intended.toggle) : null, got && got.protocol === 'rc5' ? String(got.toggle) : null],
    ['Carrier', null, got ? CARRIER : null],
  ];
  const body = $('#compare');
  body.innerHTML = '';
  for (const [name, sent, received] of rows) {
    const row = body.insertRow();
    const differs = intended && got && name !== 'Carrier' && sent !== null && received !== null && sent !== received;
    row.classList.toggle('diff', Boolean(differs));
    for (const value of [name, name === 'Protocol' || name === 'Carrier' ? sent ?? '—' : show(sent), name === 'Protocol' || name === 'Carrier' ? received ?? '—' : show(received)]) {
      row.insertCell().textContent = value;
    }
  }
}

function addLog(protocol, keyName, ok, error) {
  const item = document.createElement('li');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  for (const [cls, text] of [['t', time], ['', protocol.toUpperCase()], ['', keyName], [ok ? 'ok' : 'bad', ok ? '✓ decoded' : '✗ ' + (error || 'failed')]]) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    item.appendChild(span);
  }
  $('#log').prepend(item);
}

// ---------- The air and the TV ----------

function flyPacket(sent) {
  const beam = $('#beam');
  const width = Math.max(60, (sent.total_us / 1000) * 4);
  const stops = [];
  let t = 0;
  sent.durations.forEach((d, i) => {
    const from = (t / sent.total_us) * 100;
    t += d;
    const to = (t / sent.total_us) * 100;
    stops.push((i % 2 === 0 ? '#ff3d68' : 'transparent') + ' ' + from + '% ' + to + '%');
  });

  const packet = document.createElement('div');
  packet.className = 'packet';
  packet.style.width = width + 'px';
  packet.style.background = 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  beam.appendChild(packet);
  packet.animate(
    [{ transform: 'translateX(' + -width + 'px)' }, { transform: 'translateX(' + beam.clientWidth + 'px)' }],
    { duration: 650, easing: 'linear' },
  ).onfinish = () => packet.remove();

  $('#beamCaption').textContent =
    sent.durations.length + ' pulses · ' + (sent.total_us / 1000).toFixed(1) + ' ms · ' + sent.carrier_hz / 1000 + ' kHz carrier';
}

function tvReact(decoded) {
  const tv = state.tv;
  if (!decoded.ok) {
    if (tv.on) restart($('#tvStatic'), 'show');
    return;
  }
  const key = KEYS.find((k) => k.id && k[decoded.protocol] === decoded.command);
  if (key && key.id === 'power') {
    tv.on = !tv.on;
  } else if (!tv.on) {
    return;
  } else if (!key) {
    osd(decoded.protocol.toUpperCase() + ' ' + hex(decoded.command));
  } else if (key.digit !== undefined) {
    tv.channel = key.digit;
  } else if (key.id === 'chup' || key.id === 'chdown') {
    tv.channel = Math.max(0, Math.min(99, tv.channel + (key.id === 'chup' ? 1 : -1)));
  } else if (key.id === 'volup' || key.id === 'voldown') {
    tv.muted = false;
    tv.volume = Math.max(0, Math.min(20, tv.volume + (key.id === 'volup' ? 1 : -1)));
  } else if (key.id === 'mute') {
    tv.muted = !tv.muted;
  } else {
    osd(key.name.toUpperCase());
  }
  renderTv();
}

let osdTimer = null;
function osd(text) {
  $('#tvOsd').textContent = text;
  clearTimeout(osdTimer);
  osdTimer = setTimeout(renderTv, 1600);
}

function renderTv() {
  const tv = state.tv;
  $('#tvScreen').classList.toggle('off', !tv.on);
  $('#tvChannel').textContent = String(tv.channel).padStart(2, '0');
  $('#tvOsd').textContent = tv.muted ? 'MUTE' : 'VOL ' + tv.volume;
  const bar = $('#tvVolume');
  bar.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const segment = document.createElement('i');
    if (!tv.muted && i < tv.volume) segment.className = 'on';
    bar.appendChild(segment);
  }
}

// ---------- Waveform ----------

function animateWave() {
  const start = performance.now();
  const step = (now) => {
    state.progress = Math.min(1, (now - start) / 700);
    drawWave();
    if (state.progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// The smallest round time step that leaves room for its label.
function niceTick(totalUs, widthPx) {
  for (const step of [500, 1000, 2000, 5000, 10000, 20000]) {
    if ((step / totalUs) * widthPx >= 58) return step;
  }
  return 50000;
}

function drawTrace(ctx, durations, x, top, bottom, color, soft) {
  let t = 0;
  durations.forEach((d, i) => {
    if (i % 2 === 0) {
      const x0 = x(t);
      const x1 = x(t + d);
      ctx.fillStyle = soft;
      ctx.fillRect(x0, top, x1 - x0, bottom - top);
      ctx.strokeStyle = soft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let hx = x0 + 1.5; hx < x1; hx += 3) {
        ctx.moveTo(hx, top);
        ctx.lineTo(hx, bottom);
      }
      ctx.stroke();
    }
    t += d;
  });

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(0), bottom);
  t = 0;
  durations.forEach((d, i) => {
    const y = i % 2 === 0 ? top : bottom;
    ctx.lineTo(x(t), y);
    t += d;
    ctx.lineTo(x(t), y);
  });
  ctx.lineTo(x(t), bottom);
  ctx.stroke();
}

function drawFields(ctx, fields, x, top, height) {
  for (const field of fields) {
    const color = FIELD_COLORS[field.name] || '#8f9bbb';
    const x0 = x(field.start_us);
    const x1 = x(field.end_us);
    ctx.fillStyle = color + '2e';
    ctx.fillRect(x0 + 1, top, x1 - x0 - 2, height);
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 1, top, x1 - x0 - 2, 2);

    const label = field.bits ? field.name + ' ' + hex(field.value) : field.name;
    ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
    const text = ctx.measureText(label).width < x1 - x0 - 8 ? label : field.bits && ctx.measureText(hex(field.value)).width < x1 - x0 - 6 ? hex(field.value) : '';
    if (text) {
      ctx.fillStyle = color;
      ctx.fillText(text, x0 + 5, top + height / 2 + 6);
    }
  }
}

function drawWave() {
  const canvas = $('#wave');
  const ctx = canvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textBaseline = 'alphabetic';

  const durations = state.sent ? state.sent.durations : state.received;
  if (!durations) {
    ctx.fillStyle = '#5d6a8c';
    ctx.fillText('The waveform of the last key press appears here.', 16, height / 2);
    return;
  }

  const total = durations.reduce((a, b) => a + b, 0);
  const receivedTotal = state.received ? state.received.reduce((a, b) => a + b, 0) : 0;
  const span = Math.max(total, receivedTotal);
  const left = 84;
  const plot = width - left - 16;
  const x = (us) => left + (us / span) * plot;

  const tick = niceTick(span, plot);
  for (let t = 0; t <= span; t += tick) {
    ctx.strokeStyle = 'rgba(36, 48, 81, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x(t), 10);
    ctx.lineTo(x(t), height - 22);
    ctx.stroke();
    ctx.fillStyle = '#5d6a8c';
    ctx.fillText(t / 1000 + ' ms', x(t) + 3, height - 6);
  }

  ctx.fillStyle = '#8f9bbb';
  ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
  if (state.sent) ctx.fillText('SENT', 16, 52);
  if (state.received) ctx.fillText('RECEIVED', 16, 172);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, left + plot * state.progress, height);
  ctx.clip();
  if (state.sent) {
    drawTrace(ctx, state.sent.durations, x, 24, 76, '#4fe0d2', 'rgba(79, 224, 210, 0.16)');
    drawFields(ctx, state.sent.fields, x, 86, 30);
  }
  if (state.received) drawTrace(ctx, state.received, x, 146, 196, '#ffb547', 'rgba(255, 181, 71, 0.14)');
  ctx.restore();

  if (state.progress < 1) {
    const head = left + plot * state.progress;
    const glow = ctx.createLinearGradient(head - 40, 0, head, 0);
    glow.addColorStop(0, 'rgba(255, 61, 104, 0)');
    glow.addColorStop(1, 'rgba(255, 61, 104, 0.5)');
    ctx.fillStyle = glow;
    ctx.fillRect(head - 40, 10, 40, height - 32);
  }
}

function renderLegend(fields) {
  const box = $('#legend');
  box.innerHTML = '';
  for (const field of fields.filter((f) => f.bits)) {
    const item = document.createElement('span');
    item.style.setProperty('--c', FIELD_COLORS[field.name] || '#8f9bbb');
    item.textContent = field.name + ' ' + hex(field.value) + ' = ' + field.value.toString(2).padStart(field.bits, '0');
    box.appendChild(item);
  }
}

function describePoint(event) {
  const durations = state.sent ? state.sent.durations : state.received;
  const meta = $('#waveMeta');
  if (!durations) return;
  const canvas = $('#wave');
  const rect = canvas.getBoundingClientRect();
  const total = Math.max(durations.reduce((a, b) => a + b, 0), state.received ? state.received.reduce((a, b) => a + b, 0) : 0);
  const us = ((event.clientX - rect.left - 84) / (rect.width - 100)) * total;
  let t = 0;
  for (let i = 0; i < durations.length; i++) {
    if (us >= t && us < t + durations[i]) {
      meta.textContent = (i % 2 === 0 ? 'mark' : 'space') + ' ' + durations[i] + ' µs, at ' + (t / 1000).toFixed(2) + ' ms (#' + i + ')';
      return;
    }
    t += durations[i];
  }
  meta.textContent = 'Mark = carrier on, space = carrier off';
}

// ---------- Start ----------

async function init() {
  renderTv();
  renderCompare(null, null);
  drawWave();

  const data = await api('/api/protocols');
  const pill = $('#backend');
  if (data.ok) {
    pill.textContent = 'irlab ready';
    pill.className = 'pill ok';
    state.protocols = data.protocols;
  } else {
    pill.textContent = data.error;
    pill.className = 'pill bad';
  }
  renderProtocols();
  renderKeys();

  const jitter = $('#jitter');
  jitter.addEventListener('input', () => ($('#jitterValue').textContent = '±' + jitter.value + '%'));
  $('#decodeRaw').addEventListener('click', decodeRaw);
  $('#wave').addEventListener('mousemove', describePoint);
  $('#wave').addEventListener('mouseleave', () => ($('#waveMeta').textContent = 'Mark = carrier on, space = carrier off'));
  new ResizeObserver(drawWave).observe($('#wave'));
}

init();
