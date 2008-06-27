// An class that contains a collection of properties, with timestamps for when they were last 

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");

var EXPORTED_SYMBOLS = ["TimestampedData"];

function TimestampedData() {
  this.values = {};
  this.timestamps = {};
  this.lastUpdated = Date.now();
}

TimestampedData.prototype.addField = function(name, initialValue) {
  if (!initialValue) {
    initialValue = null;
  }
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
