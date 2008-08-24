logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["WatchedURLs"];

function WatchedURLs(limit) {
  this.watches = {};
}

WatchedURLs.prototype.watch = function(href, site, linkInfo) {
  var entry = {
    site: site,
    linkInfo: linkInfo
  }
  
  if (!(href in this.watches)) {
    this.watches[href] = [];
  }
  this.watches[href].push(entry);

  logger.log("WatchedURLs", "Watching: " + href);
}

WatchedURLs.prototype.isWatched = function(href) {
  return (href in this.watches && 
          this.watches[href] != []);
}

WatchedURLs.prototype.getWatcherInfoList = function(href) {
  if (href in this.watches) {
    return this.watches[href];
  } else {
    return null;
  }
}