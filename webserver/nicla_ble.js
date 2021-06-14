const deviceName = 'NICLA'
const sensorServiceUuid = '34c2e3bb-34aa-11eb-adc1-0242ac120002';
const sensorConfigCharacteristicUuid = '34c2e3bd-34aa-11eb-adc1-0242ac120002';
const sensorDataCharacteristicUuid = '34c2e3bc-34aa-11eb-adc1-0242ac120002';
var bleDevice
var bleServer
var sensorService
var sensorConfigCharacteristic
var sensorDataCharacteristic

var bleConnected = false


function isWebBluetoothEnabled() {
  if (!navigator.bluetooth) {
    console.log('Web Bluetooth is NOT available!')
    return false
  }
  console.log('Web Bluetooth is available!')
  return true
}

function connect() {
  return getDeviceInfo()
  .then(connectDevice)
  .then(getSensorCharacteristics)
  .then(onConnection);
}

function getDeviceInfo() {
  let options = {
    filters: [{ name: deviceName}],
    optionalServices: [sensorServiceUuid]
  };
  console.log('Requesting BLE device info...');
  return navigator.bluetooth.requestDevice(options).then(device => {
    bleDevice = device
  }).catch(error => {
    console.log('Request device error: ' + error)
  });
}

function connectDevice() {
  console.log('Connecting to device')
  bleDevice.addEventListener('gattserverdisconnected', onDisconnection);
  return bleDevice.gatt.connect()
  .then(server => {
    bleServer = server;
    return bleServer.getPrimaryService(sensorServiceUuid);
  })
  .then(service => {
    sensorService = service;
  });
}

function onDisconnection(event) {
  var status = document.getElementById("connectionStatus");
  status.innerHTML = "Disconnected";
  status.className = "badge rounded-pill bg-danger";
  bleConnected = false;
}

function onConnection() {
  var status = document.getElementById("connectionStatus");
  status.innerHTML = "Connected";
  status.className = "badge rounded-pill bg-success";
  bleConnected = true;
}

function getSensorCharacteristics() {
  console.log('Getting sensor characteristics');
  return sensorService.getCharacteristic(sensorConfigCharacteristicUuid)
  .then(characteristic => {
    sensorConfigCharacteristic = characteristic;
  })
  .then(_ => {
    return sensorService.getCharacteristic(sensorDataCharacteristicUuid);
  })
  .then(characteristic => {
    sensorDataCharacteristic = characteristic;
    sensorDataCharacteristic.startNotifications();
    sensorDataCharacteristic.addEventListener('characteristicvaluechanged', receiveSensorData)
  });
}


