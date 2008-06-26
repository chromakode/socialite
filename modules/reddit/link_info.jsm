// Contains information about a particular link.

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
reddit = Components.utils.import("resource://socialite/reddit/reddit.jsm");

var EXPORTED_SYMBOLS = ["LinkInfo", "LinkInfoFromJSON"]

// ---

function LinkInfoState() {
  this.lastUpdated = null;
  this.isLiked = null;
  this.commentCount = null;
  this.isSaved = null;
}

LinkInfoState.prototype.updated = function() {
  this.lastUpdated = Date.now();
}

LinkInfoState.prototype.copy = function(state) {
  this.isLiked = state.isLiked;
  this.commentCount = state.commentCount;
  this.isSaved = state.isSaved;
  this.updated();
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
  
  this.buttons = {};
}

LinkInfo.prototype.update = function(successCallback, failureCallback) {
  var act = Action("LinkInfo.update", hitchThis(this, function(action) {
    var infoCall = new reddit.info(
      hitchThis(this, function success(r, json) {
        this.updateFromJSON(json);
        action.success(r, json);
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
  
  this.state.isLiked  = linkData.likes;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved  = linkData.saved;
  this.state.updated();
  
  debug_log(this.id, "Updated from JSON info: "                    +
                     "liked: "    + this.state.isLiked + ", "      +
                     "comments: " + this.state.commentCount + ", " +
                     "saved: "    + this.state.isSaved             );
}

LinkInfo.prototype.updateUIState = function() {
  this.uiState.copy(this.state);
}
