/* eslint-disable max-len */
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';
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
  private LEDChar;

  private serviceID : string;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private states = {
    On: false,
    RainbowMode: false,
    Hue: 0,
    Saturation:0,
    Brightness: 0,
  };

  private parameters = {
    rainbowModeCycleTime: 15000,
    updateInterval: 50,
    HomeKitUpdateInterval: 200,
  };

  private colorCorrection = {
    r:1.0,
    g:0.7,
    b:0.7,
  };

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory

    const deviceName = accessory.context.device.displayName;
    const deviceUUID = accessory.context.device.uniqueID;
    this.serviceID = accessory.context.device.serviceID;
    this.parameters.rainbowModeCycleTime = accessory.context.device.rainbowCycle * 1000.0;

    this.led = this.accessory.getService(deviceName) || this.accessory.addService(this.platform.Service.Lightbulb, deviceName, deviceUUID + 'LED');
    this.rainbow = this.accessory.getService(deviceName + ' Rainbow mode') || this.accessory.addService(this.platform.Service.Switch, deviceName + ' Rainbow mode', deviceUUID + ' Rainbow mode');


    noble.on('stateChange', (state) => {
      this.platform.log.debug('STATE : ' + state);
      if (state === 'poweredOn') {
        this.platform.log.debug('STARTED SCANNING');
        noble.startScanning([this.serviceID], false);
      } else {
        this.platform.log.debug('STOPPED SCANNING');
        noble.stopScanning();
      }
    });

    noble.on('discover', (peripheral) => {
      peripheral.connect(() => {
        this.platform.log.debug('connected to peripheral: ' + peripheral.uuid);
        peripheral.discoverServices([this.serviceID], (error, services) => {
          const deviceInformationService = services[0];

          deviceInformationService.discoverCharacteristics([], (error, characteristics) => {
            const c = characteristics[0];
            this.LEDChar = c;
            this.updateColor();
          });
        });
      });
    });



    // register handlers for the On/Off Characteristic
    this.led.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.led.getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setHue.bind(this))       // SET - bind to the 'setBrightness` method below
      .onGet(this.getHue.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this))       // SET - bind to the 'setBrightness` method below
      .onGet(this.getSaturation.bind(this));

    this.led.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))       // SET - bind to the 'setBrightness` method below
      .onGet(this.getBrightness.bind(this));

    this.rainbow.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setRainbowMode.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getRainbowMode.bind(this));

    setInterval(() => {
      if (this.states.RainbowMode) {
        this.states.Hue = (this.states.Hue + (360.0 / this.parameters.rainbowModeCycleTime) * this.parameters.updateInterval) % 360;
        this.states.Saturation = 100;

        this.updateColor();
      }
    }, this.parameters.updateInterval);

    setInterval(() => {
      if (this.states.RainbowMode) {
        this.led.getCharacteristic(this.platform.Characteristic.Hue).updateValue(this.states.Hue);
        this.led.getCharacteristic(this.platform.Characteristic.Saturation).updateValue(this.states.Saturation);
        this.led.getCharacteristic(this.platform.Characteristic.Brightness).updateValue(this.states.Brightness);
      }
    }, this.parameters.HomeKitUpdateInterval);

    setInterval(() => {
      if (noble.state === 'poweredOn') {
        noble.stopScanning();
        noble.startScanning([this.serviceID], false);
      }
    }, 1000);
  }

  private write = (message:number[]) => {
    if (typeof this.LEDChar !== 'undefined') {
      try {
        this.LEDChar.write(Buffer.from(message), true);
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
    color = color.getLUTCorrected(this.colorCorrection.r, this.colorCorrection.g, this.colorCorrection.b);

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
    this.states.Hue = value as number;
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
