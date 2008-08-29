Components.utils.import("resource://socialite/preferences.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
logger.init("Socialite", {
  enabled:    SocialitePrefs.getBoolPref("debug"),
  useConsole: SocialitePrefs.getBoolPref("debugInErrorConsole")
});

Components.utils.import("resource://socialite/site.jsm");
Components.utils.import("resource://socialite/watchedURLs.jsm");

var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
                    .getService(Components.interfaces.nsIAlertsService);

var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
                    .getService(Components.interfaces.nsIWindowMediator);

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                                    .createInstance(Components.interfaces.nsIJSON);

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
      Socialite.loadConfiguredSites();
      Socialite.loaded = true;
    }
  },
  
  loadConfiguredSites: function() {
    var siteIDs = nativeJSON.decode(SocialitePrefs.getCharPref("sites"));
    
    siteIDs.forEach(function(siteID, index, array) {
      var siteName = SocialitePrefs.getCharPref("sites."+siteID+".siteName");
      var siteURL = SocialitePrefs.getCharPref("sites."+siteID+".siteURL")
      var siteClassName = SocialitePrefs.getCharPref("sites."+siteID+".siteClass")
      
      logger.log("SiteCollection", "Initializing site: \"" + siteName + "\" (" + siteClassName + ")");
      
      var siteClass = siteClassRegistry.getClass(siteClassName);
      var newSite = new siteClass(siteID, siteName, siteURL);
      newSite.initialize();
      Socialite.sites.addSite(newSite);    
    }, this);
  },
  
  unloadSite: function(site) {
    Socialite.watchedURLs.removeSite(site);
    Socialite.sites.removeSite(site);
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

Socialite.init();