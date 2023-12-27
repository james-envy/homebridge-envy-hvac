import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ThermostatAccessory } from './device_types/thermostat';
import { BinaryZoneAccessory } from './device_types/binary_zone';
import { PercentZoneAccessory } from './device_types/percent_zone';
import { Socket } from 'net';

export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  socket = new Socket;
  socket_buffer = '';

  queue : string[] = [];
  queue_ready = false;

  thermostats = {};

  binary_zones = {};
  percent_zones = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.socket.setEncoding('utf8');
    this.socket.on('close', this.on_close.bind(this));
    //this.socket.on('connect', this.on_connect.bind(this));
    this.socket.on('data', this.on_data.bind(this));
    this.socket.on('drain', this.on_drain.bind(this));
    //this.socket.on('end', this.on_end.bind(this));
    this.socket.on('error', this.on_error.bind(this));
    //this.socket.on('loopkup', this.on_lookup.bind(this));
    this.socket.on('ready', this.on_ready.bind(this));
    this.socket.on('timeout', this.on_timeout.bind(this));

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      this.socket.connect(12322);
    });
  }

  reconnect() {
    this.socket.connect(12322);
  }

  on_close() {
    this.log.error('close');
    setTimeout(this.reconnect.bind(this), 10000);
  }

  // on_connect() {
  //   this.log.error('connect');
  // }

  on_data(data: string) {
    this.socket_buffer += data;
    //this.log.error('data "', data, '"');
    let index = this.socket_buffer.indexOf('\n');
    while (index !== -1) {
      const line = this.socket_buffer.substring(0, index);
      this.log.error('read', line);

      const mode_matcher = /HVAC_controller::HVACMode(.*)\(ThermostatAddress = (.*)\)/;
      const mode_matched= mode_matcher.exec(line);
      if (mode_matched !== null) {
        //this.log.error('mode', mode_matched[1], mode_matched[2]);
        if (this.thermostats[mode_matched[2]] !== undefined) {
          this.thermostats[mode_matched[2]].update_mode(mode_matched[1]);
        }

        if (this.binary_zones[mode_matched[2]] !== undefined) {
          this.binary_zones[mode_matched[2]].update_power(mode_matched[1] !== 'Off');
        }

        if (this.percent_zones[mode_matched[2]] !== undefined) {
          this.percent_zones[mode_matched[2]].update_power(mode_matched[1] !== 'Off');
        }
      }

      const speed_matcher = /HVAC_controller::ThermostatHumidity\(ThermostatAddress = (.*), HumidifyPoint = (.*)\)/;
      const speed_matched= speed_matcher.exec(line);
      if (speed_matched !== null) {
        this.log.error('speed', speed_matched[1], speed_matched[2]);
        if (this.thermostats[speed_matched[1]] !== undefined) {
          this.thermostats[speed_matched[1]].update_speed(parseInt(speed_matched[2], 10));
        }

        if (this.percent_zones[speed_matched[1]] !== undefined) {
          this.percent_zones[speed_matched[1]].update_position(parseInt(speed_matched[2], 10));
        }
      }

      const thermostat_matcher = /HVAC_controller::ThermostatTemperature\(ThermostatAddress = (.*), CurrentTemperature = (.*)\)/;
      const thermostat_matched = thermostat_matcher.exec(line);
      if (thermostat_matched !== null) {
        //this.log.error('thermostat', thermostat_matched[1], thermostat_matched[2]);
        if (this.thermostats[thermostat_matched[1]] !== undefined) {
          this.thermostats[thermostat_matched[1]].update_thermostat(parseFloat(thermostat_matched[2]));
        }
      }

      const setpoint_matcher = /HVAC_controller::ThermostatTemperature\(ThermostatAddress = (.*), SetPointTemperature = (.*)\)/;
      const setpoint_matched = setpoint_matcher.exec(line);
      if (setpoint_matched !== null) {
        //this.log.error('thermostat', setpoint_matched[1], setpoint_matched[2]);
        if (this.thermostats[setpoint_matched[1]] !== undefined) {
          this.thermostats[setpoint_matched[1]].update_setpoint(parseInt(setpoint_matched[2], 10));
        }
      }

      //this.log.error('remaining "', this.socket_buffer.substring(index + 1), '"');
      this.socket_buffer = this.socket_buffer.substring(index + 1);
      index = this.socket_buffer.indexOf('\n');
    }
  }

  on_drain() {
    this.log.error('drain');
    this.queue_ready = true;
    while (this.queue.length > 0 && this.queue_ready) {
      this.queue_ready = this.socket.write(this.queue.shift()!);
    }
  }

  // on_end() {
  //   this.log.error('end');
  // }

  on_error() {
    this.log.error('error');
    this.socket.destroy();
  }

  // on_lookup() {
  //   this.log.error('lookup');
  // }

  on_ready() {
    this.log.error('ready');
    this.enqueue('HVAC_controller::Configure(HVACAddress = ' + this.config.hvac_address + ')');
    for (const address in this.thermostats) {
      this.enqueue('HVAC_controller::Configure(ThermostatAddress = ' + address + ', ThermostatAddress2 = )');
    }
    for (const address in this.binary_zones) {
      this.enqueue('HVAC_controller::Configure(ThermostatAddress = ' + address + ', ThermostatAddress2 = )');
    }
    for (const address in this.percent_zones) {
      this.enqueue('HVAC_controller::Configure(ThermostatAddress = ' + address + ', ThermostatAddress2 = )');
    }
    this.on_drain();
  }

  on_timeout() {
    this.log.error('timeout');
    this.socket.destroy();
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    this.accessories.push(accessory);
  }

  discoverDevices() {

    for (const device of this.config.thermostat_table) {

      this.log.error('thermostat_table[].name', device.name);
      this.log.error('thermostat_table[].address', device.address);
      const uuid = this.api.hap.uuid.generate(device.device_type + device.address);

      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        this.thermostats[device.address] = new ThermostatAccessory(this, existingAccessory);
      } else {
        this.log.info('Adding new accessory:', device.name);
        const accessory = new this.api.platformAccessory(device.name, uuid);
        accessory.context.device = device;
        this.thermostats[device.address] = new ThermostatAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      if (device.zone_table !== undefined) {
        for (const zone of device.zone_table) {

          this.log.error('thermostat_table[].zone_table[].name', zone.name);
          this.log.error('thermostat_table[].zone_table[].device_type', zone.address);
          this.log.error('thermostat_table[].zone_table[].address', zone.address);
          const uuid = this.api.hap.uuid.generate(zone.device_type + zone.address);

          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          if (zone.device_type === 'switch') {
            if (existingAccessory) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
              this.binary_zones[zone.address] = new BinaryZoneAccessory(this, existingAccessory);
            } else {
              this.log.info('Adding new accessory:', zone.name);
              const accessory = new this.api.platformAccessory(zone.name, uuid);
              accessory.context.zone = zone;
              this.binary_zones[zone.address] = new BinaryZoneAccessory(this, accessory);
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
          }

          if (zone.device_type === 'slider') {
            if (existingAccessory) {
              this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
              this.percent_zones[zone.address] = new PercentZoneAccessory(this, existingAccessory);
            } else {
              this.log.info('Adding new accessory:', zone.name);
              const accessory = new this.api.platformAccessory(zone.name, uuid);
              accessory.context.zone = zone;
              this.percent_zones[zone.address] = new PercentZoneAccessory(this, accessory);
              this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
            }
          }
        }
      }
    }
  }

  enqueue(data: string) {
    this.log.error('write', data);
    this.queue.push(data + '\n');
    if (this.queue_ready) {
      this.queue_ready = this.socket.write(this.queue.shift()!);
    }
  }
}
