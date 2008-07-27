logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/strUtils.jsm");
Components.utils.import("resource://socialite/watchedURLS.jsm");


var EXPORTED_SYMBOLS = ["SocialiteSite"];

function SocialiteSite() {
  this.parent = null;
}

SocialiteSite.prototype.onAddToCollection = function(collection) {
  this.parent = collection;
}
SocialiteSite.prototype.onRemoveFromCollection = function(collection) {
  this.parent = null;
}

SocialiteSite.prototype.onPageFinishLoad = logger.makeStubFunction("SocialiteSite", "onPageFinishLoad");

Reddit.prototype.onWatchedPageStartLoad = logger.makeStubFunction("SocialiteSite", "onWatchedPageStartLoad");

// ---

function SiteCollection(socialite) {
  this.socialite = socialite;
  this.sites = [];
  this.watchedURLs = new WatchedURLs();
}

SiteCollection.prototype.addSite(site) {
  this.sites.push(site);
  site.collection.onAddedToCollection(this);
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

SiteCollection.prototype.createBar(site) {
  // FIXME
}


SiteCollection.prototype.initialize() {
  this.sites.forEach(function(site, index, array) {
    site.initialize();
  });
}

SiteCollection.prototype.onContentLoad(doc, win) {
  this.sites.forEach(function(site, index, array) {
    if (doc.location.hostname.endsWith(site.hostname)) {
      site.onPageFinishLoad(doc, win);
    }
  });
}

SiteCollection.prototype.onPageStartLoad(doc, win) {
  var href = doc.location.href;
  if (this.watchedURLs.isWatched(href)) {
    // Trigger callbacks on sites that are watching this href
    var linkInfos = this.watchedURLs.getLinkInfoList(href);
    for (var i=0; i<linkInfos; i++) {
      linkInfos[i].site.onWatchedPageStartLoad(doc, win);
    }
  }
}
