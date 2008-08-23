// A failure callback to retry an action a set number of times

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");

var EXPORTED_SYMBOLS = ["retryAction"];

function retryAction(startCount, delay, retryCallback, successCallback, failureCallback) {
  var act = _RetryAction(successCallback, failureCallback);
  act.count = startCount;
  act.delay = delay
  act.retryCallback = retryCallback;
  act.timer = Components.classes["@mozilla.org/timer;1"]
              .createInstance(Components.interfaces.nsITimer);
  return act;
}

var _RetryAction = Action("retry", function() {
  var argsLen = arguments.length;

  var retryAction = arguments[argsLen-1];
  var action = arguments[argsLen-2];

  if (!retryAction.count) {
    retryAction.failure.apply(retryAction, arguments);
  } else {
    logger.log(retryAction.name, action.name + " has failed, retrying (" + retryAction.count + " retrys left)");
    
    var args = arguments;
    var doRetry = function() {
      // Call the retry callback
      var continueRetry = retryAction.doCallback(this.retryCallback, null, args);
      if (continueRetry == null || continueRetry == true) {
        retryAction.count -= 1;
        
        // Perform the action again.
        action.perform.apply(action, action.lastArgs);
      } else {
        logger.log(retryAction.name, "Retry callback has signalled to stop retrying; retry aborted");
        retryAction.failure.apply(retryAction, arguments);
      }
    };
    
    if (retryAction.delay) {      
      logger.log(retryAction.name, "Waiting " + retryAction.delay + " milliseconds");
      retryAction.timer.initWithCallback(
        doRetry,
        retryAction.delay,
        retryAction.timer.TYPE_ONE_SHOT
      );
    } else {
      doRetry();
    }
  }
});
