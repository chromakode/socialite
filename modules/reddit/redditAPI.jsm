// High-level reddit commands

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["RedditAPI"];

QUANTIZE_TIME = 1000;

var REDDIT_API_PATH = "api/";
function APIURL(siteURL, op, subreddit) {
  // Note: vote calls will 404 without the 'www.' (included in site URL)
  var subredditPart;
  if (subreddit) {
    subredditPart = "r/" + subreddit + "/";
  } else {
    subredditPart = ""; 
  }
  return siteURL + subredditPart + REDDIT_API_PATH + op;
}

function sameURL(func1, arg1, func2, arg2) {
  var url1 = arg1[0];
  var url2 = arg2[0];
  var subreddit1 = arg1[1];
  var subreddit2 = arg2[1];
  
  return (url1 == url2) && (subreddit1 == subreddit2);
}

function sameLinkID(func1, arg1, func2, arg2) {
  var linkID1 = arg1[0];
  var linkID2 = arg2[0];
  
  return (linkID1 == linkID2);
}

function RedditAPI(auth) {
  this.auth = auth;
  
  this.infoQuantizer = new Quantizer("reddit.info.quantizer", QUANTIZE_TIME, sameURL);
  this.info = Action("reddit.info", this.infoQuantizer.quantize(this._info));
  
  this.voteQuantizer = new Quantizer("reddit.vote.quantizer", QUANTIZE_TIME, sameLinkID);
  this.vote = Action("reddit.vote", this.voteQuantizer.quantize(this._vote));
  
  this.saveQuantizer = new Quantizer("reddit.save.quantizer", QUANTIZE_TIME, sameLinkID);
  this.save = Action("reddit.save", this.saveQuantizer.quantize(this._save));
  this.unsave = Action("reddit.unsave", this.saveQuantizer.quantize(this._unsave));
  
  this.hideQuantizer = new Quantizer("reddit.hide.quantizer", QUANTIZE_TIME, sameLinkID);
  this.hide = Action("reddit.hide", this.hideQuantizer.quantize(this._hide));
  this.unhide = Action("reddit.unhide", this.hideQuantizer.quantize(this._unhide));
}

RedditAPI.prototype._info = function(url, subreddit, action) {
  logger.log("reddit", "Making ajax info call");
  
  var params = {
    url:    url,
    count:  1
  };
   
  http.GetAction(
    APIURL(this.auth.siteURL, "info.json", subreddit),
    params,
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(); }
  ).perform();
};

RedditAPI.prototype.randomrising = Action("reddit.randomrising", function(action) {
  logger.log("reddit", "Making ajax randomrising call");
  
  var params = {
    limit: 1
  };
    
  var act = http.GetAction(
    this.auth.siteURL + "randomrising.json",
    params,
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(); }
  ).perform();
});

RedditAPI.prototype.mysubreddits = Action("reddit.mysubreddits", function(action) {
  logger.log("reddit", "Making ajax mysubreddits call");
    
  var act = http.GetAction(
    this.auth.siteURL + "reddits/mine.json",
    null, // No parameters
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(); }
  ).perform();
});

RedditAPI.prototype._vote = function(linkID, isLiked, action) {
  logger.log("reddit", "Making ajax vote call");
  
  var dir;
  if (isLiked == true) {
    dir = 1;
  } else if (isLiked == false) {
    dir = -1;
  } else {
    dir = 0;
  }
  
  var params = {
    id:    linkID,
    dir:   dir
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "vote"), params);
  act.chainTo(action);
  act.perform();
};


RedditAPI.prototype._save = function(linkID, action) {
  logger.log("reddit", "Making ajax save call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "save"), params);
  act.chainTo(action);
  act.perform();
};

RedditAPI.prototype._unsave = function(linkID, action) {
  logger.log("reddit", "Making ajax unsave call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unsave"), params);
  act.chainTo(action);
  act.perform();
};


RedditAPI.prototype._hide = function(linkID, action) {
  logger.log("reddit", "Making ajax hide call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "hide"), params);
  act.chainTo(action);
  act.perform();
};


RedditAPI.prototype._unhide = function(linkID, action) {
  logger.log("reddit", "Making ajax unhide call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unhide"), params);
  act.chainTo(action);
  act.perform();
};