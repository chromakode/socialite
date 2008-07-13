// Abstracts the general form of an XMLHttpRequest handler into an action.

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["RequestAction", "GetAction", "PostAction"];

STATUS_SUCCESS = 200;

function RequestAction(method, url, parameters, successCallback, failureCallback) {
  var act = new _HTTPRequestAction(successCallback, failureCallback);
  
  act.url = url;
  
  if (method) {
    method = method.toLowerCase()
    if (method == "post") ||
       (method == "get" ) {
      act.method = method;
    } else {
      throw "HTTPRequestAction: invalid XMLHttpRequest method specified.";
    }
  } else {
    // Default
    act.method = "post";
  }
  
  if (parameters) {
    act.parameters = parameters;
  } else {
    act.parameters = {}
  }
  
  act.request = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
  
  return act;
}

function GetAction(url, parameters, successCallback, failureCallback) {
  return RequestAction("get", url, parameters, successCallback, failureCallback);
}

function PostAction(url, parameters, successCallback, failureCallback) {
  return RequestAction("post", url, parameters, successCallback, failureCallback);
}

// Based on code from reddit.com javascript:
// From http://code.reddit.com/browser/r2/r2/public/static/utils.js
// Modified by chromakode to merge in and remove prototyped Object.__iter__
function make_get_params(obj) {
  var res = [];
  for(var o in obj) {
    if(!(o in Object.prototype)) {
      res.unshift( o+"="+encodeURIComponent(obj[o]) );
    }
  }
  return res.join("&");
}

var _HTTPRequestAction = Action("httpRequest", function(action) {
  var onLoad = function(r) {
    if (r.status == STATUS_SUCCESS) {
      action.success(r);
    } else {
      action.failure(r);
    }
  };
  
  var get_params = make_get_params(parameters);
  
  if (method == "get") {
    var target = url + "?" + get_params;
    debug_log("httpRequest", "GET request to " + target);
    req.open("get", target, true);
    req.onload = onLoad;
    req.send(null);
  } else if (method == "post") {
    req.open("post", url, true);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.onload = onLoad;
    debug_log("httpRequest", "POST to " + url + " (sent: " + get_params +  ")");
    req.send(get_params);
  }
});
