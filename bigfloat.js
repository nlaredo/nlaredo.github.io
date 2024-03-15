// **** BigFloat arbitrary precision math: github.com/nlaredo
  const b64digits =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~_';
  class BigFloat {
    constructor(f, bits) {
      if (f instanceof BigFloat) {
        // fast case, copy a bigfloat to a new one
        // maybe with different precision in bits
        this.assign(f);
        this.bits = (bits ? bits : f.bits);
        if (this.bits != f.bits)
          this.normalize();
        return this;
      }
      const bias = 0x3ff;
      const expLen = 11;
      // start with clearly invalid values in case of failed parse
      this.sign = 1n;
      this.exponent = 0;
      this.mantissa = 0n;
      this.msb = 0;
      this.bits = bits;
      if (typeof(f) == "bigint") {
        this.sign = f < 0 ? -1n : 1n;
        this.exponent = 0;
        this.mantissa = this.sign * f;
      } else if (typeof(f) == "string") {
        return this.fromString(f);
      } else if (!isNaN(f)) {
        const buf = new ArrayBuffer(8);
        const f64 = new Float64Array(buf);
        const u32 = new Uint32Array(buf);
        const u8 = new Uint8Array(buf);
        u32[1] = 1;
        const upper = u8[4];
        const lower = 1 - upper;
        let expPos, signPos, fracLen = 52;
        fracLen &= 31; expPos = fracLen; signPos = expPos + expLen;
        f64[0] = f;
        const signbit = (u32[upper] >> signPos) & 1;
        this.exponent = ((u32[upper] >> expPos) &
                          ((1 << expLen) - 1));
        const fracLow = u32[lower];
        const fracHigh = u32[upper] & ((1 << fracLen) - 1);
        this.sign = BigInt(signbit ? -1 : 1);
        if (this.exponent == 0x7ff) {
          // NaN (zero mantissa) or Infinity (nonzero mantissa)
          this.exponent = 0;  // squash signal values (Float64 exponent)
        }
        if (!this.exponent && !fracHigh && !fracLow) {
          this.msb = 1;  // exact zero
        } else {
          // only set if not exact zero
          this.mantissa = (1n << 52n) + (BigInt(fracHigh) << 32n) +
                           BigInt(fracLow);
          this.exponent -= bias + 52;
          this.msb = 53;
        }
      }
      this.normalize();
      return this;
    }
    assign(f) {
      this.exponent = f.exponent;
      this.mantissa = f.mantissa;
      this.sign = f.sign;
      this.msb = f.msb;
    }
    findMSB(v) {
      let msb = 0;
      // assume BigInt optimized for right shift 64 bits
      for (let i = 2; i > 0; i--) {
        do {
          let last = v;
          v >>= BigInt(32 * i);
          if (v) {
            msb += 32 * i;
          } else {
            v = last;
            break;
          }
        } while(true);
      }
      // v is now < 32 bits
      return msb + 31 - Math.clz32(Number(v));
    }
    normalize(b) {
      if (b) this.bits = b;
      if (!this.mantissa) {
        this.msb = 0;
        return;
      }
      this.msb = this.findMSB(this.mantissa);
      if (this.bits > 0) {
        const fbits = this.msb - this.bits - 1;
        if (fbits > 0) {
          const bits = BigInt(fbits);
          this.msb -= fbits;
          this.exponent += fbits;
          const rbit = (1n << (bits - 1n)) & this.mantissa;
          this.mantissa >>= bits;
          this.mantissa += (rbit ? 1n : 0n);
        }
      }
      while (!(this.mantissa & 1n)) {
        this.mantissa >>= 1n;
        this.exponent++;
        this.msb--;
      }
      /* slower:
      // to reduce calculation size, make sure lsb = 1
      // search msb in mask of only least significant set bit
      let pos = this.findMSB(this.mantissa & -this.mantissa);
      this.mantissa >>= BigInt(pos);
      this.exponent += pos;
      this.msb -= pos;
      */
    }
    f52() {
      // return new BigFloat with mantissa compatible with 53-bit mantissa
      // and even exponent for using to create first guess with FPU
      const f52 = new BigFloat(this, 51);
      if (f52.exponent & 1) {
        // make sure lower bit of exponent is zero
        f52.mantissa <<= 1n;
        f52.exponent--;
        f52.msb++;
      }
      return f52;
    }
    unaryMinus() { this.sign = -this.sign; }
    exponentiate(y) { console.log("expontiate"); }
    multiply(b) {
      let bVal = b.mantissa;
      let bExp = b.exponent;
      if (this.msb + b.msb > this.bits) {
        // try to restrict result of multiply to desired bits
        let bits = this.bits >> 1;
        if (this.msb > bits) {
          let shift = this.msb - bits;
          this.mantissa >>=  BigInt(shift);
          this.exponent += shift;
        }
        if (b.msb > bits) {
          let shift = b.msb - bits;
          bVal >>=  BigInt(shift);
          bExp += shift;
        }
      }
      this.exponent += bExp;
      this.mantissa *= bVal;
      if (!this.mantissa) {
        this.exponent = 0;
        this.msb = 1;
      }
      this.sign *= b.sign;
      this.normalize();
    }
    divide(b) {
      if (!b.mantissa) {  // divide by zero
        this.exponent = 0;
        this.mantissa = 0n;
        this.msb = 0;
      } else {
        // calculate 64 bits of precision if not set in destination
        const bits = (this.bits ? this.bits : 64) + 5;
        const bExp = 2*bits + this.msb + b.msb;
        this.mantissa <<= BigInt(bExp);
        this.mantissa /= b.mantissa;
        this.exponent -= b.exponent + bExp;
        let oldbits = this.bits;
        this.bits = bits - 5;
        this.normalize();
        this.bits = oldbits;
      }
    }
    remainder(b) { console.log("remainder"); }
    add(b) {
      const expdiff = this.exponent - b.exponent;
      if (expdiff >= 0) {
        if (expdiff > b.bits) {
        }
        this.exponent -= expdiff;
        this.mantissa =
              this.sign * (this.mantissa << BigInt(expdiff)) +
              b.sign * b.mantissa;
      } else {
        this.mantissa =
              this.sign * this.mantissa +
              b.sign * (b.mantissa << BigInt(-expdiff));
      }
      if (this.mantissa < 0n) {
        this.sign = -1n;
        this.mantissa = -this.mantissa;
      } else {
        this.sign = 1n;
      }
      this.normalize();
    }
    compare(b) {
      // only compare mantissas if signs are identical
      if (this.sign != b.sign) { return (this.sign > b.sign ? 1 : -1); }
      const expdiff = this.exponent - b.exponent;
      let val;
      if (expdiff >= 0) {
        // only compare mantissas if exponents show overlap
        if (expdiff > b.bits || expdiff > b.msb) return 1;
        val = (this.mantissa << BigInt(expdiff)) - b.mantissa;
      } else {
        if (-expdiff > b.bits || -expdiff > b.msb) return -1;
        val = this.mantissa - (b.mantissa << BigInt(-expdiff));
      }
      if (!val) return 0;
      val *= this.sign;
      return val < 0n ? -1 : 1;
    }
    lessThan(b) { return (this.compare(b) < 0); }
    equal(b) { return (this.compare(b) == 0); }
    greaterThan(b) { return (this.compare(b) > 0); }
    sub(b) {
      b.unaryMinus();
        // only compare mantissas if exponents show overlap
      this.add(b);
      b.unaryMinus();
    }
    abs() { this.sign = 1n; }
    acosh() { console.log("acosh"); }
    asin() { console.log("asin"); }
    asinh() { console.log("asinh"); }
    atan() {
      const bits = (this.bits ? this.bits : 64);
      // series: atan(x) = x - x**3 / 3 + x**5 / 5 - x**7 / 7 + ...
      const m = this.sign;
      this.abs();
      let x = new BigFloat(this, bits + 5);
      let d = new BigFloat(1, bits);
      let f = new BigFloat(0, bits);
      let a = new BigFloat(0, bits);
      let two = new BigFloat(2, bits);
      let pt2 = new BigFloat("0.2", bits);
      // precondition x
      if (x.greaterThan(pt2)) {
        a = new BigFloat(pt2, bits);
        a.atan();
      }
      while (x.greaterThan(pt2)) {
        f.add(d); // f = f+1
        // x = (x - .2) * (1 + x * .2)
        let x1 = new BigFloat(x, bits);
        x1.multiply(pt2);
        x1.add(d); // +1
        x.sub(pt2);
        x.divide(x1);
      }
      // initialize the series
      let sum = new BigFloat(x, bits + 5);
      let xx = new BigFloat(x, bits);
      xx.sign = -xx.sign;
      xx.multiply(x);  // xx = -x * x
      while (true) {
        x.multiply(xx);
        d.add(two);
        let term = new BigFloat(x, bits);
        term.divide(d);
        sum.add(term);
        if (term.msb + term.exponent < -bits-2) {
          break;
        }
      };
      f.multiply(a);
      sum.add(f);
      sum.sign *= m;
      this.exponent = sum.exponent;
      this.mantissa = sum.mantissa;
      this.sign = sum.sign;
      this.normalize();
    }
    atan2(y) { console.log("atan2"); }
    atanh() { console.log("atanh"); }
    cbrt() { console.log("cbrt (cube root)"); }
    ciel() { console.log("ciel"); }
    cos() { console.log("cos"); }
    cosh() { console.log("cosh"); }
    exp() { console.log("exp"); }
    expm1() { console.log("expm1"); }
    floor() { console.log("floor"); }
    hypot() { console.log("hypot"); }
    log() { console.log("log"); }
    max(a,b) { console.log("max"); }
    min(a,b) { console.log("min"); }
    pow(y) { console.log("pow"); }
    round() { console.log("round"); }
    sign() { console.log("sign"); }
    sin() { console.log("sin"); }
    sinh() { console.log("sinh"); }
    reciprocal() {  // calculate 1/x
      a = new BigFloat(1, this.bits);
      a.divide(this);
      this.assign(a);
      return;

      /* slower
      const bits = this.bits ? this.bits : 64;
      const f52 = this.f52();
      let x = new BigFloat(1 / Number(f52.mantissa));
      x.exponent -= f52.exponent;
      let n = x.msb + x.exponent;
      x.exponent -= n;
      this.exponent += n;
      this.sign = -1n;  // treat input as always positive
      let two = new BigFloat(2);
      do {
        // newton:
        // repeat x = x * (2 - x * this) while x changes bits
        let y = new BigFloat(x, bits);
        let xx = new BigFloat(this, bits + 5);  // xx = -this
        xx.multiply(x);  // xx = -x * this
        xx.add(two);  // xx = 2 - x * this
        x.bits = bits;  // round next op to requested bits
        x.multiply(xx); // x = x * (2 - x * this)
        x.bits = bits + 5; // more bits next loop for rounding
        if (x.equal(y)) break;
      } while (true);
      this.exponent = x.exponent + n;
      this.mantissa = x.mantissa;
      this.msb = x.msb;
      this.sign = f52.sign;
      */
    }
    rsqrt() {
      const bits = this.bits ? this.bits : 64;
      const f52 = this.f52();
      // get initial guess for 53-bit square root from the fpu
      let x = new BigFloat(Math.sqrt(Number(f52.mantissa)), bits + 5);
      x.exponent += Math.floor(f52.exponent/2);
      x.reciprocal();
      let half = new BigFloat(0.5);
      let three = new BigFloat(3);
      do {
        // newton:
        // repeat x = 0.5 * x * (3 - this * x * x) while x changes bits
        let y = new BigFloat(x, bits);
        let xx = new BigFloat(x, bits + 5);
        xx.multiply(x);
        xx.multiply(this);
        xx.unaryMinus();  // xx = -this * x * x
        xx.add(three);
        x.multiply(xx);
        x.bits = bits;  // round next op to requested bits
        x.multiply(half);
        x.bits = bits + 5; // more bits next loop for rounding
        console.log(x);
        if (x.equal(y)) break;
      } while (true);
      this.assign(x);
      this.abs();
    }
    sqrt() {
      let x = new BigFloat(this);
      x.rsqrt();
      this.multiply(x);
    }
    tan() { console.log("tan"); }
    tanh() { console.log("tanh"); }
    trunc() { console.log("trunc"); }
    fromBaseString(str, base) {
      if (!base || base < 2 || base > 64) base = 10;
      let b = BigInt(base);
      let f = new BigFloat(0, this.bits);
      let decimal = null;
      if (str) Array.from(str, x => {
        if (x == '-') {
          f.sign = -f.sign;
        } else if (x == '.') {
          decimal = 0;
        } else if (x != '+') {
          const v = b64digits.indexOf(x);
          if (v > base) {
            throw new RangeError(`${x}(${v}) out of range for base ${base}.`);
          }
          if (v >= 0) {
            f.mantissa = f.mantissa * b + BigInt(v);
            if (decimal != null) {
              decimal++;
            }
          }
        }
      });
      if (decimal > 0) {
        if (base == 10) {
          f.exponent = -decimal;  // base 10 decimal position
        } else {
          f.exponent -= Math.ceil(decimal * Math.log2(base));
        }
      }
      return f;
    }
    fromString(str) {
       const b64 = str.split('@');
       const b10 = str.split('e');
       if (b64.length != 2 && !b10[0].length)
         throw new RangeError("Invalid BaseN number");
       const base = (b64.length == 2 ?
                     1+b64digits.indexOf(b64[1].substring(0,1)) : 10);
       if (base < 2)
         throw new RangeError("Invalid base identifier after @");
       const val = (b64.length == 2 ? b64[0] : b10[0]);
       const exp = (b64.length == 2 ? b64[1].substring(1) : b10[1]);
       const m = this.fromBaseString(val, base);
       const e = this.fromBaseString(exp, base);
       this.mantissa = m.mantissa;
       this.exponent = m.exponent +
                       Number(e.sign * (e.mantissa << BigInt(e.exponent)));
       if (base == 10 && this.exponent != 0) {
         // deal with power of ten exponents
         const e10 = this.exponent;
         this.exponent = 0;
         const p10 = new BigFloat(10n**BigInt(Math.abs(e10)));
         if (e10 < 0) { this.divide(p10); } else { this.multiply(p10); }
       }
       this.sign = m.sign;
       this.normalize();
    }
    toBaseString(val, base, shift, sign) {
      if (!val && !shift) return '+0';
      if (!val) return '0';
      if (!base || base < 2 || base > 64) base = 10;
      let neg = (!sign ? val < 0n : sign < 0n);
      if (val < 0n) val = -val;
      let trim = (shift && shift.digits != undefined);
      let decimal = trim;
      if (typeof(val) != "bigint") val = BigInt(val);
      let parts = [];
      // base**8 = max 48-bit chunk to handle to fit in javascript Number
      const b8n = BigInt(base * base * base * base *
                         base * base * base * base);
      while (val) {
        let bits = Number(val % b8n);
        val /= b8n;
        for (let i = 0; i < 8 && (bits || val); i++) {
          let v = bits % base;
          if (trim && shift && !v) {
            shift.digits++;
          } else {
            trim = false;  // disable throwing away low bits
            if (decimal) {
              if (bits < base && !val) {
                if (parts.length) parts.push('.');
              } else 
                shift.digits++;
            }
            parts.push(b64digits.charAt(bits % base));
          }
          bits = Math.floor(bits / base);
        }
      }
      if (neg) {
        parts.push('-');
      } else {
        if (!decimal) parts.push('+');
      }
      parts.reverse();
      return parts.join('');
    }
    toString(base) {
      if (this.mantissa === undefined || this.exponent === undefined) {
        return "0";
      }
      if (!base || base < 2 || base > 64) base = 10;
      if (this.mantissa < 0n) {
        this.mantissa = -this.mantissa;
        this.sign = -this.sign;
      }
      let exp = this.exponent;
      let val = this.mantissa;
      if (exp >= 0) {
        val <<= BigInt(exp);
        exp = 0;
      }
      if (base == 10 && exp < 0) {
        // figure out the number of base ten digits reqired to make
        // base 10 exponents work...
        const e10 = Math.ceil(this.msb * Math.LN2 / Math.LN10) + 1;
        val *= 10n**BigInt(e10);
        val >>= BigInt(-exp);
        exp = -e10;
      }
      let shift = { digits:0 };
      let mStr = this.toBaseString(val, base, shift, this.sign);
      let eStr = (base == 10 ? '' : '@' + b64digits.charAt(base - 1));
      exp += (base == 10 ? shift.digits :
              Math.ceil(shift.digits * Math.log2(base)));
      if (exp) {
        eStr += (base == 10 ? 'e' : '') + this.toBaseString(exp, base);
      }
      return mStr + eStr;

    }
  }
