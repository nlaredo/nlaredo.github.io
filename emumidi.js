/* emumidi.js - AudioWorkletProcessor midi software synth engine
 * 
 * Copyright 2024 Nathan Laredo (laredo@gnu.org)
 *
 * This file may be freely distributed under the terms of
 * the GNU General Public Licence (GPL).
 */

/* prefixes */

const MIDI_NOTEOFF          = 0x80;
const MIDI_NOTEON           = 0x90;
const MIDI_KEY_PRESSURE     = 0xa0;
const MIDI_CTL_CHANGE       = 0xb0;
const MIDI_PGM_CHANGE       = 0xc0;
const MIDI_CHN_PRESSURE     = 0xd0;
const MIDI_PITCH_BEND       = 0xe0;
const MIDI_SYSTEM_PREFIX    = 0xf0;

/* controllers */

const CTL_BANK_SELECT       = 0x00;  /* not reset on "reset all controllers" */
const CTL_MODWHEEL          = 0x01;  /* 0(default)-127(max) modulation */
const CTL_BREATH            = 0x02;
const CTL_LFO_RATE          = 0x03;  /* minimoog: adjust LFO frequency */
const CTL_FOOT              = 0x04;
const CTL_PORTAMENTO_TIME   = 0x05;
const CTL_DATA_ENTRY        = 0x06;
const CTL_MAIN_VOLUME       = 0x07;  /* not reset on "reset all controllers" */
const CTL_BALANCE           = 0x08;
const CTL_PAN               = 0x0a;  /* 0(l)-127(r); default=64 (not reset) */
const CTL_EXPRESSION        = 0x0b;  /* channel 0(0%) - 16384(100%; default) */
const CTL_MOTIONAL_CTL1     = 0x0c;  /* roland integra 7; Part L-R param */
const CTL_MOTIONAL_CTL2     = 0x0d;  /* roland integra 7; Part F-B param */
const CTL_MOTIONAL_CTL3     = 0x0e;  /* roland integra 7; Part ambience level */
const CTL_GENERAL_PURPOSE1  = 0x10;
const CTL_TONE_MODIFY1      = 0x10;  /* roland name */
const CTL_GENERAL_PURPOSE2  = 0x11;
const CTL_TONE_MODIFY2      = 0x11;  /* roland name */
const CTL_GENERAL_PURPOSE3  = 0x12;
const CTL_GENERAL_PURPOSE4  = 0x13;
const CTL_MOTIONAL_EXT1     = 0x1c;  /* roland integra 7; PartEx L-R param */
const CTL_MOTIONAL_EXT2     = 0x1d;  /* roland integra 7; PartEx F-B param */
const CTL_MOTIONAL_EXT3     = 0x1e;  /* roland integra 7; PartEx amb level */
const CTL_LSB               = 0x20;  /* above have LSB at (CTL_* + CTL_LSB) */
/* controllers #64 to #69 (0x40 to 0x45) are on/off switches. */
const CTL_DAMPER_PEDAL      = 0x40;  /* 0(default)-63 = off; 64 - 127 = on */
const CTL_SUSTAIN           = 0x40;
const CTL_HOLD              = 0x40;  /* 0-63 = off(default); 64-127 sustain */
const CTL_HOLD1             = 0x40;
const CTL_PORTAMENTO        = 0x41;  /* 0(default)-63 = off; 64 - 127 = on */
const CTL_SOSTENUTO         = 0x42;  /* 0(default)-63 = off; 64 - 127 = on */
const CTL_SOFT_PEDAL        = 0x43;  /* 0(default)-63 = off; 64 - 127 = on */
const CTL_LEGATO            = 0x44;  /* 0(default)-63 = off; 64 - 127 = on */
const CTL_HOLD2             = 0x45;
/* controllers #70 - #79 are not reset on "reset all controllers" */
const CTL_SOUND_VARIATION   = 0x46;  /* RP-021: sound controller 1 */
const CTL_RESONANCE         = 0x47;  /* sc2: timbre/harmonic intensity */
const CTL_RELEASE_TIME      = 0x48;  /* RP-021: sound controller 3 */
const CTL_ATTACK_TIME       = 0x49;  /* RP-021: sound controller 4 */
const CTL_CUTOFF            = 0x4a;  /* RP-021: sound controller 5 */
const CTL_BRIGHTNESS        = 0x4a;  /* RP-021: sound controller 5 */
const CTL_DECAY_TIME        = 0x4b;  /* RP-021: sound controller 6 */
const CTL_VIBRATO_RATE      = 0x4c;  /* RP-021: sound controller 7 */
const CTL_VIBRATO_DEPTH     = 0x4d;  /* RP-021: sound controller 8 */
const CTL_VIBRATO_DELAY     = 0x4e;  /* RP-021: sound controller 9 */
const CTL_SOUND_CONTROLLER10= 0x4f;  /* MMA recommended practice RP-021 */
const CTL_GENERAL_PURPOSE5  = 0x50;
const CTL_TONE_VARIATION1   = 0x50;
const CTL_GENERAL_PURPOSE6  = 0x51;
const CTL_TONE_VARIATION2   = 0x51;
const CTL_GENERAL_PURPOSE7  = 0x52;
const CTL_TONE_VARIATION3   = 0x52;
const CTL_GENERAL_PURPOSE8  = 0x53;
const CTL_TONE_VARIATION4   = 0x53;
const CTL_PORTAMENTO_CTRL   = 0x54;
const CTL_VELOCITY_LSB      = 0x58;  /* MMA CA-031: high res velocity lsb */
/* controllers #91 - #95 are not reset on "reset all controllers" */
const CTL_REVERB_DEPTH      = 0x5b;  /* MMA RP-023 renamed */
const CTL_TREMOLO_DEPTH     = 0x5c;
const CTL_CHORUS_DEPTH      = 0x5d;  /* MMA RP-023 renamed */
const CTL_DETUNE_DEPTH      = 0x5e;
const CTL_CELESTE_DEPTH     = 0x5e;
const CTL_PHASER_DEPTH      = 0x5f;
const CTL_DATA_INCREMENT    = 0x60;
const CTL_DATA_DECREMENT    = 0x61;
const CTL_NRPN_LSB          = 0x62; /* default = 127 (null value) */
const CTL_NRPN_MSB          = 0x63; /* default = 127 (null value) */
const CTL_RPN_LSB           = 0x64; /* default = 127 (null value) */
const CTL_RPN_MSB           = 0x65; /* default = 127 (null value) */
/* controllers #120 - #127 are not reset on "reset all controllers" */
const CTL_ALL_SOUNDS_OFF    = 0x78;
const CTL_RESET_ALL_CONTROLLERS = 0x79; /* 3rd byte 0x00 */
const CTL_LOCAL             = 0x7a;  /* 0 = off; 127 = on */
const CTL_ALL_NOTES_OFF     = 0x7b;  /* 3rd byte 0x00 */
const CTL_OMNI_OFF          = 0x7c;  /* 3rd byte 0x00 */
const CTL_OMNI_ON           = 0x7d;  /* 3rd byte 0x00 */
const CTL_MONO              = 0x7e;  /* 3rd byte 0x00 - 0x10 (mono number) */
const CTL_POLY              = 0x7f;  /* 3rd byte 0x00 */

const POLYMAX = 64;
const NOTE_MAXLEN = Number.MAX_SAFE_INTEGER;
const ONE_OVER_PI = (1 / Math.PI);

let rate = 48000;   // will change at init to sampleRate
let waveform = 'square';
let debug = false;
function send(e){ console.error(e); }

let atune = 440.0;
let samplepos = 0;  // current position in the sample output

let elist = [];
let voice = [];     // active voices, end=0 = inactive
let channel = [];   // presently active channel state

// for volume normalization
let targetLUFS = 0.2;   // -14LUFS by default
let loudness = 0;       // avg loudness measurement
let finalgain = 1.0;
const loudnessseconds = 0.4;
let loudnesstimer = 0;

// 16 channels of tuning adjustments for 12 notes
let scaletune = new Array(16).fill(new Array(12).fill(1));
let scaleTuning = 100;  // cents per key (modified by sf2)

// convert a negative cB value to linear 0 - 1.0
function cB_to_linear(cB) {
  if (cB > 0.0)
    return 1.0;
  return Math.pow(10, cB / 200.0);
}

// convert a floating point note frequency to integer midi note number
function freq_to_note(freq) {
  let d = 69 + 12 * Math.log2(freq / atune);
  return Math.floor(d);
}

// convert a controller scaled cents value to frequency multiplier
function cents_to_freqmult(cents, num, den) {
  return Math.pow(2, num * (cents / 1200) / den);
}

// convert a midi note number to floating point frequency
function note_to_freq(note, ch) {
  let rnote = note;  // relative note to 100 cent scale
  if (scaleTuning > 100) {
    let rscale = 100 / scaleTuning;
    rnote = Math.floor(rscale * (note - 69) + 69.5);
  }
  let freq = Math.pow(2, (rnote - 69) * (scaleTuning / 1200)) * atune;
  freq *= scaletune[ch][note % 12];
  return freq;
}

// convert a midi pitchbend to a frequency multiplier
function pitchbend_to_freqmult(pitchbend, range) {
  if (range > 12) {  // roland ignores ranges larger than one octave
    range = 2;  // and seems to produce the default range instead
  }
  return Math.pow(2, (pitchbend - 8192) * (range / 12) / 8192);
}

// release existing voice playing same note on same channel, get new
function find_next_voice(ch, note) {
  let oldest = 0;
  let v = POLYMAX;
  for (let j = 0; j < POLYMAX; j++) {
    if (voice[j].ts < voice[oldest].ts) {
      oldest = j;
    }
    if (voice[j].ch == ch && voice[j].note == note &&
        voice[j].end == NOTE_MAXLEN) {
      voice[j].end = samplepos + voice[j].r;
      // TODO: SF2 samplemodes
    }
    if (voice[j].end < samplepos) {
      v = j;
    }
  }
  return (v < POLYMAX ? v : oldest);
}

function fill_audio(left, right, lfo, len) {
  try {
    let pmax = 0;  // max squared sample value per window
    for (let i = 0; i < len; i++) {
      while (elist.length > 0) {
        let todo = elist.shift(); // remove processed element
        let ts = todo.ts;
        let data = todo.data;
        let cmd = data[0];
        let ch = cmd & 0x0f;
        if ((cmd & 0xf0) == MIDI_NOTEON && !data[2])
          cmd = MIDI_NOTEOFF;
        switch (cmd & 0xf0) {
          case MIDI_NOTEOFF:
            for (let j = 0; j < POLYMAX; j++) {
              if (voice[j].ch == ch &&
                  voice[j].note == data[1] &&
                  voice[j].end == NOTE_MAXLEN) {
                if (channel[ch].ctl[CTL_SUSTAIN] >= 64) {
                  voice[j].sus = 1;
                  continue;
                }
                voice[j].end = samplepos + voice[j].r;
                // TODO: SF2 samplemodes
              }
            }
            break;
          case MIDI_NOTEON:
            let v = find_next_voice(ch, data[1]);
            if (v < POLYMAX) {
              voice[v].note = data[1];
              voice[v].f = note_to_freq(voice[v].note, ch);
              voice[v].i = 2 * Math.PI * voice[v].f / rate;
              voice[v].vel = data[2];
              voice[v].v = data[2] / 128.0;
              voice[v].t = 0.0;
              voice[v].a = cents_to_freqmult(-12000, 1, 1) * rate;
              voice[v].h = voice[v].a;
              voice[v].d = voice[v].a;
              voice[v].s = 1.0;
              voice[v].r = voice[v].a;
              voice[v].pan = channel[ch].ctl[CTL_PAN] / 127.0;
              voice[v].ch = ch;
              voice[v].ts = samplepos;
              voice[v].end = NOTE_MAXLEN;
              voice[v].inst = -1;
              voice[v].shdr = -1;
              if (0) {
                // TODO: SF2 handling
              } else {
                if (ch == 9) {
                  // kill percussion for non-sf2 voice
                  voice[v].end = 0;
                }
                // soften attack to 20ms
                voice[v].a = rate * 0.02;
                // longer release (62.5ms) since no sampled release
                voice[v].r = rate * 0.0625;
                // decay from max value to add interest
                voice[v].d = rate * 0.0625;
                // to a little under half volume
                voice[v].s = 0.4;
              }
            }
            break;
          case MIDI_KEY_PRESSURE:
            // TODO: find voice, do something with it
            break;
          case MIDI_CTL_CHANGE:
            channel[ch].ctl[data[1]] = data[2];
            if (data[1] == CTL_DATA_ENTRY) {
              if (channel[ch].ctl[CTL_RPN_LSB] == 0 &&
                  channel[ch].ctl[CTL_RPN_MSB] == 0) {
                channel[ch].bender_range = data[2];
              }
            }
            if (data[1] == CTL_MODWHEEL) {
              channel[ch].mod_mult =
                cents_to_freqmult(47, data[2], 127) - 1.0;
            }
            if (data[1] == CTL_SUSTAIN && data[2] < 64) {
              for (let j = 0; j < POLYMAX; j++) {
                if (voice[j].ch == ch && voice[j].sus) {
                  voice[j].sus = 0;
                  voice[j].end = samplepos + voice[j].r;
                  // TODO: handle SF2 samplemodes
                }
              }
            }
            break;
          case MIDI_PGM_CHANGE:
            channel[ch].program = data[1];
            break;
          case MIDI_CHN_PRESSURE:
            channel[ch].pressure = data[1];
            break;
          case MIDI_PITCH_BEND:
            channel[ch].bender = ((data[2] << 7) | data[1]);
            channel[ch].bender_mult =
              pitchbend_to_freqmult(channel[ch].bender,
                                    channel[ch].bender_range);
            break;
          case MIDI_SYSTEM_PREFIX:
            // for now do nothing
            break;
        }
      }
      left[i] = 0;
      right[i] = 0;
      let vmod = 1;
      for (let j = 0; j < POLYMAX; j++) {
        if (voice[j].end <= samplepos)
          continue; // voice no longer playing
        let tpos = samplepos - voice[j].ts; // samples since start
        let rpos = voice[j].end - samplepos;  // release pos
        let t = voice[j].t; // each voice has its own timebase
        if (tpos < voice[j].a) {
          vmod = tpos / voice[j].a; // attack phase
        } else if (tpos < voice[j].a + voice[j].h) {
          vmod = 1.0; // hold phase
        } else if (voice[j].d &&
                   tpos < voice[j].a + voice[j].h + voice[j].d) {
          // decay phase
          vmod = (tpos - (voice[j].a + voice[j].h)) / voice[j].d;
          vmod *= (1.0 - voice[j].s);
          vmod = 1.0 - vmod;
        } else {
          // sustain phase
          vmod = voice[j].s;
          if (vmod <= 0.00001) { // kill super quiet voices
            voice[j].end = 0;
            continue;
          }
        }
        if (rpos < voice[j].r) {
          // release phase, go from vmod down to zero, cubic decay
          let x = rpos / voice[j].r;
          vmod *= x * x * x;
        }
        let ch = voice[j].ch;
        let pgm = channel[ch].program;
        let sample = 0;
        vmod *= channel[ch].ctl[CTL_MAIN_VOLUME] / 127;
        vmod *= channel[ch].ctl[CTL_EXPRESSION] / 127;
        vmod *= voice[j].v;
        if (1) {
          // not using SF2, do math-based synthesis
          pgm = -pgm - 2;
          // keep timebase between 0 and 2*Pi
          if (t > 2 * Math.PI) {
            t -= 2 * Math.PI;
          }
          if (t < 0) {
            t += 2 * Math.PI;
          }
        } else {
          // TODO: handle SF2 sasmplemodes, startloop/endloop
        }
        if (pgm < 0) {
          // math based synthesis
          let tri = Math.abs(ONE_OVER_PI * (t - Math.PI)) - 1.0;
          let saw = ONE_OVER_PI * (t - Math.PI);
          let squ = (t > Math.PI ? -1 : 1);
          switch (waveform) {
            case 'si':
              sample = Math.sin(t);
              break;
            case 'sa':
              sample = saw;
              break;
            case 'tr':
              sample = tri;
              break
            default:
              sample = squ;
          }
        } else {
          // sample based synthesis
        }
        sample *= vmod;
        // handle active voices panned after playback started
        let dpan = channel[ch].ctl[CTL_PAN] / 127 - voice[j].pan;
        voice[j].pan += dpan / rate;  // smooth pan to target over 1s
        left[i] += sample * (1.0 - voice[j].pan);
        right[i] += sample * voice[j].pan;
        t += voice[j].i * channel[ch].bender_mult *
          (channel[ch].mod_mult * lfo[0][i] + 1.0);
        voice[j].t = t;
      }
      var lp = left[i] * left[i];
      var rp = right[i] * right[i];
      if (lp > pmax) {
        pmax = lp;
      }
      if (rp > pmax) {
        pmax = rp;
      }
      samplepos++;
    }
    // every 400ms start a new average
    loudnesstimer += len / rate;
    if (loudnesstimer > loudnessseconds) {
      loudness = Math.sqrt(pmax) * finalgain;
      loudnesstimer = 0;
    } else {
      loudness = 0.5 * (loudness + Math.sqrt(pmax) * finalgain);
    }
    // find gain to apply to hit targetLUFS based on running loudness
    let desiredgain = finalgain * targetLUFS / loudness;
    // apply some sanity limits to finalgain
    if (desiredgain > 1) {
      desiredgain = 1;
    }
    let deltagain = desiredgain - finalgain;
    deltagain /= 1024;  // match linux playmidi samplecount
    // apply gain correction over sample length above
    for (let i = 0; i < len; i++) {
      left[i] *= finalgain;
      right[i] *= finalgain;
      finalgain += deltagain;
    }
    return true;
  } catch (error) {
    send(error);
    return true;
  }
}
/**
 * Message based midi playback emulation.
 *
 * @class MessengerProcessor
 * @extends AudioWorkletProcessor
 */
class EmuMIDIProcessor extends AudioWorkletProcessor {
  constructor(...args) {
    super(...args);
    voice = [];
    for (let i = 0; i < POLYMAX; i++)
      voice.push({
        f:0,    // frequency
        i:0,    // value to add to timebase each sample
        v:0,    // velocity 0.0 - 1.0
        t:0,    // (time) sample position for this voice
        pan:0,  // 0.0 = left, 0.5 = center, 1.0 = right
        note:0, // midi note number being played
        vel:0,  // midi note velocity being played (0-127)
        ch:0,   // midi channel for this note (0-15)
        sus:0,  // note off is deferred by CTL_SUSTAIN
        exc:0,  // if >0, matching ch+exc terminates other notes
        end:0,  // sample position at note off + release
        ts:0,   // sample position at which note started
        // envelope
        a:0,    // attack in units of samples
        h:0,    // hold in units of samples
        d:0,    // decay in units of samples
        s:1,    // velocity at which to sustain note (0.0-1.0)
        r:0,    // release in units of samples
        // sf2 access tracking
        phdr:0, // index into phdr chunk
        pbag:0, pbag_max:0, // current and max index into pbag chunk
        pgen:0, pgen_max:0, // current and max index into pgen chunk
        pmod:0, pmod_max:0, // current and max index into pmod chunk
        inst:0, // current index into inst chunk
        ibag:0, ibag_max:0, // current and max index into ibag chunk
        igen:0, igen_max:0, // current and max index into igen chunk
        imod:0, igen_mod:0, // current and max index into imod chunk
        shdr:0, // current index into shdr chunk
        g:null, // sf2 generator sample data
      });
    channel = [];
    for (let i = 0; i < 16; i++) {
      channel.push({
        bender_mult:1, // value to multiply 'r' by for pitchbend
        mod_mult:0,    // how much LFO to apply to adjust 'r' for mod
        program:0,     // midi program (0-127) for channel
        bender:8192,   // midi pitch bend in effect (8192 = center)
        bender_range:2,  // pitchbend range in semitones, default = 2
        ctl:new Array(128).fill(0), // midi controller data values
        pressure:0,     // midi channel pressure, no effect (yet?)
      });
      channel[i].ctl[CTL_PAN] = Math.floor(Math.random() * 127);
      channel[i].ctl[CTL_EXPRESSION] = 127;
      channel[i].ctl[CTL_MAIN_VOLUME] = 127;
    }
    rate = sampleRate;
    // make it easier to post messages
    send = (e) => { this.port.postMessage(e) }
    waveform = 'square';
    this.port.onmessage = (e) => {
      let d = e.data;
      switch (d.constructor.name) {
        case 'Object':
          if (typeof(d["data"]) == 'object' &&
              d["data"].length > 0 && d["ts"] >= 0)
            elist.push(d);
          else
            send(d);
          break;
        case 'String':
          if (d == 'debug') {
            debug = true;
          } else {
            // only carea if the first two chars are right
            waveform = d.substring(0,2);
          }
          break;
        case 'Number':
          if (d > 415 && d < 467) {
            atune = d;
          }
          if (d > 9 && d < 400) {
            scaleTuning = d;
          }
          if (d < 0.0 && d >= -120.0) {  // target loudness (LUFS)
            targetLUFS = Math.pow(10, d / 20.0);
            send([loudness, finalgain]);
          }
          if (d == 0.0) {
            loudness = 0;
            loudnesstimer = 0;
            for (let i = 0; i < 16; i++) {
              scaletune[i].fill(1);
              channel[i].bender_mult = 1;
              channel[i].bender_range = 2;
              channel[i].bender = 8192;
              channel[i].ctl[CTL_PAN] = Math.floor(Math.random() * 127);
              channel[i].ctl[CTL_SUSTAIN] = 0;
              channel[i].ctl[CTL_EXPRESSION] = 127;
              channel[i].ctl[CTL_MAIN_VOLUME] = 127;
            }
            // stop all notes
            for (let i = 0; i < POLYMAX; i++) {
              voice[i].end = voice[i].ts = 0;
            }
          }
          break;
        default:
          send('unexpected:' + d.constructor.name);
      }
    }
    this.port.onmessageerror = (e) => {
      send(e);
    }
  }

  process(inputList, outputList, parameters) {
    if (!outputList.length)
      return;
    const output = outputList[0];
    const lfo = inputList[0];
    const channels = output.length;
    let left = output[0];
    let right = (channels > 1 ? output[1]: output[0]);
    let len = left.length;
    let res = fill_audio(left, right, lfo, len);
    return res;
  }
}

registerProcessor('emumidi-processor', EmuMIDIProcessor);
