Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/reddit/reddit_request.jsm");

var info = Action("info", function(href) {
  debug_log("reddit", "Making ajax info call");
  
  var params   = {
    url:    linkInfo.linkHref,
    sr:     "",
    count:  1,
  };
    
  redditRequest("info.json", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      this.success();
    } else {
      this.failure();
    }
  }, "get");
});

var vote = Action("vote", function(modHash, linkID, isLiked) {
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
    id:    linkInfo.linkID,
    uh:    this.redditModHash,
    dir:   dir,
  };
  
  redditRequest("vote", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      this.success();
    } else {
      this.failure();
    }
  });
});

var save = Action("save", function(modHash, linkID) {
  debug_log("reddit", "Making ajax save call");
  
  var params   = {
    id:    linkInfo.linkID,
    uh:    this.redditModHash,
  };
  
  redditRequest("save", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      this.success();
    } else {
      this.failure();
    }
  });
});

var unsave = Action("unsave", function(modHash, linkID) {
  debug_log("reddit", "Making ajax unsave call");
  
  var params   = {
    id:    linkInfo.linkID,
    uh:    this.redditModHash,
  };
  
  redditRequest("unsave", params, function(r){ 
    if (r.status == STATUS_SUCCESS) {
      this.success();
    } else {
      this.failure();
    }
  });
});
