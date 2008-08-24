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

var REDDIT_API_PATH = "/api/";
function APIURL(site, op) {
  // Vote calls will 404 without the 'www.'
  return "http://www." + site + REDDIT_API_PATH + op;
}

function sameURL(func1, arg1, func2, arg2) {
  var url1 = arg1[0];
  var url2 = arg2[0];
  
  return (url1 == url2);
}

function sameLinkID(func1, arg1, func2, arg2) {
  var linkID1 = arg1[0];
  var linkID2 = arg2[0];
  
  return (linkID1 == linkID2);
}

function RedditAPI(auth) {
  this.auth = auth;
  
  // Replace (hook in) this instances' action functions with quantized versions.
  // This way, we need only create the actions once, in the RedditAPI prototype, yet can get instance-specific quantization upon instantiation.
  this.infoQuantizer = new Quantizer("reddit.info.quantizer", QUANTIZE_TIME, sameURL);
  this.info.actionClass.prototype.func = this.infoQuantizer.quantize(this.info.actionClass.prototype.func);
  
  this.voteQuantizer = new Quantizer("reddit.vote.quantizer", QUANTIZE_TIME, sameLinkID);
  this.vote.actionClass.prototype.func = this.voteQuantizer.quantize(this.vote.actionClass.prototype.func);
  
  this.saveQuantizer = new Quantizer("reddit.save.quantizer", QUANTIZE_TIME, sameLinkID);
  this.save.actionClass.prototype.func = this.saveQuantizer.quantize(this.save.actionClass.prototype.func);
  this.unsave.actionClass.prototype.func = this.saveQuantizer.quantize(this.unsave.actionClass.prototype.func);
  
  this.hideQuantizer = new Quantizer("reddit.hide.quantizer", QUANTIZE_TIME, sameLinkID);
  this.hide.actionClass.prototype.func = this.hideQuantizer.quantize(this.hide.actionClass.prototype.func);
  this.unhide.actionClass.prototype.func = this.hideQuantizer.quantize(this.unhide.actionClass.prototype.func);
}

RedditAPI.prototype.info = Action("reddit.info", function(url, action) {
  logger.log("reddit", "Making ajax info call");
  
  var params = {
    url:    url,
    sr:     "",
    count:  1
  };
   
  http.GetAction(
    APIURL(this.auth.siteURL, "info.json"),
    params,
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(); }
  ).perform();
});

RedditAPI.prototype.randomrising = Action("reddit.randomrising", function(action) {
  logger.log("reddit", "Making ajax randomrising call");
  
  var params = {
    limit: 1
  };
    
  var act = http.GetAction(
    "http://www.reddit.com/randomrising.json",
    params,
    
    function success(r) {
      var json = nativeJSON.decode(r.responseText);
      action.success(r, json);
    },
    function failure(r) { action.failure(); }
  ).perform();
});

RedditAPI.prototype.vote = Action("reddit.vote", function(linkID, isLiked, action) {
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
});


RedditAPI.prototype.save = Action("reddit.save", function(linkID, action) {
  logger.log("reddit", "Making ajax save call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "save"), params);
  act.chainTo(action);
  act.perform();
});

RedditAPI.prototype.unsave = Action("reddit.unsave", function(linkID, action) {
  logger.log("reddit", "Making ajax unsave call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unsave"), params);
  act.chainTo(action);
  act.perform();
});


RedditAPI.prototype.hide = Action("reddit.hide", function(linkID, action) {
  logger.log("reddit", "Making ajax hide call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "hide"), params);
  act.chainTo(action);
  act.perform();
});


RedditAPI.prototype.unhide = Action("reddit.unhide", function(linkID, action) {
  logger.log("reddit", "Making ajax unhide call");
  
  var params = {
    id:    linkID
  };
  params = this.auth.authModHash(params);
  
  var act = http.PostAction(APIURL(this.auth.siteURL, "unhide"), params);
  act.chainTo(action);
  act.perform();
});