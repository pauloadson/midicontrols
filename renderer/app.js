import { loadState, saveConfig, clampCC, WHEEL_STEP } from './state.js';
import { MidiManager } from './midi.js';

const state = loadState();

const $port = document.getElementById("port");
const $channel = document.getElementById("channel");
const $dot = document.getElementById("dot");
const $statusText = document.getElementById("statusText");
const $rack = document.getElementById("rack");
const $knobRack = document.getElementById("knobRack");
const $sendAll = document.getElementById("sendAll");

// Injeta controles de delay no header
const $header = document.querySelector("header");
const $status = document.getElementById("status");

// Aplica estado inicial do cabeçalho
if (state.headerMinimized) $header.classList.add("minimized");

const $delayGroup = document.createElement("div");
$delayGroup.className = "delay-group";
$delayGroup.innerHTML = `
  <button id="delayBtn" class="delay-btn ${state.globalDelay.enabled ? 'active' : ''}" title="Ativa o atraso no envio para mapeamento MIDI">Delay Learn: ${state.globalDelay.enabled ? 'ON' : 'OFF'}</button>
  <input id="delayInput" class="delay-input" type="number" min="1" max="10" value="${state.globalDelay.seconds}" title="Segundos de atraso">
  <span style="font-size: 10px; color: var(--muted)">s</span>
`;
$header.insertBefore($delayGroup, $status);

// Injeta botão de toggle do cabeçalho
const $headerToggle = document.createElement("button");
$headerToggle.id = "header-toggle";
$headerToggle.innerHTML = state.headerMinimized ? '<span>Menu</span> ▼' : '<span>Recolher Menu</span> ▲';
$headerToggle.title = "Minimizar/Expandir menu superior";
$header.appendChild($headerToggle);

$headerToggle.addEventListener("click", () => {
  state.headerMinimized = !state.headerMinimized;
  $header.classList.toggle("minimized", state.headerMinimized);
  $headerToggle.innerHTML = state.headerMinimized ? '<span>Menu</span> ▼' : '<span>Recolher Menu</span> ▲';
  saveConfig(state);
});

const $shortcutBtn = document.createElement("button");
$shortcutBtn.id = "openShortcuts";
$shortcutBtn.textContent = "Atalhos";
$shortcutBtn.title = "Gerenciar atalhos de teclado globais";
$header.insertBefore($shortcutBtn, $status);

// Cria o Modal de Atalhos
const $modal = document.createElement("div");
$modal.id = "shortcutModal";
$modal.className = "modal";
$modal.innerHTML = `
  <div class="modal-content">
    <div class="modal-header">
      <h3>Atalhos Globais (Teclado -> MIDI CC)</h3>
      <button class="close-modal">&times;</button>
    </div>
    <div id="shortcutsList"></div>
    <button id="addShortcut">+ Adicionar Novo Atalho</button>
    <p style="font-size: 10px; color: var(--muted); margin-top: 12px;">
      Pressionar a tecla alterna o CC entre 0 e 127. Respeita o Delay Mode se ativo.
    </p>
  </div>
`;
document.body.appendChild($modal);

const $shortcutsList = document.getElementById("shortcutsList");
const $addShortcut = document.getElementById("addShortcut");

function renderShortcuts() {
  $shortcutsList.innerHTML = "";
  state.shortcuts.forEach((s, i) => {
    const row = document.createElement("div");
    row.className = "shortcut-row";
    row.innerHTML = `
      <div class="field">
        <label>Tecla</label>
        <input type="text" class="s-key" value="${s.key}" maxlength="1">
      </div>
      <div class="field">
        <label>MIDI CC</label>
        <input type="number" class="s-cc" value="${s.cc}" min="0" max="127">
      </div>
      <button class="remove-shortcut" title="Remover">&times;</button>
    `;

    const $key = row.querySelector(".s-key");
    const $cc = row.querySelector(".s-cc");
    const $remove = row.querySelector(".remove-shortcut");

    $key.addEventListener("change", () => {
      s.key = $key.value.toUpperCase().trim();
      $key.value = s.key;
      saveConfig(state);
    });

    $cc.addEventListener("change", () => {
      s.cc = clampCC($cc.value);
      $cc.value = s.cc;
      saveConfig(state);
    });

    $remove.addEventListener("click", () => {
      state.shortcuts.splice(i, 1);
      renderShortcuts();
      saveConfig(state);
    });

    $shortcutsList.appendChild(row);
  });
}

$shortcutBtn.addEventListener("click", () => {
  renderShortcuts();
  $modal.style.display = "flex";
});

$modal.querySelector(".close-modal").addEventListener("click", () => {
  $modal.style.display = "none";
});

$addShortcut.addEventListener("click", () => {
  state.shortcuts.push({ key: "", cc: 0, state: 0 });
  renderShortcuts();
  saveConfig(state);
});

// Listener Global de Teclado (Otimizado e Sincronizado)
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const key = e.key.toUpperCase();
  const shortcut = state.shortcuts.find(s => s.key === key);
  
  if (shortcut) {
    shortcut.state = shortcut.state ? 0 : 127;
    
    // 1. Dispara o MIDI (com ou sem delay)
    midi.sendCC(shortcut.cc, shortcut.state);

    // 2. Procura um controle visual na tela com o mesmo CC e atualiza ele
    // Isso faz com que os botões On/Off e faders se movam quando o atalho é usado
    updateUIForCC(shortcut.cc, shortcut.state);
  }
});

// Função para sincronizar a interface quando um CC muda via atalho
function updateUIForCC(cc, value) {
  // Procura nos strips (Faders)
  state.strips.forEach((strip, i) => {
    if (strip.cc === cc) {
      strip.value = value;
      // Re-renderiza o rack para refletir a mudança
      buildRack();
    }
    if (strip.btnCc === cc) {
      strip.btnValue = value;
      buildRack();
    }
    // Procura nos knobs laterais do strip
    strip.knobs.forEach(knob => {
      if (knob.cc === cc) {
        knob.value = value;
        buildRack();
      }
    });
  });

  // Procura nos knobs superiores
  state.knobs.forEach((knob, i) => {
    if (knob.cc === cc) {
      knob.value = value;
      buildKnobs();
    }
    if (knob.btnCc === cc) {
      knob.btnValue = value;
      buildKnobs();
    }
  });
}

const $delayBtn = document.getElementById("delayBtn");
const $delayInput = document.getElementById("delayInput");

$delayBtn.addEventListener("click", () => {
  state.globalDelay.enabled = !state.globalDelay.enabled;
  $delayBtn.classList.toggle("active", state.globalDelay.enabled);
  $delayBtn.textContent = `Delay Learn: ${state.globalDelay.enabled ? 'ON' : 'OFF'}`;
  saveConfig(state);
});

$delayInput.addEventListener("change", () => {
  state.globalDelay.seconds = Math.max(1, Math.min(10, parseInt($delayInput.value, 10) || 3));
  $delayInput.value = state.globalDelay.seconds;
  saveConfig(state);
});

function setStatus(kind, text) {
  $dot.className = kind;
  $statusText.textContent = text;
}

function onPortSelected(outputs, currentPortId) {
  $port.innerHTML = "";
  if (outputs.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "nenhuma porta encontrada";
    $port.appendChild(opt);
    setStatus("err", "sem portas MIDI — abra o loopMIDI");
    return;
  }

  for (const out of outputs) {
    const opt = document.createElement("option");
    opt.value = out.id;
    opt.textContent = out.name;
    $port.appendChild(opt);
  }

  const saved = outputs.find((o) => o.id === currentPortId);
  const selectedId = saved ? saved.id : outputs[0].id;
  $port.value = selectedId;
  midi.selectPort(selectedId);
}

const midi = new MidiManager(state, setStatus, onPortSelected);

function escapeAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
  ));
}

function knobArcPath(cx, cy, r, value) {
  const a0 = -135;
  const a1 = -135 + (value / 127) * 270;
  const point = (deg) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  };
  const [x0, y0] = point(a0);
  const [x1, y1] = point(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function buildChannelSelect() {
  for (let c = 1; c <= 16; c++) {
    const opt = document.createElement("option");
    opt.value = String(c);
    opt.textContent = String(c);
    $channel.appendChild(opt);
  }
  $channel.value = String(state.channel);
  $channel.addEventListener("change", () => {
    state.channel = parseInt($channel.value, 10);
    saveConfig(state);
  });
}

function buildKnobs() {
  $knobRack.innerHTML = "";
  state.knobs.forEach((knob, i) => {
    const el = document.createElement("div");
    el.className = "strip knob";
    el.innerHTML = `
      <input class="lbl" type="text" value="${escapeAttr(knob.label)}" maxlength="14">
      <div class="cc-row">CC <input class="cc" type="number" min="0" max="127" value="${knob.cc}"></div>
      <div class="onoff-row">
        <button class="onoff-btn ${knob.btnValue ? 'active' : ''}" title="Alternar On/Off (Mute)">⏻</button>
        <div class="cc-row">CC <input class="btn-cc" type="number" min="0" max="127" value="${knob.btnCc}"></div>
      </div>
      <div class="knob-wrap">
        <svg class="knob-svg" viewBox="0 0 64 64">
          <path class="knob-bg" d="${knobArcPath(32, 32, 24, 127)}"></path>
          <path class="knob-arc"></path>
          <circle class="knob-body" cx="32" cy="32" r="16"></circle>
          <g class="knob-ind">
            <line class="knob-line" x1="32" y1="14" x2="32" y2="22"></line>
          </g>
        </svg>
      </div>
      <div class="value">${knob.value}</div>
    `;
    setupKnob(el, knob, () => "Knob " + (i + 1));
    setupOnOff(el, knob);
    $knobRack.appendChild(el);
  });
}

function setupOnOff(el, data) {
  const $btn = el.querySelector(".onoff-btn");
  const $btnCc = el.querySelector(".btn-cc");

  function toggle() {
    data.btnValue = data.btnValue ? 0 : 127;
    $btn.classList.toggle("active", !!data.btnValue);
    midi.sendCC(data.btnCc, data.btnValue);
    saveConfig(state);
  }

  $btn.addEventListener("click", toggle);

  $btnCc.addEventListener("change", () => {
    data.btnCc = clampCC($btnCc.value);
    $btnCc.value = data.btnCc;
    saveConfig(state);
  });
}

function setupKnob(el, knobData, defaultLabelFn) {
  const $lbl = el.querySelector(".lbl");
  const $cc = el.querySelector(".cc");
  const $svg = el.querySelector(".knob-svg");
  const $arc = el.querySelector(".knob-arc");
  const $ind = el.querySelector(".knob-ind");
  const $val = el.querySelector(".value");
  const $scrollArea = el.querySelector(".knob-wrap") || el.querySelector(".side-knob-body");

  function render() {
    const angle = -135 + (knobData.value / 127) * 270;
    if ($ind) $ind.setAttribute("transform", `rotate(${angle} 32 32)`);
    if ($arc) $arc.setAttribute("d", knobArcPath(32, 32, 24, knobData.value));
    $val.textContent = knobData.value;
  }
  render();

  $lbl.addEventListener("change", () => {
    knobData.label = $lbl.value.trim() || defaultLabelFn();
    $lbl.value = knobData.label;
    saveConfig(state);
  });

  $cc.addEventListener("change", () => {
    knobData.cc = clampCC($cc.value);
    $cc.value = knobData.cc;
    saveConfig(state);
  });

  let dragging = false;
  let startY = 0;
  let startValue = 0;

  $svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    startY = e.clientY;
    startValue = knobData.value;
    $svg.setPointerCapture(e.pointerId);
  });

  $svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const next = Math.round(startValue + (startY - e.clientY) * 0.5);
    const clamped = Math.min(127, Math.max(0, next));
    if (clamped === knobData.value) return;
    knobData.value = clamped;
    render();
    midi.sendCC(knobData.cc, knobData.value);
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    $svg.releasePointerCapture(e.pointerId);
    saveConfig(state);
  }
  $svg.addEventListener("pointerup", endDrag);
  $svg.addEventListener("pointercancel", endDrag);

  $svg.addEventListener("dblclick", () => {
    knobData.value = 0;
    render();
    midi.sendCC(knobData.cc, 0);
    saveConfig(state);
  });

  if ($scrollArea) {
    $scrollArea.addEventListener("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const next = Math.min(127, Math.max(0, knobData.value + dir * WHEEL_STEP));
      if (next === knobData.value) return;
      knobData.value = next;
      render();
      midi.sendCC(knobData.cc, next);
      saveConfig(state);
    }, { passive: false });
  }
}

function buildRack() {
  $rack.innerHTML = "";
  state.strips.forEach((strip, i) => {
    const el = document.createElement("div");
    el.className = "strip" + (strip.showKnobs ? "" : " knobs-hidden");
    el.innerHTML = `
      <button class="toggle-knobs" title="Mostrar/Ocultar knobs laterais">${strip.showKnobs ? "−" : "+"}</button>
      <input class="lbl" type="text" value="${escapeAttr(strip.label)}" maxlength="14">
      <div class="cc-row">CC <input class="cc" type="number" min="0" max="127" value="${strip.cc}"></div>
      <div class="onoff-row">
        <button class="onoff-btn ${strip.btnValue ? 'active' : ''}" title="Alternar On/Off (Mute)">⏻</button>
        <div class="cc-row">CC <input class="btn-cc" type="number" min="0" max="127" value="${strip.btnCc}"></div>
      </div>
      <div class="controls-row">
        <div class="fader-col">
          <div class="fader-wrap">
            <input class="fader" type="range" min="0" max="127" step="1" value="${strip.value}">
          </div>
          <div class="value">${strip.value}</div>
        </div>
        <div class="side-knobs">
          ${strip.knobs.map((knob, ki) => `
            <div class="side-knob" data-ki="${ki}">
              <div class="side-knob-header">
                <input class="lbl" type="text" value="${escapeAttr(knob.label)}" maxlength="8">
                <div class="cc-row">CC <input class="cc" type="number" min="0" max="127" value="${knob.cc}"></div>
              </div>
              <div class="side-knob-body">
                <svg class="knob-svg" viewBox="0 0 64 64">
                  <path class="knob-bg" d="${knobArcPath(32, 32, 24, 127)}"></path>
                  <path class="knob-arc"></path>
                  <circle class="knob-body" cx="32" cy="32" r="16"></circle>
                  <g class="knob-ind">
                    <line class="knob-line" x1="32" y1="14" x2="32" y2="22"></line>
                  </g>
                </svg>
                <div class="value">${knob.value}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    const $lbl = el.querySelector(".lbl");
    const $cc = el.querySelector(".cc");
    const $fader = el.querySelector(".fader");
    const $val = el.querySelector(".fader-col .value");
    const $toggle = el.querySelector(".toggle-knobs");
    const $faderWrap = el.querySelector(".fader-wrap");

    $toggle.addEventListener("click", () => {
      strip.showKnobs = !strip.showKnobs;
      el.classList.toggle("knobs-hidden", !strip.showKnobs);
      $toggle.textContent = strip.showKnobs ? "−" : "+";
      saveConfig(state);
    });

    setupOnOff(el, strip);

    $lbl.addEventListener("change", () => {
      strip.label = $lbl.value.trim() || "Fader " + (i + 1);
      $lbl.value = strip.label;
      saveConfig(state);
    });

    $cc.addEventListener("change", () => {
      strip.cc = clampCC($cc.value);
      $cc.value = strip.cc;
      saveConfig(state);
    });

    $fader.addEventListener("input", () => {
      strip.value = parseInt($fader.value, 10);
      $val.textContent = strip.value;
      midi.sendCC(strip.cc, strip.value);
    });

    $fader.addEventListener("change", () => saveConfig(state));

    $fader.addEventListener("dblclick", () => {
      strip.value = 0;
      $fader.value = "0";
      $val.textContent = "0";
      midi.sendCC(strip.cc, 0);
      saveConfig(state);
    });

    if ($faderWrap) {
      $faderWrap.addEventListener("wheel", (e) => {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        const next = Math.min(127, Math.max(0, strip.value + dir * WHEEL_STEP));
        if (next === strip.value) return;
        strip.value = next;
        $fader.value = String(next);
        $val.textContent = next;
        midi.sendCC(strip.cc, next);
        saveConfig(state);
      }, { passive: false });
    }

    el.querySelectorAll(".side-knob").forEach(($sk) => {
      const ki = parseInt($sk.dataset.ki, 10);
      setupKnob($sk, strip.knobs[ki], () => `K${ki + 1}`);
    });

    $rack.appendChild(el);
  });
}

$sendAll.addEventListener("click", () => midi.sendAll());
$port.addEventListener("change", () => midi.selectPort($port.value));

buildChannelSelect();
buildRack();
buildKnobs();
midi.init();
