logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/action/cachedAction.jsm");
http = Components.utils.import("resource://socialite/utils/action/httpRequest.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/watchable.jsm");

var EXPORTED_SYMBOLS = ["RedditAuth", "authParams"];

// ---

function RedditAuth(siteURL, version, expires) {
  this.siteURL = siteURL;
  this.version = version;
  
  this.authInfo = {username:false, modhash:""};
  this.getAuthInfo = CachedAction(this._getAuthInfo, expires);
  
  this.onUsernameChange = new Watchable();
  this.onModHashChange = new Watchable();
  this.onStateChange = new Watchable();
}
RedditAuth.prototype = {
  get isLoggedIn() { return this.authInfo.isLoggedIn; },
  get username() { return this.authInfo.username; },
  get modhash() { return this.authInfo.modhash; },
  
  _getAuthInfo: Action("reddit_auth.getAuthInfo", function(action) {
    logger.log("reddit_auth", this.siteURL, "Getting new authentication info");
    
    let snarfTarget;
    if (this.version.compare("dom", "1.1") >= 0) {
      snarfTarget = this.siteURL + "stats/";
    } else if (this.version["dom"] == "1.0") {
      snarfTarget = this.siteURL + "api/info/";
    } else {
      snarfTarget = this.siteURL + "login/";
    }
    
    let act = http.GetAction(
      snarfTarget,
      null,
      
      hitchThis(this, function success(r) {
        let authInfo = extractAuthInfo(r.responseXML);
        this._updateAuthInfo(authInfo);
        action.success(authInfo);
      }),
      function failure(r) { action.failure(); }
    );
    
    act.request.overrideMimeType("text/xml");
    act.perform();
  }),
  
  _updateAuthInfo: function(authInfo) {
    let oldAuthInfo = this.authInfo;
    this.authInfo = authInfo;
    
    if (authInfo.modhash != oldAuthInfo.modhash) {
      logger.log("reddit_auth", this.siteURL, "Modhash changed.");
      this.onModHashChange.send(authInfo.modhash);
    }
    
    if (authInfo.username != oldAuthInfo.username) {
      logger.log("reddit_auth", this.siteURL, "Username changed: " + authInfo.username);
      this.onUsernameChange.send(authInfo.username);
    }
    
    if (authInfo.isLoggedIn != oldAuthInfo.isLoggedIn) {
      logger.log("reddit_auth", this.siteURL, "Login state changed: " + authInfo.isLoggedIn);
      this.onStateChange.send(authInfo.isLoggedIn);
    }
  },

  snarfAuthInfo: function(doc, win) {
    let authInfo = extractAuthInfo(doc);
    this._updateAuthInfo(authInfo);
    this.getAuthInfo.cachedValue.updated(authInfo); // reset authentication info expiration
  },
  
  actionParams: function(action, params, successCallback) {
    this.getAuthInfo(
      function success(authInfo) {
        successCallback(authParams(params, authInfo));
      },
      action.chainFailure()
    ).perform();
  }
};

function authParams(params, authInfo) {
  if (authInfo.modhash) {
    params["uh"] = authInfo.modhash;
  }
  return params;
}

function extractAuthInfo(document) {
  let authInfo = {
    username: extractUsername(document),
    modhash:  extractModHash(document)
  };
  authInfo.isLoggedIn = (authInfo.username != false) && (authInfo.username != null) && (authInfo.modhash != "");
  return authInfo;
}

function extractModHash(document) {
  try {
    let globalsCode = document.getElementsByTagName("script")[0].textContent;
    const getModHash = /modhash\s*(?:\:|=)\s*'(\w*)'/;
    
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
    const getUsername = /logged\s*(?:\:|=)\s*('(\w+)'|false)/;
    
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
