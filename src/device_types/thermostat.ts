import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { ExampleHomebridgePlatform } from '../platform';

export class ThermostatAccessory {
  private service: Service;
  private fan: Service;

  private thermostat_state = {
    mode: 'Auto',
    valid_mode: false,
    thermostat: 25,
    valid_thermostat: false,
    setpoint: 25,
    valid_setpoint: false,

    speed: 100,
    valid_speed: false,
  };

  queue : number[] = [];
  queue_ready = true;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
    || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onGet(this.getTargetHeatingCoolingState.bind(this)).onSet(this.setTargetHeatingCoolingState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onGet(this.getTargetTemperature.bind(this)).onSet(this.setTargetTemperature.bind(this));

    this.fan = this.accessory.getService('Thermostat Fan') ||
      this.accessory.addService(this.platform.Service.Fan, 'Thermostat Fan', 'thermostat_fan');

    this.fan.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.fan.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)).onGet(this.getOn.bind(this));

    this.fan.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onSet(this.setRotationSpeed.bind(this)).onGet(this.getRotationSpeed.bind(this));
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.device.name, 'Get CurrentHeatingCoolingState ->', this.thermostat_state.mode);

    switch(this.thermostat_state.mode) {
      case 'Off':
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;

      case 'Heat':
        return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;

      case 'Cool':
        return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;

      case 'Auto':
        if (this.thermostat_state.setpoint > this.thermostat_state.thermostat) {
          return this.platform.Characteristic.CurrentHeatingCoolingState.HEAT;
        }
        if (this.thermostat_state.setpoint < this.thermostat_state.thermostat) {
          return this.platform.Characteristic.CurrentHeatingCoolingState.COOL;
        }
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;

      default:
        return this.platform.Characteristic.CurrentHeatingCoolingState.OFF;
    }
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const value = this.thermostat_state.mode;
    this.platform.log.error(this.accessory.context.device.name, 'Get TargetHeatingCoolingState ->', value);

    switch(value) {
      case 'Off':
        return this.platform.Characteristic.TargetHeatingCoolingState.OFF;

      case 'Heat':
        return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;

      case 'Cool':
        return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
    }

    return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    this.platform.log.error(this.accessory.context.device.name, 'Set TargetHeatingCoolingState -> ', value);

    switch (value as number) {
      case this.platform.Characteristic.TargetHeatingCoolingState.OFF:
        this.thermostat_state.mode = 'Off';
        break;

      case this.platform.Characteristic.TargetHeatingCoolingState.HEAT:
        this.thermostat_state.mode = 'Heat';
        break;

      case this.platform.Characteristic.TargetHeatingCoolingState.COOL:
        this.thermostat_state.mode = 'Cool';
        break;

      case this.platform.Characteristic.TargetHeatingCoolingState.AUTO:
        this.thermostat_state.mode = 'Auto';
        break;
    }
    this.thermostat_state.valid_mode = false;

    this.platform.enqueue('HVAC_controller::SetHVACMode' + this.thermostat_state.mode + '(ThermostatAddress = ' +
    this.accessory.context.device.address + ', ThermostatAddress2 = )');
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const value = this.thermostat_state.thermostat;
    this.platform.log.error(this.accessory.context.device.name, 'Get CurrentTemperature ->', value);

    return value;
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    const value = this.thermostat_state.setpoint;
    this.platform.log.error(this.accessory.context.device.name, 'Get TargetTemperature ->', value);

    return value;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    this.platform.log.error(this.accessory.context.device.name, 'Set TargetTemperature -> ', value);

    this.thermostat_state.setpoint = value as number;
    this.thermostat_state.valid_setpoint = false;

    this.platform.enqueue('HVAC_controller::SetSingleSetPointTemperature(ThermostatAddress = ' + this.accessory.context.device.address
    + ', ThermostatAddress2 = , SetPointTemperature = ' + this.thermostat_state.setpoint + ')');
  }

  update_mode(mode: string) {
    this.platform.log.error(this.accessory.context.device.name, 'Update mode ->', mode);

    this.thermostat_state.mode = mode;
    this.thermostat_state.valid_mode = true;

    switch(mode) {
      case 'Off':
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
          this.platform.Characteristic.CurrentHeatingCoolingState.OFF);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.OFF);
        break;

      case 'Heat':
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
          this.platform.Characteristic.CurrentHeatingCoolingState.HEAT);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.HEAT);
        break;

      case 'Cool':
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
          this.platform.Characteristic.CurrentHeatingCoolingState.COOL);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.COOL);
        break;

      case 'Auto':
        this.update_auto();
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.AUTO);
        break;

      default:
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
          this.platform.Characteristic.CurrentHeatingCoolingState.OFF);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState,
          this.platform.Characteristic.TargetHeatingCoolingState.OFF);
        break;
    }
    this.fan.updateCharacteristic(this.platform.Characteristic.On, mode !== 'Off' && this.thermostat_state.speed !== 0);
    this.fan.updateCharacteristic(this.platform.Characteristic.RotationSpeed, mode !== 'Off' ? this.thermostat_state.speed : 0);
  }

  update_thermostat(thermostat: number) {
    this.platform.log.error(this.accessory.context.device.name, 'Update thermostat ->', thermostat);

    this.thermostat_state.thermostat = thermostat;
    this.thermostat_state.valid_thermostat = true;

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, thermostat);

    if (this.thermostat_state.mode === 'Auto') {
      this.update_auto();
    }
  }

  update_setpoint(setpoint: number) {
    this.platform.log.error(this.accessory.context.device.name, 'Update setpoint ->', setpoint);

    this.thermostat_state.setpoint = setpoint;
    this.thermostat_state.valid_setpoint = true;

    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, setpoint);

    if (this.thermostat_state.mode === 'Auto') {
      this.update_auto();
    }
  }

  update_auto() {
    if (this.thermostat_state.setpoint > this.thermostat_state.thermostat) {
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
        this.platform.Characteristic.CurrentHeatingCoolingState.HEAT);
    }
    if (this.thermostat_state.setpoint < this.thermostat_state.thermostat) {
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState,
        this.platform.Characteristic.CurrentHeatingCoolingState.COOL);
    }
  }

  //update_power(power: boolean) {
  //  this.platform.log.error('queueing', power);
  //  if (!this.thermostat_state.valid_power || this.thermostat_state.power !== power) {
  //    this.platform.log.error(this.accessory.context.device.name, 'Update Characteristic On ->', power);
  //    this.thermostat_state.power = power;
  //    this.thermostat_state.valid_power = true;
  //    this.fan.updateCharacteristic(this.platform.Characteristic.On, power);
  //  }
  //}

  update_speed(speed: number) {
    this.platform.log.error('queueing', speed);
    if (speed !== 0) {
      if (!this.thermostat_state.valid_speed || this.thermostat_state.speed !== speed) {
        this.platform.log.error(this.accessory.context.device.name, 'Update Characteristic RotationSpeed ->', speed);
        this.thermostat_state.speed = speed;
        this.thermostat_state.valid_speed = true;
        this.fan.updateCharacteristic(this.platform.Characteristic.On, this.thermostat_state.mode !== 'Off' && speed !== 0);
        this.fan.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.thermostat_state.mode !== 'Off' ? speed : 0);
      }
    }
  }

  async setOn(value: CharacteristicValue) {
    this.platform.log.error(this.accessory.context.device.name, 'Set Characteristic On -> ', this.thermostat_state.mode, value);

    if (this.thermostat_state.mode === 'Off' && value === true) {
      this.platform.enqueue('HVAC_controller::SetHVACModeFan(ThermostatAddress = ' +
      this.accessory.context.device.address + ', ThermostatAddress2 = )');
    }
    if (this.thermostat_state.mode !== 'Off' && value === false) {
      this.platform.enqueue('HVAC_controller::SetHVACModeOff(ThermostatAddress = ' +
      this.accessory.context.device.address + ', ThermostatAddress2 = )');
    }
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.error(this.accessory.context.device.name, 'Set Characteristic RotationSpeed -> ', value);

    this.thermostat_state.speed = value as number;
    this.thermostat_state.valid_speed = false;
    this.platform.enqueue('HVAC_controller::SetHumidifyPoint(ThermostatAddress = ' + this.accessory.context.device.address
    + ', ThermostatAddress2 = , HumidifyPoint = ' + value + ')');
  }

  async getOn(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.device.name, 'Get Characteristic On ->', this.thermostat_state.speed !== 0);

    return this.thermostat_state.mode !== 'Off' && this.thermostat_state.speed !== 0;
  }

  async getRotationSpeed(): Promise<CharacteristicValue> {
    this.platform.log.error(this.accessory.context.device.name, 'Get Characteristic RotationSpeed ->', this.thermostat_state.speed);

    return this.thermostat_state.mode !== 'Off' ? this.thermostat_state.speed : 0;
  }
}
