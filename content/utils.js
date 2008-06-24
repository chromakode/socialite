var SocialitePrefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.socialite.");
SocialitePrefs.QueryInterface(Components.interfaces.nsIPrefBranch2);

// Nice closure-based partial application method from Greasemonkey. (originally GM_hitch)
function hitchHandler(obj, meth) {
  if (!obj[meth]) {
    throw "method '" + meth + "' does not exist on object '" + obj + "'";
  }

  var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

  return function() {
    // make a copy of staticArgs (don't modify it because it gets reused for
    // every invocation).
    var args = staticArgs.concat();

    // add all the new arguments
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    // invoke the original function with the correct this obj and the combined
    // list of static and dynamic arguments.
    return obj[meth].apply(obj, args);
  };
}

// Similar to hitchHandler, but puts dynamic arguments before static ones
function hitchHandlerFlip(obj, meth) {
  if (!obj[meth]) {
    throw "method '" + meth + "' does not exist on object '" + obj + "'";
  }

  var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

  return function() {
    // make a copy of staticArgs (don't modify it because it gets reused for
    // every invocation).
    var args = staticArgs.concat();

    // add all the new arguments first
    for (var i = arguments.length-1; i >= 0; i--) {
      args.unshift(arguments[i]);
    }

    // invoke the original function with the correct this obj and the combined
    // list of static and dynamic arguments.
    return obj[meth].apply(obj, args);
  };
}

// Add an event listener that only fires once.
function makeOneShot(instance, type, listener, useCapture) {

  var oneShotListener = function () {
    instance.removeEventListener(type, oneShotListener, useCapture);
    listener.apply(null, arguments);
  }
  
  instance.addEventListener(type, oneShotListener, useCapture);
}

function retryHandler(thisArg, count) {
  retry = function() {
    var thisFunc = arguments.callee;

//    debug_log("retryHandler", 

    // Retry the handler call with the given arguments,
    // and a fail handler to retry with the decremented count.
    thisFunc.caller.apply(thisArg, arguments,
      retryHandler(count-1, thisArg));
  }
}

function debug_log(section, msg) {
  if (SocialitePrefs.getBoolPref("debug")) {
    if (SocialitePrefs.getBoolPref("debugInErrorConsole")) {
      const consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
      consoleService.logStringMessage("[Socialite] " + section + " -- " + msg + "\n");
    } else {
      dump("[Socialite] " + section + " -- " + msg + "\n");
    }
  }
}
