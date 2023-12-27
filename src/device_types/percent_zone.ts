import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from '../platform';

export class PercentZoneAccessory {
  private service: Service;

  private percent_zone_state = {
    position: 100,
    valid_position: false,
    power: true,
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

    this.service = this.accessory.getService(this.platform.Service.WindowCovering) ||
    this.accessory.addService(this.platform.Service.WindowCovering);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.zone.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onSet(this.setTargetPosition.bind(this)).onGet(this.getTargetPosition.bind(this));
  }

  update_position(position: number) {
    this.platform.log.error('update_position', position);
    if (position !== 0) {
      if (!this.percent_zone_state.valid_position || this.percent_zone_state.position !== position) {
        this.percent_zone_state.position = position;
        this.percent_zone_state.valid_position = true;
        this.platform.log.error(this.accessory.context.zone.name, 'Update Characteristic CurrentPosition ->',
          this.percent_zone_state.power ? position : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.percent_zone_state.power ? position : 0);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.percent_zone_state.power ? position : 0);
      }
    }
  }

  update_power(power: boolean) {
    this.platform.log.error('update_power', power);
    if (!this.percent_zone_state.valid_power || this.percent_zone_state.power !== power) {
      this.percent_zone_state.power = power;
      this.percent_zone_state.valid_power = true;
      this.platform.log.error(this.accessory.context.zone.name, 'Update Characteristic CurrentPosition ->', power ?
        this.percent_zone_state.position : 0);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, power ? this.percent_zone_state.position : 0);
      this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, power ? this.percent_zone_state.position : 0);
    }
  }

  async setTargetPosition(value: CharacteristicValue) {
    this.platform.log.error(this.accessory.context.zone.name, 'Set Characteristic TargetPosition -> ', value);

    if (value !== 0) {
      if ((this.percent_zone_state.power === true) || (value !== 100)) {
        this.percent_zone_state.position = value as number;
        this.percent_zone_state.valid_position = false;
        this.platform.enqueue('HVAC_controller::SetHumidifyPoint(ThermostatAddress = ' + this.accessory.context.zone.address
        + ', ThermostatAddress2 = , HumidifyPoint = ' + this.percent_zone_state.position + ')');
      }
      if (this.percent_zone_state.power === false) {
        this.percent_zone_state.power = true;
        this.percent_zone_state.valid_power = false;
        this.platform.enqueue('HVAC_controller::SetHVACModeOn(ThermostatAddress = ' + this.accessory.context.zone.address
        + ', ThermostatAddress2 = )');
      }
    } else {
      this.percent_zone_state.power = false;
      this.percent_zone_state.valid_power = false;
      this.platform.enqueue('HVAC_controller::SetHVACModeOff(ThermostatAddress = ' + this.accessory.context.zone.address
      + ', ThermostatAddress2 = )');
    }
  }

  async getCurrentPosition(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.zone.name, 'Get Characteristic CurrentPosition ->', this.percent_zone_state.position);

    return this.percent_zone_state.power ? this.percent_zone_state.position : 0;
  }

  async getPositionState(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.zone.name, 'Get Characteristic PositionState ->',
      this.platform.Characteristic.PositionState.STOPPED);

    return this.platform.Characteristic.PositionState.STOPPED;
  }

  async getTargetPosition(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.zone.name, 'Get Characteristic TargetPosition ->', this.percent_zone_state.position);

    return this.percent_zone_state.power ? this.percent_zone_state.position : 0;
  }
}
