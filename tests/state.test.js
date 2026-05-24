import { clampCC, loadState, STORAGE_KEY } from '../renderer/state.js';

// Mock do structuredClone que pode não estar disponível no Node.js antigo (Jest ambiente)
if (typeof structuredClone === 'undefined') {
  global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// Mock do localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('State Logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('clampCC should limit values between 0 and 127', () => {
    expect(clampCC(150)).toBe(127);
    expect(clampCC(-10)).toBe(0);
    expect(clampCC(64)).toBe(64);
    expect(clampCC('50')).toBe(50);
    expect(clampCC('abc')).toBe(0);
  });

  test('loadState should migrate old config adding knobs, showKnobs, buttons and globalDelay to strips', () => {
    const oldConfig = {
      channel: 2,
      strips: Array.from({ length: 8 }, (_, i) => ({
        label: "Old Fader " + (i + 1),
        cc: 20 + i,
        value: 50
      })),
      knobs: []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(oldConfig));

    const state = loadState();
    expect(state.channel).toBe(2);
    expect(state.globalDelay).toBeDefined();
    expect(state.globalDelay.enabled).toBe(false);
    expect(state.strips[0].label).toBe("Old Fader 1");
    expect(state.strips[0].knobs).toBeDefined();
    expect(state.strips[0].knobs.length).toBe(3);
    expect(state.strips[0].showKnobs).toBe(true);
    expect(state.strips[0].btnCc).toBe(60);
    expect(state.strips[0].btnValue).toBe(0);
    expect(state.knobs[0].btnCc).toBe(70);
  });
});
