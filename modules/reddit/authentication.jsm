var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                   .getService(Components.interfaces.nsILoginManager)
                        
var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
                                             Components.interfaces.nsILoginInfo,
                                             "init");

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");

var EXPORTED_SYMBOLS = ["getAuthHash", "refreshAuthHash", "RedditAuth"];

STATUS_SUCCESS = 200;

PASSWORD_HOSTNAME = "chrome://socialite";
PASSWORD_REALM_PRE = "Socialite authentication for ";

// ---

function RedditAuth(siteURL, username, userHash) {
  this.siteURL = siteURL;
  this.username = username;
  this.userHash = userHash;
  this.modHash = null;
}

RedditAuth.prototype.authParams = function(params) {
  params["uh"] = this.userHash;
  return params;
}

RedditAuth.prototype.snarfModHash = function(modHash) {
  this.modHash = modHash;
}

RedditAuth.prototype.authModHash = function(params) {
  if (this.modHash) {
    params["uh"] = this.modHash;
  }
  return params;
}

// ---

var getAuthHash = Action("reddit_auth.getAuthHash", function(siteURL, action) {
  logger.log("reddit_auth", "Making authenticate call");
  
  var logins = loginManager.findLogins({}, PASSWORD_HOSTNAME, null, PASSWORD_REALM_PRE + siteURL);
  if (logins.length == 0) {
    // No stored hash... time to get one
    var act = new refreshAuthHash();
    act.chainTo(action);
    act.perform(siteURL);
  } else {
    var login = logins[0];
    var rAuth = new RedditAuth(siteURL, login.username, login.password);
    action.success(rAuth);
  }
});

var refreshAuthHash = Action("reddit_auth.refreshAuthHash", function(siteURL, action) {
  logger.log("reddit_auth", "Getting new user hash");
  
  var act = http.GetAction(
    "http://" + siteURL + "/bookmarklets/",
    null,
    
    function success(r) {
      var uh = extractUserHash(r.responseXML);
      var username = extractUsername(r.responseXML); 
       
      // Save the userHash we retrieved
      var uhLoginInfo = new nsLoginInfo(
        PASSWORD_HOSTNAME,
        null,
        PASSWORD_REALM_PRE + siteURL,
        username, uh,
        "", ""
      );
      
      // Remove any existing logins
      var logins = loginManager.findLogins({}, PASSWORD_HOSTNAME, null, PASSWORD_REALM_PRE + siteURL);
      for (var i = 0; i < logins.length; i++) {
        if (logins[1].username == username) {
          loginManager.removeLogin(logins[i]);
        }
      }
      
      // Add the new login
      loginManager.addLogin(uhLoginInfo);
      
      var rAuth = new RedditAuth(siteURL, uh);
      action.success(rAuth);
    },
    function failure(r) { action.failure(); }
  );
  
  act.request.overrideMimeType('text/xml');
  act.perform();
});

function evalXHTML_XPath(document, xpath) {
  var XPathResult = Components.interfaces.nsIDOMXPathResult;
  const XHTMLResolver = function(prefix) {
    if (prefix=="xhtml") {return "http://www.w3.org/1999/xhtml"}
  }
  
  return document.evaluate(xpath, document, XHTMLResolver, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
}

function extractUserHash(document) {
  // A bit elaborate, but this is currently the best way to do things.
  // By getting the information from the bookmarklets page itself, we are hopefully more safe from unassociated page changes as reddit may alter their hashing system...
  
  // Get the first "like" button
  try {
    var results = evalXHTML_XPath(document, "//xhtml:a/xhtml:img[@alt='like']/..");
    var likeButton = results.iterateNext();
    const getUserHash = /uh=(\w*)/;
    
    return likeButton.href.match(getUserHash)[1];
  } catch (e)  {
    logger.log("reddit_auth", "Unable to parse bookmarklets page for user hash: " + e.toString());
    return null;
  }
}

function extractUsername(document) {
  // Get the username
  try {
    var results = evalXHTML_XPath(document, "//xhtml:span[@class='user']/xhtml:a");
    var usernameLink = results.iterateNext();
    return usernameLink.textContent;
  } catch (e)  {
    logger.log("reddit_auth", "Unable to parse bookmarklets page for username: " + e.toString());
    return null;
  }
}
