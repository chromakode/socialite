logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["ActiveInterval"];

let idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
                                     .getService(Components.interfaces.nsIIdleService)

function ActiveInterval(callback, interval, idleThreshold) {
  this.callback = callback;
  this.interval = interval;
  
  if (idleThreshold !== undefined) {
    this.idleThreshold = idleThreshold;
  } else {
    this.idleThreshold = 60*5; // 10 minutes
  }
  
  // Instantiate an observer for the idle service
  let self = this;
  this.idleObserver = {
    observe: function(subject, topic, data) {
      switch (topic) {
        case "idle":
          logger.log("activeinterval", "User idle; pausing interval")
          self._stop_ticking();
          break;
          
        case "back":
          logger.log("activeinterval", "User back; resuming interval")
          self.tick();
          self._start_ticking();
          break;
      }
    }
  };
  
  // Instantiate a timer
  this.timer = Components.classes["@mozilla.org/timer;1"]
                                  .createInstance(Components.interfaces.nsITimer);
  this.isTicking = false;
  this.isRunning = false;
}
ActiveInterval.prototype = {
  start: function(callback) {
    if (!this.isRunning) {
      idleService.addIdleObserver(this.idleObserver, this.idleThreshold);
      this._start_ticking();
      this.isRunning = true;
    }
  },
  
  stop: function() {
    if (this.isRunning) {
      idleService.removeIdleObserver(this.idleObserver, this.idleThreshold);
      this._stop_ticking();
      this.isRunning = false;
    }
  },
  
  reset: function() {
    if (this.isTicking) {
      this._start_ticking();
    }
  },
  
  setInterval: function(interval) {
    this.interval = interval;
    if (this.isTicking) {
      this.timer.delay = this._get_timer_interval();
    }
  },
  
  _get_timer_interval: function() {
    return this.interval*1000;
  },
  
  _start_ticking: function() {
    let self = this;
    this.timer.initWithCallback(
      function() {self.tick();},
      this._get_timer_interval(),
      this.timer.TYPE_REPEATING_SLACK
    );
    this.isTicking = true;
  },
  
  _stop_ticking: function() {
    this.timer.cancel();
    this.isTicking = false;
  },
  
  tick: function() {
    this.callback();
  },
};
