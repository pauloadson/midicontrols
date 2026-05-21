export const NUM_STRIPS = 8;
export const NUM_KNOBS = 8;
export const WHEEL_STEP = 2;
export const STORAGE_KEY = "faders-midi-config-v2"; // Incrementada para a versão Electron

export const defaultStrips = Array.from({ length: NUM_STRIPS }, (_, i) => ({
  label: "Fader " + (i + 1),
  cc: 20 + i,
  value: 0
}));

export const defaultKnobs = Array.from({ length: NUM_KNOBS }, (_, i) => ({
  label: "Knob " + (i + 1),
  cc: 28 + i,
  value: 0
}));

export function clampCC(n) {
  n = parseInt(n, 10);
  if (Number.isNaN(n)) return 0;
  return Math.min(127, Math.max(0, n));
}

export function saveConfig(state) {
  const data = {
    channel: state.channel,
    portId: state.portId,
    strips: state.strips,
    knobs: state.knobs,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadState() {
  const state = {
    channel: 1,
    portId: null,
    strips: structuredClone(defaultStrips),
    knobs: structuredClone(defaultKnobs),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.channel = data.channel || 1;
      state.portId = data.portId || null;
      if (Array.isArray(data.strips) && data.strips.length === NUM_STRIPS) {
        state.strips = data.strips;
      }
      if (Array.isArray(data.knobs) && data.knobs.length === NUM_KNOBS) {
        state.knobs = data.knobs;
      }
    }
  } catch (e) {
    console.warn("Config inválida, usando padrão:", e);
  }
  return state;
}
