function String.prototype.startsWith(strTarget, strCheck) {
  return this.substring(0, strCheck.length) == strCheck;
}

function String.prototype.endsWith(strTarget, strCheck) {
  return this.lastIndexOf(strCheck) == (this.length - strCheck.length)
}
