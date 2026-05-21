// O preload.js atua como uma ponte segura entre o processo Main e o Renderer.
// Por enquanto, não precisamos expor APIs específicas do Node para o Renderer,
// já que o Web MIDI API está disponível nativamente no Chromium do Electron.

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado no Electron');
});
