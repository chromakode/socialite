// Contains information about a particular link.

Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
reddit = Components.utils.import("resource://socialite/reddit/reddit.jsm");

var EXPORTED_SYMBOLS = ["LinkInfo", "LinkInfoFromJSON"]

// ---

function LinkInfoState() {
  this.isLiked = null;
  this.commentCount = null;
  this.isSaved = null;
}

LinkInfoState.prototype.copy = function(state) {
  this.isLiked = state.isLiked;
  this.commentCount = state.commentCount;
  this.isSaved = state.isSaved;
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
  var linkInfo = this;
  var act = Action("LinkInfo.update", function() {
    var action = this;
    var infoCall = new reddit.info(
      function success(r, json) {
        linkInfo.updateFromJSON(json);
        action.success();
      },
      function fail() {
        action.failure();
      }
    );
    
    infoCall.perform(linkInfo.url);
  });
  
  return (new act(successCallback, failureCallback));
}

LinkInfo.prototype.updateFromJSON = function(json) {
  var linkData = json.data.children[0].data;
  
  this.state.isLiked  = linkData.likes;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved  = linkData.saved;
  
  this.updateUIState();
  
  debug_log(this.linkID, "Updated from JSON info: "                    +
                         "liked: "    + this.state.isLiked + ", "      +
                         "comments: " + this.state.commentCount + ", " +
                         "saved: "    + this.state.isSaved             );
}

LinkInfo.prototype.updateUIState = function() {
  this.uiState.copy(this.state);
}
