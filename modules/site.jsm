logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");
Components.utils.import("resource://socialite/watchedURLS.jsm");


var EXPORTED_SYMBOLS = ["SocialiteSite"];

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

SocialiteSite.prototype.onSitePageFinishLoad = logger.makeStubFunction("SocialiteSite", "onSitePageFinishLoad");

SocialiteSite.prototype.setupBarContent = logger.makeStubFunction("SocialiteSite", "setupBarContent");

// ---

function SiteCollection(socialite) {
  this.socialite = socialite;
  this.sites = [];
  this.watchedURLs = new WatchedURLs();
}

SiteCollection.prototype.addSite(site) {
  this.sites.push(site);
  site.onAddedToCollection(this);
}

SiteCollection.prototype.removeSite(site) {
  for (var i=1; i<this.sites.length; i++) {
    if (this.sites[i] == site) {
      this.sites.splice(i, 1);
      break;
    }
  }
  site.onRemovedFromCollection(this);
}

SiteCollection.prototype.initialize() {
  this.sites.forEach(function(site, index, array) {
    site.initialize();
  });
}

SiteCollection.prototype.onContentLoad(doc, win) {
  this.sites.forEach(function(site, index, array) {
    if (doc.location.hostname.endsWith(site.hostname)) {
      site.onSitePageFinishLoad(doc, win);
    }
  });
}
