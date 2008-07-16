var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                      .getService(Components.interfaces.nsILoginManager)
                                
var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                             Components.interfaces.nsILoginInfo,
                                             "init");

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/http_request.jsm");

var EXPORTED_SYMBOLS = ["getAuthHash", "refreshAuthHash", "RedditAuth"];

STATUS_SUCCESS = 200;

PASSWORD_HOSTNAME = "chrome://socialite";
PASSWORD_REALM_PRE = "Socialite authentication for ";

// ---

function RedditAuth(site, userHash) {
  this.site = site;
  this.userHash = userHash;
  this.modHash = null;
}

RedditAuth.prototype.authParams = function(params) {
  params["uh"] = this.userHash;
  return params;
}

RedditAuth.prototype.snarfModHash = function(modHash) {
    debug_log("reddit_auth", "Snarfed: " + modHash);
  this.modHash = modHash;
}

RedditAuth.prototype.authModHash = function(params) {
  if (this.modHash) {
    params["uh"] = this.modHash;
  }
  return params;
}

// ---

var getAuthHash = Action("reddit_auth.getAuthHash", function(site, action) {
  debug_log("reddit_auth", "Making authenticate call");
  
  var logins = loginManager.findLogins({}, PASSWORD_HOSTNAME, null, PASSWORD_REALM_PRE + site);
  if (logins.length == 0) {
    // No stored hash... time to get one
    var act = new refreshAuthHash();
    act.chainTo(action);
    act.perform(site);
  } else {
    var login = logins[0];
    var rAuth = new RedditAuth(site, login.password);
    action.success(rAuth);
  }
});

var refreshAuthHash = Action("reddit_auth.refreshAuthHash", function(site, action) {
  debug_log("reddit_auth", "Getting new user hash");
  
  var act = http.GetAction(
    "http://" + site + "/bookmarklets/",
    null,
    
    function success(r) {
      var uh = extractUserHash(r.responseXML);
        
      // Save the userHash we retrieved
      var uhLoginInfo = new nsLoginInfo(
        PASSWORD_HOSTNAME,
        null,
        PASSWORD_REALM_PRE + site,
        "", uh,
        "", ""
      );
      
      // Remove any existing logins
      var logins = loginManager.findLogins({}, PASSWORD_HOSTNAME, null, PASSWORD_REALM_PRE + site);
      for (var i = 0; i < logins.length; i++) {
        loginManager.removeLogin(logins[i]);
      }
      
      // Add the new login
      loginManager.addLogin(uhLoginInfo);
      
      var rAuth = new RedditAuth(site, uh);
      action.success(rAuth);
    },
    function failure(r) { action.failure(); }
  );
  
  act.request.overrideMimeType('text/xml');
  act.perform();
});

function extractUserHash(document) {
  // A bit elaborate, but this is currently the best way to do things.
  // By getting the information from the bookmarklets page itself, we are hopefully more safe from unassociated page changes as reddit may alter their hashing system...
  
  var XPathResult = Components.interfaces.nsIDOMXPathResult;
  const XHTMLResolver = function(prefix) {
    if (prefix=="xhtml") {return "http://www.w3.org/1999/xhtml"}
  }
  
  // Get the first "like" button
  try {
    var results = document.evaluate("//xhtml:a/xhtml:img[@alt='like']/..", document, XHTMLResolver, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    var likeButton = results.iterateNext();
    const getUserHash = /uh=(\w*)/;
    
    return likeButton.href.match(getUserHash)[1];
  } catch (e)  {
    debug_log("reddit_auth", "Unable to parse bookmarklets page for user hash: " + e.toString());
    return null;
  }
}
