/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue} from 'homebridge';

import { LEDStripsPlatform } from './platform';
import { Color } from './Color';
import { BluetoothLED } from './BluetoothLED';

import noble = require('@abandonware/noble');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LED_Strip {
  private led: Service;
  private rainbow: Service;
  //private light_of_day: Service;

  private bluetoothLED: BluetoothLED | undefined;

  private serviceUUID : string;

  private main_states = {
    On: false,
    Color : new Color(0, 0, 0),
  };

  private rainbow_states = {
    On: false,
    Color : new Color(0, 0, 0),
    cycle_time_modifier: 0.0,
  };

  private light_of_day_states = {
    On: false,
    Color : new Color(0, 0, 0),
  };

  private parameters = {
    rainbow_cycle_time: 15.0, // Time in seconds to complete a full rainbow cycle
    rainbow_update_interval: 50,
    HomeKitUpdateInterval: 200,
  };

  private color_correction = {
    r:1.0,
    g:0.7,
    b:0.7,
  };

  constructor(
    private readonly platform: LEDStripsPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    //  Set accessory information
    //this.accessory.getService(this.platform.Service.AccessoryInformation)!
    //.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Unknown')
    //.setCharacteristic(this.platform.Characteristic.Model, 'Unknown')
    //.setCharacteristic(this.platform.Characteristic.SerialNumber, 'Unknown');
    this.serviceUUID = accessory.context.device.serviceUUID;
    this.parameters.rainbow_cycle_time = accessory.context.device.rainbowCycle;

    //this.light_of_day = this.accessory.getService('Light of day') || this.accessory.addService(this.platform.Service.Lightbulb, 'Light of day');

    //  Prepare LED
    this.bluetoothLED = new BluetoothLED(this.serviceUUID);

    this.bluetoothLED.onConnect.add(() => this.platform.log.info('Connected to ' + this.accessory.displayName));
    this.bluetoothLED.onDisconnect.add(() => this.platform.log.info('Disconnected to ' + this.accessory.displayName));

    //this.bluetoothLED.onDisconnect.add(() => this.led.setHiddenService(true));
    //this.bluetoothLED.onDisconnect.add(() => this.led.setHiddenService(false));

    noble.on('scanStart', () => this.platform.log.debug('Started Scanning...'));
    noble.on('scanStop', () => this.platform.log.debug('Stopped Scanning...'));
    noble.on('warning', (message: string) => this.platform.log.warn('Noble: ' + message));
    noble.on('error', (message: string) => this.platform.log.error('Noble: ' + message));

    this.led = this.accessory.getService('LED') || this.accessory.addService(this.platform.Service.Lightbulb, 'LED', 'LED-main');
    //  Register Handlers for On/Off, Hue, Saturation Characteristics
    this.led.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setLEDOn.bind(this))
      .onGet(this.getLEDOn.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setLEDHue.bind(this))
      .onGet(this.getLEDHue.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setLEDSaturation.bind(this))
      .onGet(this.getLEDSaturation.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setLEDBrightness.bind(this))
      .onGet(this.getLEDBrightness.bind(this));

    this.rainbow = this.accessory.getService('Rainbow light') || this.accessory.addService(this.platform.Service.Lightbulb, 'Rainbow light', 'LED-rainbow');

    this.rainbow.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setRainbowOn.bind(this))
      .onGet(this.getRainbowOn.bind(this));

    this.rainbow.getCharacteristic(this.platform.Characteristic.Hue)
      .onGet(this.getRainbowHue.bind(this));

    this.rainbow.getCharacteristic(this.platform.Characteristic.Saturation)
      .onGet(this.getRainbowSaturation.bind(this));

    this.rainbow.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setRainbowBrightness.bind(this))
      .onGet(this.getRainbowBrightness.bind(this));


    setInterval(() => {
      if (this.rainbow_states.On) {
        this.rainbow.getCharacteristic(this.platform.Characteristic.Hue).updateValue(this.rainbow_states.Color.hue);
        this.rainbow.getCharacteristic(this.platform.Characteristic.Saturation).updateValue(this.rainbow_states.Color.saturation);
        this.rainbow.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.rainbow_states.Color.brightness);
      }
    }, this.parameters.HomeKitUpdateInterval);

    //  Update the rainbow mode when active on regular interval
    setInterval(() => {
      if (this.rainbow_states.On) {
        this.rainbow_states.Color.hue = (this.rainbow_states.Color.hue + 0.36 * this.parameters.rainbow_update_interval * this.rainbow_states.cycle_time_modifier / this.parameters.rainbow_cycle_time) % 360;
        this.rainbow_states.Color.saturation = 100;

        this.updateLED();
      }
    }, this.parameters.rainbow_update_interval);
  }

  /*
  private updateRainbowMode() {
    if (!this.states.RainbowMode) {
      return;
    }

    this.setHue(Number(this.getHue()) + 0.36 * this.parameters.rainbow_update_interval / this.parameters.rainbow_cycle_time);
    this.setSaturation(100);

    this.updateColor();
  }
  */


  private updateLED() {

    if (!this.bluetoothLED || !this.bluetoothLED.connected) {
      return;
    }

    let color = new Color(0, 0, 0);
    if (this.main_states.On) {
      if (this.rainbow_states.On) {
        color = this.rainbow_states.Color;
        color.brightness = this.main_states.Color.brightness;
      } else {
        color = this.main_states.Color;
      }
    }

    color = color.getLUTCorrected(this.color_correction.r, this.color_correction.g, this.color_correction.b);

    this.platform.log.debug('Color: r: ' + color.red + ', g: ' + color.green + ', b:' + color.blue);

    this.bluetoothLED.color = color;
  }
  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */

  async getLEDOn(): Promise<CharacteristicValue> {
    return this.main_states.On;
  }

  async getLEDBrightness(): Promise<CharacteristicValue> {
    return this.main_states.Color.brightness;
  }

  async getLEDHue(): Promise<CharacteristicValue> {
    return this.main_states.Color.hue;
  }

  async getLEDSaturation(): Promise<CharacteristicValue> {
    return this.main_states.Color.saturation;
  }

  async setLEDOn(value: CharacteristicValue) {
    this.main_states.On = value as boolean;
    this.updateLED();
  }

  async setLEDBrightness(value: CharacteristicValue) {
    this.main_states.Color.brightness = value as number;
    this.updateLED();
  }

  async setLEDHue(value: CharacteristicValue) {
    this.main_states.Color.hue = value as number;
    this.updateLED();
  }

  async setLEDSaturation(value: CharacteristicValue) {
    this.main_states.Color.saturation = value as number;
    this.updateLED();
  }

  async getRainbowOn(): Promise<CharacteristicValue> {
    return this.rainbow_states.On;
  }

  async getRainbowBrightness(): Promise<CharacteristicValue> {
    return this.rainbow_states.cycle_time_modifier * 100.0;
  }

  async getRainbowHue(): Promise<CharacteristicValue> {
    return this.rainbow_states.Color.hue;
  }

  async getRainbowSaturation(): Promise<CharacteristicValue> {
    return this.rainbow_states.Color.saturation;
  }

  async setRainbowOn(value: CharacteristicValue) {
    if ((value as boolean) && !this.rainbow_states.On) {
      this.rainbow_states.Color = new Color(this.main_states.Color.red, this.main_states.Color.green, this.main_states.Color.blue, this.main_states.Color.alpha);
    }
    this.rainbow_states.On = value as boolean;

    this.updateLED();
  }

  async setRainbowBrightness(value: CharacteristicValue) {
    this.rainbow_states.cycle_time_modifier = (value as number) / 100.0;
    this.updateLED();
  }
}
