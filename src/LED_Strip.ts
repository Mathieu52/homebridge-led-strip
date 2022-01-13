import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from './platform';

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
    Brightness: 100,
  };

  private parameters = {
    rainbowModeCycleTime: 15000,
    updateInterval: 50,
    HomeKitUpdateInterval: 200,
  };

  private colorCorrection = {
    r:1.0,
    g:0.6,
    b:0.6,
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
      console.log('STATE : ' + state);
      if (state === 'poweredOn') {
        console.log('STARTED SCANNING');
        noble.startScanning([this.serviceID], false);
      } else {
        console.log('STOPPED SCANNING');
        noble.stopScanning();
      }
    });

    noble.on('discover', (peripheral) => {
      peripheral.connect((error) => {
        console.log('connected to peripheral: ' + peripheral.uuid);
        peripheral.discoverServices([this.serviceID], (error, services) => {
          const deviceInformationService = services[0];
          console.log(services);

          deviceInformationService.discoverCharacteristics([], (error, characteristics) => {
            console.log(characteristics);
            const c = characteristics[0];
            this.LEDChar = c;

            c.on('data', (data, isNotification) => {
              console.log('battery level is now: ', data.readUInt8(0) + '%');
            });

            // to enable notify
            c.subscribe((error) => {
              console.log('battery level notification on');
            });
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
      this.LEDChar.write(Buffer.from(message), true);
    }
  };

  private updateColor() {
    const h = this.states.Hue;
    const s = this.states.Saturation / 100.0;
    let v = this.states.Brightness / 100.0;

    if (!this.states.On) {
      v = 0;
    }

    const k = v * s;

    const x = k * (1.0 - Math.abs(((h / 60) % 2) - 1));

    const m = v - k;

    let r, g, b;

    if(h >= 0 && h < 60) {
      r = k;
      g = x;
      b = 0;
    }
    if(h >= 60 && h < 120) {
      r = x;
      g = k;
      b = 0;
    }

    if(h >= 120 && h < 180) {
      r = 0;
      g = k;
      b = x;
    }

    if(h >= 180 && h < 240) {
      r = 0;
      g = x;
      b = k;
    }

    if(h >= 240 && h < 300) {
      r = x;
      g = 0;
      b = k;
    }

    if(h >= 300 && h < 360) {
      r = k;
      g = 0;
      b = x;
    }

    this.write([0x01, (r+m)*255 * this.colorCorrection.r, (g+m)*255 * this.colorCorrection.g, (b+m)*255 * this.colorCorrection.b]);
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
