// High-level reddit commands

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/reddit/reddit_request.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["info", "randomrising", "vote", "save", "unsave"];

STATUS_SUCCESS = 200;

QUANTIZE_TIME = 1000;

var infoQuantizer = new Quantizer("reddit.info.quantizer", QUANTIZE_TIME);
infoQuantizer.sameFunc = function(func1, arg1, func2, arg2) {
  var url1 = arg1[0];
  var url2 = arg2[0];
  
  return (url1 == url2);
};
var info = Action("reddit.info", infoQuantizer.quantize(function(url, action) {
  debug_log("reddit", "Making ajax info call");
  
  var params   = {
    url:    url,
    sr:     "",
    count:  1,
  };
    
  redditRequest("info.json", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    } else {
      action.failure(r);
    }
  }, "get");
}));


var randomrising = Action("reddit.randomrising", function(action) {
  debug_log("reddit", "Making ajax randomrising call");
  
  var params   = {
    limit: 1,
  };
    
  redditRequest("randomrising.json", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    } else {
      action.failure(r);
    }
  }, "get", "http://www.reddit.com/");
});

var sameLinkID = function(func1, arg1, func2, arg2) {
  var linkID1 = arg1[1];
  var linkID2 = arg2[1];
  
  return (linkID1 == linkID2);
};

var voteQuantizer = new Quantizer("reddit.vote.quantizer", QUANTIZE_TIME, sameLinkID);
var vote = Action("reddit.vote", voteQuantizer.quantize(function(modHash, linkID, isLiked, action) {
  debug_log("reddit", "Making ajax vote call");
  
  var dir;
  if (isLiked == true) {
    dir = 1;
  } else if (isLiked == false) {
    dir = -1;
  } else {
    dir = 0;
  }
  
  var params   = {
    id:    linkID,
    uh:    modHash,
    dir:   dir,
  };
  
  redditRequest("vote", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      action.success(r);
    } else {
      action.failure(r);
    }
  });
}));

var saveQuantizer = new Quantizer("reddit.save.quantizer", QUANTIZE_TIME, sameLinkID);
var save = Action("reddit.save", saveQuantizer.quantize(function(modHash, linkID, action) {
  debug_log("reddit", "Making ajax save call");
  
  var params   = {
    id:    linkID,
    uh:    modHash,
  };
  
  redditRequest("save", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      action.success(r);
    } else {
      action.failure(r);
    }
  });
}));

var unsave = Action("reddit.unsave", saveQuantizer.quantize(function(modHash, linkID, action) {
  debug_log("reddit", "Making ajax unsave call");
  
  var params   = {
    id:    linkID,
    uh:    modHash,
  };
  
  redditRequest("unsave", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      action.success(r);
    } else {
      action.failure(r);
    }
  });
}));
