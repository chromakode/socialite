logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/watchedLinks.jsm");

var EXPORTED_SYMBOLS = ["SocialiteSite"];

function SocialiteSite() {
  this.collection = null;
}

SocialiteSite.prototype.onAddToCollection = function(collection) {
  this.collection = collection;
}
SocialiteSite.prototype.onRemoveFromCollection = logger.makeStubFunction("SocialiteSite", "onRemovedFromCollection");

SocialiteSite.prototype.onPageFinishLoad = logger.makeStubFunction("SocialiteSite", "onContentLoad");

Reddit.prototype.onWatchedURLStartLoad = logger.makeStubFunction("SocialiteSite", "onPageStartLoad");

Reddit.prototype.onWatchedURLFinishLoad = logger.makeStubFunction("SocialiteSite", "onPageFinishLoad");

Reddit.prototype.setupBarUI = logger.makeStubFunction("SocialiteSite", "setupBarUI");


// ---

function SiteCollection() {
  this.sites = [];
  this.watchedLinks = new WatchedLinks();
}

SiteCollection.prototype.addSite(site) {
  this.sites.push(site);
  site.collection.onAddedToCollection(this);
}

SiteCollection.prototype.removeSite(site) {
  site.onRemovedFromCollection(this);
  for (var i=1; i<this.sites.length; i++) {
    if (this.sites[i] == site) {
      this.sites.splice(i, 1);
      break;
    }
  }
}


SiteCollection.prototype.onContentLoad(document) {
  this.sites.forEach(function(site, index, array) {
    site.onContentLoad(document);
  });
}
