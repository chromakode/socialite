logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");


var EXPORTED_SYMBOLS = ["getAuthInfo", "RedditAuth"];

// ---

function RedditAuth(siteURL, username, userHash) {
  this.siteURL = siteURL;
  this.username = username;
  this.modHash = null;
}

RedditAuth.prototype.snarfAuthInfo = function(doc, win) {
  this.modHash = extractModHash(doc);
  this.username = extractUsername(doc);
}

RedditAuth.prototype.authModHash = function(params) {
  if (this.modHash) {
    params["uh"] = this.modHash;
  }
  return params;
}

RedditAuth.prototype.refreshAuthInfo = Action("reddit_auth.refreshAuthInfo", function(action) {
  logger.log("reddit_auth", this.siteURL, "Getting new authentication info");
  
  var act = http.GetAction(
    this.siteURL + "login/",
    null,
    
    hitchThis(this, function success(r) {
      this.modHash = extractModHash(r.responseXML);
      this.username = extractUsername(r.responseXML);
      logger.log("reddit_auth", this.siteURL, "Stored authentication info");

      action.success();
    }),
    function failure(r) { action.failure(); }
  );
  
  act.request.overrideMimeType("text/xml");
  act.perform();
});

function extractModHash(document) {
  try {
    let globalsCode = document.getElementsByTagName("script")[0].textContent;
    const getModHash = /modhash\s+=\s+'(\w+)'/;
    
    return globalsCode.match(getModHash)[1];
  } catch (e)  {
    logger.log("reddit_auth", this.siteURL, "Unable to parse page for user hash: " + e.toString());
    return null;
  }
}

function extractUsername(document) {
  // Get the username
  try {
    let globalsCode = document.getElementsByTagName("script")[0].textContent;
    const getUsername = /logged\s+=\s+'(\w+)'/;
    
    return globalsCode.match(getUsername)[1];
  } catch (e)  {
    logger.log("reddit_auth", this.siteURL, "Unable to parse page for username: " + e.toString());
    return null;
  }
}
