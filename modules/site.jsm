Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
faviconWatch = Components.utils.import("resource://socialite/utils/faviconWatch.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");

var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

var EXPORTED_SYMBOLS = ["SocialiteSite", "SiteCollection", "SiteClassRegistry"];

function SocialiteSite(siteID, siteName, siteURL) {
  this.siteID = siteID;
  this.siteName = siteName;
  this.siteURI = IOService.newURI(siteURL, null, null);
  this.siteURL = this.siteURI.spec;
  this.loaded = false;
  
  this.sitePreferences = Components.classes["@mozilla.org/preferences-service;1"]
                                            .getService(Components.interfaces.nsIPrefService)
                                            .getBranch("extensions.socialite.sites." + this.siteID + ".");
  this.sitePreferences.QueryInterface(Components.interfaces.nsIPrefBranch2);
}

SocialiteSite.prototype.siteClassID = "SocialiteSite";
SocialiteSite.prototype.siteClassName = "Socialite Site";
SocialiteSite.prototype.siteClassIconURI = "";

SocialiteSite.prototype.getIconURI = function() {
  // We'll assume that favicon.ico exists for now.
  return this.siteURL+"/favicon.ico";
}

SocialiteSite.prototype.onLoad = function() {
  faviconWatch.setFavicon(this.siteURL, this.getIconURI());  
  this.loaded = true;  
};

SocialiteSite.prototype.onUnload = function() {
  this.loaded = false;
}

SocialiteSite.prototype.onCreate = logger.makeStubFunction("SocialiteSite", "onCreate");
SocialiteSite.prototype.onDelete = logger.makeStubFunction("SocialiteSite", "onDelete");

SocialiteSite.prototype.onSitePageLoad = logger.makeStubFunction("SocialiteSite", "onSitePageLoad");
SocialiteSite.prototype.getLinkInfo = logger.makeStubFunction("SocialiteSite", "getLinkInfo");
SocialiteSite.prototype.createBarContentUI = logger.makeStubFunction("SocialiteSite", "createBarContentUI");
SocialiteSite.prototype.createBarSubmitUI = logger.makeStubFunction("SocialiteSite", "createBarSubmitUI");
SocialiteSite.prototype.createPreferencesUI = logger.makeStubFunction("SocialiteSite", "createPreferencesUI");

// ---

function SiteCollection() {
  this.byID = {};
}

SiteCollection.prototype.__iterator__ = function() {
  for each (let site in this.byID) {
    if (site) {
      yield site;
    }
  }
}

SiteCollection.prototype.onContentLoad = function(doc, win) {
  for (let site in this) {
    // Remove www.
    var baseRegex = /www\.?/;
    var baseSiteHost = site.siteURI.spec.replace(baseRegex, "");
    var baseURL = doc.location.href.replace(baseRegex, "");
    if (strStartsWith(baseURL, baseSiteHost)) {
      site.onSitePageLoad(doc, win);
    }
  }
}

SiteCollection.prototype.loadSite = function(site) {
  logger.log("SiteCollection", "Loading site: \"" + site.siteName + "\" (" + site.siteClassID + ")");
  
  if (!this.byID[site.siteID]) {
    this.byID[site.siteID] = site;
  } else {
    throw "Site with id \""+site.siteID+"\" already loaded";
  }
  site.onLoad();
  observerService.notifyObservers(this, "socialite-load-site", site.siteID);
}

SiteCollection.prototype.unloadSite = function(site) {
  logger.log("SiteCollection", "Unloading site: \"" + site.siteName + "\" (" + site.siteClassID + ")");
  observerService.notifyObservers(this, "socialite-unload-site", site.siteID);
  site.onUnload();
  this.byID[site.siteID] = null;
  Socialite.watchedURLs.removeSite(site);
}

SiteCollection.prototype.reloadSite = function(site) {
  logger.log("SiteCollection", "Reloading site: \"" + site.siteName + "\" (" + site.siteClassID + ")");
  this.unloadSite(site);
  this.loadSite(site);  
}

SiteCollection.prototype.isLoaded = function(site) {
  return (site && this.byID[site.siteID] == site);
}

SiteCollection.prototype.loadConfiguredSites = function() {
  var siteIDs = nativeJSON.decode(Socialite.preferences.getCharPref("sites"));
  
  siteIDs.forEach(function(siteID, index, array) {
    var siteName = Socialite.preferences.getCharPref("sites."+siteID+".siteName");
    var siteURL = Socialite.preferences.getCharPref("sites."+siteID+".siteURL")
    var siteClassID = Socialite.preferences.getCharPref("sites."+siteID+".siteClassID")
    
    logger.log("SiteCollection", "Loading site from preferences: \"" + siteName + "\" (" + siteClassID + ")");
    
    var siteClass = SiteClassRegistry.getClass(siteClassID);
    var newSite = new siteClass(siteID, siteName, siteURL);
    this.loadSite(newSite);    
  }, this);
}

SiteCollection.prototype.saveConfiguredSites = function() {
  var siteIDs = [];
  for (let site in this) {
    siteIDs.push(site.siteID);
  }
  Socialite.preferences.setCharPref("sites", nativeJSON.encode(siteIDs));
}

SiteCollection.prototype.requestID = function() {
  for (var i=0; i<Number.MAX_VALUE; i++) {
    if (!(i in this.byID)) {
      // Reserve this ID
      this.byID[i] = null;
      
      // Clear any existing preferences
      Socialite.preferences.deleteBranch("sites."+i+".");
      
      return i;
    }
  }
  throw "Unexpected ID search failure, unable to find free ID";
}

SiteCollection.prototype.releaseID = function(id) {
  if ((id in this.byID) && (this.byID[id] == null)) {
    delete this.byID[id];
    
    // Delete preferences
    Socialite.preferences.deleteBranch("sites."+id+".");
  } else {
    throw "Cannot release ID, ID in use";  
  }
}

SiteCollection.prototype.createSite = function(siteClassID, siteID, siteName, siteURL) {
  logger.log("SiteCollection", "Creating site: \"" + siteName + "\" (" + siteClassID + ")");
  var siteClass = SiteClassRegistry.getClass(siteClassID);
  var newSite = new siteClass(siteID, siteName, siteURL);
  newSite.onCreate();
  this.loadSite(newSite);
  this.saveConfiguredSites();
  return newSite;
}

SiteCollection.prototype.deleteSite = function(site) {
  logger.log("SiteCollection", "Deleting site: \"" + site.siteName + "\" (" + site.siteClassID + ")");
  site.onDelete();
  this.unloadSite(site);
  this.releaseID(site.siteID);
}

//---

var SiteClassRegistry = 
{
  classes: {},
  
  addClass: function(constructor) {
    this.classes[constructor.prototype.siteClassID] = constructor;
  },
  
  getClass: function(classID) {
    return this.classes[classID];
  }
}