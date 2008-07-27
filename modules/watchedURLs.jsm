logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["WatchedURLs"];

function WatchedURLs(limit) {
  this.watches = {};
}

WatchedURLs.prototype.watch = function(href, linkInfo) {
  if (!(href in this.watches)) {
    this.watches[href] = [];
  }
  this.watches[href].push(linkInfo);

  logger.log("WatchedURLs", "Watching: " + href);
}

WatchedURLs.prototype.isWatched = function(href) {
  return (href in this.watches && 
          this.watches[href] != []);
}

WatchedURLs.prototype.getLinkInfoList = function(href) {
  if (href in this.watches) {
    return this.watches[href];
  } else {
    return null;
  }
}

WatchedURLs.prototype.getLinkInfo = function(site, href) {
  if (this.isWatched(href)) {
    // Search for a linkInfo instance with the appropriate site 
    var linkInfos = this.watches[href];
    for (var i=0; i<linkInfos; i++) {
      if (linkInfos[i].site = site) {
        return linkInfos[i];
      }
    }
    
    // None were found
    return null;
  } else {
    return null;
  }
}
