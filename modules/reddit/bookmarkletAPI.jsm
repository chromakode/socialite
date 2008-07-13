// High-level reddit bookmarklet commands

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/http_request.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");

var EXPORTED_SYMBOLS = ["BookmarkletAPI"];

var BOOKMARKLET_API_PATH = "/d/";
function APIURL(site, op) {
  return "http://" + site + BOOKMARKLET_API_PATH + op;
}

var sameURL = function(func1, arg1, func2, arg2) {
  var url1 = arg1[0];
  var url2 = arg2[0];
  
  return (url1 == url2);
};

// Make a template since all bookmarklet calls are similar
function bookmarkletAction(op, quantizer) {
  var func = function(url, action) {
    debug_log("reddit", "Making ajax bookmarklet " + op + " call");
    
    var params = {
      u: url,
    };
    params = this.reddit.auth.authParams(params);
    
    var act = http.GetAction(APIURL(this.reddit.auth.site, op), params);
    act.chainTo(this);
    act.perform();
  }
  
  if (quantizer) {
    func = quantizer.quantize(func);
  }

  return Action("reddit.bookmarklet." + op, func);
}

function BookmarkletAPI(reddit) {
  this.reddit = reddit;
  
  this.voteQuantizer = new Quantizer("reddit.bookmarklet.vote.quantizer", QUANTIZE_TIME, sameURL);
  this.like = bookmarkletAction("like", this.voteQuantizer);
  this.dislike = bookmarkletAction("dislike", this.voteQuantizer);

  this.saveQuantizer = new Quantizer("reddit.bookmarklet.save.quantizer", QUANTIZE_TIME, sameURL);
  this.save = bookmarkletAction("save", this.saveQuantizer);
}
