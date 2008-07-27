var EXPORTED_SYMBOLS = ["String.prototype.startsWith", "String.prototype.endsWith"];

String.prototype.startsWith = function(strCheck) {
  return this.substring(0, strCheck.length) == strCheck;
}

String.prototype.endsWith = function(strCheck) {
  return this.lastIndexOf(strCheck) == (this.length - strCheck.length)
}
