logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");
Components.utils.import("resource://socialite/watchedURLs.jsm");


var EXPORTED_SYMBOLS = ["SocialiteSite", "SiteCollection"];

function SocialiteSite() {
  this.parent = null;
  this.sitename = null;
  this.siteurl = null;
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

SiteCollection.prototype.initialize = function() {
  this.sites.forEach(function(site, index, array) {
    site.initialize();
  });
}

SiteCollection.prototype.onContentLoad = function(doc, win) {
  this.sites.forEach(function(site, index, array) {
    if (strEndsWith(doc.location.hostname, site.siteurl)) {
      site.onSitePageLoad(doc, win);
    }
  });
}

SiteCollection.prototype.failureMessage = function(message) {
  this.socialite.failureMessage(message);
}