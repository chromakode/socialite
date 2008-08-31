Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");

var faviconService = Components.classes["@mozilla.org/browser/favicon-service;1"]
                                        .getService(Components.interfaces.nsIFaviconService);

var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                                   .getService(Components.interfaces.nsIIOService);

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                                    .createInstance(Components.interfaces.nsIJSON);

var EXPORTED_SYMBOLS = ["SocialiteSite", "SiteCollection", "siteClassRegistry"];

function SocialiteSite(siteID, siteName, siteURL) {
  this.siteID = siteID;
  this.siteName = siteName;
  this.siteURL = siteURL;
  
  this.preferences = Components.classes["@mozilla.org/preferences-service;1"]
                                        .getService(Components.interfaces.nsIPrefService)
                                        .getBranch("extensions.socialite.sites." + this.siteID + ".");
  this.preferences.QueryInterface(Components.interfaces.nsIPrefBranch2);
}

SocialiteSite.prototype.initialize = logger.makeStubFunction("SocialiteSite", "initialize");

SocialiteSite.prototype.getIconURI = function() {
  var siteURI = IOService.newURI("http://"+this.siteURL, null, null);
  return faviconService.getFaviconImageForPage(siteURI).spec;
}

SocialiteSite.prototype.onCreate = logger.makeStubFunction("SocialiteSite", "onCreate");
SocialiteSite.prototype.onDelete = logger.makeStubFunction("SocialiteSite", "onDelete");

SocialiteSite.prototype.onSitePageLoad = logger.makeStubFunction("SocialiteSite", "onSitePageLoad");
SocialiteSite.prototype.setupBarContent = logger.makeStubFunction("SocialiteSite", "setupBarContent");

// ---

function SiteCollection() {
  this.siteList = [];
  this.nextID = 0;
}

SiteCollection.prototype.loadSite = function(site) {
  logger.log("SiteCollection", "Loading site: \"" + site.siteName + "\" (" + site.siteClassName + ")");
  if ((Number(site.siteID) != NaN) && (site.siteID >= this.nextID)) {
    // Keep nextID in sync with loaded sites
    this.nextID = site.siteID + 1; 
  }
  this.siteList.push(site);
  site.initialize();
}

SiteCollection.prototype.unloadSite = function(site) {
  logger.log("SiteCollection", "Unloading site: \"" + site.siteName + "\" (" + site.siteClassName + ")");
  for (var i=0; i<this.siteList.length; i++) {
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

SiteCollection.prototype.loadConfiguredSites = function() {
  var siteIDs = nativeJSON.decode(Socialite.preferences.getCharPref("sites"));
  
  siteIDs.forEach(function(siteID, index, array) {
    var siteName = Socialite.preferences.getCharPref("sites."+siteID+".siteName");
    var siteURL = Socialite.preferences.getCharPref("sites."+siteID+".siteURL")
    var siteClassName = Socialite.preferences.getCharPref("sites."+siteID+".siteClass")
    
    logger.log("SiteCollection", "Loading site from preferences: \"" + siteName + "\" (" + siteClassName + ")");
    
    var siteClass = siteClassRegistry.getClass(siteClassName);
    var newSite = new siteClass(siteID, siteName, siteURL);
    this.loadSite(newSite);    
  }, this);
}

SiteCollection.prototype.saveConfiguredSites = function() {
  Socialite.preferences.setCharPref("sites", nativeJSON.encode([site.siteID for each (site in this.siteList)]));
}

SiteCollection.prototype.createSite = function(siteClass, siteName, siteURL) {
  logger.log("SiteCollection", "Creating site: \"" + site.siteName + "\" (" + site.siteClassName + ")");
  var newSite = new siteClass(this.nextID, siteName, siteURL);
  this.nextID += 1;
  newSite.onCreate();
  return newSite;
}

SiteCollection.prototype.deleteSite = function(site) {
  logger.log("SiteCollection", "Deleting site: \"" + site.siteName + "\" (" + site.siteClassName + ")");
  site.onDelete();
  Socialite.preferences.deleteBranch("sites."+site.siteID);
  this.unloadSite(site);
}

//---

function SiteClassRegistry() {
  this.classes = {};
}

SiteClassRegistry.prototype.addClass = function(constructor) {
  this.classes[constructor.prototype.siteClassName] = constructor;
}

SiteClassRegistry.prototype.getClass = function(name) {
  return this.classes[name];
}

siteClassRegistry = new SiteClassRegistry();