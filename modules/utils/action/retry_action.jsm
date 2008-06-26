// A failure callback to retry an action a set number of times

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["retryAction"]

function retryAction(startCount, delay, retryCallback, successCallback, failureCallback) {
  var act = new _RetryAction(successCallback, failureCallback);
  act.count = startCount;
  act.delay = delay
  act.retryCallback = retryCallback;
  act.timer = Components.classes["@mozilla.org/timer;1"]
              .createInstance(Components.interfaces.nsITimer);
  return act;
}

var _RetryAction = Action("retry", function() {
  var argsLen = arguments.length;
  
  // Get the last argument
  var action = arguments[argsLen-1];

  if (!this.count) {
    this.failure.apply(this, arguments);
  } else {
    var self = this;
    debug_log(self.name, action.name + " has failed, retrying (" + self.count + " retrys left)");
    
    var doRetry = function() {
      // Call the retry callback
      self.doCallback(self.retryCallback, null, arguments);
         
      self.count -= 1;
        
      // Perform the action again.
      action.perform.apply(action, arguments);
    }
    
    if (this.delay) {      
      debug_log(self.name, "Waiting " + self.delay + " milliseconds");
      this.timer.initWithCallback(doRetry, this.delay, this.timer.TYPE_ONE_SHOT);
    } else {
      doRetry();
    }
  }
});
