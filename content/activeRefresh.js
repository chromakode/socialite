let modules = {};
let importModule = function(name) Components.utils.import(name, modules);

let Socialite = importModule("resource://socialite/socialite.jsm").Socialite;
let logger = importModule("resource://socialite/utils/log.jsm");
let ActiveInterval = importModule("resource://socialite/utils/activeInterval.jsm").ActiveInterval;

SocialiteWindow.ActiveRefresh = {
    onLoad: function() {
      this.interval = new ActiveInterval(function() {
        // Refresh with the skipEvent parameter true, so we don't reset the interval needlessly.
        SocialiteWindow.refreshCurrentContentBar(true);
      }, 2*60, 4*60);
      
      let self = this;
      
      // Reset the refresh interval when a refresh occurs.
      gBrowser.addEventListener("SocialiteContentBarRefresh", function(event) {
        logger.log("activerefresh", "Resetting refresh interval");
        self.interval.reset();
      }, false);
      
      // Start/stop the refresh interval based on the presence of a content bar.
      gBrowser.addEventListener("SocialiteContentBarChanged", function(event) {
        if (SocialiteWindow.currentContentBar) {
          self.start();
        } else {
          self.stop();
        }
      }, false);
    },
    
    onUnload: function() {
      // In case the interval is running, we shouldn't leave a dangling idleObserver.
      this.stop();
    },
    
    start: function() {
      if (!this.interval.isRunning) {
        logger.log("activerefresh", "Starting refresh interval.");
        this.interval.start();
      }
    },
    
    stop: function() {
      if (this.interval.isRunning) {
        logger.log("activerefresh", "Stopping refresh interval.");
        this.interval.stop();
      }
    }
}