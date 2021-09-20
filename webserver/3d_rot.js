window.log = function()
{
	if (this.console)
	{
		console.log(Array.prototype.slice.call(arguments));
	}
};

// Namespace
var Defmech = Defmech ||
{};

Defmech.RotationWithQuaternion = (function()
{
	'use_strict';

	//<WebBLE> 
	const deviceName = 'NICLA'
	const sensorServiceUuid = '34c2e3bb-34aa-11eb-adc1-0242ac120002';
	const sensorConfigCharacteristicUuid = '34c2e3bd-34aa-11eb-adc1-0242ac120002';
	const sensorDataCharacteristicUuid = '34c2e3bc-34aa-11eb-adc1-0242ac120002';

    //we use game rotation vector which is a fusion output from accelerometer and gyroscope signals 
    //here we don't want to use the 9DoF fusion (with magnetic sensor for fusion) which outputs the absolute orientation
    const quaternionSensorId = 38
    //const quaternionScaleFactor = 1.0 / 16384
    const quaternionScaleFactor = 1.0
    const quaternionSensorRate = 50.0


    //var transformQuaternion = new THREE.Quaternion();
    //transformQuaternion.setFromAxisAngle( new THREE.Vector3( -1, 0, 0 ), Math.PI / 2 );


	var bleDevice
	var bleServer
	var sensorService
	var sensorConfigCharacteristic
	var sensorDataCharacteristic

	var sensorMap = new Map();
	var parseScheme;
	var sensorTypes;
	var sensorTypesLen;

	fetch("./parse-scheme.json")
	  .then(response => response.json())
	  .then(json => {
	    console.log(json);
	    parseScheme = json;
	  });

	fetch("./sensor-type-map.json")
	  .then(response => response.json())
	  .then(json => {
	    console.log(json);
	    sensorTypes = json;
	    var counter = 0;
	    sensorTypesLen = Object.keys(sensorTypes).length;
	    console.log("Json length: ", sensorTypesLen);
	    //fillSensorTable();
	  });


	document.querySelector('#connectButton').addEventListener('click', function() {
	  if (isWebBluetoothEnabled()) { 
	    connect() 
	    .then(_ => {
	      console.log('Connected')
	      //document.querySelector('#configureButton').disabled = false
	    })
	    .catch(error => {
	      console.log('ERROR: ' + error);
	    });
	  }
	});



	function floatToBytes(value) {
	  var tempArray = new Float32Array(1);
	  tempArray[0] = value;
	  return new Uint8Array(tempArray.buffer);
	}

	function intToBytes(value) {
	  var tempArray = new Int32Array(1);
	  tempArray[0] = value;
	  return new Uint8Array(tempArray.buffer);
	}

	function isWebBluetoothEnabled() {
	  if (!navigator.bluetooth) {
	    console.log('Web Bluetooth is NOT available!')
	    return false
	  }
	  console.log('Web Bluetooth is available!')
	  return true
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

    function configSensors() {
        var configPacket = new Uint8Array(9);
        configPacket[0] = quaternionSensorId;
        configPacket.set(floatToBytes(0), 1);
        configPacket.set(intToBytes(0), 5);
        console.log(configPacket);
        sensorConfigCharacteristic.writeValue(configPacket);

        setTimeout(() => {
            console.log("reconfig sample rate");
            configPacket.set(floatToBytes(quaternionSensorRate), 1);
            sensorConfigCharacteristic.writeValue(configPacket);
        }, 1000);
    }

	function connect() {
	  return getDeviceInfo()
	  .then(connectDevice)
	  .then(getSensorCharacteristics)
	  .then(onConnection);
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
	}

	function onConnection() {
	  var status = document.getElementById("connectionStatus");
	  status.innerHTML = "Connected";
	  status.className = "badge rounded-pill bg-success";
	}

	function getSensorCharacteristics() {
	  console.log('Getting sensor characteristics');
	  return sensorService.getCharacteristic(sensorConfigCharacteristicUuid)
	  .then(characteristic => {
	    sensorConfigCharacteristic = characteristic;
        configSensors();
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

	function updateSensorStatus(_this, sensor) {
	  var configPacket = new Uint8Array(9);
	  configPacket[0] = sensor;

	  if (_this.style.backgroundColor == "limegreen") {
	    //Turn sensor OFF
	    console.log("Disable sensor ", sensor);
	    configPacket.set(floatToBytes(0), 1);
	    configPacket.set(intToBytes(0), 5);
	    console.log(configPacket);
	    sensorConfigCharacteristic.writeValue(configPacket)
	    .then(_ => {  
	      console.log('Configuration written');
	    });
	    _this.style.backgroundColor = "";
	  } else {
	    //Turn sensor ON
	    console.log("Enable sensor ", sensor);
	    configPacket.set(floatToBytes(1), 1);
	    console.log(configPacket);
	    sensorConfigCharacteristic.writeValue(configPacket)
	    .then(_ => {  
	      console.log('Configuration written');
	    });
	    _this.style.backgroundColor = "limegreen";
	  }
	}

	function fillSensorTable() {
	  var table = document.getElementById("dataTable");
	  var tableLength = table.rows.length;

	  for (let i = 0; i < sensorTypesLen - 1; i++) {
	    var key = Object.keys(sensorTypes)[i];
	    if (sensorTypes[key].dashboard == 1) {
	      var tableLength = table.rows.length;
	      var sensorIdx = parseInt(key)
	      sensorMap.set(sensorIdx, tableLength);
	      var row = table.insertRow(tableLength);
	      var cell = row.insertCell(0);
	      cell.innerHTML = key;
	      cell = row.insertCell(1);
	      cell.innerHTML = sensorTypes[key].name;
	      cell = row.insertCell(2);
	      cell.innerHTML = 0;
	      cell = row.insertCell(3);
	      cell.innerHTML = '<input id="Button" type="button" value="Enabled" onclick="updateSensorStatus(this, \'' + sensorIdx + '\');"/>'
	      cell = row.insertCell(4);
	      var chartIdx = sensorTypes[sensorIdx].name;
	      cell.innerHTML = '<div id=\'' + chartIdx + '\'></div>';
	    }
	  }
	}

	a=[]; b=[]; c=[];

	function receiveSensorData(event) {
	  var value = event.target.value;
	  // Get sensor data
	  var sensor = value.getUint8(0);
	  var size = value.getUint8(1);
	  //console.log(value)
	  var parsedData = parseData(sensor, value);
	  parsedName = parsedData[0]
	  parsedStringValue = parsedData[1]
	  parsedValue = parsedData[2]


	  //var table = document.getElementById("dataTable");
	  // If sensor is already in the table -> update its value
	  //console.log("sensor:", sensor)
	  if (sensor == quaternionSensorId) {
        const arrXYZValues = parsedStringValue.split(" ");
        x = parseFloat(arrXYZValues[1]);
        y = parseFloat(arrXYZValues[5]);
        z = parseFloat(arrXYZValues[9]);
        w = parseFloat(arrXYZValues[13]);

        console.log("rotVec: ", x, y, z, w);
        rotVec = [x * quaternionScaleFactor, y * quaternionScaleFactor, z * quaternionScaleFactor, w * quaternionScaleFactor];

        updateQuaternion(rotVec);
	  }

	  if (sensorMap.has(sensor)) {
	    /*
	    rowIndex = sensorMap.get(sensor);
	    var row = table.rows[rowIndex];
	    var cell = row.cells[0];
	    cell.innerHTML = sensor;
	    cell = row.cells[1];
	    cell.innerHTML = parsedName;
	    cell = row.cells[2];
	    cell.innerHTML = parsedStringValue;
	    cell = row.cells[4];
	    var chartIdx = parsedName;

	    */

	    var cnt = 0;

	    if (sensorTypes[sensor].scheme == "singleRead") {
	      //Initial condition to draw the first chart point
	      if (sensorTypes[sensor].value == 0) {   //Plot doesn't exist yet because no valid data have been received
	        if (parsedValue != 0) {   //First valid data received: draw it in the chart
	          Plotly.newPlot(chartIdx,[{y:[parsedValue],type:'line'}]);
	          //Update json to signal that the reception started
	          cnt = cnt + 1;
	          sensorTypes[sensor].value = cnt;
	        }
	      } else {    //Plot already exists
	        Plotly.extendTraces(chartIdx,{y:[[parsedValue]]}, [0]);
	        cnt = sensorTypes[sensor].value;
	        sensorTypes[sensor].value = cnt + 1;
	      }

	      if (cnt > 200) {
	        Plotly.relayout(chartIdx,{
	          xaxis: {
	            range: [cnt-200,cnt]
	          }
	        });
	      }

	    } else if (sensorTypes[sensor].scheme == "xyz") {
	        //Parse 3D axes values
	        const arrXYZValues = parsedStringValue.split(" ");
	        console.log("Split: ", arrXYZValues);
	        console.log("Split[1]: ", arrXYZValues[1]);
	        console.log("Split[5]: ", arrXYZValues[5]);
	        console.log("Split[9]: ", arrXYZValues[9]);

	    /**
	      //Initial condition to draw the first chart point
	      if (sensorTypes[sensor].value == 0) {   //Plot doesn't exist yet because no valid data have been received
	        if (parsedValue != 0) {   //First valid data received: draw it in the chart
	          Plotly.newPlot(chartIdx,[{x:[arrXYZValues[1]],y:[arrXYZValues[5]],z:[arrXYZValues[9]],type:'mesh3d'}]);
	          //Update json to signal that the reception started
	          sensorTypes[sensor].value = parsedValue;
	        }
	      } else {    //Plot already exists
	        Plotly.extendTraces(chartIdx,{x:[[arrXYZValues[1]]],y:[[arrXYZValues[5]]],z:[[arrXYZValues[9]]]}, [0]);
	      }
	      */

	    }
	  }
	}

	function parseData(sensor, data) {
	  var sensorName = sensorTypes[sensor].name;
	  var scheme = sensorTypes[sensor].scheme;
	  var result = "";
	  var parse_scheme;
	  var eventcount;
	  // dataIndex start from 2 because the first bytes of the packet indicate
	  // the sensor id and the data size
	  var dataIndex = 0 + 2;
	  var value = 0;

	  if (scheme == "singleRead") {
	    parse_scheme = sensorTypes[sensor]["parse-scheme"];
	  } else if (scheme == "quaternion") {
	    parse_scheme = parseScheme["types"][0]["parse-scheme"];
	  } else if (scheme == "xyz") {
	    parse_scheme = parseScheme["types"][1]["parse-scheme"];
	  } else if (scheme == "orientation") {
	    parse_scheme = parseScheme["types"][2]["parse-scheme"];
	  } else if (scheme == "event") {
	    eventcount = sensorTypes[sensor].eventcount;
	    parse_scheme = parseScheme["types"][3]["parse-scheme"];
	  } else if (scheme == "activity") {
	    parse_scheme = parseScheme["types"][4]["parse-scheme"];
	  }

	  parse_scheme.forEach(element => {
	    //console.log(element);
	    var name = element['name'];
	    var valueType = element['type'];
	    var scale = element['scale-factor'];
	    var size = 0;

	    if (valueType == "uint8") {
	      value = data.getUint8(dataIndex, true) * scale; 
	      size = 1;
	    } else if (valueType == "int8") {
	      value = data.getInt8(dataIndex, true) * scale; 
	      size = 1;
	    } else if (valueType == "uint16") {
	      value = data.getUint16(dataIndex, true) * scale; 
	      size = 2;
	    } else if (valueType == "int16") {
	      value = data.getInt16(dataIndex, true) * scale; 
	      size = 2;
	    } else if (valueType == "uint24") {
	      value = data.getUint16(dataIndex, true) + (data.getUint8(dataIndex+2, true) << 16);
	      size = 3;
	    } else if (valueType == "uint32") {
	      value = data.getUint16(dataIndex, true) + (data.getUint16(dataIndex+2, true) << 16);
	      size = 4;
	    } else if (valueType == "float") {
	      value = data.getFloat32(dataIndex, true) * scale; 
	      size = 4;
	    } else if (valueType == "none") {
	      value = eventcount + 1;
	      sensorTypes[sensor].eventcount = value;
	      size = 0;
	    } else {
	      console.log("Error: unknown type");
	    }

	    if (scheme == "activity") {
	      value = geActivityString(value);
	    }
	    result = result + element.name + ": " + value + "   ";
	    //console.log(dataIndex);
	    dataIndex += size;

	  });

	  return [sensorName, result, value];
	}

	function geActivityString(value) {

	  const activityMessages = ["Still activity ended",
	                            "Walking activity ended",
	                            "Running activity ended",
	                            "On bicycle activity ended",
	                            "In vehicle activity ended",
	                            "Tilting activity ended",
	                            "In vehicle still ended",
	                            "",
	                            "Still activity started",
	                            "Walking activity started",
	                            "Running activity started",
	                            "On bicycle activity started",
	                            "In vehicle activity started",
	                            "Tilting activity started",
	                            "In vehicle still started",
	                            ""];

	  for (let i = 0; i < 16; i++) {
	    maskedVal = (value & (0x0001 << i)) >> i;
	    if (maskedVal) {
	      console.log(activityMessages[i]);
	      return [activityMessages[i]];
	    }
	  }
	}
	//</WebBLE> 


	var container;

	var camera, scene, renderer;

	var cube, plane;

	var mouseDown = false;
	var rotateStartPoint = new THREE.Vector3(0, 0, 1);
	var rotateEndPoint = new THREE.Vector3(0, 0, 1);

	var curQuaternion;
	var windowHalfX = window.innerWidth / 2;
	var windowHalfY = window.innerHeight / 2;
	var rotationSpeed = 2;
	var lastMoveTimestamp,
		moveReleaseTimeDelta = 50;

	var startPoint = {
		x: 0,
		y: 0
	};

	var quatEv = [0, 0, 0, 1];

    const cubeDimension = 70


	var setup = function()
	{
		container = document.createElement('div');
		document.body.appendChild(container);

		var info = document.createElement('div');
		info.style.position = 'absolute';
		info.style.top = '10px';
		info.style.width = '100%';
		info.style.textAlign = 'center';
		container.appendChild(info);

		camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 1000);
		camera.position.y = 150;
		camera.position.z = 500;

		scene = new THREE.Scene();

		// Cube

		var boxGeometry = new THREE.BoxGeometry(cubeDimension, cubeDimension, cubeDimension);

		for (var i = 0; i < boxGeometry.faces.length; i += 2)
		{

			var color = {
				h: (1 / (boxGeometry.faces.length)) * i,
				s: 0.5,
				l: 0.5
			};

			boxGeometry.faces[i].color.setHSL(color.h, color.s, color.l);
			boxGeometry.faces[i + 1].color.setHSL(color.h, color.s, color.l);

		}

		var cubeMaterial = new THREE.MeshBasicMaterial(
		{
			vertexColors: THREE.FaceColors,
			overdraw: 0.5
		});

		cube = new THREE.Mesh(boxGeometry, cubeMaterial);
		cube.position.y = cubeDimension;
		scene.add(cube);

		// Plane

		var planeGeometry = new THREE.PlaneGeometry(cubeDimension, cubeDimension);
		planeGeometry.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

		var planeMaterial = new THREE.MeshBasicMaterial(
		{
			color: 0xe0e0e0,
			overdraw: 0.5
		});

		plane = new THREE.Mesh(planeGeometry, planeMaterial);
		scene.add(plane);

		renderer = new THREE.CanvasRenderer();
		renderer.setClearColor(0xf0f0f0);
		renderer.setSize(window.innerWidth, window.innerHeight);

		container.appendChild(renderer.domElement);


		window.addEventListener('resize', onWindowResize, false);

		animate();
	};

	function onWindowResize()
	{
		windowHalfX = window.innerWidth / 2;
		windowHalfY = window.innerHeight / 2;

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function animate()
	{
		requestAnimationFrame(animate);
		render();
	}

	function updateQuaternion(value) 
	{
		//console.log("rotVec:", value[0], value[1], value[2], value[3]);
		quatEv = value;
	}

	function render()
	{
        handleRotation();

		renderer.render(scene, camera);
	}

	var handleRotation = function()
	{
		curQuaternion = cube.quaternion;
        curQuaternion.set(quatEv[0], quatEv[1], quatEv[2], quatEv[3]);
		curQuaternion.normalize();
		cube.setRotationFromQuaternion(curQuaternion);
	};

	// PUBLIC INTERFACE
	return {
		init: function()
		{
			setup();
		}

	};
})();

document.onreadystatechange = function()
{
	if (document.readyState === 'complete')
	{
		Defmech.RotationWithQuaternion.init();
	}
};


//document.getElementById('sensorId').value = '10';
//document.getElementById('rate').value = '0';
//document.getElementById('latency').value = '0';

