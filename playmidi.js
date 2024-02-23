var license = document.getElementById("license");
var canvas = document.getElementById("keyboard");
var config = document.getElementById("config");
var cfgform = document.forms['cfgform'];
var filequeue = document.getElementById("filequeue");
var transport = document.getElementById("transport");
var settempo = document.getElementById("tempo");
var prev = document.getElementById("prev");
var play = document.getElementById("play");
var next = document.getElementById("next");
var loop = document.getElementById("loop");
var sloop = document.getElementById("sloop");
var eloop = document.getElementById("eloop");
var taptempo = document.getElementById("tap");
var filename = document.getElementById("filename");
var filelist = [];
var smf = -1; // current index into above array
var tsnext = -1;  // timestamp (ms) next midifile event will play
var tsnow = -1;   // timestamp (ms) of current animation frame
var playing = false;  // is a midi file currently being played?
var ctx = canvas.getContext("2d");

var context=null;	// the Web Audio "context" object
var midiAccess=null;	// the MIDIAccess object.
var voice = [];         // tracking of synth voices
var lfo;                // for tracking synth LFO
var lfout;              // for drawing LFO data
var lfdata;
var fftout;             // for drawing FFT data
var fftdata;
var mastervol;          // master gain control
var moddepth = 50;      // mod depth range in cents (midi default 50 cents)
var modoff = 0;         // fractional note offset for visual modwheel
var attack=0.01;	// attack speed
var decay=0.05;	        // decay speed
var sustain=0.75;       // sustain level
var release=0.15;	// release speed
var mastertune=440;
var maxVoices=24;
var vMax = 1/2;         // max volume per voice
var soundon = false;
var hold1 = new Array(16).fill(false);      // cc64
var sostenuto = new Array(16).fill(false);  // cc66
var sostenutolist = new Array(16).fill([]); // track notes on per ch
var soft = new Array(16).fill(false);       // cc67
var vpan = new Array(16).fill(64);          // cc0a (pan)
var showoctaves = false;
var showflames = false;
var showfountain = false;
var showdebug = false;
var showconfig = true;
var showspect = false;
var showstats = false;
var waveform = 'square';

var notecounter;  // keep statistics per channel for visual stats
var counterbase;  // keep track of when statistics were started
function resetstats() {
  counterbase = 0; // start time for notes per second calculation
  notecounter = new Array(16).fill(0);  // per channel
}
resetstats();

var midiinputs = [{ id:null, name:'midi disabled', type:'error' }];
var midioutputs = [{ id:null, name:'midi disabled', type:'error' }];
var midiout = null;  // id of selected out device or null for none
var midiin = null;   // id of selected in device or null for none
var midictrl = null;   // id of selected in device or null for none
// a bunch of midi constants to avoid magic numbers...
var meta = {
  SEQUENCE_NUMBER:0x00,
  TEXT_EVENT:0x01,
  COPYRIGHT_NOTICE:0x02,
  SEQUENCE_NAME:0x03,
  INSTRUMENT_NAME:0x04,
  LYRIC:0x05,
  MARKER:0x06,
  CUE_POINT:0x07,
  PROGRAM_NAME:0x08,
  DEVICE_NAME:0x09,
  CHANNEL_PREFIX:0x20,
  END_OF_TRACK:0x2f,
  SET_TEMPO:0x51,
  SMPTE_OFFSET:0x54,
  TIME_SIGNATURE:0x58,
  KEY_SIGNATURE:0x59,
  SEQUENCER_SPECIFIC:0x74,
  META_EVENT:0xff, // prefixes all of the above in the midi file
  MIDI_HEADER: 0x4d546864, // "MThd"
  TRACK_HEADER: 0x4d54726b,  // "MTrk"
};
var midi_status = {
  NOTEOFF:0x80,
  NOTEON:0x90,
  KEY_PRESSURE:0xa0,
  CTL_CHANGE:0xb0,
  PGM_CHANGE:0xc0,
  CHN_PRESSURE:0xd0,
  PITCH_BEND:0xe0,
  SYSTEM_PREFIX:0xf0,
};
var midi_sys = {
  SYSTEM_EXCLUSIVE:0xf0,
  TIME_CODE_QF:0xf1,
  SONG_POSITION:0xf2,
  SONG_SELECT:0xf3,
  TUNE_REQUEST:0xf6,
  SYSEX_END:0xf7,
  TIMING_CLOCK:0xf8,
  START:0xfa,
  CONTINUNE:0xfb,
  STOP:0xfc,
  ACTIVE_SENSING:0xfe,
  RESET:0xff,
};
var midi_ctl = {
  BANK_SELECT:0x00,
  MODWHEEL:0x01,
  BREATH:0x02,
  LFO_RATE:0x03,
  FOOT:0x04,
  PORTAMENTO_TIME:0x05,
  DATA_ENTRY:0x06,
  MAIN_VOLUME:0x07,
  BALANCE:0x08,
  PAN:0x0a,
  EXPRESSION:0x0b,
  MOTIONAL_CTL1:0x0c,
  MOTIONAL_CTL2:0x0d,
  MOTIONAL_CTL3:0x0e,
  GEN_PURPOSE1:0x10,
  TONE_MODIFY1:0x10,
  GEN_PURPOSE2:0x11,
  TONE_MODIFY2:0x11,
  GEN_PURPOSE3:0x12,
  GEN_PURPOSE4:0x13,
  MOTIONAL_EXT1:0x1c,
  MOTIONAL_EXT2:0x1d,
  MOTIONAL_EXT3:0x1e,
  LSB:0x20,  // all above have LSB at above value + 0x20
  DAMPER_PEDAL:0x40,
  SUSTAIN:0x40,
  HOLD:0x40,
  HOLD1:0x40,
  PORTAMENTO:0x41,
  SOSTENUTO:0x42,
  SOFT_PEDAL:0x43,
  LEGATO:0x44,
  HOLD2:0x45,
  // controllers 70-79 are *not* reset on "reset all controllers"
  SOUND_VARIATION:0x46,
  RESONANCE:0x47,
  RELEASE_TIME:0x48,
  ATTACK_TIME:0x49,
  CUTOFF:0x4a,
  BRIGHTNESS:0x4a,
  DECAY_TIME:0x4b,
  VIBRATO_RATE:0x4c,
  VIBRATO_DEPTH:0x4d,
  VIBRATO_DELAY:0x4e,
  SOUND_CONTROLLER10:0x4f,
  GEN_PURPOSE5:0x50,
  TONE_VARIATION1:0x50,
  GEN_PURPOSE6:0x51,
  TONE_VARIATION2:0x51,
  GEN_PURPOSE7:0x52,
  TONE_VARIATION3:0x52,
  GEN_PURPOSE8:0x53,
  TONE_VARIATION4:0x53,
  PORTAMENTO_CTRL:0x54,
  VELOCITY_LSB:0x58,
  // controllers 91 - 95 are *not* reset on "reset all controllers"
  REVERB_DEPTH:0x5b,
  TREMOLO_DEPTH:0x5e,
  CELESTE_DEDPTH:0x5e,
  CHORUS_DEPTH:0x5f,
  DATA_INCREMENT:0x60,
  DATA_DECREMENT:0x61,
  NRPN_LSB:0x62,
  NRPN_MSB:0x63,
  RPN_LSB:0x64,
  RPN_MSB:0x65,
  ALL_SOUNDS_OFF:0x78,
  RESET_ALL_CONTROLLERS:0x79, // third byte 0
  LOCAL:0x7a,
  ALL_NOTES_OFF:0x7b,
  OMNI_OFF:0x7c,
  OMNI_ON:0x7d,
  MONO:0x7e,
  POLY:0x7f,
};

var midi_rpn = {
  PITCH_BEND_RANGE:0x00,  // mm = semitones, ll = cents, default=mm=2 
  // old: master fine is adjusted, new gm2: only channel fine is adjusted
  CHN_FINE_TUNE:0x01,  // -8192*50/8192 - 0 - +8192*50/8192 cent
  CHN_COARSE_TUNE:0x02,  // -48 - 0 - +48 semitones, ll = ignored
  TUNING_PGM_SEL:0x03,
  TUNING_BANK_SEL:0x04,
  MOD_DEPTH_RANGE:0x05,
  AZIMUTH_ANGLE:0x3d00,
  ELEVATION_ANGLE:0x3d01,
  GAIN:0x3d02,
  DISTANCE_RATIO:0x3d03,
  MAX_DISTANCE:0x3d04,
  GAIN_AT_MAX_DISTANCE:0x3d05,
  REF_DISTANCE_RATIO:0x3d06,
  PAN_SPREAD_ANGLE:0x3d07,
  ROLL_ANGLE:0x3d08,
  RPN_NULL:0x7f7f,
};

var midi_nrpn = {
  GS_VIBRATO_RATE:0x0108,  // -64 - 0(0x40) - +63 (relative)
  GS_VIBRATO_DEPTH:0x0109,  // -64 - 0(0x40) - +63 (relative)
  GS_VIBRATO_DELAY:0x010a,  // -64 - 0(0x40) - +63 (relative)
  // TVF = Time Variant Filter
  GS_TVF_CUTOFF_FREQ:0x0120,  // -64 - 0(0x40) - +63 (relative)
  GS_TVF_RESONANCE:0x0121,  // -64 - 0(0x40) - +63 (relative)
  // TVA = Time Variant Amplifier
  GS_TVFTVA_ATTACK:0x0163,  // -64 - 0(0x40) - +63 (relative)
  GS_TVFTVA_DECAY:0x0164,  // -64 - 0(0x40) - +63 (relative)
  GS_TVFTVA_RELEASE:0x0166,  // -64 - 0(0x40) - +63 (relative)
  GS_RHYTHM_PITCH_C:0x1800,  // 0x18rr rr = note number (abs)
  GS_RHYTHM_TVA_LVL:0x1a00,  // 0x1arr rr = note number (abs)
  // note: panpot -64 = "random", -63(L) - 0(Center) - +63(R)
  NRPN_GS_RHYTHM_PANPOT:0x1c00,  // 0x1crr rr = note number (abs)
  NRPN_GS_RHYTHM_REVERB:0x1d00,  // 0x1drr rr = note number (abs)
  NRPN_GS_RHYTHM_CHORUS:0x1e00,  // 0x1err rr = note number (abs)
  NRPN_NULL:0x7f7f,
};

var cmdlen = [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 2, 0];
var maxticks = Number.MAX_SAFE_INTEGER;
// for converting legacy dos characters to unicode
var cp437 = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7,
  0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5,
  0x00c9, 0x00e6, 0x00c6, 0x00f4, 0x00f6, 0x00f2, 0x00fb, 0x00f9,
  0x00ff, 0x00d6, 0x00dc, 0x00a2, 0x00a3, 0x00a5, 0x20a7, 0x0192,
  0x00e1, 0x00ed, 0x00f3, 0x00fa, 0x00f1, 0x00d1, 0x00aa, 0x00ba,
  0x00bf, 0xa9 /*0x2310*/,
                  0x00ac, 0x00bd, 0x00bc, 0x00a1, 0x00ab, 0x00bb,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
  0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b, 0x2510,
  0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x255e, 0x255f,
  0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256b,
  0x256a, 0x2518, 0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580,
  0x03b1, 0x00df, 0x0393, 0x03c0, 0x03a3, 0x03c3, 0x00b5, 0x03c4,
  0x03a6, 0x0398, 0x03a9, 0x03b4, 0x221e, 0x03c6, 0x03b5, 0x2229,
  0x2261, 0x00b1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00f7, 0x2248,
  0x00b0, 0x2219, 0x00b7, 0x221a, 0x207f, 0x00b2, 0x25a0, 0x00a0,
];
// make all the enum-like objects read-only
if (Object.freeze) {
  Object.freeze(meta);
  Object.freeze(midi_status);
  Object.freeze(midi_sys);
  Object.freeze(midi_ctl);
  Object.freeze(midi_rpn);
  Object.freeze(midi_nrpn);
  Object.freeze(cmdlen);
  Object.freeze(maxticks);
  Object.freeze(cp437);
}

var ccolor = [];
function hexrgb(r,g,b) {
  return "#" + ("0" + r.toString(16)).slice(-2) +
    ("0" + g.toString(16)).slice(-2) +
    ("0" + b.toString(16)).slice(-2);
}
// try to make 16 visually distinct colors, no black, no white
function makeccolor() {
  var c = 0;
  ccolor = [];
  // make default color table
  for (var i = 1; c < 16; i++) {
    if ((i & 7) == 0 || (i & 7) == 7)
      continue; // skip black and white
    var b3 = (i & 8) ? 63 : 0;
    var b4 = (i & 16) ? 127 : 0;
    var r = (i & 1) ? 255 - b4 : b3; 
    var g = (i & 2) ? 255 - b3 - b4 : (i & 16) ? 63 : 0;
    var b = (i & 4) ? 255 - b3 - b4 : (i & 16) ? 63 : 0;
    var color = hexrgb(r,g,b);
    ccolor.push(color);
    // update form color selector
    c++;
    cfgform["c" + c].value = color;
  }
}
makeccolor();
var touchchan = 1;
var mousechan = 2;
var keychan = 5;

var noteboxes = [];
var keyboxes = [];
var textlines = [];
var maxlines = 80;
var textscroll = 0;
var maxcols = 80;
var particles = [];
var maxparticles = 1000;
var psize = 3;
var gravity = 0.6;
var midilog = [];  // log for all generated/received events
var notefrac = new Array(16).fill(0); // tracking pitchbend
var bendmult = new Array(16).fill(1); // playing pitchbend
var bendup = 2;  // pitchbend range in semitones
var benddn = 2;  // pitchbend range in semitones
var keybed = 69.81818182; // 128 key full size midi keyboard in inches
var keydepth = 6; // depth in inches, always 6 for full size keys
var bkeydepth = 3.5; // black key depth in inches, 3.5 for full size keys
var keyscale = 0.0;  // allow resizing of keyboard, 0.0 = scale to 88
var keypan = 0;  // allow touch interface panning of the keyboard
var keyalpha = 1; // allow making the keys disappear for streaming
var keyshadow = false; // option to go crazy with context shadows
var kct = 128; // note: 68.818 inches for 128 keys, given 48 for 88
var bw;  // black key width in pixels
var kh;  // keyboard height in pixels
var bkh; // black key height in pixels
var dy;  // pixels to move up per animation frame
var th = 32;  // transport area height
var dw = canvas.width;  // drawing area height
var dh = canvas.height - th;  // drawing area width
var blackimg = null;
var whiteimg = null;
var noiseimg = null;
var fireimg1 = null;
var fireimg2 = null;

var whitekey = new Image();
var blackkey = new Image();
canvas.crossOrigin = null;
blackkey.crossOrigin = null;
whitekey.crossOrigin = null;
blackkey.onload = function () { blackimg = blackkey; };
blackkey.src = "images/blackkey.png";
whitekey.onload = function () { whiteimg = whitekey; };
whitekey.src = "images/whitekey.png";

resize();
initaudio();
function hexdump(a, offset, len) {
  if (!offset)
    offset = 0;
  if (len < 16 || !len)
    len = 128;
  var lines = [];
  var alen = (offset + len).toString(16).length;
  for (var row = 0; row < (len >> 4); row++) {
    var out = [];
    out.push(("0000000" + offset.toString(16)).slice(-alen) + ":");
    for (var i = 0; i < 16; i++) {
      out.push(" " + ("0" + a[offset + i].toString(16)).slice(-2));
    }
    out.push("   ");
    for (var i = 0; i < 16; i++) {
      out.push(a[offset + i] >= 32 ?
               String.fromCharCode(a[offset + i]) : ".");
    }
    lines.push(out.join(""));
    offset += 16;
  }
  console.log(lines.join("\n"));
  return offset;
}
function readVLC(f) {
  var val = 0;
  var c = 0;
  do {
    if (f.pos < f.size) {
      c = f.buf[f.pos++];
    }
    val |= (c & 0x7f);
    if (c & 0x80) {
      val <<= 7;
    }
  } while ((c & 0x80) && f.pos < f.size);
  return val;
}
function read32(f) {
  var val = 0;
  for (var i = 0; i < 4 && f.pos < f.size; i++) {
    val = (val << 8) | f.buf[f.pos++];
  }
  return val;
}
function read16(f) {
  var val = 0;
  for (var i = 0; i < 2 && f.pos < f.size; i++) {
    val = (val << 8) | f.buf[f.pos++];
  }
  return val;
}
function read8(f) {
  if (f.pos >= f.size)
    return 0;
  return f.buf[f.pos++];
}
function loadmidi(midifile) {
  this.index = filelist.length - 1;
  this.p = midifile.arrayBuffer().then(a => {
    var f = filelist[this.index];
    f.buf = new Uint8Array(a);
    var hdr = read32(f);
    if (hdr == meta.MIDI_HEADER) {
      var len = read32(f);
      f.type = read16(f);
      f.tracks = read16(f);
      f.division = read16(f);
      for (var i = 0; i < f.tracks; i++) {
        var thdr = read32(f);
        var tlen = read32(f);
        if (thdr == meta.TRACK_HEADER && tlen + f.pos <= f.size) {
          f.track.push({
            pos:0,  // byte offset processing track
            size:tlen,
            buf:f.buf.subarray(f.pos, f.pos + tlen),  // track events
            running_st:0, // last status byte read
            tick:0,  // next event tick in track
          });
          f.pos += tlen;
          // pre-load next tick position for each track
          f.track[i].tick = readVLC(f.track[i]);
        }
      }
      f.tracks = f.track.length; // limit in case of errors in file
    } else {
      f.tick = maxticks;
    }
    updatefilelist();
  });
}
function handlefiles(files) {
  var count = files.length;
  for (var i=0; i < count; i++) {
    filelist.push({
      buf:null,  // midi file contents
      name:files[i].name,
      type:-1,  // 0 = 1-track, 1 = multi-track, 2 = multi-1-track-songs
      tracks:0,  // number of tracks in file
      division:48,  // ticks per beat
      tempo:120,  // bpm = 60000 / milliseconds per quarter
      tempo_ms:500,  // tempo in milliseconds per quarter
      time_n:4, // time signature numerator
      time_d:4, // time signature denominator
      tick:0, // current tick position
      track:[], // per-track buffers and status
      pos:0,  // byte offset processing file
      size:files[i].size,
      fillbuf:null,
    });
    // for promise: need to do this one *after* array push
    filelist[filelist.length-1].fillbuf = new loadmidi(files[i]);
  }
}
function updatefilelist() {
  var newhtml = '<ol>';
  count = filelist.length;
  for (var i=0; i < count; i++) {
    var f = filelist[i];
    newhtml += '<li>' + f.name + ', ' + (f.type < 0 ? 'ignored' :
    ' type: ' + f.type + ', tracks: ' + f.tracks + ', division: ' +
    f.division) +
    '<span style="width:95px;float:right;text-align:right">' + f.size +
    '&nbsp;bytes</span></li>';
  }
  newhtml += '</ol>';
  filequeue.innerHTML = newhtml;
  if (count > 0)
    filename.value = "1. " + filelist[0].name;
}
function dragevent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (event.type == 'dragenter' || event.type == 'dragover') {
    canvas.classList.add('active');
    event.dataTransfer.dropEffect='copy';
  } else if (event.type == 'dragleave' || event.type == 'drop') {
    canvas.classList.remove('active');
    if (event.type == 'drop') {
      handlefiles(event.dataTransfer.files);
    }
  }
}
function addText(type, text) {
  var i, len = text.length;
  var s = text.substr(0,1);
  var f = text.substr(-1,1);
  // continue the line without following 3 starting characters
  if ((type == 1 || type == 5) && s != '\\' && s != '/' && s != '@') {
    for (i = 0; i < textlines.length; i++) {
      if (textlines[i].type == type &&
          textlines[i].text.length + len < maxcols) {
        textlines[i].text = textlines[i].text + text;
        if (f == '\n')
          textlines[i].type |= 0x80; // end current line
        return;
      }
    }
  }
  textlines.push({
    text:text,
    type:type,
  });
  if (textlines.length > maxlines) {
    textlines,shift();
  }
  // lock down previous lines of the same type
  // to not trigger appending more text to them
  for (i = 0; i < textlines.length  - 1; i++) {
    if (textlines[i].type == type)
      textlines[i].type |= 0x80;
  }
}
function handle_meta(t, e, d, f) {
  switch (e) {
    case meta.END_OF_TRACK:
      t.tick = maxticks;
      return;
    case meta.SET_TEMPO:
      f.tempo_ms = ((d[0] << 16) | (d[1] << 8) | d[2]) / 1000;
      f.tempo = (60000 / f.tempo_ms).toFixed(1);
      tempo.val = f.tempo;
      tempo.ms = tempo.avgms = f.tempo_ms;
      return;
    case meta.SEQUENCE_NUMBER:
    case meta.TEXT_EVENT:
    case meta.COPYRIGHT_NOTICE:
    case meta.SEQUENCE_NAME:
    case meta.INSTRUMENT_NAME:
    case meta.LYRIC:
    case meta.MARKER:
    case meta.CUE_POINT:
    case meta.PROGRAM_NAME:
    case meta.DEVICE_NAME:
      addText(e, d.map(x => String.fromCharCode(
                       x < 128 ? x : cp437[x - 128])).join(""));
      return;
    case meta.CHANNEL_PREFIX:
    case meta.SMPTE_OFFSET:
    case meta.TIME_SIGNATURE:
    case meta.KEY_SIGNATURE:
    case meta.SEQUENCER_SPECIFIC:
      console.log("meta 0x" + e.toString(16) + ": " + d);
  } 
}
function handle_midi(e, d) {
  var command = e & 0xf0;
  var channel = e & 0x0f;
  // don't send drums to the soft synth (yet?)
  if (soundon && channel == 9)
    return;
  switch (command) {
    case midi_status.CTL_CHANGE:
      switch(d[0]) {
        case midi_ctl.MODWHEEL:
          cc01(channel, d[1]);
          break;
        case midi_ctl.HOLD1:
          cc64(channel, d[1]);
          break;
        case midi_ctl.SOSTENUTO:
          cc66(channel, d[1]);
          break;
        case midi_ctl.SOFT_PEDAL:
          cc67(channel, d[1]);
          break;
        case midi_ctl.PAN:
          cc0a(channel, d[1]);
          break;
      }
      break;
    case midi_status.PITCH_BEND:
      pitchBend(channel, (d[1] << 7) | d[0]);
      break;

    case midi_status.NOTEON:
      if (d[1] != 0) {  // if velocity != 0, this is a note-on message
        noteOn(channel, d[0] + mt, d[1]);
        break;
      }
      // if velocity == 0, fall through to note off case
    case midi_status.NOTEOFF:
      noteOff(channel, d[0] + mt, d[1]);
      break;
  }
}
function playevents(f) {
  var i;
  var mintick = maxticks;
  // find track with the lowest delta tick count
  for (i = 0; i < f.tracks; i++) {
    if (f.track[i].pos >= f.track[i].size)
      f.track[i].tick = maxticks;
    if (f.track[i].tick < mintick)
      mintick = f.track[i].tick;
  }
  f.tick = mintick;
  if (mintick == maxticks) {
    // no remaining data in file
    nextMIDI();
    return;
  }
  // mark ms start of tick 0 in division
  tempo.first = tsnow - (f.tick % f.division) * f.tempo_ms / f.division;
  // handle all tracks with the same lowest delta tick count
  // lowest numbered track first
  do {
    for (i = 0; i < f.tracks; i++) {
      if (f.track[i].tick <= mintick) {
        var data = [];
        // get first event byte
        data.push(read8(f.track[i]));
        // if bit 7 is set, forward to running status
        if (data[0] & 0x80) {
          f.track[i].running_st = data[0];
          data.pop();
        }
        // if running status is 0xff, it's a meta event
        if (f.track[i].running_st == 0xff) {
          // make running status the meta event number
          // which will force read of VLC length
          f.track[i].running_st = read8(f.track[i]);
        }
        var len = cmdlen[f.track[i].running_st >> 4];
        if (len == 0) {
          // get the length of a meta event
          len = readVLC(f.track[i]);
        }
        // read the bytes of the event
        for (var d = data.length; d < len; d++) {
          data.push(read8(f.track[i]));
        }
        if (f.track[i].running_st < 0x80) {
          handle_meta(f.track[i], f.track[i].running_st, data, f);
        } else {
          handle_midi(f.track[i].running_st, data);
        }
        // setup next tick for track
        if (f.track[i].pos < f.track[i].size)
          f.track[i].tick += readVLC(f.track[i]);
        else
          f.track[i].tick = maxticks;
        break; // check from track 0 again for more at mintick
      }
    }
  } while (i < f.tracks);
  var dms = 0;  // calculate milliseconds to next nearest event
  // find track with the lowest delta tick count to schedule next
  mintick = maxticks;
  for (i = 0; i < f.tracks; i++) {
    if (f.track[i].tick < mintick)
      mintick = f.track[i].tick;
  }
  if (mintick == maxticks) {
    // no remaining data in file
    nextMIDI();
    return;
  }
  if (1 || f.division > 0) {
    dms = (mintick - f.tick) * f.tempo_ms / f.division;
  } else {
    // TODO: SMPTE timing
  }
  // wait for next event time if it's less than 40 secs, else squash
  if (dms < 40096)
    tsnext += dms;
}
var visible = true;
function vischange(e) {
  lasttime = document.timeline.currentTime;
  visible = (document.visibilityState === "visible");
  if (!visible) {
    stopAllNotes();
  } else {
    requestAnimationFrame(animate);
  }
}
function prepMIDI(f) {
  filename.value = (smf + 1) + ". " + f.name;
  play.value = 'Play';
  textlines = [];  // clear any text on screen
  if (f.tick > 0 && f.type >= 0) {
    // reset all internal positions to start of file
    f.tick = 0;
    f.tempo = 120;
    f.tempo_ms = 500;
    for (var i = 0; i < f.tracks; i++) {
      f.track[i].running_st = 0;
      f.track[i].pos = 0;
      f.track[i].tick = readVLC(f.track[i]);
    }
  }
  return f.type >= 0;
}
function prevMIDI() {
  tsnext = tsnow = 0;
  stopAllNotes();
  while (smf > 0) {
    if (prepMIDI(filelist[--smf]))
      break;
  }
  if (smf < 0) {
    playing = false;
    play.style.background="";
  }
}
function nextMIDI() {
  tsnext = tsnow = 0;
  stopAllNotes();
  while (smf + 1 < filelist.length) {
    if (prepMIDI(filelist[++smf]))
      break;
  }
  if (smf >= filelist.length) {
    playing = false;
    play.style.background="";
  }
}
function uibutton(e) {
  var now = Date.now();
  if (e.target == taptempo) {
    tempo.beats++;
    tempo.count++;
    if (now > tempo.last) {
      tempo.ms = now - tempo.last;
      tempo.avgms = (now - tempo.first) / tempo.count;
      if (Math.abs(tempo.ms - tempo.avgms) > 2) {
        tempo.count = 0;  // restart long running avg
        tempo.avgms = tempo.ms;
      }
      tempo.val = (60000 / tempo.avgms).toFixed(1);
    }
    if (tempo.count == 0)
      tempo.first = now;
    tempo.last = now;
  } else if (e.target == play) {
    playing = !playing;
    if (playing) {
      play.style.background="#ffd";
    } else {
      stopAllNotes();
      play.value = 'Play';
      play.style.background="";
      return;
    }
    if (smf < 0) {
      nextMIDI();
    }
  } else if (e.target == next) {
    nextMIDI();
  } else if (e.target == prev) {
    prevMIDI();
  }
}
function enableevents() {
  // register some event handlers
  window.addEventListener('visibilitychange', vischange, false);
  window.addEventListener('resize', resize, false);
  cfgform.addEventListener('submit', toggleconfig, false);
  var opt = {passive:false};
  window.addEventListener('keydown', keydown, opt);
  window.addEventListener('keyup', keyup, opt);
  window.addEventListener('contextmenu', mouseup, opt);
  canvas.addEventListener('mouseup', mouseup, opt);
  canvas.addEventListener('mousedown', mousedown, opt);
  canvas.addEventListener('mousemove', mousemove, opt);
  canvas.addEventListener('wheel', mousewheel, opt);
  canvas.addEventListener('touchstart', handletouch, opt);
  canvas.addEventListener('touchend', handletouch, opt);
  canvas.addEventListener('touchmove', handletouch, opt);
  canvas.addEventListener('touchcancel', handletouch, opt);
  prev.addEventListener('click', uibutton, opt);
  play.addEventListener('click', uibutton, opt);
  next.addEventListener('click', uibutton, opt);
  loop.addEventListener('click', uibutton, opt);
  sloop.addEventListener('click', uibutton, opt);
  eloop.addEventListener('click', uibutton, opt);
  taptempo.addEventListener('click', uibutton, opt);
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(
    function(e) { window.addEventListener(e, dragevent, false); });
  // enable midi events
  if (navigator.requestMIDIAccess)
    navigator.requestMIDIAccess().then(gotMIDI, deniedMIDI);
}
// start animation behind menu
requestAnimationFrame(animate);
enableevents();
function failaudio() { soundon = false; }
function startaudio() {
  setSound(cfgform.soundon.checked);
  if (lfo.start < 0) {
    lfo.osc.start();
    lfo.start = 0;
  }
}
function toggleconfig(event) {
  // prevent form submit
  if (event) event.preventDefault();
  if (context.state == 'suspended') {
    if (event.type == 'submit' || event.type == 'contextmenu' ||
      event.type == 'mouseup' || event.type == 'touchend') {
      // resume audio context on "activation" interaction
      context.resume().then(startaudio,failaudio);
    } else
      return false; // prevent dismiss/submit
  }
  if (showconfig && !cfgform.checkValidity()) {
    cfgform.reportValidity();
    return false;  // prevent dismiss/submit
  }
  if (showconfig) {
    // validated form user is asking to dismiss
    setSound(cfgform.soundon.checked);
    waveform = cfgform.waveform.value;
    showdebug = cfgform.showdebug.checked;
    showoctaves = cfgform.showoctaves.checked;
    showstats = cfgform.showstats.checked;
    mastertune = cfgform.mastertune.value;
    moddepth = cfgform.moddepth.value;
    benddn = -cfgform.benddn.value;
    bendup = cfgform.bendup.value;
    touchchan = cfgform.touchchan.value - 1;
    mousechan = cfgform.mousechan.value - 1;
    keychan = cfgform.keychan.value - 1;
    keyalpha = cfgform.keyalpha.value;
    psize = cfgform.psize.value;
    maxparticles = cfgform.maxparticles.value;
    keyshadow = cfgform.keyshadow.checked;
    for (var i = 0; i < 15; i++) {
      ccolor[i] = cfgform["c"+(i+1)].value;
    }
    showfountain = cfgform.showfountain.checked;
    showflames = cfgform.showflames.checked;
    showspect = cfgform.showspect.checked;
    midiin = cfgform.midiin.value;
    midiout = cfgform.midiout.value;
    midictrl = cfgform.midictrl.value;
    if (showflames)
      resize();
  }
  showconfig = !showconfig;
  config.style.display = showconfig ? 'block' : 'none';
  license.style.display = 'none';
  return false;  // prevent form submit
}
function dbRatio(dB) {
  if (dB < 0)
    return Math.pow(10, dB / 20);
  return 1.0-Math.pow(10, -dB / 20);
}
function setSound(value) {
  if (soundon == value)
    return;
  soundon = value;
  if (soundon)
    return;
  for (var i = 0; i < maxVoices; i++) {
    if (voice[i].note >= 0) {
      voice[i].note = -1;
      voice[i].hold1 = false;
      voice[i].soft = false;
      voice[i].sostenuto = false;
      voice[i].env.gain.cancelScheduledValues(0);
      voice[i].env.gain.setTargetAtTime(0.0, 0, release);
    }
  }
  lfo.env.gain.value = 0;
}
function stopAllNotes() {
  // turn off all controllers with state
  hold1.fill(false);
  sostenuto.fill(false);
  sostenutolist.fill([]);
  soft.fill(false);
  bendmult.fill(1);
  notefrac.fill(0);
  // stop sounds
  setSound(false);
  setSound(cfgform.soundon.checked);
  // make noteboxes end, keys not look pressed
  for (var i = 0, j = noteboxes.length; i < j; i++)
    noteboxes[i].playing = false;
  for (var i = 0; i < kct; i++) {
    keyboxes[i].pressed = false;
  }
}
function findNote(note, channel) {
  for (i = 0; i < maxVoices; i++) {
    if (voice[i].note == note && voice[i].channel == channel)
      return i;
  }
  return 0;
}
var steal = 0;
function nextNote(note) {
  var reuse = -1;
  var oldest = -1;
  for (var i = 0; i < maxVoices; i++) {
    if (voice[i].note == note) {
      if (reuse < 0 ||
        (reuse >= 0 && voice[i].start < voice[reuse].start))
        reuse = i;  // prefer oldest reuse
    }
    if (voice[i].note < 0) {
      if (oldest < 0)
        oldest = i;
      if (voice[i].start < voice[oldest].start)
        oldest = i;
    }
  }
  // if oldest note is in use, prefer to reuse existing same note
  if (oldest < 0 && reuse >= 0)
    return reuse;
  if (oldest < 0) {  // no unused voice, none match current note
    oldest = steal;
    steal += 1;  // round-robin which voice is stolen
    steal %= maxVoices;
  }
  return oldest;
}
function noteFreq(note) {
  return mastertune * Math.pow(2,(note-69)/12);
}

function pitchBend(channel, value) {
  var bendrange = value < 8192 ? benddn : bendup;
  notefrac[channel] = bendrange * (value - 8192.0) / 8192.0;
  bendmult[channel] = Math.pow(2,
                        (bendrange / 12) * (value - 8192.0) / 8192.0);
  if (soundon) {
    // modify all the playing notes on the channel by the bend value
    for (var i = 0; i < maxVoices; i++) {
      if (voice[i].note >= 0 && voice[i].channel == channel) {
        voice[i].osc.frequency.setValueAtTime(voice[i].freq *
                bendmult[channel], 0);
      }
    }
  }
}
function stopDTMF(keyentry) {
  var v1 = keyentry.t1;
  var v2 = keyentry.t2;
  keyentry.t1 = keyentry.t2 = -1;
  [v1,v2].forEach(function(v) {
    if (v >= 0) {
      // immediate stop to tones
      voice[v].env.gain.cancelScheduledValues(0);
      voice[v].env.gain.setTargetAtTime(0.0, 0, 0.005);
      voice[v].note = -1;
    }
  });
}
function startDTMF(keyentry, plan) {
  var v = nextNote(256);
  var v1 = plan.r1;
  var v2 = plan.r2;
  voice[v].note = 256;
  voice[v].freq = plan.t1;
  voice[v].osc.type = 'sine';
  voice[v].osc.frequency.setValueAtTime(voice[v].freq, 0);
  voice[v].start = context.currentTime;
  voice[v].env.gain.cancelScheduledValues(0);
  voice[v].env.gain.setTargetAtTime(v1, 0, 0.005);
  voice[v].vpan.pan.setValueAtTime(0, context.currentTime);
  keyentry.t1 = v;
  v = nextNote();
  voice[v].note = 256;
  voice[v].freq = plan.t2;
  voice[v].osc.type = 'sine';
  voice[v].osc.frequency.setValueAtTime(voice[v].freq, 0);
  voice[v].start = context.currentTime;
  voice[v].env.gain.cancelScheduledValues(0);
  voice[v].env.gain.setTargetAtTime(v2, 0, 0.005);
  voice[v].vpan.pan.setValueAtTime(0, context.currentTime);
  keyentry.t2 = v;
}
function startNote(channel, note, velocity) {
  var i = nextNote(note);
  voice[i].note = note;
  voice[i].channel = channel;
  voice[i].freq = noteFreq(note);
  voice[i].hold1 = false;
  voice[i].sostenuto = false;
  voice[i].osc.frequency.setValueAtTime(voice[i].freq *
                                        bendmult[channel], 0);
  voice[i].osc.type = waveform;
  if (voice[i].start < 0)
    voice[i].osc.start();
  voice[i].start = context.currentTime;
  voice[i].env.gain.cancelScheduledValues(0);
  voice[i].env.gain.setTargetAtTime(vMax * (velocity/127), 0, attack);
  voice[i].env.gain.setTargetAtTime(vMax * (sustain * velocity/127),
    context.currentTime + attack, decay);
  // 9 to 3.3 seconds of sustain to decay to -60dB
  var sustime = 9 * Math.exp(-note/128);
  sustime = (sustime * 2) / 10;  // convert to time constant
  voice[i].env.gain.setTargetAtTime(0.001 / 127,
    context.currentTime + attack + decay, sustime); 
  voice[i].vpan.pan.setValueAtTime((vpan[channel]/64) - 1,
                                   context.currentTime);
}
function stopSustain(channel) {
  for (var i = 0; i < maxVoices; i++) {
    if (voice[i].channel != channel)
      continue;
    if ((voice[i].hold1 && !hold1[channel] && !voice[i].sostenuto) ||
       (voice[i].sostenuto && !sostenuto[channel])) {
      voice[i].sostenuto = false;
      voice[i].hold1 = false;
      voice[i].env.gain.cancelScheduledValues(0);
      voice[i].env.gain.setTargetAtTime(0.0, 0, release);
      voice[i].note = -1;
    }
  }
}
function stopNote(channel, note) {
  var i = findNote(note, channel);
  if (i >= 0) {
    voice[i].hold1 = hold1[channel];
    if (sostenuto[channel]) {
      voice[i].sostenuto = (sostenutolist[channel].indexOf(note) >= 0);
    }
    voice[i].note = -1;  // mark for early reuse even if sustained
    if (voice[i].hold1 || voice[i].sostenuto) {
      return;
    }
    voice[i].env.gain.cancelScheduledValues(0);
    voice[i].env.gain.setTargetAtTime(0.0, 0, release);
  }
}

function resize()
{
  if (canvas.width != innerWidth) {
    keyscale = 0; // force reset to 88 keys on window resize/rotate
  }
  // adjust to how browser reflows transport area
  th = transport.clientHeight;
  // make config always end 43 pixels above transport area (43+32=75)
  config.style.bottom = (th + 43) + 'px';
  dw = window.innerWidth;
  dh = window.innerHeight - th;
  canvas.width = dw;
  canvas.height = dh;
  makekeys();
  if (showflames) {
    var h = dh - kh - Math.round(2 * keyscale);
    noiseimg = new ImageData(dw, h);
    fireimg1 = new ImageData(dw, h);
    fireimg2 = new ImageData(dw, h);
    makenoiseimage();
  }
}

function makekeys()
{
  if (keyscale <= 0) {
    // on reload, set initial scale to show 88, set keypan to note 21
    keyscale = 128.0 / 88.0;
    keypan = -21 * dw * keyscale / 128;
  }
  var sw = dw * keyscale;
  var sh = dh * keyscale;
  var kw = sw / (kct * 7 / 12);  // white key width (px)

  bw = sw / kct;  // black key width in pixels
  kh = Math.round(keydepth * sw / keybed); // keyboard height (px)
  bkh = Math.round(bkeydepth * sw / keybed); // black height (px)
  dy =  dh / 256;  // move 1/256 window height per frame
  var wpos = 0;

  keyboxes = [];
  for (var i = 0; i < kct; i++) {
    var n = i % 12;
    var bk = (n == 1 || n == 3 || n == 6 || n == 8 || n == 10);
    var pnote = (i >= 21 && i <= 108); // is in standard piano range?
    var x = bk ? bw * i : wpos * kw;
    var y = dh - kh;
    var w = (bk ? bw : kw);
    var h =  (bk ? bkh : kh);
    var fill = (bk ? '#000' : '#fff');
    var pfill = ccolor[0]; // replaced with channel color later
    var gradient = ctx.createLinearGradient(x+keypan, y+kh/2,
        x+keypan+kw, y+kh/2-1);
    gradient.addColorStop(0, '#0008');
    gradient.addColorStop(0.25, '#0000');

    keyboxes.push({
      x: x,
      y: y,
      w: w,
      h: h,
      v: 0,
      note: i,
      pressed: false,
      sostenuto: false,
      isBlack: bk,
      fill: fill,
      held: false,
      ptime: 0,
      sfill: '#fff',
      pfill: pfill,
      grd: gradient,
      pnote: pnote,
    });
    wpos += bk ? 0 : 1;
  }
}

var mousenote = -1;
var touchnotes = [];

function getkey(x,y) {
  var note = -1;
  x -= keypan;

  // find which black key was pressed
  for (var i = 0, j = keyboxes.length; i < j && note < 0; i++) {
    if (!keyboxes[i].isBlack) // check only black key overlays first
      continue;
    if (x >= keyboxes[i].x &&
        x < keyboxes[i].x + keyboxes[i].w &&
        y >= keyboxes[i].y &&
        y < keyboxes[i].y + keyboxes[i].h) {
      note = keyboxes[i].note;
    }
  }
  // find which white key was pressed
  for (var i = 0, j = keyboxes.length; i < j && note < 0; i++) {
    if (keyboxes[i].isBlack) // already checked black keys
      continue;
    if (x >= keyboxes[i].x &&
        x < keyboxes[i].x + keyboxes[i].w &&
        y >= keyboxes[i].y &&
        y < keyboxes[i].y + keyboxes[i].h) {
      note = keyboxes[i].note;
    }
  }
  return note;
}

function mousemove(event) {
  event.preventDefault();
  if (mousenote >= 0) {
    var note = getkey(event.clientX, event.clientY);
    if (note == mousenote) {
      return;
    }
    if (mousenote >= 0) {
      noteOff(mousechan, mousenote, 64);
      mousenote = -1;
    }
    if (note >= 0) {
      noteOn(mousechan, note, 127);
      mousenote = note;
    }
  }
  // allow scrolling midi text with primary mouse drag
  if (event.buttons & 1) {
    textscroll += event.movementY;
  }
}

function mouseup(event) {
  event.preventDefault();
  if (event.type != 'contextmenu' && event.button == 2)
    return;  // squash this duplicated event
  if (event.clientY < 75 || event.type == 'contextmenu') {
    toggleconfig(event);
  }
  if (mousenote >= 0) {
    noteOff(mousechan, mousenote, 64);
    mousenote = -1;
  }
}
function mousedown(event) {
  event.preventDefault();
  var note;
  if (mousenote >= 0) {
    noteOff(mousechan, mousenote, 64);
    mousenote = -1;
  }
  // ignore if not in keyboard area
  if (event.y < dh - kh) {
    // todo: maybe trigger some pointer based effects in scrolly area
    return;
  }
  note = getkey(event.clientX, event.clientY);
  if (note >= 0) {
    noteOn(mousechan, note, 127);
    mousenote = note;
  }
}
function capkeyscale(scale, ypos)
{
  // cap scale at y position at ypos or 90% of window height
  ypos = Math.max(0.1 * dh, ypos);
  if (scale * kh > dh - ypos - 25) {
    scale = (dh - ypos - 25) / kh;
  }
  if (scale * keyscale < 1.0) {
    scale = 1.0 / keyscale;
  }
  return scale;
}
function updatekeypan(oldx, scale, x)
{
  keypan -= oldx;
  keypan *= scale;
  keypan += x;
  if (keypan < dw - 128 * bw * scale)
    keypan = dw - 128 * bw * scale;
  if (keypan > 0)
    keypan = 0;
}
function mousewheel(event) {
  event.preventDefault();
  var delta = event.deltaY;
  if (event.shiftKey) { // wheel + shift = pan left/right (deltaY)
    updatekeypan(0, 1.0, delta / keyscale);
    makekeys();
  } else { // wheel = touchpad pan up/down (deltaY)
    var scale = (kh + delta) / kh;
    // wheel + ctrlKey = touchpad pinch zoom (deltaY)
    if (event.ctrlKey) {
      scale = (delta < 0) ? 1.05 : 0.95;
    }
    var x = event.clientX;
    var pscale = scale;
    scale = capkeyscale(scale, 0);
    updatekeypan(x, scale, x);
    keyscale *= scale;
    makekeys();
  }
}

var oldx = -1;
var oldy = -1;
var olddist = -1;
var oldxc = -1;

function handletouch(event) {
  event.preventDefault();
  var notes = [];
  var count = event.touches.length;
  if (count == 1) {
    if (oldxc < 0 && event.touches[0].clientY < 75) {
      toggleconfig(event);
      return;
    }
    if (event.touches[0].clientY < dh - kh - 2) {
      // have a single touch above the kbd, track for 1 touch kbd panning
      var x = event.touches[0].clientX;
      var y = event.touches[0].clientY;
      if (oldx >= 0) {
        updatekeypan(oldx, 1.0, x);
        makekeys();
      }
      // allow scrolling midi text with primary mouse drag
      if (oldy >= 0) {
        textscroll += y - oldy;
      }
      oldx = x;
      oldy = y;
      return;
    }
  }
  oldx = oldy = -1;
  if (count == 2) {
    var kbd = dh - kh - 2;
    if (event.touches[0].clientY < kbd && event.touches[1].clientY < kbd) {
      // allow two touch keyboard scale and pan
      var x1 = event.touches[0].clientX;
      var y1 = event.touches[0].clientY;
      var x2 = event.touches[1].clientX;
      var y2 = event.touches[1].clientY;
      var d = Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));

      var ymax = Math.max(y1, y2);
      if (olddist >= 0) {
        var scale = d / olddist;
        scale = capkeyscale(scale, ymax - 25);
        // try to land touch over same relative place on keyboard
        updatekeypan(oldxc, scale, x2);

        keyscale *= scale;

        makekeys();
      }
      olddist = d;
      oldxc = x2;
      return;
    }
  }
  olddist = -1;
  oldxc = -1;
  for (var i = 0; i < count; i++) {
    var note = getkey(event.touches[i].clientX, event.touches[i].clientY);
    if (note >= 0) {
      var force = event.touches[i].force;
      if (force <= 0) // if unknown or undefined, define 0.5 default
        force = 0.5;
      notes.push(note);
      if (touchnotes.indexOf(note) < 0) {
        noteOn(touchchan, note, Math.round(force * 127));
        touchnotes.push(note);
      }
    }
  }
  // figure out if any touched notes went away or changed
  for (var i = touchnotes.length - 1; i >= 0; i--) {
    if (notes.indexOf(touchnotes[i]) < 0) {
      noteOff(touchchan, touchnotes[i], 64);
    }
  }
  touchnotes = [...notes];
}

var keyspressed = [];
var shiftpressed = false;
var keytranspose = 60;
var mt = 0;  // midi transpose (from javascript console)
// table of event.code mapping to octave note offset
// event.code names should be independent of keyboard layout
// see: https://w3c.github.io/uievents-code/#key-alphanumeric-writing-system
var keytable = [
  { c:'Space', n:-12, m:-1 },
  { c:'KeyA', n:0, m:-1 },
  { c:'IntlBackslash', n:-1, m:-1 },
  { c:'KeyZ', n:0, m:-1 },
  { c:'KeyS', n:1, m:-1 },
  { c:'KeyX', n:2, m:-1 },
  { c:'KeyD', n:3, m:-1 },
  { c:'KeyC', n:4, m:-1 },
  { c:'KeyF', n:5, m:-1 },
  { c:'KeyV', n:5, m:-1 },
  { c:'KeyG', n:6, m:-1 },
  { c:'KeyB', n:7, m:-1 },
  { c:'KeyH', n:8, m:-1 },
  { c:'KeyN', n:9, m:-1 },
  { c:'KeyJ', n:10, m:-1 },
  { c:'KeyM', n:11, m:-1 },
  { c:'KeyK', n:12, m:-1 },
  { c:'Comma', n:12, m:-1 },
  { c:'KeyL', n:13, m:-1 },
  { c:'Period', n:14, m:-1 },
  { c:'Semicolon', n:15, m:-1 },
  { c:'Slash', n:16, m:-1 },
  { c:'Quote', n:17, m:-1 },
  { c:'IntlRo', n:17, m:-1 },
  { c:'Backquote', n:10, m:-1 },
  { c:'Digit1', n:12, m:-1 },
  { c:'KeyQ', n:12, m:-1 },
  { c:'Digit2', n:13, m:-1 },
  { c:'KeyW', n:14, m:-1 },
  { c:'Digit3', n:15, m:-1 },
  { c:'KeyE', n:16, m:-1 },
  { c:'Digit4', n:17, m:-1 },
  { c:'KeyR', n:17, m:-1 },
  { c:'Digit5', n:18, m:-1 },
  { c:'KeyT', n:19, m:-1 },
  { c:'Digit6', n:20, m:-1 },
  { c:'KeyY', n:21, m:-1 },
  { c:'Digit7', n:22, m:-1 },
  { c:'KeyU', n:23, m:-1 },
  { c:'KeyI', n:24, m:-1 },
  { c:'Digit8', n:24, m:-1 },
  { c:'Digit9', n:25, m:-1 },
  { c:'KeyO', n:26, m:-1 },
  { c:'Digit0', n:27, m:-1 },
  { c:'KeyP', n:28, m:-1 },
  { c:'Minus', n:29, m:-1 },
  { c:'BracketLeft', n:29, m:-1 },
  { c:'Equal', n:30, m:-1 },
  { c:'IntlYen', n:32, m:-1 },
  { c:'BracketRight', n:31, m:-1 },
  { c:'Backslash', n:33, m:-1 },
  { c:'ArrowDown', n:-128, m:-1 },
  { c:'ArrowUp', n:128, m:-1 },
  { c:'ArrowLeft', n:-1, m:-1 },
  { c:'ArrowRight', n:1, m:-1 },
  { c:'ShiftLeft', n:-1, m:-1 },
  { c:'ShiftRight', n:1, m:-1 },
  // DMTF
  { c:'Numpad0', n:0, t1:-1, t2:-1 },
  { c:'Numpad1', n:1, t1:-1, t2:-1 },
  { c:'Numpad2', n:2, t1:-1, t2:-1 },
  { c:'Numpad3', n:3, t1:-1, t2:-1 },
  { c:'Numpad4', n:4, t1:-1, t2:-1 },
  { c:'Numpad5', n:5, t1:-1, t2:-1 },
  { c:'Numpad6', n:6, t1:-1, t2:-1 },
  { c:'Numpad7', n:7, t1:-1, t2:-1 },
  { c:'Numpad8', n:8, t1:-1, t2:-1 },
  { c:'Numpad9', n:9, t1:-1, t2:-1 },
  { c:'NumpadMultiply', n:10, t1:-1, t2:-1 }, //*
  { c:'NumpadDivide', n:11, t1:-1, t2:-1 },   //#
  { c:'NumpadSubtract', n:12, t1:-1, t2:-1 }, //A
  { c:'NumpadAdd', n:13, t1:-1, t2:-1 },      //B
  { c:'NumpadEnter', n:14, t1:-1, t2:-1 },    //C
  { c:'NumpadDecimal', n:15, t1:-1, t2:-1 },  //D
  { c:'PageDown', n:16, t1:-1, t2:-1 },  //north america dialtone
  { c:'PageUp', n:17, t1:-1, t2:-1 },  //north america ringback
  { c:'Delete', n:18, t1:-1, t2:-1 },  //north america busy
];

var rMF = dbRatio(-7);
var ss5 = [
  { t1:1300,t2:1500, n:"MF0", r1:rMF, r2:rMF },
  { t1:700,t2:900, n:"MF1", r1:rMF, r2:rMF },
  { t1:700,t2:1100, n:"MF2", r1:rMF, r2:rMF },
  { t1:900,t2:1100, n:"MF3", r1:rMF, r2:rMF },
  { t1:700,t2:1300, n:"MF4", r1:rMF, r2:rMF },
  { t1:900,t2:1300, n:"MF5", r1:rMF, r2:rMF },
  { t1:1100,t2:1300, n:"MF6", r1:rMF, r2:rMF },
  { t1:700,t2:1500, n:"MF7", r1:rMF, r2:rMF },
  { t1:900,t2:1500, n:"MF8", r1:rMF, r2:rMF }, 
  { t1:1100,t2:1500, n:"MF9", r1:rMF, r2:rMF },
  { t1:700,t2:1700, n:"ST3P", r1:rMF, r2:rMF },
  { t1:900,t2:1700, n:"STP", r1:rMF, r2:rMF }, 
  { t1:1100,t2:1700, n:"KP1", r1:rMF, r2:rMF },
  { t1:1300,t2:1700, n:"KP2", r1:rMF, r2:rMF },
  { t1:1500,t2:1700, n:"ST", r1:rMF, r2:rMF },
  { t1:2600,t2:2600, n:"2600", r1:dbRatio(-6), r2:dbRatio(-6) },
  { t1:2400,t2:2600, n:"2400+2600", r1:dbRatio(-6), r2:dbRatio(-6) },
  { t1:400,t2:450, n:"UK Ring", r1:dbRatio(-19), r2:dbRatio(-19) },
  { t1:2400,t2:2400, n:"2400", r1:dbRatio(-6), r2:dbRatio(-6) },
];

var rLow = dbRatio(-11);
var rHigh = dbRatio(-9);
var dtmf = [
  { t1:941,t2:1336, n:"0", r1:rLow, r2:rHigh },
  { t1:697,t2:1209, n:"1", r1:rLow, r2:rHigh },
  { t1:697,t2:1336, n:"2", r1:rLow, r2:rHigh },
  { t1:697,t2:1477, n:"3", r1:rLow, r2:rHigh },
  { t1:770,t2:1209, n:"4", r1:rLow, r2:rHigh },
  { t1:770,t2:1336, n:"5", r1:rLow, r2:rHigh },
  { t1:770,t2:1477, n:"6", r1:rLow, r2:rHigh },
  { t1:852,t2:1209, n:"7", r1:rLow, r2:rHigh },
  { t1:852,t2:1336, n:"8", r1:rLow, r2:rHigh },
  { t1:852,t2:1477, n:"9", r1:rLow, r2:rHigh },
  { t1:941,t2:1209, n:"*", r1:rLow, r2:rHigh },
  { t1:941,t2:1477, n:"#", r1:rLow, r2:rHigh },
  { t1:697,t2:1633, n:"A", r1:rLow, r2:rHigh },
  { t1:770,t2:1633, n:"B", r1:rLow, r2:rHigh },
  { t1:852,t2:1633, n:"C", r1:rLow, r2:rHigh },
  { t1:941,t2:1633, n:"D", r1:rLow, r2:rHigh },
  { t1:350,t2:440, n:"NA Dial", r1:dbRatio(-13), r2:dbRatio(-13) },
  { t1:480,t2:440, n:"NA Ring", r1:dbRatio(-19), r2:dbRatio(-19) },
  { t1:480,t2:620, n:"NA Busy", r1:dbRatio(-24), r2:dbRatio(-24) },
];

// return index of event.code in keytable, -1 if not found
function keyindex(code) {
  for (var i = 0, j = keytable.length; i < j; i++) {
    if (keytable[i].c == code)
      return i;
  }
  return -1;
}

function keydown(event) {
  if (event.code == 'F12') {
    return;  // allow F12 dev console access
  }
  if (showconfig) return;
  event.preventDefault();
  var i = keyindex(event.code);
  if (i < 0)
    return;
  if (event.code == 'ArrowLeft' || event.code == 'ArrowRight') {
    updatekeypan(bw * keytable[i].n, 1, 0);
    makekeys();
    return;
  }
  if (keyspressed.indexOf(i) < 0) {
    keyspressed.push(i);
  } else
    return; // key was already tracked as pressed
  var n = keytable[i].n;
  if (keytable[i].hasOwnProperty('t1')) {
    if (soundon) {
      var plan = shiftpressed ? ss5[n] : dtmf[n];
      startDTMF(keytable[i], plan);
    }
    return;
  }
  if (event.code == 'ShiftLeft' || event.code == 'ShiftRight') {
    shiftpressed = true;
    return;
  }
  if (n == -128) {
    keytranspose -= (shiftpressed ? 1 : 12);
    if (keytranspose < 0)
      keytranspose = 0;
    return;
  }
  if (n == 128) {
    keytranspose += (shiftpressed ? 1 : 12);
    if (keytranspose > 96)
      keytranspose = 96;
    return;
  }
  n = keytranspose + n;
  if (n < 0 || n > 127)
    return;
  keytable[i].m = n;  // mark midi note playing for key
  noteOn(keychan, n, 96);
}

function keyup(event) {
  if (event.code == 'F12') {
    return;  // allow F12 dev console access
  }
  if (event.code == 'Escape' || event.code == 'ContextMenu') {
    toggleconfig(event);
    return;
  }
  if (showconfig) return;
  event.preventDefault();
  if (event.code == 'ControlLeft') {
    cc67(keychan, soft[keychan] ? 0 : 127);
    return;
  }
  if (event.code == 'AltLeft') {
    cc66(keychan, sostenuto[keychan] ? 0 : 127);
    return;
  }
  if (event.code == 'ControlRight') {
    cc64(keychan, hold1[keychan] ? 0 : 127);
    return;
  }
  var i = keyindex(event.code);
  if (i < 0)
    return;
  var j = keyspressed.indexOf(i);
  if (j < 0)
    return;  // got key up for key not tracked as pressed
  keyspressed.splice(j, 1);  // remove key from list of keys pressed
  if (event.code == 'ShiftLeft' || event.code == 'ShiftRight') {
    shiftpressed = false;
    return;
  }
  if (keytable[i].hasOwnProperty('t1')) {
    if (soundon) {
      // kill active dtmf voices for key
      stopDTMF(keytable[i]);
    }
    return;
  }
  var n = keytable[i].m;
  keytable[i].m = -1; // no midi note playing for key
  if (n < 0 || n > 127)
    return;   // octave keys also fall out here
  noteOff(keychan, n, 64);
}

function initaudio(event) {
  // patch up prefixes
  window.AudioContext=window.AudioContext||window.webkitAudioContext;
  context = new AudioContext();

  lfo = {
    osc: context.createOscillator(),
    env: context.createGain(),
    freq: noteFreq(0),
    start: -1,
  }
  lfo.osc.frequency.value = lfo.freq;
  lfo.osc.type = 'triangle';
  lfo.env.gain.value = 0;
  lfo.osc.connect(lfo.env);
  lfout = context.createAnalyser();
  lfout.fftSize = 32;
  lfo.env.connect(lfout);
  lfdata = new Float32Array(lfout.frequencyBinCount);
  mastervol = context.createGain();
  mastervol.connect(context.destination);
  mastervol.gain.value = dbRatio(-10);
  fftout = context.createAnalyser();
  fftout.fftSize = 256;
  fftout.minDecibels = -96;
  fftout.maxDecibels = 0;
  fftout.smoothingTimeConstant = 0;
  fftdata = new Uint8Array(fftout.frequencyBinCount);
  mastervol.connect(fftout);
  for (i = 0; i < maxVoices; i++) {
    // set up the basic oscillator chain, muted to begin with.
    var oscillator = context.createOscillator();
    var envelope = context.createGain();
    var pan = context.createStereoPanner();
    oscillator.frequency.value = 0;
    oscillator.connect(envelope);
    lfo.env.connect(oscillator.detune);
    pan.connect(mastervol);
    envelope.connect(pan);
    envelope.gain.value = 0.0;  // Mute the sound
    voice.push({
      start: -1,
      note: -1,
      freq: 0,
      hold1: false,
      sostenuto: false,
      osc: oscillator,
      env: envelope,
      vpan: pan,
    });
  }
  // set default panning for each channel randomly
  for (i = 0; i < vpan.length; i++) {
    vpan[i] = Math.floor(Math.random() * 128);
    if (i == keychan || i == mousechan || i == touchchan) {
      // for default non-midi sources, prefer center-ish-random
      vpan[i] >>= 4;
      vpan[i] += 60;
    }
  }
}
function selectmidi() {
  cfgform.midiin.options.length = 0;
  cfgform.midiout.options.length = 0;
  cfgform.midictrl.options.length = 0;
  midiinputs.forEach(function(input) {
    if (midiin == null && input.id != 'none') {
      midiin = input.id;
    }
    var sel = (midiin == input.id);
    var csel = (midictrl == input.id);
    cfgform.midiin.options.add(new Option(input.id + " - " +
      input.name, input.id, sel, sel));
    cfgform.midictrl.options.add(new Option(input.id + " - " +
      input.name, input.id, csel, csel));
  });
  midioutputs.forEach(function(output) {
    var sel = (midiout == output.id);
    cfgform.midiout.options.add(new Option(output.id + " - " +
      output.name, output.id, sel, sel));
  });
}
function connectMIDI() {
  midiinputs = [];
  midiinputs.push({ id:'none', name:'disabled', type:'input' });
  midiinputs.push({ id:'all', name:'enabled', type:'input' });
  midiAccess.inputs.forEach(function(input) {
    input.onmidimessage = midimessage;
    midiinputs.push({
      id: input.id,
      name: input.name,
      type: input.type,
    });
  });
  midioutputs = [];
  midioutputs.push({ id:'none', name:'disabled', type:'output' });
  midiAccess.outputs.forEach(function(output) {
    midioutputs.push({
      id: output.id,
      name: output.name,
      type: output.type,
      out: output,
    });
  });
  selectmidi();  // update possible midi selections
}
function gotMIDI(midi) {
  midiAccess = midi;
  connectMIDI();
  midiAccess.onstatechange=connectMIDI;
}
function deniedMIDI(err) {
  midiout = midiin = midictrl = null;
}
var tempo = {
  val:120,
  first:0,
  last:0,
  avgms:500,
  ms:500,
  count:0,
  beats:0,
}
function midimessage(event) {
  if (midiin != 'all' && event.target.id != midiin)
    return;  // if user selected a device, ignore all the rest
  var now = Math.floor(event.timeStamp);  // no data in fractional part
  midilog.push({ data:event.data, src:event.target.id, time:now,
  });  // how big can this grow?
  var channel = event.data[0] & 0x0f;
  switch (event.data[0] & 0xf0) {
    case midi_status.SYSTEM_PREFIX:
      if (event.data[0] == midi_sys.START) {
        tempo.beats = 0;
      }
      if (event.data[0] == midi_sys.TIMING_CLOCK) {
        if  (tempo.beats % 24 < 12) {
          taptempo.style.background="#ff0";
        } else {
          taptempo.style.background="";
        }
        tempo.beats++;
        tempo.count++;
        if (now > tempo.last) {
          tempo.ms = now - tempo.last;
          tempo.avgms = (now - tempo.first) / tempo.count;
          if (Math.abs(tempo.ms - tempo.avgms) > 2) {
            tempo.count = 0;  // restart long running avg
            tempo.avgms = tempo.ms;
          }
          tempo.val = (2500 / tempo.avgms).toFixed(1);
        }
        if (tempo.count == 0)
          tempo.first = now;
        tempo.last = now;
      }
      break;
    case midi_status.CTL_CHANGE:
      switch(event.data[1]) {
        case midi_ctl.MODWHEEL:
          cc01(channel, event.data[2]);
          break;
        case midi_ctl.HOLD1:
          cc64(channel, event.data[2]);
          break;
        case midi_ctl.SOSTENUTO:
          cc66(channel, event.data[2]);
          break;
        case midi_ctl.SOFT_PEDAL:
          cc67(channel, event.data[2]);
          break;
      }
      break;
    case midi_status.PITCH_BEND:
      pitchBend(channel, (event.data[2] << 7) | event.data[1]);
      break;
    case midi_status.NOTEON:
      if (event.data[2]!=0) {  // if velocity != 0, this is a note-on message
        noteOn(channel, event.data[1], event.data[2]);
        break;
      }
      // if velocity == 0, fall through to note off case
    case midi_status.NOTEOFF:
      noteOff(channel, event.data[1]);
      break;
  }
}
function cc01(channel, value) {
  var modwheel = value / 127;
  // do this whether or not sound is on for modulation rendering
  lfo.env.gain.value = moddepth * modwheel;
}
function cc64(channel, value) {
  hold1[channel] = (value >= 64);
  if (!hold1[channel]) {
    for (var i = 0; i < kct; i++)
      keyboxes[i].held = false;
    if (soundon) {
      // kill all the playing notes that got noteoff already
      stopSustain(channel);
    }
  }
}
function cc66(channel, value) {
  sostenuto = (value >= 64);
  if (sostenuto) {
    // record notes currently on
    sostenutolist[channel] = [];
    for (var i = 0; i < kct; i++) {
      if (keyboxes[i].pressed && keyboxes[i].channel == channel)
        sostenutolist[channel].push(i);
    }

  } else {
    for (var i = 0; i < kct; i++) {
      if (keyboxes[i].channel == channel)
        keyboxes[i].sostenuto = false;
    }
    if (soundon)
      stopSustain(channel);
  }
}
function cc67(channel, value) {
  soft[channel] = (value >= 64);
}
function cc0a(channel, value) {
  // 64 = center, 0 is hard left, 127 is hard right
  vpan[channel] = value;
  if (soundon) {
    for (var i = 0; i < maxVoices; i++) {
      if (voice[i].channel == channel)
        voice[i].vpan.pan.setValueAtTime((vpan[channel]/64) - 1,
                                         context.currentTime);
    }
  }
}
function noteOn(channel, noteNumber, velocity) {
  if (soft[channel])
    velocity /= 3.0;
  noteboxes.push(new NoteBox(channel, noteNumber, velocity));
  if (noteNumber < kct) {
    keyboxes[noteNumber].v = velocity;
    keyboxes[noteNumber].ptime = context.currentTime;
    keyboxes[noteNumber].pressed = true;
    keyboxes[noteNumber].pfill = ccolor[channel] + '55';
    keyboxes[noteNumber].sfill = ccolor[channel];
  }
  notecounter[channel] += 1;
  if (counterbase <= 0) {  // baseline after reset on first midi note
    counterbase = context.currentTime;
  }
  if (soundon) {
    startNote(channel, noteNumber, velocity);
  }
}
function noteOff(channel, noteNumber) {
  for (var i = 0, j = noteboxes.length; i < j; i++) {
    if (noteboxes[i].n == noteNumber && noteboxes[i].channel == channel)
      noteboxes[i].playing = false;
  }
  if (noteNumber < kct) {
    keyboxes[noteNumber].pressed = false;
    keyboxes[noteNumber].held = hold1[channel];
    if (sostenuto) {
      keyboxes[noteNumber].sostenuto =
        (sostenutolist[channel].indexOf(noteNumber) >= 0);
    }
  }
  if (soundon) {
    stopNote(channel, noteNumber);
  }
}

// add a round rectangle function
ctx.roundRect = function(x,y,w,h,r) {
  if (r > h / 2)
    r = h / 2;
  if (r > w / 2)
    r = w / 2;
  var r2 = r;
  // square off tops and bottoms when they hit edges
  if ((1+dh-kh)-(y+h) < r) {
    r2 = (1+dh-kh)-(y+h);
    if (r2 < 1)
      r2 = 0;
  }
  if(y < r)
    r = y < 0 ? 0 : y;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);  // top
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r2); // right
  ctx.quadraticCurveTo(x + w, y + h, x + w - r2, y + h);
  ctx.lineTo(x + r2, y + h);  // bottom
  ctx.quadraticCurveTo(x, y + h, x, y + h - r2);
  ctx.lineTo(x, y + r); // left
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

var lasttime = 0;
var fps = 0;
var framerate = 1000.0 / 60.0;  // expected update 60fps

var npos = 0;

function updatefire() {
  var w = fireimg1.width;
  var h = fireimg1.height;

  noteseed();
  for (var y = h - 2; y > 2; y--) {
    for (var x = 1; x < w - 1; x++) {
      var offset = x * 4 + y * w * 4;
      var o1 = offset + 4;
      var o2 = offset - 4;
      var o3 = offset + w * 4;
      var o4 = offset - 2 * w * 4;

      var c = noiseimg.data[x * 4 + ((npos + y) % h) * w * 4];
      var p = (fireimg1.data[o1] + fireimg1.data[o2] +
        fireimg1.data[o3] + fireimg1.data[o4]) / 4;
      p -= c;

      if (p < 0)
        p = 0
      // write pixel value to buffer2 one pixel higher
      fireimg2.data[o4] = Math.round(p);
      fireimg2.data[o4+1] = p < 174 ? 0 : p * 174 / 255;
      fireimg2.data[o4+2] = p < 20 ? 0 : p * 20 / 255;
      fireimg2.data[o4+3] = p < 20 ? 0 : 255;
    }
  }
  npos += 1;
  npos %= h;
  fireimg1.data.set(fireimg2.data);
  ctx.putImageData(fireimg1, 0, 0);
}

var rseed = 0;
function msrandom() {
  rseed = rseed * 214013 + 2531011;
  rseed &= 0xffffffff;
  return (rseed >> 16) & 0x7fff;
}
function msrandomf() {
  rseed = rseed * 214013 + 2531011;
  rseed &= 0xffffffff;
  return ((rseed >> 16) & 0x7fff) / 0x7fff;
}

var PERLIN_YWRAPB = 4;
var PERLIN_YWRAP = 1 << PERLIN_YWRAPB;
var PERLIN_ZWRAPB = 8;
var PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB;
var PERLIN_SIZE = 4095;

var perlin_octaves = 4; // default to medium smooth
var perlin_amp_falloff = 0.5; // 50% reduction/octave

var scaled_cosine = function(i) {
  return 0.5 * (1.0 - Math.cos(i * Math.PI));
};

var perlin; // will be initialized lazily by noise() or noiseSeed()

var noise = function(x, y, z) {
  y = y || 0;
  z = z || 0;

  if (perlin == null) {
    perlin = new Array(PERLIN_SIZE + 1);
    for (var i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = msrandomf();
    }
  }

  if (x < 0) {
    x = -x;
  }
  if (y < 0) {
    y = -y;
  }
  if (z < 0) {
    z = -z;
  }

  var xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  var xf = x - xi;
  var yf = y - yi;
  var zf = z - zi;
  var rxf, ryf;

  var r = 0;
  var ampl = 0.5;

  var n1, n2, n3;

  for (var o = 0; o < perlin_octaves; o++) {
    var of = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB);

    rxf = scaled_cosine(xf);
    ryf = scaled_cosine(yf);

    n1 = perlin[of & PERLIN_SIZE];
    n1 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n1);
    n2 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE];
    n2 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2);
    n1 += ryf * (n2 - n1);

    of += PERLIN_ZWRAP;
    n2 = perlin[of & PERLIN_SIZE];
    n2 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n2);
    n3 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE];
    n3 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3);
    n2 += ryf * (n3 - n2);

    n1 += scaled_cosine(zf) * (n2 - n1);

    r += n1 * ampl;
    ampl *= perlin_amp_falloff;
    xi <<= 1;
    xf *= 2;
    yi <<= 1;
    yf *= 2;
    zi <<= 1;
    zf *= 2;

    if (xf >= 1.0) {
      xi++;
      xf--;
    }
    if (yf >= 1.0) {
      yi++;
      yf--;
    }
    if (zf >= 1.0) {
      zi++;
      zf--;
    }
  }
  return r;
};
var noiseDetail = function(lod, falloff) {
  if (lod > 0) {
    perlin_octaves = lod;
  }
  if (falloff > 0) {
    perlin_amp_falloff = falloff;
  }
};

var noiseSeed = function(seed) {
  // Linear Congruential Generator
  // Variant of a Lehman Generator
  var lcg = (function() {
    // Set to values from http://en.wikipedia.org/wiki/Numerical_Recipes
    // m is basically chosen to be large (as it is the max period)
    // and for its relationships to a and c
    var m = 4294967296;
    // a - 1 should be divisible by m's prime factors
    var a = 1664525;
    // c and m should be co-prime
    var c = 1013904223;
    var seed, z;
    return {
      setSeed: function(val) {
        // pick a random seed if val is undefined or null
        // the >>> 0 casts the seed to an unsigned 32-bit integer
        z = seed = (val == null ? msrandomf() * m : val) >>> 0;
      },
      getSeed: function() {
        return seed;
      },
      rand: function() {
        // define the recurrence relationship
        z = (a * z + c) % m;
        // return a float in [0, 1)
        // if z = m then z / m = 0 therefore (z % m) / m < 1 always
        return z / m;
      }
    };
  })();

  lcg.setSeed(seed);
  perlin = new Array(PERLIN_SIZE + 1);
  for (var i = 0; i < PERLIN_SIZE + 1; i++) {
    perlin[i] = lcg.rand();
  }
};

function makenoiseimage() {
  var w = noiseimg.width;
  var h = noiseimg.height;

  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var offset = x * 4 + y * w * 4;
      v = noise(x * 15 / w, y * 15 / h) * 15;
      //var v = msrandom() & 0x0f;
      noiseimg.data[offset] = v;
    }
  }
}
function noteseed() {
  var w = fireimg1.width;
  var h = fireimg1.height;
  var seed = ctx.getImageData(0, 0, dw, dh - kh - 2);
  var offset = (h - h) * w * 4;
  for (var i = 0, j = seed.data.length; i < j; i += 4) {
    if (seed.data[i] > 0 || seed.data[i + 1] > 0 ||
      seed.data[i + 2] > 0) {
      fireimg1.data[offset + i] = 255;
      fireimg1.data[offset + i + 3] = 255;
    }
  }
}
function Dot(x, y, dx, dy, c) {
  this.x = x;
  this.y = y;
  this.dx = dx;
  this.dy = dy;
  this.c = c;
  this.update = function() {
    this.x += this.dx;
    this.y += this.dy;
    this.dy += gravity;
    if (this.y > dh - kh - 2) {
      this.dx = this.dy = 0;
    }
    ctx.fillStyle = this.c;
    ctx.fillRect(this.x, this.y, psize, psize);
  }
}
var splortstart = 0;
var splortmax = 0.125;
var sparktime = 0;
function drawspark(thiskey, ts) {
  var dt = ts - thiskey.ptime;
  var splorttime = ts - splortstart;
  if (splorttime > 4 && ts - sparktime > 0.125)
    splortstart = ts;
  sparktime = ts;
  if (dt > 6) {
    return;
  }
  var smod = (9 - dt) / 9;
  if (showflames)
    smod *= 0.75;
  var size = thiskey.w * smod;
  var x = keypan + thiskey.x + thiskey.w / 2;
  var y = thiskey.y+1;
  var rot = Math.PI/2;
  var points = Math.floor(msrandomf() * 5) + 20;
  var dangle = Math.PI / points;
  var vmod = Math.sqrt(thiskey.v) / 10;
  var fangle = Math.sin(thiskey.note * Math.PI/16 + ts*3) * Math.PI/8;
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  for (var i = 0; i <= points; i++) {
    var wiggle = i > 0 && i < points ?
      msrandomf() * dangle / 2 - dangle / 4 : 0;
    var dx = Math.sin(i * dangle + wiggle + rot);
    var dy = Math.cos(i * dangle + wiggle + rot);
    var r = msrandomf() * size/2 + size;
    var v = msrandomf() * 6 + 6;
    v *= smod;
    if (i & 1) {
      r *= 0.55;
    } else if (i > points / 2 - 5 && i < points / 2 + 5) {
      // for the five "middle" spark points, shoot particles
      v *= vmod;
      var c = v > 11.5 ? '#fff' : thiskey.sfill;
      if (splorttime < splortmax) {
        dx = Math.sin(2*rot+wiggle);
        dy = Math.cos(2*rot+wiggle);
        v += 16;
      } else if (showfountain) {
        dx = Math.sin(2*rot+fangle+wiggle);
        dy = Math.cos(2*rot+fangle+wiggle);
        v += 10;
      }
      var newx = x + r * dx;
      var newy = y + r * dy;
      particles.push(new Dot(newx, newy, v * dx, v * dy, c));
    }
    ctx.lineTo(x + r * dx, y + r * dy);
  }
  ctx.moveTo(x - size, y);
  ctx.closePath();
  ctx.strokeStyle = thiskey.sfill;
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.stroke();
}
function drawkeyboard() {
  if (keyshadow) {
    ctx.save();
    ctx.shadowColor = 'rgb(96,96,96,1)';
    ctx.shadowOffsetX = ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 7;
  }
  // draw white keys first
  ctx.strokeStyle = '#000';
  for (var i = 0, j = keyboxes.length; i < j; i++) {
    if (keyboxes[i].isBlack)
      continue;
    if (whiteimg != null) {
      koff = keyboxes[i].pressed ? 6 : 0;
      ctx.drawImage(whiteimg, 0, 0,
        whiteimg.naturalWidth, whiteimg.naturalHeight - koff,
        keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    } else {
      ctx.fillStyle = keyboxes[i].fill;
      ctx.beginPath();
      ctx.rect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
      ctx.fill();
      ctx.stroke();
    }
    if (!keyboxes[i].pnote) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    }
    if (keyboxes[i].pressed) {
      if (!shadow) {
        ctx.fillStyle = keyboxes[i].grd;
        ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
          keyboxes[i].w, keyboxes[i].h);
        shadow = true;
      }
      ctx.fillStyle = keyboxes[i].pfill;
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    } else {
        shadow = false;
    }
    if (bw > 5 && (i % 12) == 0) {
      // place note name centered on the bottom of every c
      var off = keyboxes[i].pressed ? 6 : 0;
      var oct = i / 12 - 1;
      var txt = 'C' + oct;
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.font = '10px sans-serif';
      var tw = ctx.measureText('C-1');  // scale size for largest
      var scale = keyboxes[i].w / tw.width;
      var px = Math.floor(10 * scale);
      ctx.font = px + 'px sans-serif';
      tw = ctx.measureText(txt);
      ctx.fillText(txt, keypan + keyboxes[i].x +
        keyboxes[i].w/2 - tw.width/2, keyboxes[i].y + 0.9 * kh + off);
      ctx.fill();
      ctx.restore()
    }
  }
  // draw black keys on top
  for (var i = 0, j = keyboxes.length; i < j; i++) {
    if (showoctaves && i % 12 == 0) {  // draw thin octave lines
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(keypan + keyboxes[i].x, keyboxes[i].y);
      ctx.lineTo(keypan + keyboxes[i].x, 0);
      ctx.stroke();
    }
    if (!keyboxes[i].isBlack)
      continue;
    if (blackimg != null) {
      koff = keyboxes[i].pressed ? 6 : 0;
      ctx.drawImage(blackimg, 0, 0,
        blackimg.naturalWidth, blackimg.naturalHeight - koff,
        keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    } else {
      ctx.fillStyle = keyboxes[i].fill;
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    }
    if (!keyboxes[i].pnote) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    }
    if (keyboxes[i].pressed) {
      ctx.fillStyle = 'rgba(255,255,255,0.33)';
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
      ctx.fillStyle = keyboxes[i].pfill;
      ctx.fillRect(keypan + keyboxes[i].x, keyboxes[i].y,
        keyboxes[i].w, keyboxes[i].h);
    }
  }
  if (keyshadow) {
    ctx.restore();
  }
}

function NoteBox(channel, noteNumber, velocity) {
  this.y = 0;
  this.h = 1;
  this.channel = channel;
  this.n = noteNumber;
  this.v = velocity;
  this.playing = true;
  this.pfill = ccolor[channel];

  this.update = function(dt) {
    var y = this.y;
    var h = this.h;
    var n = this.n;
    var v = this.v;
    var nf = (this.playing ? notefrac[channel] : 0);
    var mo = (this.playing ? modoff : 0);
    var x = keyboxes[n].x + keypan + bw * mo + bw * nf;

    this.y += dy * dt / framerate;
    if (this.playing == true) {
      this.h += dy * dt / framerate;
      if (this.h > dh - kh) {
        // clip tall notes to viewing area
        this.h = dh - kh;
        this.y = this.h;
      }
    }
    ctx.fillStyle = this.pfill + (88 + v).toString(16);
    ctx.strokeStyle = this.pfill + 'ff';
    ctx.roundRect(x, dh - kh - y, keyboxes[n].w, h, bw);
    ctx.fill();
    ctx.stroke();
  }
}

var fftcount = 0;
var ffthist = [];
var ffthistmax = 48;
function drawfft() {
  if (showflames) return;
  fftcount++;
  if ((fftcount & 1) == 0) {
    fftout.getByteFrequencyData(fftdata);
    ffthist.push(new Uint8Array(fftdata));
    if (ffthist.length > ffthistmax) {
      ffthist.splice(0, ffthist.length - ffthistmax);
    }
  }
  var len = fftout.frequencyBinCount;
  var histcount = ffthist.length;
  var yc = dh - kh - ffthistmax*2 - 2;
  for (var j = 0; j < histcount; j++) {
    for (var i = 0; i < len; i++) {
      var p = ffthist[j][i];
      if (!p) continue;
      ctx.fillStyle = 'hsl('+(180-p*360/255)+',100%,50%)';
      ctx.fillRect(i*2 + j, yc + j*2 - (fftcount&1), 2, -p/25.5);
    }
  }
}

ctx.font = '11px sans-serif';
var mindt = 100; // 100ms per frame min
function animate(timestamp) {
  var dt = timestamp - lasttime;
  lasttime = timestamp;
  // if window is not visible, don't update
  if (!visible)
    return;
  // if there was a gap in timing, squash it to zero
  if (dt > mindt)
    dt = 0;
  requestAnimationFrame(animate);
  if (playing) {
    tsnow += dt;
    play.value = (tsnow / 1000).toFixed(1);
    if (smf >= 0 && tsnext <= tsnow) {
      playevents(filelist[smf]);
    }
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // webkit is missing getFloatTimeDomainData, just use 0 if missing
  if (lfout && lfout.getFloatTimeDomainData != undefined) {
    lfout.getFloatTimeDomainData(lfdata);
    if (showspect) {
      drawfft();
    }
  }
  modoff = lfdata[0] / 100;
  // update particles
  for (var i = 0, j = particles.length; i < j; i++) {
    particles[i].update();
  }
  // delete particles that fall off screen
  for (var i = particles.length - 1; i >= 0; i--) {
    if (particles[i].y > dh - kh - 2) {
      particles.splice(i, 1);
    }
  }
  // delete particles if length grows too far
  if (particles.length > maxparticles) {
    particles.splice(0, particles.length - maxparticles);
  }
  if (keyalpha > 0)
    drawkeyboard();
  for (var i = 0, j = noteboxes.length; i < j; i++) {
    noteboxes[i].update(dt);
  }
  // delete noteboxes that scroll off screen
  for (var i = noteboxes.length - 1; i >= 0; i--) {
    if (noteboxes[i].y > dh + noteboxes[i].h) {
      noteboxes.splice(i, 1);
    }
  }
  ctx.beginPath();  // seems required to stop artifact
  // draw red line at the top of keys
  ctx.fillStyle = '#f00';
  ctx.fillRect(0, dh - kh - 2*keyscale, dw, 1+2*keyscale);

  // draw sparks for all notes pressed or held
  for (var i = 0; i < kct; i++) {
    if ((keyboxes[i].x + keyboxes[i].w + keypan < 0) ||
      (keyboxes[i].x + keypan > dw)) {
      continue;  // skip keys outside view
    }
    if (keyboxes[i].pressed || keyboxes[i].held ||
      keyboxes[i].sostenuto) {
      drawspark(keyboxes[i], context.currentTime);
    }
  }
  // draw fire on top of it all...
  if (showflames) {
    updatefire();
  }

  if (keyalpha <= 0) {
    //ctx.clearRect(0, canvas.height - kh, canvas.width, canvas.height);
  } else if (keyalpha < 1) { 
    ctx.fillStyle = 'rgba(0, 0, 119,'+(1-keyalpha)+')';
    ctx.fillRect(0, canvas.height - kh, canvas.width, canvas.height);
  }
  if (showdebug) {
    ctx.fillStyle = '#ffd';
    if (dt > 0) {
      var newfps = (1000/dt);
      if (fps <= 5)
        fps = newfps;  // seed moving average at startup
      // calculate weighted moving average fps
      fps = 0.98 * fps + 0.02 * newfps;
      ctx.fillText(Math.round(fps) +' fps', 30, 15);
    }
    var lines = 10;
    for (var i = 1, j = midilog.length; i < lines && j - i >= 0; i++) {
      var d = midilog[j-i].data;
      var s = midilog[j-i].src;
      var t = midilog[j-i].time;
      var y = 75 + 15 * (lines - i);
      var hexmidi = '';
      d.forEach(function(b) {
        hexmidi += ' ' + (b + 256).toString(16).substr(-2);
      });
      ctx.fillText(j-i + ': ' + s + ' ' +  t + ' ' + hexmidi, 30, y);
    }
  }
  if (showstats) {
    var dt = context.currentTime - counterbase;
    var xsplit = dw / 18;
    for (var i = 0; i < 16; i++) {
      if (notecounter[i] > 0) {
        ctx.fillStyle = ccolor[i];
        ctx.fillText(notecounter[i], xsplit * (i + 1), 30);
        ctx.fillText((notecounter[i] / dt).toFixed(2) + ' nps',
                xsplit * (i + 1), 45);
      }
    }
  }
  if (tempo.val > 10) {
    settempo.value = tempo.val;
    var tick = timestamp - tempo.first;
    if (playing) {
      if (filelist[smf].tempo != tempo.val) {
        filelist[smf].tempo_ms = 60000 / tempo.val;
        filelist[smf].tempo = tempo.val;
      }
      tick = tsnow - tempo.first;
    }
    if (1 & Math.floor(tick / (tempo.ms / 2)))
        taptempo.style.background="";
      else
        taptempo.style.background="#ffd";
  }
  ctx.save()
  ctx.font = '20px monospace';
  for (var i = textlines.length - 1; i > 0; i--) {
    var ty = dh - kh - 2 * keyscale - (textlines.length - i) * 20;
    ctx.fillStyle = ccolor[textlines[i].type & 15];
    ctx.fillText(textlines[i].text, 20, ty + textscroll);
  }
  ctx.restore()
  if (context.state == 'suspended') {
    ctx.fillStyle = '#fff';
    ctx.fillText('Audio context suspended: click or tap ' +
       'play (or here) to start...', 25, 65);
  }
};
