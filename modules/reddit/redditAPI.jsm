// High-level reddit commands

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/action/cachedAction.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["RedditAPI", "RedditVersion"];

QUANTIZE_TIME = 1000;
AUTH_EXPIRE_AGE = 4*60*60;
SUBREDDITS_EXPIRE_AGE = 30*60;

// Socialite recognizes the following unofficial versions for compatibility purposes:
//
// API versions:
//   0.0 -- original API
//   0.1 -- by_id API request added
//
// DOM versions:
//   0.0 -- original DOM, before jQuery changes
//   1.0 -- after jQuery changes
//   1.1 -- consolidation of link/linkcompressed classes; higher-level likes/dislikes/unvoted classes
REDDIT_LATEST_VERSION = { dom:"1.1", api:"0.1" };

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

function tryJSON(action, r) {
  let json;
  try {
    json = nativeJSON.decode(r.responseText);
  } catch (e) {
    action.failure(r);
    return;
  }
  action.success(r, json);
}

function DepaginateAction(baseurl, params, successCallback, failureCallback) {
  let act = _DepaginateAction(successCallback, failureCallback);
  
  act.baseurl = baseurl;
  if (params) {
    act.params = params;
  } else {
    act.params = {};
  }
  
  act.limit = 20;
  act.count = 0;
  act.items = [];
  return act
}

var _DepaginateAction = Action("depaginate", function(action) {
  let fauxJSON = function() {
    return {"kind":"Listing", "data":{"children":action.items}};
  }
  
  let fetchNext = function(after) {
    if (action.count < action.limit) {
      action.count += 1;
      logger.log("reddit", "Depaginate action running (page " + action.count + "; after=" + after + ")");

      if (after) {
        action.params["after"] = after;
      }
      
      http.GetAction(
        action.baseurl,
        action.params,
        
        function success(r) {
          let json;
          try {
            // Add the items in the JSON to our collection, and save the "after" attribute.
            json = nativeJSON.decode(r.responseText);
            action.items = action.items.concat(json.data.children);
            nextAfter = json.data.after;
          } catch (e) {
            action.failure(r);
            return;
          }
          
          if (nextAfter) {
            fetchNext(nextAfter);
          } else {
            // Return the final request and a faux JSON response with the full listing.
            action.success(r, fauxJSON());
          }
        },
        action.chainFailure()
      ).perform();
    } else {
      // We hit the request limit. Return a null request and what we got.
      action.success(null, fauxJSON());
    }
  }
  fetchNext();
});

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
  
  this.mysubreddits_cached = CachedAction(this.mysubreddits, SUBREDDITS_EXPIRE_AGE);
  
  this.messages = Action("reddit.messages", this._messages);
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
    this.auth = new RedditAuth(this.siteURL, this.version, AUTH_EXPIRE_AGE);
  }
  
  // Reset subreddit cache when the username changes.
  let self = this;
  this._removeUsernameWatch = this.auth.onUsernameChange.watch(function(username) {
    self.mysubreddits_cached.cachedValue.reset();
  });
}

RedditAPI.prototype.destroy = function() {
  this._removeUsernameWatch();
}

RedditAPI.prototype._urlinfo = function(url, subreddit, action) {
  logger.log("reddit", "Making info API request");
   
  http.GetAction(
    APIURL(this.auth.siteURL, "info.json", subreddit),
    {url:url, limit:1},
    
    function success(r) {
      tryJSON(action, r);
    },
    action.chainFailure()
  ).perform();
};

RedditAPI.prototype._thinginfo = function(thingID, action) {
  logger.log("reddit", "Making by_id API request");
   
  http.GetAction(
    this.auth.siteURL + "by_id/" + thingID + ".json",
    null,
    
    function success(r) {
      tryJSON(action, r);
    },
    action.chainFailure()
  ).perform();
};

RedditAPI.prototype.randomrising = Action("reddit.randomrising", function(action) {
  logger.log("reddit", "Making randomrising API request");
  
  var act = http.GetAction(
    this.auth.siteURL + "randomrising.json",
    {limit:1},
    
    function success(r) {
      tryJSON(action, r);
    },
    action.chainFailure()
  ).perform();
});

RedditAPI.prototype.mysubreddits = Action("reddit.mysubreddits", function(action) {
  logger.log("reddit", "Making mysubreddits API request");
    
  var act = DepaginateAction(this.auth.siteURL + "reddits/mine.json");
  act.chainTo(action);
  act.perform();
});

RedditAPI.prototype._messages = function(mark, action) {
  logger.log("reddit", "Making messages API request");
  
  http.GetAction(
    this.auth.siteURL + "message/inbox.json",
    {mark:mark},
    
    function success(r) {
      tryJSON(action, r);
    },
    action.chainFailure()
  ).perform();
};

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
  
  let self = this;
  this.auth.actionParams(action,
    {id:linkID, dir:dir},
    function success(authParams) {
      var act = http.PostAction(APIURL(self.auth.siteURL, "vote"), authParams);
      act.chainTo(action);
      act.perform();
    }
  );
};


RedditAPI.prototype._simpleLinkPost = function(command, linkID, action) {
  logger.log("reddit", "Making " + command + " API call");
  
  let self = this;
  this.auth.actionParams(action,
    {id:linkID},
    function success(authParams) {
      var act = http.PostAction(APIURL(self.auth.siteURL, command), authParams);
      act.chainTo(action);
      act.perform();
    }
  );
};

function simpleLinkPost(command) {
  return function(linkID, action) {
    this._simpleLinkPost(command, linkID, action);
  };
};

RedditAPI.prototype._save   = simpleLinkPost("save");
RedditAPI.prototype._unsave = simpleLinkPost("unsave");
RedditAPI.prototype._hide   = simpleLinkPost("hide");
RedditAPI.prototype._unhide = simpleLinkPost("unhide");