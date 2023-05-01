import { Color } from './Color';
import { SimpleListener } from './SimpleListener';

import noble = require('@abandonware/noble');

export class BluetoothLED {
  private _color = new Color(0, 0, 0);
  private _UUID = '';
  private _connected = false;
  private characteristic: noble.Characteristic | undefined;

  public onConnect : SimpleListener = new SimpleListener();
  public onDisconnect : SimpleListener = new SimpleListener();

  constructor(UUID: string) {
    this._UUID = UUID;

    this.onDisconnect.add(() => {
      if (noble.state === 'poweredOn') {
        noble.startScanning([this.UUID], false);
      }
    });

    this.onConnect.add(() => noble.stopScanning());

    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        noble.startScanning([this.UUID], false);
      }
    });

    noble.on('discover', (peripheral) => {
      peripheral.once('connect', () => this.connected = true);
      peripheral.once('disconnected', () => this.connected = false);

      peripheral.connect(() => {
        peripheral.discoverServices([UUID], (_error, services) => {
          this.connected = true;
          services[0].discoverCharacteristics([], (_error, characteristics) => this.characteristic = characteristics[0]);
        });
      });
    });

    setInterval(() => {
      noble.stopScanning();
      if (noble.state === 'poweredOn' && !this.connected) {
        noble.startScanning([this.UUID], false);
      }
    }, 5000);
  }

  private write (message:number[]) {
    if (this.characteristic) {
      this.characteristic.write(Buffer.from(message), true);
    }
  }

  public get color(): Color {
    return this._color;
  }

  public set color(c: Color) {
    this._color = c;
    this.write([0x01, this._color.red, this._color.green, this._color.blue]);
  }

  public get UUID(): string {
    return this._UUID;
  }

  private set UUID(value: string) {
    this._UUID = value;
  }

  public get connected(): boolean {
    return this._connected;
  }

  private set connected(value: boolean) {
    const tempValue = this._connected;
    this._connected = value;

    if (tempValue !== value) {
      if (value) {
        this.onConnect.fire;
      } else {
        this.onDisconnect.fire;
      }
    }
  }
}