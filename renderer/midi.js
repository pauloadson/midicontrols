export class MidiManager {
  constructor(state, onStatusChange, onPortSelected) {
    this.state = state;
    this.onStatusChange = onStatusChange;
    this.onPortSelected = onPortSelected;
    this.midiAccess = null;
    this.output = null;
  }

  async init() {
    if (!navigator.requestMIDIAccess) {
      this.onStatusChange("err", "navegador sem Web MIDI — use Chrome ou Edge");
      return;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => this.refreshPorts();
      this.refreshPorts();
    } catch (e) {
      this.onStatusChange("err", "acesso MIDI negado");
      console.error(e);
    }
  }

  refreshPorts() {
    const outputs = this.midiAccess ? [...this.midiAccess.outputs.values()] : [];
    this.onPortSelected(outputs, this.state.portId);
  }

  selectPort(id) {
    this.output = this.midiAccess.outputs.get(id) || null;
    this.state.portId = this.output ? id : null;
    if (this.output) {
      this.onStatusChange("ok", "conectado: " + this.output.name);
    } else {
      this.onStatusChange("err", "porta indisponível");
    }
  }

  sendCC(cc, value) {
    if (!this.output) return;
    const status = 0xB0 | ((this.state.channel - 1) & 0x0F);
    this.output.send([status, cc & 0x7F, value & 0x7F]);
  }

  sendAll() {
    this.state.strips.forEach((s) => {
      this.sendCC(s.cc, s.value);
      if (s.knobs) {
        s.knobs.forEach((k) => this.sendCC(k.cc, k.value));
      }
    });
    this.state.knobs.forEach((k) => this.sendCC(k.cc, k.value));
  }
}
