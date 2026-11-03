// Token lab: what rtk and graft change in the text an agent reads.

const CONTEXT_WINDOW = 200000;
const runs = {};
const slots = {};

const $ = (selector, root = document) => root.querySelector(selector);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

function short(n) {
  if (n >= 100000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.round(n));
}

async function api(path, body, raw) {
  try {
    const options = body === undefined ? undefined : {
      method: 'POST',
      headers: { 'Content-Type': raw ? 'text/plain' : 'application/json' },
      body: raw ? body : JSON.stringify(body),
    };
    const response = await fetch(path, options);
    return await response.json();
  } catch (error) {
    return { ok: false, error: 'server not reachable' };
  }
}

function countUp(element, to, ms, format = fmt) {
  const from = Number(element.dataset.value || 0);
  element.dataset.value = to;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    element.textContent = format(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Duels ----------

function lane(kind, side) {
  const box = document.createElement('div');
  box.className = 'lane ' + kind;
  box.innerHTML = `
    <div class="lane-head"><span class="tag"></span><code></code></div>
    <div class="track"><div class="fill ${kind}"></div></div>
    <div class="nums"><b>0</b><span class="sub">≈ tokens</span></div>
    <div class="missing hidden"></div>`;
  $('.tag', box).textContent = kind === 'base' ? 'without' : side.label;
  $('code', box).textContent = side.command;
  $('code', box).title = side.command;
  if (side.missing) {
    $('.missing', box).textContent = side.missing;
    $('.missing', box).classList.remove('hidden');
  }
  return box;
}

function duelCard(duel) {
  const card = document.createElement('article');
  card.className = 'panel duel';
  card.innerHTML = `
    <header><div><h3></h3><p class="q"></p></div><button class="btn run">Run</button></header>
    <footer><span class="verdict"></span><button class="btn peek">Show output</button></footer>
    <div class="outputs hidden"><pre class="out-base"></pre><pre class="out-tool"></pre></div>`;
  $('h3', card).textContent = duel.title;
  $('.q', card).textContent = duel.question;
  const base = lane('base', duel.baseline);
  const tool = lane('tool', duel.tool);
  card.insertBefore(tool, $('footer', card));
  card.insertBefore(base, tool);
  $('.run', card).addEventListener('click', () => runDuel(card, duel));
  $('.peek', card).addEventListener('click', () => {
    const outputs = $('.outputs', card);
    outputs.classList.toggle('hidden');
    $('.peek', card).textContent = outputs.classList.contains('hidden') ? 'Show output' : 'Hide output';
  });
  card.lanes = { base, tool };
  return card;
}

function showLane(box, side, max) {
  const fill = $('.fill', box);
  const count = $('b', box);
  if (side.missing) {
    fill.style.width = '0';
    count.textContent = '—';
    return;
  }
  fill.style.transition = 'none';
  fill.style.width = '0';
  void fill.offsetWidth;
  fill.style.transition = '';
  requestAnimationFrame(() => (fill.style.width = Math.max(0.6, (side.tokens / max) * 100) + '%'));
  count.dataset.value = 0;
  countUp(count, side.tokens, 1400);
  $('.sub', box).textContent =
    '≈ tokens · ' + fmt(side.chars) + ' chars · ' + fmt(side.lines) + ' lines · ' +
    ((side.tokens / CONTEXT_WINDOW) * 100).toFixed(2) + '% of the window';
}

async function runDuel(card, duel) {
  const button = $('.run', card);
  button.disabled = true;
  button.textContent = 'Running…';
  const result = await api('/api/duels/run', { id: duel.id });
  button.disabled = false;
  button.textContent = 'Run again';
  if (!result.baseline) {
    $('.verdict', card).textContent = result.error || 'failed';
    return;
  }

  const { baseline, tool } = result;
  const max = Math.max(baseline.tokens || 0, tool.tokens || 0, 1);
  showLane(card.lanes.base, baseline, max);
  showLane(card.lanes.tool, tool, max);
  $('.out-base', card).textContent = baseline.output || '';
  $('.out-tool', card).textContent = tool.output || tool.missing || '';

  const verdict = $('.verdict', card);
  verdict.classList.remove('worse');
  if (tool.missing || !baseline.tokens) {
    verdict.textContent = '';
  } else if (tool.tokens < baseline.tokens) {
    const saved = 1 - tool.tokens / baseline.tokens;
    verdict.textContent = '−' + Math.round(saved * 100) + '% · ' + (baseline.tokens / Math.max(tool.tokens, 1)).toFixed(1) + '× less to read';
  } else {
    verdict.classList.add('worse');
    verdict.textContent = '+' + Math.round((tool.tokens / baseline.tokens - 1) * 100) + '% more to read';
  }

  runs[duel.id] = tool.missing ? null : { base: baseline.tokens, tool: tool.tokens };
  updateRace();
}

function updateRace() {
  const done = Object.values(runs).filter(Boolean);
  const base = done.reduce((sum, r) => sum + r.base, 0);
  const tool = done.reduce((sum, r) => sum + r.tool, 0);
  const max = Math.max(base, tool, 1);
  $('#raceBase').style.width = (base / max) * 100 + '%';
  $('#raceTool').style.width = (tool / max) * 100 + '%';
  countUp($('#raceBaseNum'), base, 1400);
  countUp($('#raceToolNum'), tool, 1400);
  $('#windowBase').style.width = Math.min(100, (base / CONTEXT_WINDOW) * 100) + '%';
  $('#windowTool').style.width = Math.min(100, (tool / CONTEXT_WINDOW) * 100) + '%';
  $('#saving').textContent = base ? 'saved ' + fmt(base - tool) + ' tokens (' + Math.round((1 - tool / base) * 100) + '%)' : '';
}

async function runAll() {
  const button = $('#runAll');
  button.disabled = true;
  for (const card of document.querySelectorAll('.duel')) {
    await runDuel(card, card.duel);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  button.disabled = false;
}

// ---------- Session replay ----------

function sessionLabel(session) {
  const s = session.summary;
  const when = new Date(session.modified).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const prompt = s.first_prompt ? s.first_prompt.slice(0, 48) : '(no prompt)';
  return when + ' · ' + s.turns + ' turns · ' + short(s.input_tokens) + ' in · ' + prompt;
}

function setSession(slot, parsed, origin) {
  slot.data = parsed;
  const s = parsed.summary;
  $('.slot-meta', slot.el).textContent =
    origin + ' · ' + s.turns + ' turns · ' + s.tool_calls + ' tool calls · ' + fmt(s.input_tokens) + ' input · ' +
    fmt(s.output_tokens) + ' output' + (s.model ? ' · ' + s.model : '');
  resetSlot(slot);
}

function resetSlot(slot) {
  slot.totals = { input: 0, output: 0, tools: 0, turns: 0 };
  slot.done = false;
  for (const element of slot.el.querySelectorAll('.counter b')) {
    element.dataset.value = 0;
    element.textContent = '0';
  }
  $('.feed', slot.el).innerHTML = '';
  setGauge(slot, 0);
}

function setGauge(slot, context) {
  const arc = $('.arc', slot.el);
  const length = arc.getTotalLength();
  const share = Math.min(1, context / CONTEXT_WINDOW);
  arc.style.transition = 'stroke-dashoffset 0.35s ease-out, stroke 0.35s';
  arc.style.strokeDasharray = length;
  arc.style.strokeDashoffset = length * (1 - share);
  arc.style.stroke = share > 0.75 ? '#ff5c74' : slot.id === 'a' ? '#ff3d68' : '#4fe0d2';
  $('.value', slot.el).textContent = short(context);
}

function addChip(slot, text, tokens) {
  const feed = $('.feed', slot.el);
  const chip = document.createElement('div');
  if (tokens === undefined) {
    chip.className = 'chip prompt';
    chip.textContent = '› ' + text;
  } else {
    chip.className = 'chip';
    chip.innerHTML = '<span class="who"></span><span class="bar"></span><span class="n"></span>';
    $('.who', chip).textContent = text;
    $('.who', chip).title = text;
    const bar = $('.bar', chip);
    bar.style.width = Math.max(2, Math.min(100, (tokens / 8000) * 100)) + '%';
    bar.style.background = slot.id === 'a' ? '#ff3d68' : '#4fe0d2';
    $('.n', chip).textContent = short(tokens);
  }
  feed.prepend(chip);
  while (feed.children.length > 40) feed.lastChild.remove();
}

function applyEvent(slot, event, ms) {
  const counters = (k) => $('.counter b[data-k="' + k + '"]', slot.el);
  if (event.kind === 'prompt') {
    addChip(slot, event.text);
  } else if (event.kind === 'turn') {
    slot.totals.input += event.context;
    slot.totals.output += event.output;
    slot.totals.turns += 1;
    setGauge(slot, event.context);
    countUp(counters('input'), slot.totals.input, ms, short);
    countUp(counters('output'), slot.totals.output, ms, short);
    countUp(counters('turns'), slot.totals.turns, ms);
  } else if (event.kind === 'result') {
    slot.totals.tools += event.tokens;
    countUp(counters('tools'), slot.totals.tools, ms, short);
    addChip(slot, event.tool + (event.label ? ' · ' + event.label : ''), event.tokens);
  }
}

function play() {
  const active = Object.values(slots).filter((slot) => slot.data);
  if (!active.length) {
    $('#replayVerdict').textContent = 'Pick at least one session first.';
    return;
  }
  clearInterval(play.timer);
  active.forEach(resetSlot);
  $('#replayVerdict').textContent = '';
  const ms = 420 / Number($('#speed').value);
  let index = 0;
  play.timer = setInterval(() => {
    let running = false;
    for (const slot of active) {
      if (index < slot.data.timeline.length) {
        applyEvent(slot, slot.data.timeline[index], ms);
        running = true;
      } else if (!slot.done) {
        slot.done = true;
        addChip(slot, 'finished after ' + slot.totals.turns + ' turns');
      }
    }
    index += 1;
    if (!running) {
      clearInterval(play.timer);
      showVerdict(active);
    }
  }, ms);
}

function showVerdict(active) {
  const box = $('#replayVerdict');
  if (active.length < 2) {
    box.textContent = 'Load a second session to compare.';
    return;
  }
  const [a, b] = [slots.a, slots.b];
  const name = (slot) => $('.slot-name', slot.el).value;
  const change = (x, y) => (x ? Math.round((1 - y / x) * 100) : 0);
  const input = change(a.totals.input, b.totals.input);
  const output = change(a.totals.output, b.totals.output);
  box.innerHTML = '';
  const line = document.createElement('div');
  line.append(
    name(b) + ' read ',
    Object.assign(document.createElement('b'), { textContent: Math.abs(input) + '% ' + (input >= 0 ? 'less' : 'more') + ' input' }),
    ' and wrote ' + Math.abs(output) + '% ' + (output >= 0 ? 'less' : 'more') + ' output than ' + name(a) +
      ' (' + fmt(b.totals.input) + ' vs ' + fmt(a.totals.input) + ' input tokens, ' + b.totals.turns + ' vs ' + a.totals.turns + ' turns).',
  );
  box.appendChild(line);
}

async function initReplay() {
  const data = await api('/api/sessions');
  $('#sessionFolder').textContent = data.folder || 'unknown';
  for (const el of document.querySelectorAll('.slot')) {
    const slot = { id: el.dataset.slot, el, data: null };
    slots[slot.id] = slot;
    resetSlot(slot);

    const select = $('select', el);
    select.add(new Option((data.sessions || []).length ? 'Pick a session from this folder' : 'No sessions in this folder yet', ''));
    for (const session of data.sessions || []) select.add(new Option(sessionLabel(session), session.id));
    select.addEventListener('change', async () => {
      if (!select.value) return;
      const parsed = await api('/api/sessions/' + encodeURIComponent(select.value));
      if (parsed.summary) setSession(slot, parsed, 'session ' + select.value.slice(0, 8));
    });

    const drop = $('.drop', el);
    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', async (event) => {
      event.preventDefault();
      drop.classList.remove('over');
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const parsed = await api('/api/sessions/parse', await file.text(), true);
      if (parsed.summary) setSession(slot, parsed, file.name);
    });
  }
  $('#play').addEventListener('click', play);
}

async function init() {
  const data = await api('/api/duels');
  const pill = $('#backend');
  pill.textContent = data.duels ? 'server ready' : data.error;
  pill.className = 'pill ' + (data.duels ? 'ok' : 'bad');
  for (const duel of data.duels || []) {
    const card = duelCard(duel);
    card.duel = duel;
    $('#duels').appendChild(card);
  }
  $('#runAll').addEventListener('click', runAll);
  await initReplay();
}

init();
