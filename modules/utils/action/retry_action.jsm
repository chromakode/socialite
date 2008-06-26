// A failure callback to retry an action a set number of times

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");

var EXPORTED_SYMBOLS = ["retryAction"];

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
    debug_log(this.name, action.name + " has failed, retrying (" + this.count + " retrys left)");
    
    var doRetry = function() {
      // Call the retry callback
      this.doCallback(this.retryCallback, null, arguments);
         
      this.count -= 1;
        
      // Perform the action again.
      action.perform.apply(action, arguments);
    }
    
    if (this.delay) {      
      debug_log(this.name, "Waiting " + this.delay + " milliseconds");
      this.timer.initWithCallback(hitchThis(this, doRetry), this.delay, this.timer.TYPE_ONE_SHOT);
    } else {
      doRetry();
    }
  }
});
