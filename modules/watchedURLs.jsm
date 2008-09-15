Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["WatchedURLs"];

function isEmpty(object) {
  // From http://objectmix.com/javascript/351435-json-object-empty.html#post1284914
  for (var i in object) { 
    return false;
  }
  return true;
}

function WatchedURLs(limit) {
  this.watches = {};
}

WatchedURLs.prototype.watch = function(href, site, linkInfo, replace) {
  if (Socialite.sites.isLoaded(site)) {
    var entry = {
      site: site,
      linkInfo: linkInfo
    }
    
    if (!(href in this.watches)) {
      this.watches[href] = {};
    }
    
    if (!this.watches[href][site.siteID] || replace) {
      this.watches[href][site.siteID] = entry;
    }
  
    logger.log("WatchedURLs", "Watching: " + href);
  }
}

WatchedURLs.prototype.isWatched = function(href) {
  return (href in this.watches && 
          !isEmpty(this.watches[href]));
}

WatchedURLs.prototype.getWatches = function(href) {
  if (href in this.watches) {
    return this.watches[href];
  } else {
    return null;
  }
}

WatchedURLs.prototype.isWatchedBy = function(href, site) {
  return (href in this.watches && 
          this.watches[href] && 
          this.watches[href][site.siteID]);
}

WatchedURLs.prototype.getWatchLinkInfo = function(href, site) {
  if (this.isWatchedBy(href, site)) {
    return this.watches[href][site.siteID].linkInfo;
  } else {
    return null;
  }
}

WatchedURLs.prototype.removeSite = function(site) {
  for each (linkWatches in this.watches) {
    if (linkWatches[site.siteID]) {
      delete linkWatches[site.siteID];
    }
  };
}