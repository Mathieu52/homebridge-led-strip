/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { LEDStripsPlatform } from './platform';
import { Color } from './Color';

import noble = require('@abandonware/noble');

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class LED_Strip {
  private led: Service;
  private rainbow: Service;
  private LED_Characteristic: noble.Characteristic | undefined;

  private serviceUUID : string;

  private states = {
    On: false,
    RainbowMode: false,
    Hue: 0,
    Saturation:0,
    Brightness: 0,
  };

  private parameters = {
    rainbow_cycle_time: 15.0, // Time in seconds to complete a full rainbow cycle
    rainbow_update_interval: 50,
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

    this.led = this.accessory.getService('LED') || this.accessory.addService(this.platform.Service.Lightbulb, 'LED');
    this.rainbow = this.accessory.getService('Rainbow mode') || this.accessory.addService(this.platform.Service.Switch, 'Rainbow mode');



    noble.on('stateChange', (state) => {
      this.platform.log.debug('Bluetooth: ' + state === 'poweredOn' ? 'Started Scanning' : 'Stopped Scanning');
      if (state === 'poweredOn') // eslint-disable-next-line curly
        noble.startScanning([this.serviceUUID], false);
      else // eslint-disable-next-line curly
        noble.stopScanning();
    });

    noble.on('discover', (peripheral) => {
      peripheral.connect(() => {
        this.platform.log.debug('Connected to strips with UUID: ' + peripheral.uuid);
        peripheral.discoverServices([this.serviceUUID], (_error, services) => {
          services[0].discoverCharacteristics([], (_error, characteristics) => {
            const characteristic = characteristics[0];
            this.LED_Characteristic = characteristic;
            this.updateColor();
          });
        });
      });
    });


    //  Register Handlers for On/Off, Hue, Saturation Characteristics
    this.led.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setHue.bind(this))
      .onGet(this.getHue.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this))
      .onGet(this.getSaturation.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this));


    //  Register Handler for On/Off Characteristic for the RainbowMode
    this.rainbow.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setRainbowMode.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getRainbowMode.bind(this));


    //  Update the rainbow mode when active on regular interval
    setInterval(() => {
      if (!this.states.RainbowMode) {
        return;
      }

      this.setHue(this.states.Hue + 0.36 * this.parameters.rainbow_update_interval / this.parameters.rainbow_cycle_time);
      this.setSaturation(100);

      this.updateColor();
    }, this.parameters.rainbow_update_interval);


    //  When bluetooth is enabled, and the strips haven't been found yet, start a new scan every 1 second;
    setInterval(() => {
      if (noble.state === 'poweredOn') {
        noble.stopScanning();
        noble.startScanning([this.serviceUUID], false);
      }
    }, 1000);
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

  private write = (message:number[]) => {
    if (typeof this.LED_Characteristic !== 'undefined') {
      try {
        this.LED_Characteristic.write(Buffer.from(message), true);
      } catch {
        this.platform.log.error(`Could not write to ${this.accessory.context.device.displayName}`);
      }
    }
  };

  private updateColor() {
    let color : Color = new Color(0, 0, 0);
    color.setHSV(this.states.Hue, this.states.Saturation, this.states.Brightness);
    if (!this.states.On) {
      color.brightness = 0;
    }
    color = color.getLUTCorrected(this.color_correction.r, this.color_correction.g, this.color_correction.b);

    this.write([0x01, color.red, color.green, color.blue]);
  }
  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */

  async getOn(): Promise<CharacteristicValue> {
    const isOn = this.states.On;

    return isOn;
  }

  async getBrightness(): Promise<CharacteristicValue> {
    return this.states.Brightness;
  }

  async getHue(): Promise<CharacteristicValue> {
    return this.states.Hue;
  }

  async getSaturation(): Promise<CharacteristicValue> {
    return this.states.Saturation;
  }

  async setOn(value: CharacteristicValue) {
    this.states.On = value as boolean;
    this.updateColor();
  }

  async setBrightness(value: CharacteristicValue) {
    this.states.Brightness = value as number;
    this.updateColor();
  }

  async setHue(value: CharacteristicValue) {
    this.states.Hue = value as number % 360;
    this.states.RainbowMode = false;
    this.rainbow.getCharacteristic(this.platform.Characteristic.On).updateValue(this.states.RainbowMode);

    this.updateColor();
  }

  async setSaturation(value: CharacteristicValue) {
    this.states.Saturation = value as number;
    this.states.RainbowMode = false;
    this.rainbow.getCharacteristic(this.platform.Characteristic.On).updateValue(this.states.RainbowMode);

    this.updateColor();
  }

  //RAINBOW MODE
  async getRainbowMode(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    return this.states.RainbowMode;
  }

  async setRainbowMode(value: CharacteristicValue) {
    this.states.RainbowMode = value as boolean;
  }
}
