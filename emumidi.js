/* global currentTime */

/**
 * Message based midi playback emulation.
 *
 * @class MessengerProcessor
 * @extends AudioWorkletProcessor
 */
class EmuMIDIProcessor extends AudioWorkletProcessor {
  constructor(...args) {
    super(...args);
    this.voices = [];
    for (let i = 0; i < 64; i++)
      this.voices.push({
        r:0,
        pos:0,
      });
    this.outputChannelCount = [2];
    this.port.onmessage = (e) => {
      let notes = e.data;
      for (let i = 0; i < 64; i++) {
        if (notes.length > i) {
          this.voices[i].r = 2 * Math.PI * notes[i] / sampleRate;
        } else {
          this.voices[i].r = 0;
        }
        if (!this.voices[i].r)
          this.voices[i].pos = 0;
      }
    }
    this.port.onmessageerror = (e) => {
      console.log(e);
    }
  }

  process(inputList, outputList, parameters) {
    if (!outputList.length)
      return;
    const output = outputList[0];
    const channels = output.length;
    const left = output[0];
    const right = (channels > 1 ? output[1]: output[0]);
    for (let t = 0, j = output[0].length; t < j; t++) {
      let sum = [0, 0];
      for (let i = 0; i < 64; i++) {
        let val = Math.sin(this.voices[i].pos);
        if (val > 0)
          val = 1;
        else val = 0;

        sum[i & 1] += val;
        this.voices[i].pos += this.voices[i].r;
      }
      sum[0] /= 8;
      sum[1] /= 8;
      right[t] = sum[0];
      left[t] = sum[1];
    }
    return true;
  }
}

registerProcessor('emumidi-processor', EmuMIDIProcessor);
