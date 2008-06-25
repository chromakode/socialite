// High-level reddit commands

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/reddit/reddit_request.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/action/quantized_action.jsm");

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["info", "vote", "save", "unsave", "logSuccess"]

STATUS_SUCCESS = 200;

QUANTIZE_TIME = 1000;

var info = Action("reddit.info", function(href) {
  debug_log("reddit", "Making ajax info call");
  
  var params   = {
    url:    href,
    sr:     "",
    count:  1,
  };
    
  var self = this;
  redditRequest("info.json", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      var json = nativeJSON.decode(r.responseText);
      self.success(r, json);
    } else {
      self.failure(r);
    }
  }, "get");
});

var randomrising = Action("reddit.randomrising", function() {
  debug_log("reddit", "Making ajax randomrising call");
  
  var params   = {
    limit: 1,
  };
    
  var self = this;
  redditRequest("randomrising.json", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      var json = nativeJSON.decode(r.responseText);
      self.success(r, json);
    } else {
      self.failure(r);
    }
  }, "get", "http://www.reddit.com/");
});

var vote = QuantizedAction("reddit.vote", function(modHash, linkID, isLiked) {
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
  
  var self = this;
  redditRequest("vote", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      self.success(r);
    } else {
      self.failure(r);
    }
  });
});

vote.interval = QUANTIZE_TIME;
vote.sameFunc = function(arg1, arg2) {
  var linkID1 = arg1[1];
  var linkID2 = arg2[1];
  
  return (linkID1 == linkID2);
};

var save = Action("reddit.save", function(modHash, linkID) {
  debug_log("reddit", "Making ajax save call");
  
  var params   = {
    id:    linkID,
    uh:    modHash,
  };
  
  var self = this;
  redditRequest("save", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      self.success(r);
    } else {
      self.failure(r);
    }
  });
});

var unsave = Action("reddit.unsave", function(modHash, linkID) {
  debug_log("reddit", "Making ajax unsave call");
  
  var params   = {
    id:    linkID,
    uh:    modHash,
  };
  
  var self = this;
  redditRequest("unsave", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      self.success(r);
    } else {
      self.failure(r);
    }
  });
});
