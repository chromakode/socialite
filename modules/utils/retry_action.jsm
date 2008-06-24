// A failure callback to retry an action a set number of times

Components.utils.import("resource://socialite/debug.jsm");

var EXPORTED_SYMBOLS = ["RetryAction"]

function retryAction(startCount, retryCallback, successCallback, failureCallback) {
  var act = new _RetryAction(successCallback, failureCallback);
  act.count = startCount;
  act.retryCallback = retryCallback;
  
  return act;
}

var _RetryAction = Action("retry", function() {
  var argsLen = arguments.length;
  
  // Get the last argument
  var action = arguments[argsLen-1];

  if (!this.count) {
    return false;
  } else {
    // Call the retry callback
    this.doCallback(this.retryCallback, null, arguments);
    
    debug_log(action.actionName+"-"+this.actionName, action.actionName + " failed, retrying (" + count + " retrys left)");
       
    this.count -= 1;
      
    // Perform the action again.
    return action.perform.apply(action, arguments);
  }
});
