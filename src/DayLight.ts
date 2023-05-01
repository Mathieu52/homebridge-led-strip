import * as SunCalc from 'suncalc';
import { Color } from './Color';

export class DayLight {
  public longitude = 0.0;
  public latitude = 0.0;

  constructor(longitude : number, latitude : number) {
    this.longitude = longitude;
    this.latitude = latitude;
  }

  get time() : number {
    const date = new Date();
    const timezoneOffset = date.getTimezoneOffset() / 60.0;

    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    return this.wrapTime((hours + minutes / 60) + timezoneOffset);
  }

  get sunrise(): number {
    // Use the SunCalc library to calculate the sunrise and sunset times
    const times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
    const timezoneOffset = new Date().getTimezoneOffset() / 60.0;

    const sunriseHours = times.sunrise.getUTCHours();
    const sunriseMinutes = times.sunrise.getUTCMinutes();

    return this.wrapTime((sunriseHours + sunriseMinutes / 60) + timezoneOffset);
  }

  get sunset(): number {
    // Use the SunCalc library to calculate the sunrise and sunset times
    const times = SunCalc.getTimes(new Date(), this.latitude, this.longitude);
    const timezoneOffset = new Date().getTimezoneOffset() / 60.0;

    const sunsetHours = times.sunset.getUTCHours();
    const sunsetMinutes = times.sunset.getUTCMinutes();

    return this.wrapTime((sunsetHours + sunsetMinutes / 60) + timezoneOffset);
  }

  get temperature(): number {
    const t = this.map(this.time, this.sunrise, this.sunset, -1, 1);
    return (0.839 * Math.sqrt(1 - t * t) + 0.348) * 6000.0;
  }

  get intensity(): number {
    const t = this.map(this.time, this.sunrise, this.sunset, 0, Math.PI);
    return Math.min(Math.max(Math.pow(Math.sin(t), 1.0 / 10.0), 0), 1);
  }

  get sun_light_color() : Color {
    const temperature = this.temperature / 100.0;

    let red:number, green: number, blue: number;
    if (temperature <= 66) {
      red = 255;
    } else {
      red = temperature - 60.0;
      red = 329.698727446 * Math.pow(red, -0.1332047592);
    }

    if (temperature <= 66) {
      green = temperature;
      green = 99.4708025861 * Math.log(green) - 161.1195681661;
    } else {
      green = temperature - 60.0;
      green = 288.1221695283 * Math.pow(green, -0.0755148492);
    }

    if (temperature >= 66) {
      blue = 255;
    } else if (temperature <= 19) {
      blue = 0;
    } else {
      blue = temperature - 10.0;
      blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    }

    return new Color(red, green, blue);
  }

  get color() : Color {
    const color = (this.time >= this.sunrise && this.time <= this.sunset) ? this.sun_light_color : new Color(0, 0, 0);
    return new Color(color.red * this.intensity, color.green * this.intensity, color.blue * this.intensity);
  }


  private map(value : number, minIn : number, maxIn : number, minOut : number, maxOut : number): number {
    return (value - minIn) * (maxOut - minOut) / (maxIn - minIn) + minOut;
  }


  private wrapTime(time: number): number {
    if (time < 0) {
      return time + 24;
    } else if (time >= 24) {
      return time - 24;
    } else {
      return time;
    }
  }

}