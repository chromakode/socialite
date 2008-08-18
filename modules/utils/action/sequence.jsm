// A helper function to call a list of functions in sequence

logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["sequenceCalls"];

function sequenceCalls() {
  var callbacks = Array.prototype.splice.call(arguments, 0) || [];
  
  var sequence = function () {
    for (var i=0; i<callbacks.length; i++) {
      callbacks[i].apply(null, arguments);
    }
  }
  
  return sequence;
}
