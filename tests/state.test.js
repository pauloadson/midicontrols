import { clampCC } from '../renderer/state.js';

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
    clear: () => { store = {}; }
  };
})();
global.localStorage = localStorageMock;

describe('State Logic', () => {
  test('clampCC should limit values between 0 and 127', () => {
    expect(clampCC(150)).toBe(127);
    expect(clampCC(-10)).toBe(0);
    expect(clampCC(64)).toBe(64);
    expect(clampCC('50')).toBe(50);
    expect(clampCC('abc')).toBe(0);
  });
});
