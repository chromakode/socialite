var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
                    .getService(Components.interfaces.nsIAlertsService);

var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
                    .getService(Components.interfaces.nsIWindowMediator);

var EXPORTED_SYMBOLS = ["Socialite"];

// ---

var Socialite =
{  
  init: function() {
    Socialite.loaded = false;
    
    Socialite.sites = new SiteCollection();
    Socialite.watchedURLs = new WatchedURLs();
  },
  
  load: function() {
    if (!Socialite.loaded) {
      Socialite.sites.loadConfiguredSites();
      Socialite.loaded = true;
    }
  },

  failureMessage: function(message) {
    logger.log("Socialite", "Failure occurred, message: " + message);
  
    alertsService.showAlertNotification(
      "chrome://global/skin/icons/Error.png",
      "Socialite Error",
      message, 
      null, null, null, "socialite-failure"
    );
  },

  openUILink: function(url, e) {
    window = windowManager.getMostRecentWindow("navigator:browser");
    window.openUILink(url, e);
  }

}

// Bring up the preferences first thing
Socialite.preferences = Components.classes["@mozilla.org/preferences-service;1"]
                                           .getService(Components.interfaces.nsIPrefService)
                                           .getBranch("extensions.socialite.");
Socialite.preferences.QueryInterface(Components.interfaces.nsIPrefBranch2);

// Now, initialize the logging system
logger = Components.utils.import("resource://socialite/utils/log.jsm");
logger.init("Socialite", {
  enabled:    Socialite.preferences.getBoolPref("debug"),
  useConsole: Socialite.preferences.getBoolPref("debugInErrorConsole")
});

// Import application components now that we're initialized and Socialite is defined
Components.utils.import("resource://socialite/site.jsm");
Components.utils.import("resource://socialite/watchedURLs.jsm");

// Finish initialization (now that the environment is set up)
Socialite.init();