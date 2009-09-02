// An action that caches an action's result, refreshing it when it expires

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["CachedAction"];

function CachedAction(updateAction, expireSeconds) {
  let updateActionName = updateAction.actionClass.prototype.name;
  let ActionConstructor = Action(updateActionName+"-cached", _cachedAction);
  
  let actionPrototype = ActionConstructor.actionClass.prototype;
  actionPrototype.updateAction = updateAction;
  actionPrototype.expireSeconds = expireSeconds;
  
  return ActionConstructor;
}

function _cachedAction(action) {  
  let actionClass = action.__proto__;
  
  let now = Date.now();
  let elapsed = now - actionClass.lastUpdated; 
  
  if (actionClass._value && elapsed < actionClass.expireSeconds*1000) {
    action.success.apply(action, actionClass._value);
  } else {
    actionClass.updateAction.call(this,
      function success() {
        actionClass._value = arguments;
        actionClass.lastUpdated = Date.now();
        action.success.apply(action, actionClass._value);
      },
      function failure(r) { action.failure(r); }
    ).perform()
  }
}