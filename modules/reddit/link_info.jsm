// Contains information about a particular link.

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/timestamped_data.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/reddit/reddit.jsm");

var EXPORTED_SYMBOLS = ["LinkInfo", "LinkInfoFromJSON"]

// ---

function LinkInfoState() {
  TimestampedData.apply(this);
  this.addField("isLiked");
  this.addField("score");
  this.addField("likeCount");
  this.addField("dislikeCount");
  this.addField("subreddit");
  this.addField("commentCount");
  this.addField("isSaved");
  this.addField("isHidden");
}

LinkInfoState.prototype = new TimestampedData;

// ---

function LinkInfoFromJSON(json) {
  var linkData = json.data.children[0].data;
  var linkInfo = new LinkInfo(linkData.url, linkData.name, linkData.title);
  
  linkInfo.updateFromJSON(json);
  
  return linkInfo;
}

function LinkInfo(reddit, url, fullname, title) {
  this.reddit = reddit;
  this.url = url;
  this.fullname = fullname;
  this.title = title;
  
  this.modActive = true;
  
  this.state = new LinkInfoState();
  this.uiState = new LinkInfoState();
  
  this.ui = {};
}

const fullnameRegex = /(\w+)_(\w+)/;

LinkInfo.prototype.getID = function() {
  return fullnameRegex.exec(this.fullname)[2];
}

LinkInfo.prototype.getKind = function() {
  return fullnameRegex.exec(this.fullname)[1];
}

LinkInfo.prototype.update = function(successCallback, failureCallback) {
  var act = Action("LinkInfo.update", hitchThis(this, function(action) {
    var infoCall = new this.reddit.API.info(
      hitchThis(this, function success(r, json) {
        if (action.startTime >= this.state.lastUpdated) {
          this.updateFromJSON(json);
          action.success(r, json);
        } else {
          logger.log(this.fullname, "State updated since update request, not updating state");
        }
      }),
      function failure(r) {
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
  this.state.likeCount    = linkData.ups;
  this.state.dislikeCount = linkData.downs;
  this.state.subreddit    = linkData.subreddit;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved      = linkData.saved;
  this.state.isHidden     = linkData.hidden;
  
  logger.log(this.fullname, "Updated from JSON info: "                    +
                     "liked: "    + this.state.isLiked + ", "      +
                     "score: "    + this.state.score + ", "        +
                     "subreddit: "+ this.state.subreddit + ", "    +
                     "comments: " + this.state.commentCount + ", " +
                     "saved: "    + this.state.isSaved + ", "      +
                     "hidden: "   + this.state.isHidden            );
}

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
