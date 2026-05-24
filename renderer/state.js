export const NUM_STRIPS = 8;
export const NUM_KNOBS = 8;
export const WHEEL_STEP = 2;
export const STORAGE_KEY = "faders-midi-config-v2"; // Incrementada para a versão Electron

export const defaultStrips = Array.from({ length: NUM_STRIPS }, (_, i) => ({
  btnCc: 60 + i,
  btnValue: 0,
  label: "Fader " + (i + 1),
  cc: 20 + i,
  value: 0,
  showKnobs: true,
  knobs: Array.from({ length: 3 }, (_, k) => ({
    label: `K${k + 1}`,
    cc: 36 + (i * 3) + k,
    value: 0
  }))
}));

export const defaultKnobs = Array.from({ length: NUM_KNOBS }, (_, i) => ({
  btnCc: 70 + i,
  btnValue: 0,
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
    globalDelay: state.globalDelay,
    shortcuts: state.shortcuts,
    channel: state.channel,
    portId: state.portId,
    strips: state.strips,
    knobs: state.knobs,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadState() {
  const state = {
    globalDelay: { enabled: false, seconds: 3 },
    shortcuts: [],
    channel: 1,
    portId: null,
    strips: structuredClone(defaultStrips),
    knobs: structuredClone(defaultKnobs),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.globalDelay = data.globalDelay || { enabled: false, seconds: 3 };
      state.shortcuts = Array.isArray(data.shortcuts) ? data.shortcuts : [];
      state.channel = data.channel || 1;
      state.portId = data.portId || null;
      if (Array.isArray(data.strips) && data.strips.length === NUM_STRIPS) {
        state.strips = data.strips.map((s, i) => {
          // Garante que strips antigos ganhem os novos knobs
          if (!s.knobs || !Array.isArray(s.knobs)) {
            s.knobs = structuredClone(defaultStrips[i].knobs);
          }
          if (s.btnCc === undefined) s.btnCc = 60 + i;
          if (s.btnValue === undefined) s.btnValue = 0;
          if (s.showKnobs === undefined) {
            s.showKnobs = true;
          }
          return s;
        });
      }
      if (Array.isArray(data.knobs) && data.knobs.length === NUM_KNOBS) {
        state.knobs = data.knobs.map((k, i) => {
          if (k.btnCc === undefined) k.btnCc = 70 + i;
          if (k.btnValue === undefined) k.btnValue = 0;
          return k;
        });
      }
    }
  } catch (e) {
    console.warn("Config inválida, usando padrão:", e);
  }
  return state;
}
