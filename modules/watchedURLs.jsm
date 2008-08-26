logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["WatchedURLs"];

function WatchedURLs(limit) {
  this.watches = {};
}

WatchedURLs.prototype.watch = function(href, site, linkInfo, replace) {
  var entry = {
    site: site,
    linkInfo: linkInfo
  }
  
  if (!(href in this.watches)) {
    this.watches[href] = {};
  }
  
  if (!this.watches[href][site.siteName] || replace) {
    this.watches[href][site.siteName] = entry;
  }

  logger.log("WatchedURLs", "Watching: " + href);
}

WatchedURLs.prototype.isWatched = function(href) {
  return (href in this.watches && 
          this.watches[href] != {});
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
          this.watches[href][site.siteName]);
}