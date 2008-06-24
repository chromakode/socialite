// Object-oriented action handler glue

Components.utils.import("resource://socialite/debug.jsm");

var EXPORTED_SYMBOLS = ["Action", "ActionType"]

function Action(actionName, actionFunc) {
  // Make a copy of the constructor function
  var action = function() { _MakeAction.apply(this, arguments); };

  // Make an action object, instantiatable with callbacks
  action.prototype = new ActionType();
  action.prototype.actionName = actionName;
  action.prototype.actionFunc = actionFunc;
  
  return action;
}

_MakeAction = function(successCallback, failureCallback) {
  this.successCallback = successCallback;
  this.failureCallback = failureCallback;
}

function ActionType() {}

ActionType.prototype.perform = function() {
  debug_log("action", "Performing "+ this.actionName + " action");

  var result = this.actionFunc.apply(this, arguments);
}

ActionType.prototype.doCallback = function(callback, args) {
  // Arguments contain the arguments passed to this function,
  // with the action object and result at the end.
  var newargs = Array.prototype.splice.call(args, 0) || [];
  newargs.push(this);
  
  if (callback) {
    if (callback instanceof ActionType) {
      return callback.perform.apply(callback, newargs);
    } else {
      return callback.apply(null, newargs);
    }
  }
}

ActionType.prototype.success = function() {
  debug_log("action", this.actionName + " succeeded");
  return this.doCallback(this.successCallback, arguments);
}

ActionType.prototype.failure = function() {
  debug_log("action", this.actionName + " failed");
  return this.doCallback(this.failureCallback, arguments);
}

ActionType.prototype.toFunction = function() {
  var self = this;
  
  var doAction = function() {
    return self.perform.apply(self, arguments);
  }
  
  return doAction;
}
