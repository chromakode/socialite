logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/site.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
//Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");
Components.utils.import("resource://socialite/reddit/redditLinkInfo.jsm");

var EXPORTED_SYMBOLS = ["RedditSite"];

var XPathResult = Components.interfaces.nsIDOMXPathResult;

function RedditSite(siteName, siteURL) {
  this.siteName = siteName;
  this.siteURL = siteURL;
  
  this.API = new RedditAPI();
  //this.bookmarkletAPI = new BookmarkletAPI(this);
  
  this.authenticate = Action("reddit.authenticate", function(action) {
    getAuthHash(
      hitchThis(this, function success(auth) {
        this.API.auth = auth;
        action.success(auth);
      }),
      function failure() { action.failure(); }
    ).perform(this.siteURL);
  });
}

RedditSite.prototype = new SocialiteSite();

RedditSite.prototype.initialize = function() {
  this.authenticate().perform();
}

RedditSite.prototype.onSitePageLoad = function(doc, win) {
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
  this.API.auth.snarfModHash(win.wrappedJSObject.modhash);
}

RedditSite.prototype.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  
  try {
    // Remove title_ from title_XX_XXXXX
    var linkURL   = link.href;
    var linkID    = link.id.slice(6);
    var linkTitle = link.textContent;
    
    // Create the linkInfo object
    var linkInfo = new RedditLinkInfo(this.API, linkURL, linkID);
    linkInfo.localState.title = linkTitle;
    
    //
    // Get some "preloaded" information from the page while we can.
    //
    var linkLike              = doc.getElementById("up_"+linkInfo.fullname);
    var linkLikeActive        = /upmod/.test(linkLike.className);
    
    var linkDislike           = doc.getElementById("down_"+linkInfo.fullname);
    var linkDislikeActive     = /downmod/.test(linkDislike.className);

    if (linkLikeActive) {
      linkInfo.localState.isLiked  = true;
    } else if (linkDislikeActive) {
      linkInfo.localState.isLiked  = false;
    } else {
      linkInfo.localState.isLiked  = null;
    }
    
    var scoreSpan             = doc.getElementById("score_"+linkInfo.fullname)
    if (scoreSpan) {
      linkInfo.localState.score    = parseInt(scoreSpan.textContent);
    }
    
    var linkSubreddit          = doc.getElementById("subreddit_"+linkInfo.fullname)
    if (linkSubreddit) {
      linkInfo.localState.subreddit = linkSubreddit.textContent;
    }

    var linkComments           = doc.getElementById("comment_"+linkInfo.fullname);
    var commentNum             = /((\d+)\s)?comment[s]?/.exec(linkComments.textContent)[2];
    if (commentNum) {
      linkInfo.localState.commentCount = parseInt(commentNum);
    } else {
      linkInfo.localState.commentCount = 0;
    }
    
    var linkSave               = doc.getElementById("save_"+linkInfo.fullname+"_a");
    var linkUnsave             = doc.getElementById("unsave_"+linkInfo.fullname+"_a");
    
    if (linkSave != null) {
      // If there's a save link
      // Whether it's clicked
      linkInfo.localState.isSaved = (linkSave.style.display == "none");
    } else if (linkUnsave != null) {
      // If there's an unsave link (assumption)
      // Whether it's not clicked
      linkInfo.localState.isSaved = (linkUnsave.style.display != "none");
    } else {
      // No save or unsave link present -- this shouldn't happen, as far as I know.
      logger.log(linkInfo.fullname, "Unexpected save link absence.");
    }
    
    // You'd think the link was hidden, the user couldn't have clicked on it
    // But they could find it in their hidden links list.
    var linkHide             = doc.getElementById("hide_"+linkInfo.fullname+"_a");
    var linkUnhide           = doc.getElementById("unsave_"+linkInfo.fullname+"_a");
    
    if (linkHide != null) {
      linkInfo.localState.isHidden = false;
    } else if (linkUnhide != null) {
      linkInfo.localState.isHidden = true;
    } else {
      // No hide or unhide link present -- this shouldn't happen, as far as I know.
      logger.log(linkInfo.fullname, "Unexpected hide link absence.");
    }
  } catch (e) {
    logger.log(linkInfo.fullname, "Caught exception while reading data from DOM: " + e.toString());
  }
  
  // Add the information we collected to the watch list  
  logger.log(linkInfo.fullname, "Clicked");
  this.parent.watchedURLs.watch(linkInfo.url, this, linkInfo);
}

RedditSite.prototype.createBarContent = function(document, linkInfo) {
  var barContent = document.createElement("hbox");
  
  barContent.linkInfo = linkInfo;
  
  // We define behaviors here since I intend the RedditBarContent XBL to only be responsible for the display of a RedditLinkInfo instance.
  // In other words, we'll treat it more like a support widget and define handlers for its commands here.
  // FIXME: We'll use this 'afterBound' hack because I'm tired of trying to figure out how to make XBL apply synchronously.
  var site = this;
  barContent.afterBound = function() {
    
    var failureHandler = hitchHandler(site, "actionFailureHandler", barContent.linkInfo);
    var voteUpdateHandler = function() {
      barContent.linkInfo.update(
        hitchThis(barContent, barContent.update),
        failureHandler
      ).perform(["score"]);
    };
    var updateHandler = function() {
      barContent.linkInfo.update(
        hitchThis(barContent, barContent.update),
        failureHandler
      ).perform([]);
    };
    
    this.labelSubreddit.addEventListener("click", function(e) {
      site.parent.openUILink("http://"+site.siteURL+"/r/"+barContent.linkInfo.localState.subreddit+"/", e);
    }, false);
        
    this.buttonLike.addEventListener("click", function(e) {
      var vote = barContent.linkInfo.vote(
        voteUpdateHandler,
        failureHandler
      );
      if (barContent.linkInfo.localState.isLiked == true) {
        vote.perform(null);
      } else {
        vote.perform(true);
      }
      barContent.update();
    }, false);
    
    this.buttonDislike.addEventListener("click", function(e) {
      var vote = barContent.linkInfo.vote(
        voteUpdateHandler,
        failureHandler
      );
      if (barContent.linkInfo.localState.isLiked == false) {
        vote.perform(null);
      } else {
        vote.perform(false);
      }
      barContent.update();
    }, false);
    
    this.buttonComments.addEventListener("click", function(e) {
      site.parent.openUILink("http://"+site.siteURL+"/info/"+barContent.linkInfo.getID()+"/comments/", e);
    }, false);
    
    this.buttonSave.addEventListener("click", function(e) {
      if (barContent.linkInfo.localState.isSaved) {
        var submit = barContent.linkInfo.unsave(
          updateHandler,
          failureHandler
        );
      } else {
        var submit = barContent.linkInfo.save(
          updateHandler,
          failureHandler
        );
      }
      submit.perform()
      barContent.update();
    }, false);
    
    this.buttonHide.addEventListener("click", function(e) {
      if (barContent.linkInfo.localState.isHidden) {
        var submit = barContent.linkInfo.unhide(
          updateHandler,
          failureHandler
        );
      } else {
        var submit = barContent.linkInfo.hide(
          updateHandler,
          failureHandler
        );
      }
      submit.perform()
      barContent.update();
    }, false);
    
    this.buttonRandom.addEventListener("click", function(e) {
      site.API.randomrising(
        function (r, json) {
          var linkInfo = RedditLinkInfoFromJSON(site.API, json);
          site.parent.watchedURLs.watch(linkInfo.url, site, linkInfo);
          site.parent.openUILink(linkInfo.url, e);
        },
        failureHandler
      ).perform();
    }, false);
    
  };
  
  barContent.style.MozBinding = "url(chrome://socialite/content/reddit/redditBar.xml#redditbarcontent)"; 
  return barContent;
}

RedditSite.prototype.actionFailureHandler = function(linkInfo, r, action) {
  // 5xx error codes
  if (r.status >= 500 && r.status < 600) {
    text = "Reddit was unable to perform the requested action (" + action.name + "). Please try again later.";
  } else {
    text = "Unexpected HTTP status " + r.status + " recieved (" + action.name + ")";
  }
  
  this.parent.failureMessage(text);
}
