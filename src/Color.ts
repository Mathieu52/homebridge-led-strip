export class Color {
  public red : number;
  public green : number;
  public blue : number;
  public alpha : number;

  constructor(red : number, green : number, blue : number, alpha? : number) {
    this.red = red;
    this.green = green;
    this.blue = blue;

    if (typeof alpha !== 'undefined') {
      this.alpha = alpha;
    } else {
      this.alpha = 100;
    }
  }

  //GET
  get hue(): number {
    const maxval = Math.max(this.red, this.green, this.blue);
    const minval = Math.min(this.red, this.green, this.blue);
    const difference = maxval - minval;

    if (difference === 0) {
      return 0;
    } else if (this.red === maxval){
      return ((60 * (this.green - this.blue) / difference) + 360) % 360.0;
    } else if (this.green === maxval) {
      return ((60 * (this.blue - this.red) / difference) + 120) % 360.0;
    } else {
      return ((60 * (this.red - this.green) / difference) + 240) % 360.0;
    }
  }

  set hue(h: number) {
    this.setHSV(h, this.saturation, this.brightness);
  }

  get saturation(): number {
    const maxval = Math.max(this.red, this.green, this.blue);
    const minval = Math.min(this.red, this.green, this.blue);
    const difference = maxval - minval;

    if (maxval === 0) {
      return 0;
    } else {
      return difference * 100.0 / maxval;
    }
  }

  set saturation(s: number) {
    this.setHSV(this.hue, s, this.brightness);
  }

  get brightness(): number {
    return Math.max(this.red, this.green, this.blue) * 100.0 / 255.0;
  }

  set brightness(b: number) {
    this.setHSV(this.hue, this.saturation, b);
  }

  public setRGB(r: number, g: number, b: number) : void {
    this.red = r;
    this.green = g;
    this.blue = b;
  }

  public setRGBA(r: number, g: number, b: number, a: number) : void {
    this.setRGB(r, g, b);
    this.alpha = a;
  }

  public setHSV(h: number, s: number, v: number) : void {
    s /= 100.0;
    v /= 100.0;

    const k = v * s;

    const x = k * (1.0 - Math.abs(((h / 60) % 2) - 1));

    const m = v - k;

    if(h >= 0 && h < 60) {
      this.red = k;
      this.green = x;
      this.blue = 0;
    } else if(h >= 60 && h < 120) {
      this.red = x;
      this.green = k;
      this.blue = 0;
    } else if(h >= 120 && h < 180) {
      this.red = 0;
      this.green = k;
      this.blue = x;
    } else if(h >= 180 && h < 240) {
      this.red = 0;
      this.green = x;
      this.blue = k;
    } else if(h >= 240 && h < 300) {
      this.red = x;
      this.green = 0;
      this.blue = k;
    } else if(h >= 300 && h < 360) {
      this.red = k;
      this.green = 0;
      this.blue = x;
    }
    this.red = (this.red + m) * 255;
    this.green = (this.green + m) * 255;
    this.blue = (this.blue + m) * 255;
  }

  public setHSVA(h: number, s: number, v: number, a: number) : void {
    this.setHSV(h, s, v);
    this.alpha = a;
  }

  /**
   * Returns LUT corrected color
   * @param redCorrection red correction parameters
   * @param greenCorrection green correction parameters
   * @param blueCorrection blue correction parameters
   */
  public getLUTCorrected(redCorrection: number, greenCorrection: number, blueCorrection: number) : Color {
    const r = Math.pow(this.red / 255.0, redCorrection) * 255.0;
    const g = Math.pow(this.green / 255.0, greenCorrection) * 255.0;
    const b = Math.pow(this.blue / 255.0, blueCorrection) * 255.0;

    return new Color(r, g, b, this.alpha);
  }

  public static fromColor(color : Color) : Color {
    return new Color(color.red, color.green, color.blue, color.alpha);
  }
}