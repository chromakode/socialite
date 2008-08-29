logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");

var faviconService = Components.classes["@mozilla.org/browser/favicon-service;1"]
                                        .getService(Components.interfaces.nsIFaviconService);

var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                                   .getService(Components.interfaces.nsIIOService);

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
  this.siteList = [];
}

SiteCollection.prototype.addSite = function(site) {
  this.siteList.push(site);
  site.onAddToCollection(this);
}

SiteCollection.prototype.removeSite = function(site) {
  for (var i=1; i<this.siteList.length; i++) {
    if (this.siteList[i] == site) {
      this.siteList.splice(i, 1);
      break;
    }
  }
  Socialite.watchedURLs.removeSite(site);
}

SiteCollection.prototype.onContentLoad = function(doc, win) {
  this.siteList.forEach(function(site, index, array) {
    if (strEndsWith(doc.location.hostname, site.siteURL)) {
      site.onSitePageLoad(doc, win);
    }
  });
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