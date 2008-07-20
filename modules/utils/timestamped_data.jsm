// An class that contains a collection of properties, with timestamps for when they were last 

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");

var EXPORTED_SYMBOLS = ["TimestampedData"];

function TimestampedData() {
  this.fields = [];
  this.values = {};
  this.timestamps = {};
  this.lastUpdated = Date.now();
}

TimestampedData.prototype.addField = function(name, initialValue) {
  if (!initialValue) {
    initialValue = null;
  }
  this.fields.push(name);
  this.values[name] = initialValue;
  this.__defineSetter__(name, hitchHandler(this, "setField", name));
  this.__defineGetter__(name, hitchHandler(this, "getField", name));
  this.timestamps[name] = Date.now();
}

TimestampedData.prototype.getField = function(name) {
  return this.values[name];
}

TimestampedData.prototype.setField = function(name, value) {
  var time = Date.now();
  
  this.values[name] = value;
  
  this.timestamps[name] = time;
  this.lastUpdated = time;
}

TimestampedData.prototype.getTimestamp = function(name) {
  return this.timestamps[name];
}

TimestampedData.prototype.copy = function(data, omit) {
  for (var i=0; i<data.fields.length; i++) {
    var field = data.fields[i];
    if ((field in this) &&
        !(omit && !(omit.indexOf(field) == -1))) {  
      this[field] = data[field];
    }
  }
}
