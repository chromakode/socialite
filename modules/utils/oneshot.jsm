// Add an event listener that only fires once.

var EXPORTED_SYMBOLS = ["makeOneShot"]

function makeOneShot(instance, type, listener, useCapture) {

  var oneShotListener = function () {
    instance.removeEventListener(type, oneShotListener, useCapture);
    listener.apply(null, arguments);
  }
  
  instance.addEventListener(type, oneShotListener, useCapture);
}
