import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from '../platform';

export class BinaryZoneAccessory {
  private service: Service;

  private binary_zone_state = {
    power: false,
    valid_power: false,
  };

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.zone.name);

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)).onGet(this.getOn.bind(this));
  }

  update_power(power: boolean) {
    this.platform.log.error('queueing', power);

    if (!this.binary_zone_state.valid_power || this.binary_zone_state.power !== power) {
      this.binary_zone_state.power = power;
      this.binary_zone_state.valid_power = true;
      this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(power);
    }
  }

  async setOn(value: CharacteristicValue) {
    this.platform.log.debug(this.accessory.context.zone.name, 'Set Characteristic On ->', value);

    this.binary_zone_state.power = value as boolean;
    this.binary_zone_state.valid_power = false;

    this.platform.enqueue('HVAC_controller::SetHVACMode' + (value as boolean ? 'On' : 'Off') + '(ThermostatAddress = ' +
    this.accessory.context.zone.address + ', ThermostatAddress2 = )');
  }

  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.debug(this.accessory.context.zone.name, 'Get Characteristic On ->', this.binary_zone_state.power);

    return this.binary_zone_state.power;
  }
}
