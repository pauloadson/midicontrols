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

function buildRack() {
  $rack.innerHTML = "";
  state.strips.forEach((strip, i) => {
    const el = document.createElement("div");
    el.className = "strip";
    el.innerHTML = `
      <input class="lbl" type="text" value="${escapeAttr(strip.label)}" maxlength="14">
      <div class="cc-row">CC <input class="cc" type="number" min="0" max="127" value="${strip.cc}"></div>
      <div class="fader-wrap">
        <input class="fader" type="range" min="0" max="127" step="1" value="${strip.value}">
      </div>
      <div class="value">${strip.value}</div>
    `;

    const $lbl = el.querySelector(".lbl");
    const $cc = el.querySelector(".cc");
    const $fader = el.querySelector(".fader");
    const $val = el.querySelector(".value");

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

    el.addEventListener("wheel", (e) => {
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

    $rack.appendChild(el);
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

    const $lbl = el.querySelector(".lbl");
    const $cc = el.querySelector(".cc");
    const $svg = el.querySelector(".knob-svg");
    const $arc = el.querySelector(".knob-arc");
    const $ind = el.querySelector(".knob-ind");
    const $val = el.querySelector(".value");

    function render() {
      const angle = -135 + (knob.value / 127) * 270;
      $ind.setAttribute("transform", `rotate(${angle} 32 32)`);
      $arc.setAttribute("d", knobArcPath(32, 32, 24, knob.value));
      $val.textContent = knob.value;
    }
    render();

    $lbl.addEventListener("change", () => {
      knob.label = $lbl.value.trim() || "Knob " + (i + 1);
      $lbl.value = knob.label;
      saveConfig(state);
    });

    $cc.addEventListener("change", () => {
      knob.cc = clampCC($cc.value);
      $cc.value = knob.cc;
      saveConfig(state);
    });

    let dragging = false;
    let startY = 0;
    let startValue = 0;

    $svg.addEventListener("pointerdown", (e) => {
      dragging = true;
      startY = e.clientY;
      startValue = knob.value;
      $svg.setPointerCapture(e.pointerId);
    });

    $svg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const next = Math.round(startValue + (startY - e.clientY) * 0.5);
      const clamped = Math.min(127, Math.max(0, next));
      if (clamped === knob.value) return;
      knob.value = clamped;
      render();
      midi.sendCC(knob.cc, knob.value);
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
      knob.value = 0;
      render();
      midi.sendCC(knob.cc, 0);
      saveConfig(state);
    });

    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      const next = Math.min(127, Math.max(0, knob.value + dir * WHEEL_STEP));
      if (next === knob.value) return;
      knob.value = next;
      render();
      midi.sendCC(knob.cc, next);
      saveConfig(state);
    }, { passive: false });

    $knobRack.appendChild(el);
  });
}

$sendAll.addEventListener("click", () => midi.sendAll());
$port.addEventListener("change", () => midi.selectPort($port.value));

buildChannelSelect();
buildRack();
buildKnobs();
midi.init();
