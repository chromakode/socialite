XULNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

Components.utils.import("resource://socialite/preferences.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
logger.init("Socialite", {
  enabled:    SocialitePrefs.getBoolPref("debug"),
  useConsole: SocialitePrefs.getBoolPref("debugInErrorConsole"),
});

persistence = Components.utils.import("resource://socialite/persistence.jsm");

Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/action/sequence.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/oneshot.jsm");

Components.utils.import("resource://socialite/reddit/reddit.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");
Components.utils.import("resource://socialite/reddit/linkInfo.jsm");

var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
                    .getService(Components.interfaces.nsIAlertsService);

var sessionStore  = Components.classes["@mozilla.org/browser/sessionstore;1"]
                    .getService(Components.interfaces.nsISessionStore);
// ---

const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;
const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;
var SocialiteProgressListener =
{
  QueryInterface: function(aIID) {
   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
       aIID.equals(Components.interfaces.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {return 0;},

  onLocationChange: function(aProgress, aRequest, aURI) {
    var window = aProgress.DOMWindow;
    
    if (window == window.top) {
      logger.log("SocialiteProgressListener", "onLocationChange (loading): " + aProgress.DOMWindow.location.href);
      Socialite.linkStartLoad(window, aProgress.isLoadingDocument);
    }
  },
  
  onProgressChange: function() {return 0;},
  onStatusChange: function() {return 0;},
  onSecurityChange: function() {return 0;},
}

// ---

var Socialite = new Object();

Socialite.init = function() {
  window.addEventListener("load", hitchHandler(this, "onLoad"), false);
  window.addEventListener("unload", hitchHandler(this, "onUnload"), false);
};

Socialite.onLoad = function() {
  // initialization code
  this.strings = document.getElementById("socialite-strings");
  
  this.tabBrowser = document.getElementById("content");
  this.appContent = document.getElementById("appcontent");
 
  this.tabInfo = [];

  this.sites = new SiteCollection(this);
  this.sites.initialize();
  
  this.tabBrowser.addEventListener("DOMContentLoaded", hitchHandler(this, "contentLoad"), false);
  
  // Watch for new tabs to add progress listener to them
  this.tabBrowser.addEventListener("TabOpen", hitchHandler(this, "tabOpened"), false);
  this.tabBrowser.addEventListener("TabClose", hitchHandler(this, "tabClosed"), false);
  
  // Add progress listener to tabbrowser. This fires progress events for the current tab.
  this.setupProgressListener(this.tabBrowser);
};

Socialite.setupProgressListener = function(browser) {
  logger.log("main", "Progress listener added.");
  
  browser.addProgressListener(SocialiteProgressListener,  Components.interfaces.nsIWebProgress.NOTIFY_ALL);
};

Socialite.unsetProgressListener = function(browser) {
  logger.log("main", "Progress listener removed.");
    
  browser.removeProgressListener(SocialiteProgressListener);
};

Socialite.onUnload = function() {
  // Remove remaining progress listeners.
  
  this.unsetProgressListener(this.tabBrowser);
};

Socialite.tabOpened = function(e) {
  var browser = e.originalTarget.linkedBrowser;
  var win = browser.contentWindow;
  
  logger.log("main", "Tab opened: " + win.location.href);
  
  this.linkStartLoad(win);
}

Socialite.tabClosed = function(e) {
  var browser = e.originalTarget.linkedBrowser;
  var currentTab = this.tabBrowser.tabContainer.selectedIndex;
  this.tabInfo[currentTab] = null;
  
  logger.log("main", "Tab closed: " + browser.contentWindow.location.href);
}

Socialite.contentLoad = function(e) {
  var doc = e.originalTarget;
  
  if (doc instanceof HTMLDocument) {
    var win = doc.defaultView;
    if (win == win.top) {
      this.sites.onContentLoad(doc, win);
    }
  }
};

Socialite.linkStartLoad = function(win, isLoading) {
  this.sites.onPageStartLoad(win.document, win);




  var href = win.location.href;
  var browser = this.tabBrowser.getBrowserForDocument(win.document);
  var currentTab = this.tabBrowser.tabContainer.selectedIndex;
  var notificationBox = this.tabBrowser.getNotificationBox(browser);

  if (this.sites.watchedURLs.isWatched(href)) {
    // This is a watched link. Create a notification box and initialize.
    var linkInfo = this.sites.watchedURLs.get
    this.tabInfo[currentTab] = linkInfo;
    
    this.sites.onWatchedPageStartLoad(win, win.document);
    
    // Show the banner, without allowing actions yet
    this.showNotificationBox(browser, linkInfo, isLoading);
  } else {
  
  
  // Handle persistence changes, if any.
  var linkInfo = this.tabInfo[currentTab];

  if (linkInfo && linkInfo.ui.notification) {
    if (!persistence.onLocationChange(linkInfo.url, href)) {
      notificationBox.removeNotification(linkInfo.ui.notification);
      linkInfo.ui.notification = null;
      logger.log(linkInfo.fullname, "Removed notification");
    }
  }
}

Socialite.redditUpdateLinkInfo = function(linkInfo, omit) {
  linkInfo.update(
    hitchThis(this, function success(r, json, action) {
      // Only update the UI if the update started after the last user-caused UI update.
      if (action.startTime >= linkInfo.uiState.lastUpdated) {
        linkInfo.updateUIState(omit);
        this.updateButtons(linkInfo);
      } else {
        logger.log(linkInfo.fullname, "UI changed since update request, not updating UI");
      }
    }),
    hitchThis(this, function failure(r, action) {
      this.failureNotification(linkInfo, r, action);
    })
  ).perform();
}

Socialite.revertUIState = function(linkInfo, properties, r, action) {
  linkInfo.revertUIState(properties, action.startTime);
  this.updateButtons(linkInfo);
}

Socialite.actionFailureHandler = function(linkInfo, r, action) {
  this.failureNotification(linkInfo, r, action);
  this.redditUpdateLinkInfo(linkInfo);
}

Socialite.failureNotification = function(linkInfo, r, action) {
  var text;
  
  var linkID;
  if (linkInfo) {
    linkID = linkInfo.fullname;
  } else {
    linkID = "unknown";
  }
  logger.log(linkID, "Failure occurred, action: " + action.name + ", status: " + r.status);
  
  if (r.status != 200) {
    text = "Unexpected HTTP status " + r.status + " recieved (" + action.name + ")";
  } else {
    text = "The requested action failed (" + action.name + ")";
  }
  
  alertsService.showAlertNotification(
    "chrome://global/skin/icons/Error.png",
    "Socialite Connection Error",
    text, 
    null, null, null, "socialite-failure");
}
  
Socialite.showNotificationBox = function(browser, linkInfo, isNewPage) {
  
};

// ---

Socialite.init();
