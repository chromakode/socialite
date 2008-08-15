logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");
Components.utils.import("resource://socialite/reddit/redditLinkInfo.jsm");

var EXPORTED_SYMBOLS = ["Reddit"];

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit/upgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit/upmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit/downgray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit/downmod.png"

function Reddit(sitename, siteurl) {
  this.sitename = sitename;
  this.siteurl = siteurl;
  
  this.auth = null;
  this.API = new RedditAPI(this);
  this.bookmarkletAPI = new BookmarkletAPI(this);
  
  /*this.authenticate = Action("reddit.authenticate", hitchThis(this, function(action) {
    (new getAuthHash(
      hitchThis(this, function success(auth) {
        this.auth = auth;
        action.success(auth);
      }),
      function failure() { action.failure(); }
    )).perform(this.site);
  }));*/
}

Reddit.prototype.initialize = function() {
  /*(new this.authenticate()).perform();*/
}

Reddit.prototype.createBarContent = function(document, linkInfo) {
  var barContent = document.createElement("hbox");
  barContent.style.MozBinding = "url(chrome://socialite/content/reddit/redditBar.xml#redditbar)";
  barContent.linkInfo = linkInfo;
  return barContent;
}

Reddit.prototype.onSitePageLoad = function(doc, win) {
  // Iterate over each article link and register event listener
  var res = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
   
  for (var i=0; i < res.snapshotLength; i++) {
    var siteLink = res.snapshotItem(i);
    siteLink.addEventListener("mouseup", hitchHandler(this, "linkClicked"), false);
    
    // For debugging purposes
    //siteLink.style.color = "red";
  }
  
  logger.log("reddit", "Added click handlers to " + res.snapshotLength + " links on " + win.location.href);
  
  // Snarf the authentication hash using wrappedJSObject
  // This should be safe, since Firefox 3 uses a XPCSafeJSObjectWrapper
  // See http://developer.mozilla.org/en/docs/XPConnect_wrappers#XPCSafeJSObjectWrapper
  this.auth.snarfModHash(win.wrappedJSObject.modhash);
}

Reddit.prototype.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  
  try {
    // Remove title_ from title_XX_XXXXX
    var linkURL   = link.href;
    var linkID    = link.id.slice(6);
    var linkTitle = link.textContent;
    
    // Create the linkInfo object
    var linkInfo = new RedditLinkInfo(this, linkURL, linkID);
    linkInfo.state.title = linkTitle;
    
    //
    // Get some "preloaded" information from the page while we can.
    //
    var linkLike              = doc.getElementById("up_"+linkInfo.fullname);
    var linkLikeActive        = /upmod/.test(linkLike.className);
    
    var linkDislike           = doc.getElementById("down_"+linkInfo.fullname);
    var linkDislikeActive     = /downmod/.test(linkDislike.className);

    if (linkLikeActive) {
      linkInfo.state.isLiked  = true;
    } else if (linkDislikeActive) {
      linkInfo.state.isLiked  = false;
    } else {
      linkInfo.state.isLiked  = null;
    }
    
    var scoreSpan             = doc.getElementById("score_"+linkInfo.fullname)
    if (scoreSpan) {
      linkInfo.state.score    = parseInt(scoreSpan.textContent);
    }
    
    var linkSubreddit          = doc.getElementById("subreddit_"+linkInfo.fullname)
    if (linkSubreddit) {
      linkInfo.state.section   = linkSubreddit.textContent;
    }

    var linkComments           = doc.getElementById("comment_"+linkInfo.fullname);
    var commentNum             = /((\d+)\s)?comment[s]?/.exec(linkComments.textContent)[2];
    if (commentNum) {
      linkInfo.state.commentCount = parseInt(commentNum);
    } else {
      linkInfo.state.commentCount = 0;
    }
    
    var linkSave               = doc.getElementById("save_"+linkInfo.fullname+"_a");
    var linkUnsave             = doc.getElementById("unsave_"+linkInfo.fullname+"_a");
    
    if (linkSave != null) {
      // If there's a save link
      // Whether it's clicked
      linkInfo.state.isSaved = (linkSave.style.display == "none");
    } else if (linkUnsave != null) {
      // If there's an unsave link (assumption)
      // Whether it's not clicked
      linkInfo.state.isSaved = (linkUnsave.style.display != "none");
    } else {
      // No save or unsave link present -- this shouldn't happen, as far as I know.
      logger.log(linkInfo.fullname, "Unexpected save link absence.");
    }
    
    // You'd think the link was hidden, the user couldn't have clicked on it
    // But they could find it in their hidden links list.
    var linkHide             = doc.getElementById("hide_"+linkInfo.fullname+"_a");
    var linkUnhide           = doc.getElementById("unsave_"+linkInfo.fullname+"_a");
    
    if (linkHide != null) {
      linkInfo.state.isHidden = false;
    } else if (linkUnhide != null) {
      linkInfo.state.isHidden = true;
    } else {
      // No hide or unhide link present -- this shouldn't happen, as far as I know.
      logger.log(linkInfo.fullname, "Unexpected hide link absence.");
    }
  } catch (e) {
    logger.log(linkInfo.fullname, "Caught exception while reading data from DOM: " + e.toString());
  }
  
  // Add the information we collected to the watch list  
  logger.log(linkInfo.fullname, "Clicked");
  this.parent.watchedURLs.watch(link.href, linkInfo);
}

/*
Socialite.updateLikeButtons = function(ui, isLiked) {
  if (isLiked == true) {
    ui.buttonLike.setAttribute("image", REDDIT_LIKE_ACTIVE_IMAGE);
    ui.buttonLike.setAttribute("checked", true);
  } else {
    ui.buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
    ui.buttonLike.setAttribute("checked", false);
  }
  
  if (isLiked == false) {
    ui.buttonDislike.setAttribute("image", REDDIT_DISLIKE_ACTIVE_IMAGE);
    ui.buttonDislike.setAttribute("checked", true);
  } else {
    ui.buttonDislike.setAttribute("image", REDDIT_DISLIKE_INACTIVE_IMAGE);
    ui.buttonDislike.setAttribute("checked", false);
  }
};

Socialite.updateScoreLabel = function(ui, score, isLiked) {
  ui.labelScore.setAttribute("value", score);
  if (isLiked == true) {
    ui.labelScore.setAttribute("class", "socialite-score socialite-liked");
  } else if (isLiked == false) {
    ui.labelScore.setAttribute("class", "socialite-score socialite-disliked");  
  } else {
    ui.labelScore.setAttribute("class", "socialite-score");  
  }
}

Socialite.updateSectionLabel = function(ui, section) {
  if (section) {
    ui.labelSection.setAttribute("value", "["+section+"]");
  } else {
    ui.labelSection.setAttribute("value", "");
  }
}

Socialite.updateCommentsButton = function(ui, commentCount) {
  ui.buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [commentCount.toString()]));
}

Socialite.updateSaveButton = function(ui, isSaved) {
  if (isSaved) {
    ui.buttonSave.setAttribute("label", this.strings.getString("unsave"));
    ui.buttonSave.setAttribute("accesskey", this.strings.getString("unsave.accesskey"));
  } else {
    ui.buttonSave.setAttribute("label", this.strings.getString("save"));
    ui.buttonSave.setAttribute("accesskey", this.strings.getString("save.accesskey"));
  }
}

Socialite.updateHideButton = function(ui, isHidden) {
  if (isHidden) {
    ui.buttonHide.setAttribute("label", this.strings.getString("unhide"));
    ui.buttonHide.setAttribute("accesskey", this.strings.getString("unhide.accesskey"));
  } else {
    ui.buttonHide.setAttribute("label", this.strings.getString("hide"));
    ui.buttonHide.setAttribute("accesskey", this.strings.getString("hide.accesskey"));
  }
}

Socialite.updateButtons = function(linkInfo) {
  if (linkInfo.modActive) {
    linkInfo.ui.buttonLike.setAttribute("disabled", false);
    linkInfo.ui.buttonDislike.setAttribute("disabled", false);
    linkInfo.ui.buttonSave.setAttribute("disabled", false);
  } else {
    linkInfo.ui.buttonLike.setAttribute("disabled", true);
    linkInfo.ui.buttonDislike.setAttribute("disabled", true);
    linkInfo.ui.buttonSave.setAttribute("disabled", true);
  }
  
  this.updateLikeButtons(linkInfo.ui, linkInfo.uiState.isLiked);
  this.updateScoreLabel(linkInfo.ui, linkInfo.uiState.score, linkInfo.uiState.isLiked);
  this.updateSectionLabel(linkInfo.ui, linkInfo.uiState.subreddit);
  this.updateCommentsButton(linkInfo.ui, linkInfo.uiState.commentCount);
  this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);
  this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);
  
  logger.log(linkInfo.fullname, "Updated UI");
}

Socialite.siteLinkClicked = function(e) {
  openUILink("http://www.reddit.com", e);
};

Socialite.buttonLikeClicked = function(linkInfo, e) {
  // We'll update the score locally, without using live data, since this is typically cached on reddit. In general, it makes more sense if there is a visible change in the score, even though we're not being totally accurate!
  if (linkInfo.uiState.isLiked == true) {
    linkInfo.uiState.isLiked = null;
    linkInfo.uiState.score -= 1;
  } else if (linkInfo.uiState.isLiked == false) {
    linkInfo.uiState.isLiked = true;
    linkInfo.uiState.score += 2;
  } else {
    linkInfo.uiState.isLiked = true;
    linkInfo.uiState.score += 1;
  }

  // Provide instant feedback before sending
  this.updateLikeButtons(linkInfo.ui, linkInfo.uiState.isLiked);
  this.updateScoreLabel(linkInfo.ui, linkInfo.uiState.score, linkInfo.uiState.isLiked);
  
  // Submit the vote, and then update state.
  // (proceeding after each AJAX call completes)
  var submit = new this.reddit.API.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo, ["score"]),
    sequenceCalls(
      hitchHandler(this, "revertUIState", linkInfo, ["isLiked", "score"]),
      hitchHandler(this, "actionFailureHandler", linkInfo)
    )
  );    
    
  submit.perform(linkInfo.fullname, linkInfo.uiState.isLiked);
};

Socialite.buttonDislikeClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isLiked == true) {
    linkInfo.uiState.isLiked = false;
    linkInfo.uiState.score -= 2;
  } else if (linkInfo.uiState.isLiked == false) {
    linkInfo.uiState.isLiked = null;
    linkInfo.uiState.score += 1;
  } else {
    linkInfo.uiState.isLiked = false;
    linkInfo.uiState.score -= 1;
  }
  
  // Provide instant feedback before sending
  this.updateLikeButtons(linkInfo.ui, linkInfo.uiState.isLiked);
  this.updateScoreLabel(linkInfo.ui, linkInfo.uiState.score, linkInfo.uiState.isLiked);
  
  // Submit the vote, and then update state.
  // (proceeding after the AJAX call completes)
  var submit = new this.reddit.API.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo, ["score"]),
    sequenceCalls(
      hitchHandler(this, "revertUIState", linkInfo, ["isLiked", "score"]),
      hitchHandler(this, "actionFailureHandler", linkInfo)
    )
  );
  
  submit.perform(linkInfo.fullname, linkInfo.uiState.isLiked);
};

Socialite.sectionClicked = function(linkInfo, e) {
  openUILink("http://www.reddit.com/r/"+linkInfo.state.subreddit+"/", e);
};

Socialite.buttonCommentsClicked = function(linkInfo, e) {
  openUILink("http://www.reddit.com/info/"+linkInfo.getID()+"/comments/", e);
};

Socialite.buttonSaveClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isSaved) {
    
    linkInfo.uiState.isSaved = false;
    this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);

    (new this.reddit.API.unsave(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isSaved"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(linkInfo.fullname);
        
  } else {
  
    linkInfo.uiState.isSaved = true;
    this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);

    (new this.reddit.API.save(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isSaved"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(linkInfo.fullname);
  }
};

Socialite.buttonHideClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isHidden) {
    
    linkInfo.uiState.isHidden = false;
    this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);

    (new redditAPI.unhide(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isHidden"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(linkInfo.fullname);
        
  } else {
  
    linkInfo.uiState.isHidden = true;
    this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);

    (new this.reddit.API.hide(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isHidden"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(linkInfo.fullname);
  }
};

Socialite.buttonRandomClicked = function(e) {
  var self = this;

  (new this.reddit.API.randomrising(
    function (r, json) {
      var linkInfo = LinkInfoFromJSON(json);
      self.watchLink(linkInfo.url, linkInfo);
      openUILink(linkInfo.url, e);
    },
    hitchHandler(this, "failureNotification", null))
  ).perform();
};*/
