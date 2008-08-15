// Contains information about a particular link.

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/timestampedData.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["LinkInfo", "LinkInfo"]

// ---

function LinkInfoState() {
  TimestampedData.apply(this);
}

LinkInfoState.prototype = new TimestampedData;

// ---

function LinkInfo(site, url) {
  this.site = site;
  this.url = url;
  
  this.state = new LinkInfoState();
  this.uiState = new LinkInfoState();
}

LinkInfo.prototype.update = logger.makeStubFunction("LinkInfo", "update");

LinkInfo.prototype.updateUIState = function(omit) {
  this.uiState.copy(this.state, omit);
}

LinkInfo.prototype.revertUIState = function(properties, timestamp) {
  logger.log(this.fullname, "Reverting UI state properties: [" + properties.toString() + "]");
  for (var i=0; i<properties.length; i++) {
    var prop = properties[i];
    
    // If the uiState hasn't been updated since the timestamp, revert it.
    if ((timestamp == null) || (timestamp >= this.uiState.getTimestamp(prop))) {
      logger.log(this.fullname, "Reverting UI state property " + prop + " from " + this.uiState[prop] + " to " + this.state[prop]);
      this.uiState[prop] = this.state[prop];
    } else {
      logger.log(this.fullname, "UI state property " + prop + " modified since revert timestamp, skipping revert.");
    }
  }
}
