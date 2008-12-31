// High-level reddit commands

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["RedditAPI", "RedditVersion"];

QUANTIZE_TIME = 1000;

REDDIT_LATEST_VERSION = { dom:"1.0", api:"0.1" };
function RedditVersion(){};
RedditVersion.prototype = REDDIT_LATEST_VERSION;
RedditVersion.prototype.compare = function(field, value) {
  const versionCompare = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                            .getService(Components.interfaces.nsIVersionComparator)
                                            .compare;
  return versionCompare(this[field], value);
}

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

function RedditAPI(siteURL) {
  this.siteURL = siteURL;
  
  this.urlinfoQuantizer = new Quantizer("reddit.urlInfo.quantizer", QUANTIZE_TIME, sameURL);
  this.urlinfo = Action("reddit.urlinfo", this.urlinfoQuantizer.quantize(this._urlinfo));
  
  this.thinginfoQuantizer = new Quantizer("reddit.thinginfo.quantizer", QUANTIZE_TIME, sameLinkID);
  this.thinginfo = Action("reddit.thinginfo", this.thinginfoQuantizer.quantize(this._thinginfo));
  
  this.voteQuantizer = new Quantizer("reddit.vote.quantizer", QUANTIZE_TIME, sameLinkID);
  this.vote = Action("reddit.vote", this.voteQuantizer.quantize(this._vote));
  
  this.saveQuantizer = new Quantizer("reddit.save.quantizer", QUANTIZE_TIME, sameLinkID);
  this.save = Action("reddit.save", this.saveQuantizer.quantize(this._save));
  this.unsave = Action("reddit.unsave", this.saveQuantizer.quantize(this._unsave));
  
  this.hideQuantizer = new Quantizer("reddit.hide.quantizer", QUANTIZE_TIME, sameLinkID);
  this.hide = Action("reddit.hide", this.hideQuantizer.quantize(this._hide));
  this.unhide = Action("reddit.unhide", this.hideQuantizer.quantize(this._unhide));
}

RedditAPI.prototype.init = function(version, auth) {
  this.version = new RedditVersion();
  // Copy specified versions into our version object.
  if (version) {
    for (let field in version) {
      if (version[field]) {
        this.version[field] = version[field];
      }
    }
  }
  
  if (auth) {
    this.auth = auth;
  } else {
    this.auth = new RedditAuth(this.siteURL);
    this.auth.refreshAuthInfo().perform();
  }
}

RedditAPI.prototype._urlinfo = function(url, subreddit, action) {
  logger.log("reddit", "Making info API request");
  
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
    function failure(r) { action.failure(r); }
  ).perform();
};

RedditAPI.prototype._thinginfo = function(thingID, action) {
  logger.log("reddit", "Making by_id API request");
   
  http.GetAction(
    this.auth.siteURL + "by_id/" + thingID + ".json",
    null,
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(r); }
  ).perform();
};

RedditAPI.prototype.randomrising = Action("reddit.randomrising", function(action) {
  logger.log("reddit", "Making randomrising API request");
  
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
    function failure(r) { action.failure(r); }
  ).perform();
});

RedditAPI.prototype.mysubreddits = Action("reddit.mysubreddits", function(action) {
  logger.log("reddit", "Making mysubreddits API request");
    
  var act = http.GetAction(
    this.auth.siteURL + "reddits/mine.json",
    null, // No parameters
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(r); }
  ).perform();
});

RedditAPI.prototype._vote = function(linkID, isLiked, action) {
  logger.log("reddit", "Making vote API call");
  
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
  logger.log("reddit", "Making save API call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "save"), params);
  act.chainTo(action);
  act.perform();
};

RedditAPI.prototype._unsave = function(linkID, action) {
  logger.log("reddit", "Making unsave API call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unsave"), params);
  act.chainTo(action);
  act.perform();
};


RedditAPI.prototype._hide = function(linkID, action) {
  logger.log("reddit", "Making hide API call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "hide"), params);
  act.chainTo(action);
  act.perform();
};


RedditAPI.prototype._unhide = function(linkID, action) {
  logger.log("reddit", "Making unhide API call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unhide"), params);
  act.chainTo(action);
  act.perform();
};