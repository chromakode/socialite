// High-level reddit bookmarklet commands

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/quantizer.jsm");

var EXPORTED_SYMBOLS = ["BookmarkletAPI"];

QUANTIZE_TIME = 1000;

var BOOKMARKLET_API_PATH = "/d/";
function APIURL(site, op) {
  return "http://www." + site + BOOKMARKLET_API_PATH + op;
}

function sameURL(func1, arg1, func2, arg2) {
  var url1 = arg1[0];
  var url2 = arg2[0];
  
  return (url1 == url2);
};

// Make a template since all bookmarklet calls are similar
function bookmarkletAction(self, op, quantizer) {
  var func = hitchThis(self, function(url, action) {
    logger.log("reddit", "Making ajax bookmarklet " + op + " call");
    
    var params = {
      u: url,
    };
    params = this.reddit.auth.authParams(params);
    
    var act = http.GetAction(APIURL(this.reddit.auth.site, op), params);
    act.chainTo(action);
    act.perform();
  });
  
  if (quantizer) {
    func = quantizer.quantize(func);
  }

  return Action("reddit.bookmarklet." + op, func);
}

function BookmarkletAPI(reddit) {
  this.reddit = reddit;
  
  this.voteQuantizer = new Quantizer("reddit.bookmarklet.vote.quantizer", QUANTIZE_TIME, sameURL);
  this.like = bookmarkletAction(this, "like", this.voteQuantizer);
  this.dislike = bookmarkletAction(this, "dislike", this.voteQuantizer);

  this.saveQuantizer = new Quantizer("reddit.bookmarklet.save.quantizer", QUANTIZE_TIME, sameURL);
  this.save = bookmarkletAction(this, "save", this.saveQuantizer);
}
