// Contains information about a particular reddit link.

logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/timestampedData.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");

var EXPORTED_SYMBOLS = ["RedditLinkInfo", "RedditLinkInfoFromJSON"];

// ---

function RedditLinkInfoState() {
  TimestampedData.apply(this);
  this.addField("title");
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

function RedditLinkInfoFromJSON(api, json) {
  var linkData = json.data.children[0].data;
  var linkInfo = new RedditLinkInfo(api, linkData.url, linkData.name);
  
  linkInfo.setFromJSON(json);
  linkInfo.updateLocalState();
  
  return linkInfo;
}

/**
 * A high-level object for dealing with a single link on Reddit.
 */
function RedditLinkInfo(api, url, fullname) {
  this.redditAPI = api;
  this.url = url;
  this.fullname = fullname;
  
  this.state = new RedditLinkInfoState();
  this.localState = new RedditLinkInfoState();
}

RedditLinkInfo.prototype.update = Action("RedditLinkInfo.update", function(omittedFields, action) {  
  var infoCall = this.redditAPI.info(
    hitchThis(this, function success(r, json) {
      // Ensure the received data is not older than the last update (for instance, due to lag)
      if (action.startTime >= this.state.lastUpdated) {
        this.setFromJSON(json);
        this.updateLocalState(omittedFields, action.startTime);
      } else {
        logger.log("RedditLinkInfo", this.fullname, "State updated since update request, not updating state");
      }
      action.success(r, json);
    }),
    function failure(r) { action.failure(r); }
  );
  
  infoCall.perform(this.url, this.localState.subreddit);
});

RedditLinkInfo.prototype.vote = Action("RedditLinkInfo.vote", function(isLiked, action) {
  if (isLiked != this.localState.isLiked) {
    // Determine the updated score
    if (isLiked == true) {
      if (this.localState.isLiked == false) {
        this.localState.score += 2;
      } else if (this.localState.isLiked == null) {
        this.localState.score += 1;
      }
    } else if (isLiked == false) {
      if (this.localState.isLiked == true) {
        this.localState.score -= 2;
      } else if (this.localState.isLiked == null) {
        this.localState.score -= 1;
      }
    } else if (isLiked == null) {
      if (this.localState.isLiked == true) {
        this.localState.score -= 1;
      } else if (this.localState.isLiked == false) {
        this.localState.score += 1;
      }
    }
    
    this.localState.isLiked = isLiked;

    // Submit the vote, and then update state.
    // (proceeding after each AJAX call completes)
    var submit = this.redditAPI.vote(
      function success(r) { action.success(r); },
      function failure(r) {
        this.revertLocalState(submit.startTime, ["isLiked", "score"])
        action.failure(r);
      }
    );    
      
    submit.perform(this.fullname, this.localState.isLiked);
  }
});

RedditLinkInfo.prototype.hide = Action("RedditLinkInfo.hide", function(action) {
  if (!this.localState.isHidden) {
   this.localState.isHidden = true;
  
   var submit = this.redditAPI.hide(
      function success(r) { action.success(r); },
      function failure(r) {
        this.revertLocalState(submit.startTime, ["isHidden"])
        action.failure(r);
      }
    )
    
    submit.perform(this.fullname);
  }  
});

RedditLinkInfo.prototype.unhide = Action("RedditLinkInfo.unhide", function(action) {
  if (this.localState.isHidden) {
   this.localState.isHidden = false;
  
   var submit = this.redditAPI.unhide(
      function success(r) { action.success(r); },
      function failure(r) {
        this.revertLocalState(submit.startTime, ["isHidden"])
        action.failure(r);
      }
    )
    
    submit.perform(this.fullname);
  }  
});

RedditLinkInfo.prototype.save = Action("RedditLinkInfo.save", function(action) {
  if (!this.localState.isSaved) {
   this.localState.isSaved = true;
  
   var submit = this.redditAPI.save(
      function success(r) { action.success(r); },
      function failure(r) {
        this.revertLocalState(submit.startTime, ["isSaved"])
        action.failure(r);
      }
    )
    
    submit.perform(this.fullname);
  }  
});

RedditLinkInfo.prototype.unsave = Action("RedditLinkInfo.unsave", function(action) {
  if (this.localState.isSaved) {
   this.localState.isSaved = false;
  
   var submit = this.redditAPI.unsave(
      function success(r) { action.success(r); },
      function failure(r) {
        this.revertLocalState(submit.startTime, ["isSaved"])
        action.failure(r);
      }
    )
    
    submit.perform(this.fullname);
  }  
});

const fullnameRegex = /(\w+)_(\w+)/;

RedditLinkInfo.prototype.getID = function() {
  return fullnameRegex.exec(this.fullname)[2];
}

RedditLinkInfo.prototype.getKind = function() {
  return fullnameRegex.exec(this.fullname)[1];
}

RedditLinkInfo.prototype.setFromJSON = function(json) {
  var linkData = json.data.children[0].data;
  
  this.state.title        = linkData.title;
  this.state.isLiked      = linkData.likes;
  this.state.score        = linkData.score;
  this.state.likeCount    = linkData.ups;
  this.state.dislikeCount = linkData.downs;
  this.state.subreddit    = linkData.subreddit;
  this.state.commentCount = linkData.num_comments;
  this.state.isSaved      = linkData.saved;
  this.state.isHidden     = linkData.hidden;
  
  logger.log("RedditLinkInfo", this.fullname, "Updated from JSON info: " +
                     "liked: "    + this.state.isLiked + ", "      +
                     "score: "    + this.state.score + ", "        +
                     "subreddit: "+ this.state.subreddit + ", "    +
                     "comments: " + this.state.commentCount + ", " +
                     "saved: "    + this.state.isSaved + ", "      +
                     "hidden: "   + this.state.isHidden            );
}

RedditLinkInfo.prototype.updateLocalState = function(omittedFields, timestamp) {
  this.localState.copy(this.state, omittedFields, timestamp, true);
}

RedditLinkInfo.prototype.revertLocalState = function(properties, timestamp) {
  this.localState.copy(this.state, properties, timestamp);
}