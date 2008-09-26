Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["WatchedURLs"];

function WatchInfo(URL, redirectFrom) {
  this.URL = URL;
  this.hidden = false;
  this.redirectFrom = redirectFrom;
  this._info = {};
}
WatchInfo.prototype = {
  get info() {
    if (this.redirectFrom) {
      return this.redirectFrom.info;
    } else {
      return this._info;
    }
  },
  
  set info(value) {
    if (this.redirectFrom) {
      this.redirectFrom.info = value;
    } else {
      this._info = value;
    }
  },
  
  __iterator__: function() {
    return Iterator(this._info);
  },
  
  addSite: function(site, linkInfo, replace) {
    if (!this.info[site.siteID] || replace) {
      this.info[site.siteID] = linkInfo;
    }
  },
  
  removeSite: function(site) {
    if (this.info[site.siteID]) {
      delete this.info[site.siteID];
    }
  },
  
  getSite: function(site) {
    return this.info[site.siteID];
  },
  
  hasSite: function(site) {
    return site.siteID in this.info;
  },
  
  isEmpty: function() {
    // From http://objectmix.com/javascript/351435-json-object-empty.html#post1284914
    for (var i in this.info) {
      return false;
    }
    return true;
  },
  
  /**
   * Ensure that the watch is not hidden or otherwise prevented from displaying
   */
  activate: function() {
    this.hidden = false;
  }
}

function WatchedURLs() {
  this.watches = {};
}
WatchedURLs.prototype = {
  watch: function(URL, site, linkInfo, replace) {
    if (Socialite.sites.isLoaded(site)) {
      if (!(URL in this.watches)) {
        this.watches[URL] = new WatchInfo(URL);
      }
      this.watches[URL].addSite(site, linkInfo, replace);
      
      // Adding a new site will activate a hidden/suppressed watch, since we should show the new information.
      this.watches[URL].activate();
    
      logger.log("WatchedURLs", "Watching: " + URL);
    }
  },

  get: function(URL) {
    return this.watches[URL];
  },

  getBy: function(URL, site) {
    if (this.isWatchedBy(URL, site)) {
      return this.get(URL).getSite(site);
    } else {
      return null;
    }
  },

  isWatched: function(URL) {
    return ((URL in this.watches) && !this.watches[URL].isEmpty());
  },

  isWatchedBy: function(URL, site) {
    return (this.isWatched(URL) && this.get(URL).hasSite(site));
  },

  removeSite: function(site) {
    for each (watchInfo in this.watches) {
      watchInfo.removeSite(site);
    };
  }
}