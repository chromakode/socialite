Components.utils.import("resource://socialite/preferences.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");
Components.utils.import("resource://socialite/watchedURLs.jsm");

var faviconService = Components.classes["@mozilla.org/browser/favicon-service;1"]
                                        .getService(Components.interfaces.nsIFaviconService);

var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                                   .getService(Components.interfaces.nsIIOService);

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                                    .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["SocialiteSite", "SiteCollection", "siteClassRegistry"];

function SocialiteSite() {
  this.parent = null;
  this.siteID = null;
  this.siteName = null;
  this.siteURL = null;
  this.preferences = null;
}

SocialiteSite.prototype.initialize = function() {
  this.preferences = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.socialite.sites." + this.siteID + ".");
  this.preferences.QueryInterface(Components.interfaces.nsIPrefBranch2);
}

SocialiteSite.prototype.getIconURI = function() {
  var siteURI = IOService.newURI("http://"+this.siteURL, null, null);
  return faviconService.getFaviconImageForPage(siteURI).spec;
}

SocialiteSite.prototype.onAddToCollection = function(collection) {
  this.parent = collection;
}
SocialiteSite.prototype.onRemoveFromCollection = function(collection) {
  this.parent = null;
}

SocialiteSite.prototype.onSitePageLoad = logger.makeStubFunction("SocialiteSite", "onSitePageLoad");

SocialiteSite.prototype.setupBarContent = logger.makeStubFunction("SocialiteSite", "setupBarContent");

// ---

function SiteCollection(socialite) {
  this.socialite = socialite;
  this.sites = [];
  this.watchedURLs = new WatchedURLs();
}

SiteCollection.prototype.addSite = function(site) {
  this.sites.push(site);
  site.onAddToCollection(this);
}

SiteCollection.prototype.removeSite = function(site) {
  for (var i=1; i<this.sites.length; i++) {
    if (this.sites[i] == site) {
      this.sites.splice(i, 1);
      break;
    }
  }
  site.onRemoveFromCollection(this);
}

SiteCollection.prototype.loadFromPreferences = function() {
  var siteIDs = nativeJSON.decode(SocialitePrefs.getCharPref("sites"));
  
  siteIDs.forEach(function(siteID, index, array) {
    var siteName = SocialitePrefs.getCharPref("sites."+siteID+".siteName");
    var siteURL = SocialitePrefs.getCharPref("sites."+siteID+".siteURL")
    var siteClassName = SocialitePrefs.getCharPref("sites."+siteID+".siteClass")
    
    logger.log("SiteCollection", "Initializing site: \"" + siteName + "\" (" + siteClassName + ")");
    
    var siteClass = siteClassRegistry.getClass(siteClassName);
    var newSite = new siteClass(siteID, siteName, siteURL);
    newSite.initialize();
    this.addSite(newSite);    
  }, this);
}

SiteCollection.prototype.onContentLoad = function(doc, win) {
  this.sites.forEach(function(site, index, array) {
    if (strEndsWith(doc.location.hostname, site.siteURL)) {
      site.onSitePageLoad(doc, win);
    }
  });
}

SiteCollection.prototype.failureMessage = function(message) {
  this.socialite.failureMessage(message);
}

SiteCollection.prototype.openUILink = function(url, e) {
  this.socialite.openUILink(url, e);
}

//---

function SiteClassRegistry() {
  this.classes = {};
}

SiteClassRegistry.prototype.setClass = function(name, constructor) {
  this.classes[name] = constructor;
}

SiteClassRegistry.prototype.getClass = function(name) {
  return this.classes[name];
}

siteClassRegistry = new SiteClassRegistry();