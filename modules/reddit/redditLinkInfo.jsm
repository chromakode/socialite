// Contains information about a particular reddit link.

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/timestampedData.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/reddit/reddit.jsm");

var EXPORTED_SYMBOLS = ["RedditLinkInfo", "RedditLinkInfoFromJSON"];

// ---

function RedditLinkInfoState() {
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

RedditLinkInfoState.prototype = new TimestampedData;

// ---

function RedditLinkInfoFromJSON(json) {
  var linkData = json.data.children[0].data;
  var linkInfo = new LinkInfo(linkData.url, linkData.name, linkData.title);
  
  linkInfo.updateFromJSON(json);
  
  return linkInfo;
}

function RedditLinkInfo(redditsite, url, fullname) {
  this.prototype = new LinkInfo(redditsite, url);
  
  this.fullname = fullname;
  
  this.state = new LinkInfoState();
}

const fullnameRegex = /(\w+)_(\w+)/;

RedditLinkInfo.prototype.getID = function() {
  return fullnameRegex.exec(this.fullname)[2];
}

RedditLinkInfo.prototype.getKind = function() {
  return fullnameRegex.exec(this.fullname)[1];
}

RedditLinkInfo.prototype.update = function(successCallback, failureCallback) {
  var act = Action("RedditLinkInfo.update", hitchThis(this, function(action) {
    var infoCall = new this.site.API.info(
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

RedditLinkInfo.prototype.updateFromJSON = function(json) {
  var linkData = json.data.children[0].data;
  
  this.state.isLiked      = linkData.likes;
  this.state.score        = linkData.score;
  this.state.likeCount    = linkData.ups;
  this.state.dislikeCount = linkData.downs;
  this.state.subreddit    = linkData.subreddit;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved      = linkData.saved;
  this.state.isHidden     = linkData.hidden;
  
  logger.log(this.fullname, "Updated from JSON info: " +
                     "liked: "    + this.state.isLiked + ", "      +
                     "score: "    + this.state.score + ", "        +
                     "subreddit: "+ this.state.subreddit + ", "    +
                     "comments: " + this.state.commentCount + ", " +
                     "saved: "    + this.state.isSaved + ", "      +
                     "hidden: "   + this.state.isHidden            );
}
