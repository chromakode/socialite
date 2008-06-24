/*
"The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
http://code.reddit.com/LICENSE. The License is based on the Mozilla Public
License Version 1.1, but Sections 14 and 15 have been added to cover use of
software over a computer network and provide for limited attribution for the
Original Developer. In addition, Exhibit A has been modified to be consistent
with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Reddit.

The Original Developer is the Initial Developer.  The Initial Developer of the
Original Code is CondeNet, Inc.

Contributor(s):
  Chromakode <chromakode@gmail.com>

All portions of the code written by CondeNet are Copyright (c) 2006-2008
CondeNet, Inc. All Rights Reserved.
*/

var EXPORTED_SYMBOLS = ["redditRequest", "redditRequest_no_response"]

STATUS_READY = 4;

// Reddit access code patched together from the reddit.com javascript

// From http://code.reddit.com/browser/r2/r2/public/static/utils.js

// Chromakode: modified to merge in Object.__iter__
function make_get_params(obj) {
  makeParam = function(x, y) {
    return x + "=" + encodeURIComponent(y);
  };
      
  var res = [];
  for(var o in obj) {
    if(!(o in Object.prototype)) {
      res.unshift(makeParam(o, obj[o]));
    }
  }
  return res.join("&");
}

// Chromakode: modified to include get/post method argument
function redditRequest(op, parameters, worker_in, method, base) {
  if (!parameters) {
    parameters = {};
  }
  
  if (!method) {
    method = "post";
  }
  
  if (!base) {
    var base = "http://www.reddit.com/api/";
  }
  
  var url = base + op;
  var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
  
  var worker = function(r) {
    if (r.target.readyState == STATUS_READY) {
      return worker_in(r.target);
    }
  };
  
  var get_params = make_get_params(parameters);
  
  if (method == "get") {
    req.open("get", url + "?" + get_params, true);
    req.onreadystatechange = worker;
    req.send(null);
  } else if (method == "post") {
    req.open("post", url, true);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.onreadystatechange = worker;
    req.send(get_params);
  }
}
function redditRequest_no_response(op, parameters, method) {
  redditRequest(op, parameters, function(r){}, method);
}

