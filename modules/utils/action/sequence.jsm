// A failure callback to retry an action a set number of times

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
