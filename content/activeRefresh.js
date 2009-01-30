SocialiteWindow.ActiveRefresh = (function() {
  let modules = {};
  let importModule = function(name) Components.utils.import(name, modules);
  
  let Socialite = importModule("resource://socialite/socialite.jsm").Socialite;
  let logger = importModule("resource://socialite/utils/log.jsm");
  let ActiveInterval = importModule("resource://socialite/utils/activeInterval.jsm").ActiveInterval;
  
  var ActiveRefresh = {
      onLoad: function() {
        this.interval = new ActiveInterval(function() {
          logger.log("activerefresh", "Refreshing current content bar");
          // Refresh with the skipEvent parameter true, so we don't reset the interval needlessly.
          SocialiteWindow.refreshCurrentContentBar(true);
        }, this.getInterval(), Socialite.globals.IDLE_THRESHOLD);
        
        let self = this;
        
        // Reset the refresh interval when a refresh occurs.
        gBrowser.addEventListener("SocialiteContentBarRefresh", function(event) {
          logger.log("activerefresh", "Resetting refresh interval");
          self.interval.reset();
        }, false);
        
        // Start/stop the refresh interval based on the presence of a content bar.
        gBrowser.addEventListener("SocialiteContentBarChanged", function(event) {
          self.checkBarStatus();
        }, false);
      },
      
      onUnload: function() {
        // In case the interval is running, we shouldn't leave a dangling idleObserver.
        this.stop();
      },
      
      isEnabled: function() {
        return Socialite.preferences.getBoolPref("refreshIntervalEnabled");
      },
      
      start: function() {
        if (!this.interval.isRunning && this.isEnabled()) {
          logger.log("activerefresh", "Starting refresh interval.");
          this.interval.start();
        }
      },
      
      stop: function() {
        if (this.interval.isRunning) {
          logger.log("activerefresh", "Stopping refresh interval.");
          this.interval.stop();
        }
      },
      
      checkBarStatus: function() {
        if (SocialiteWindow.currentContentBar) {
          this.start();
        } else {
          this.stop();
        }
      },
      
      getInterval: function() {
        let interval = Socialite.preferences.getIntPref("refreshInterval");
        
        // Ensure that it's not possible to refresh faster than the coded minimum limit (for courtesy to sites) 
        if (interval < Socialite.globals.MINIMUM_REFRESH_INTERVAL) {
          interval = Socialite.globals.MINIMUM_REFRESH_INTERVAL;
          Socialite.preferences.setIntPref("refreshInterval", interval);
        }
        
        return interval;
      },
      
      updateEnabled: function() {
        if (this.isEnabled()) {
          this.checkBarStatus();
        } else {
          this.stop();
        }
      },
      
      updateInterval: function() {
        this.interval.setInterval(this.getInterval());
      }
  };
  
  return ActiveRefresh;
})();