// Contains information about a particular link.

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/timestamped_data.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
reddit = Components.utils.import("resource://socialite/reddit/reddit.jsm");

var EXPORTED_SYMBOLS = ["LinkInfo", "LinkInfoFromJSON"]

// ---

function LinkInfoState() {
  TimestampedData.apply(this);
  this.addField("isLiked");
  this.addField("score");
  this.addField("commentCount");
  this.addField("isSaved");
  this.addField("isHidden");
}

LinkInfoState.prototype = new TimestampedData;

LinkInfoState.prototype.copy = function(state) {
  this.isLiked = state.isLiked;
  this.score = state.score;
  this.commentCount = state.commentCount;
  this.isSaved = state.isSaved;
  this.isHidden = state.isHidden;
}

// ---

function LinkInfoFromJSON(json) {
  var linkData = json.data.children[0].data;
  var linkInfo = new LinkInfo(linkData.url, linkData.name, linkData.title);
  
  linkInfo.updateFromJSON(json);
  
  return linkInfo;
}

function LinkInfo(url, id, title) {
  this.url = url;
  this.id = id;
  this.title = title;
  
  this.modActive = true;
  
  this.state = new LinkInfoState();
  this.uiState = new LinkInfoState();
  
  this.ui = {};
}

LinkInfo.prototype.update = function(successCallback, failureCallback) {
  var act = Action("LinkInfo.update", hitchThis(this, function(action) {
    var infoCall = new reddit.info(
      hitchThis(this, function success(r, json) {
        if (action.startTime >= this.state.lastUpdated) {
          this.updateFromJSON(json);
          action.success(r, json);
        } else {
          debug_log(linkInfo.id, "State updated since update request, not updating state");
        }
      }),
      function fail(r) {
        action.failure(r);
      }
    );
    
    infoCall.perform(this.url);
  }));
  
  return (new act(successCallback, failureCallback));
}

LinkInfo.prototype.updateFromJSON = function(json) {
  var linkData = json.data.children[0].data;
  
  this.state.isLiked      = linkData.likes;
  this.state.score        = linkData.score;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved      = linkData.saved;
  this.state.isHidden     = linkData.hidden;
  
  debug_log(this.id, "Updated from JSON info: "                    +
                     "liked: "    + this.state.isLiked + ", "      +
                     "score: "    + this.state.score + ", "        +
                     "comments: " + this.state.commentCount + ", " +
                     "saved: "    + this.state.isSaved + ", "      +
                     "hidden: "   + this.state.isHidden            );
}

LinkInfo.prototype.updateUIState = function() {
  this.uiState.copy(this.state);
}

LinkInfo.prototype.revertUIState = function(properties, timestamp) {
  debug_log(this.id, "Reverting UI state properties: [" + properties.toString() + "]");
  for (var i=0; i<properties.length; i++) {
    var prop = properties[i];
    
    // If the uiState hasn't been updated since the timestamp, revert it.
    if ((timestamp == null) || (timestamp >= this.uiState.getTimestamp(prop))) {
      debug_log(this.id, "Reverting UI state property " + prop + " from " + this.uiState[prop] + " to " + this.state[prop]);
      this.uiState[prop] = this.state[prop];
    } else {
      debug_log(this.id, "UI state property " + prop + " modified since revert timestamp, skipping revert.");
    }
  }
}
