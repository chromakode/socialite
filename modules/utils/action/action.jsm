// Object-oriented action handler glue

logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["Action", "ActionType"];

function Action(name, func) {
  // Create a new object "class" for this action
  var ActionClass = function(){};

  // Give all instantiated actions the common parent class and set base properties
  ActionClass.prototype = new ActionType();
  ActionClass.prototype.name = name;
  ActionClass.prototype.func = func;
  
  // Method to instantiate a new action, binding it to the object the method was called on
  var ActionConstructorMethod = function(successCallback, failureCallback) {
    var action = new ActionClass();
    
    action.thisObj = this;
    action.successCallback = successCallback;
    action.failureCallback = failureCallback;
    action.startTime = null;
    
    return action;
  }
  
  // To modify the action class after the fact, we'll create a property on the constructor
  ActionConstructorMethod.actionClass = ActionClass;
  
  return ActionConstructorMethod;
}

function ActionType() {}

ActionType.prototype.perform = function() {
  logger.log("action", "Performing " + this.name + " action");

  this.startTime = Date.now();
  
  var argArray = Array.prototype.splice.call(arguments, 0) || [];

  // Copy and store the array
  this.lastArgs = argArray.concat();
  
  // Add this action object to the end of the arguments list and call.
  var newargs = this.addToArgs(argArray);
  return this.func.apply(this.thisObj, newargs);
}

ActionType.prototype.addToArgs = function(args) {
  // Arguments contain the arguments passed to this function, with this action object at the end.
  var newargs = Array.prototype.splice.call(args, 0) || [];
  if (newargs[newargs.length-1] != this) {
    newargs.push(this);
  }
  return newargs;
}

ActionType.prototype.doCallback = function(callback, args) {
  // Arguments contain the arguments passed to this function, with this action object at the end.
  var newargs = this.addToArgs(args);
  
  if (callback) {
    // A little sugar to allow actions to be passed in without calling toFunction()
    if (callback instanceof ActionType) {
      return callback.perform.apply(callback, newargs);
    } else {
      return callback.apply(this.thisObj, newargs);
    }
  }
}

ActionType.prototype.success = function() {
  logger.log("action", this.name + " succeeded");
  return this.doCallback(this.successCallback, arguments);
}

ActionType.prototype.failure = function() {
  logger.log("action", this.name + " failed");
  return this.doCallback(this.failureCallback, arguments);
}

ActionType.prototype.toFunction = function() {
  var self = this;
  
  var doAction = function() {
    return self.perform.apply(self, arguments);
  }
  
  return doAction;
}

ActionType.prototype.chainTo = function(action) {
  this.successCallback = function() {action.success.apply(action, arguments)}
  this.failureCallback = function() {action.failure.apply(action, arguments)}
  
  return;
}
