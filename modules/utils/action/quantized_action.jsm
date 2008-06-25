// An action that ensures that it only calls the function once the action has not been performed for an interval (a form of flood control).

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["QuantizedAction"]

function QuantizedAction(actionName, actionFunc, interval, sameFunc) {
  var action = Action(actionName, actionFunc);
  
  action.interval = interval;
  if (sameFunc) {
    action.sameFunc = sameFunc;
  } else {
    action.sameFunc = function() {return false};
  }
  
  action.waitingSet = [];
  action.timer = Components.classes["@mozilla.org/timer;1"]
                 .createInstance(Components.interfaces.nsITimer);
  action.timerIsRunning = false;
  
  // Hook into the perform method of the action.
  action.prototype.perform = function() {
    action.performQuantized(this, arguments);
  }
  
  // Called when an action is performed
  action.performQuantized = function(act, args) {
    debug_log("quantize", "Received perform request for " + this.prototype.actionName);
  
    // Scan for an existing equivalent call, and replace it.
    for (var i=0; i<this.waitingSet.length; i++) {
      var entry = this.waitingSet[i];
      if (this.sameFunc(entry.args, args)) {
        entry.args = args;
        entry.wasCalled = true;
        return;
      }
    }
  
    // If an equivalent call was not found, create a new entry.
    var entry = {
      act: act,
      args: args,
      wasCalled: false,
    }
    this.waitingSet.push(entry);

    var self = this;
    if (!this.timerIsRunning) {
      this.timer.initWithCallback(
        function() {self.performEvents.apply(self)}, 
        this.interval,  
        this.timer.TYPE_REPEATING_SLACK
      );
      this.timerIsRunning = true;
    }
  }
  
  // Called when the timer ticks
  action.performEvents = function() {
    for (var i=0; i<this.waitingSet.length; i++) {
      var entry = this.waitingSet[i];
      
      // If the action wasn't called within the last interval, perform it now.
      if (!entry.wasCalled) {
        // Remove the entry
        this.waitingSet.splice(i, 1);
        
        // Perform the action
        ActionType.prototype.perform.apply(entry.act, entry.args);
      } else {
        debug_log("quantize", "Delaying " + this.prototype.actionName + " action");
        // Reset the flag
        entry.wasCalled = false;
      }
    }
    
    // If nothing is left queued, stop the timer.
    if (this.waitingSet.length == 0) {
      this.timer.cancel();
      this.timerIsRunning = false;
    }
  }
  
  return action;
}
