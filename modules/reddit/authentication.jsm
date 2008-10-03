logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/watchable.jsm");


var EXPORTED_SYMBOLS = ["getAuthInfo", "RedditAuth"];

// ---

function RedditAuth(siteURL) {
  this.siteURL = siteURL;
  this.username = false;
  this.modHash = "";
  
  this.onUsernameChange = new Watchable();
  this.onModHashChange = new Watchable();
  this.onStateChange = new Watchable();
}
RedditAuth.prototype = {
  isLoggedIn: function() {
    return ((this.username != false) && (this.modHash != ""));
  },
  
  updateAuthInfo: function(username, modHash) {
    let wasLoggedIn = this.isLoggedIn();
    
    if (modHash != this.modHash) {
      logger.log("reddit_auth", this.siteURL, "Mod hash changed.");
      this.modHash = modHash;
      //logger.log("reddit_auth", this.siteURL, "Mod hash changed.");
      this.onModHashChange.send(modHash);
    }
    
    if (username != this.username) {
      this.username = username;
      logger.log("reddit_auth", this.siteURL, "Username changed: " + username);
      this.onUsernameChange.send(username);
    }
    
    let isLoggedIn = this.isLoggedIn();
    if (wasLoggedIn != isLoggedIn) {
      logger.log("reddit_auth", this.siteURL, "Login state changed: " + isLoggedIn);
      this.onStateChange.send(isLoggedIn);
    }
  },

  snarfAuthInfo: function(doc, win) {
    this.updateAuthInfo(extractUsername(doc), extractModHash(doc))
  },

  authModHash: function(params) {
    if (this.modHash) {
      params["uh"] = this.modHash;
    }
    return params;
  },
  
  refreshAuthInfo: Action("reddit_auth.refreshAuthInfo", function(action) {
    logger.log("reddit_auth", this.siteURL, "Getting new authentication info");
    
    let act = http.GetAction(
      this.siteURL + "login/",
      null,
      
      hitchThis(this, function success(r) {
        this.updateAuthInfo(extractUsername(r.responseXML), extractModHash(r.responseXML));
        logger.log("reddit_auth", this.siteURL, "Stored authentication info");
  
        action.success();
      }),
      function failure(r) { action.failure(); }
    );
    
    act.request.overrideMimeType("text/xml");
    act.perform();
  })
};

function extractModHash(document) {
  try {
    let globalsCode = document.getElementsByTagName("script")[0].textContent;
    const getModHash = /modhash\s*=\s*'(\w*)'/;
    
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
    const getUsername = /logged\s*=\s*('(\w+)'|false)/;
    
    let username;
    let [match, outer, inner] = globalsCode.match(getUsername);
    if (outer == "false") {
      // Not logged in
      username = false;
    } else {
      username = inner;
    }
    
    return username;
  } catch (e)  {
    logger.log("reddit_auth", this.siteURL, "Unable to parse page for username: " + e.toString());
    return null;
  }
}
