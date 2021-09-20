var sensorMap = new Map();
var parseScheme;
var sensorTypes;

fetch("./parse-scheme.json")
    .then(response => response.json())
    .then(json => {
        console.log(json);
        parseScheme = json;
    });

//fetch("./sensor-type.json")
fetch("./sensor-type-map.json")
    .then(response => response.json())
    .then(json => {
        console.log(json);
        sensorTypes = json;
    });


function toInt24(n) {
    neg =  n & 0x800000;
    if (!neg) {
        return n;
    } else {
        return -(0xffffff - n + 1);
    }
}

function parseData(sensor, data) {
  var type = sensorTypes[sensor].type;
  var sensorName = sensorTypes[sensor].name;
  var scheme = parseScheme["types"][type]["parse-scheme"];
  var result = {};

  var result_str = "";

  // dataIndex start from 2 because the first bytes of the packet indicate
  // the sensor id and the data size
  var dataIndex = 0 + 2;
  elem_entries = scheme.length;
  //scheme.forEach(element => {
  let i = 0;
  while (i < elem_entries) {
    element = scheme[i];
    //console.log(element);
    var name = element['name'];
    var valueType = element['type'];
    var scale = element['scale-factor'];
    var value = 0;
    var size = 0;

    result["name"] = sensorName;
    result["pktLen"] = data.byteLength;
      
    if (valueType == "uint8") {
      value = data.getUint8(dataIndex, true); 
      size = 1;
    } else if (valueType == "uint16") {
      value = data.getUint16(dataIndex, true);
      size = 2;
    } else if (valueType == "uint24") {
      value = data.getUint16(dataIndex, true) + (data.getUint8(dataIndex+2, true) << 16);
      size = 3;
    } else if (valueType == "uint32") {
      value = data.getUint16(dataIndex, true) + (data.getUint16(dataIndex+2, true) << 16);
      size = 4;
    } else if (valueType == "int16") {
      value = data.getInt16(dataIndex, true); 
      size = 2;
    } else if (valueType == "int24") {
      value = data.getUint16(dataIndex, true) + (data.getUint8(dataIndex+2, true) << 16);
      value = toInt24(value);
      size = 3;
    } else if (valueType == "float") {
      value = data.getFloat32(dataIndex, true); 
      size = 4;
    } else {
      console.log("Error: unknown type " + name);
      value = "undefined";
    }

    if (scale != undefined) {
      value = (value * scale).toFixed(4);
    } else {
        //console.log(name + " has no scale");
    }

    result[name] = value;
    //result_str = result_str + element.name + ':"' + value + '"' + ",";
    //console.log(dataIndex);
    dataIndex += size;
    if (dataIndex >= data.byteLength) {
        return result;
    }
  //});
    i++;
  }

  console.log(result);
  return result;
}

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
