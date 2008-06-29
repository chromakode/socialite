 // Todo:
 // = Modularize
 // ---- Watches
 // - Download list of current top links and auto-apply to pages
 // + Save button
 // + Button preferences
 // - Login detection/button
 // + Display score
 // - Display subreddit
 // + Persistence Options
 // + Better error handling/retry
 // - Submit link command
 // - Make roll-in an option
 // - Unsuccessful action queue
 // - Option of working indicator (throbber)
 // - Autoclose bar based on link clicks, not persistence
 
 // Outstanding issues:
 // + Raw images seem to not be handled by DOMContentLoaded
 // + Toolbar opening lag
 // + Open comments in new tab
 // + Popup blocker bar
 // + Preserve after back-forward
 // + Reopen bar
 // + Some links still not working
 // + Link title alignment off
 // - m.reddit.com support (Pickegnome)
 // - Handle RSS readers
 // - Disable on fullscreen
 // - Open tabs in background?

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

RETRY_COUNT = 3;
RETRY_DELAY = 5000;

Components.utils.import("resource://socialite/preferences.jsm");
Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/action/sequence.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/utils/oneshot.jsm");
reddit = Components.utils.import("resource://socialite/reddit/reddit.jsm");
Components.utils.import("resource://socialite/reddit/link_info.jsm");

var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
                    .getService(Components.interfaces.nsIAlertsService);

// ---

const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;
const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;
var SocialiteProgressListener =
{
  QueryInterface: function(aIID) {
   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
       aIID.equals(Components.interfaces.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {return 0;},

  onLocationChange: function(aProgress, aRequest, aURI) {
    var window = aProgress.DOMWindow;
    
    if (window == window.top) {
      debug_log("SocialiteProgressListener", "onLocationChange (loading): " + aProgress.DOMWindow.location.href);
      Socialite.linkStartLoad(window, aProgress.isLoadingDocument);
    }
  },
  
  onProgressChange: function() {return 0;},
  onStatusChange: function() {return 0;},
  onSecurityChange: function() {return 0;},
}

// ---

var Socialite = new Object();

Socialite.init = function() {
  this.initialized = false;
  window.addEventListener("load", hitchHandler(this, "onLoad"), false);
  window.addEventListener("unload", hitchHandler(this, "onUnload"), false);
};

Socialite.onLoad = function() {
  // initialization code
  this.strings = document.getElementById("socialite-strings");
  
  this.tabBrowser = document.getElementById("content");
  this.appContent = document.getElementById("appcontent");
  
  this.linksWatched = {};
  
  // FIFO queue for removing old watched links
  this.linksWatchedQueue = [];
  this.linksWatchedLimit = 100;
  
  // Authentication hash
  this.redditModHash = null;
  
  this.tabBrowser.addEventListener("DOMContentLoaded", hitchHandler(this, "contentLoad"), false);
  
  // Watch for new tabs to add progress listener to them
  this.tabBrowser.addEventListener("TabOpen", hitchHandler(this, "tabOpened"), false);
  this.tabBrowser.addEventListener("TabClose", hitchHandler(this, "tabClosed"), false);
  
  // Add progress listener to tabbrowser. This fires progress events for the current tab.
  this.setupProgressListener(this.tabBrowser);
  
  this.initialized = true;
};

Socialite.setupProgressListener = function(browser) {
  debug_log("main", "Progress listener added.");
  
  browser.addProgressListener(SocialiteProgressListener,  Components.interfaces.nsIWebProgress.NOTIFY_ALL);
};

Socialite.unsetProgressListener = function(browser) {
  debug_log("main", "Progress listener removed.");
    
  browser.removeProgressListener(SocialiteProgressListener);
};

Socialite.onUnload = function() {
  // Remove remaining progress listeners.
  
  this.unsetProgressListener(this.tabBrowser);
};

Socialite.tabOpened = function(e) {
  var browser = e.originalTarget.linkedBrowser;
  var win = browser.contentWindow;
  
  debug_log("main", "Tab opened: " + win.location.href);
  
  this.linkStartLoad(win);
}

Socialite.tabClosed = function(e) {
  var browser = e.originalTarget.linkedBrowser;
  
  debug_log("main", "Tab closed: " + browser.contentWindow.location.href);
}

Socialite.contentLoad = function(e) {
  var doc = e.originalTarget;
  
  if (doc instanceof HTMLDocument) {
    var win = doc.defaultView;
    
    if (win.location.hostname.match(/reddit\.com$/) && win == win.top) {
      // Iterate over each article link and register event listener
      var res = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
      
      for (var i=0; i < res.snapshotLength; i++) {
        var siteLink = res.snapshotItem(i);
        siteLink.addEventListener("mouseup", hitchHandler(this, "linkClicked"), false);
        //siteLink.style.color = "red";
      }
      
      debug_log("main", "Added click handlers to " + res.snapshotLength + " links on " + win.location.href);
      
      // Snarf the authentication hash using wrappedJSObject
      this.redditModHash = win.wrappedJSObject.modhash
    }
  }
};

Socialite.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  var browser = this.tabBrowser.getBrowserForDocument(doc);
    
  // Remove title_ from title_XX_XXXXX
  var linkURL   = link.href;
  var linkID    = link.id.slice(6);
  var linkTitle = link.textContent;
  
  var linkInfo = new LinkInfo(linkURL, linkID, linkTitle);
  
  //
  // Get some "preloaded" information from the page while we can.
  //
  var linkLike            = doc.getElementById("up_"+linkInfo.id);
  var linkLikeActive      = /upmod/.test(linkLike.className);
  
  var linkDislike         = doc.getElementById("down_"+linkInfo.id);
  var linkDislikeActive   = /downmod/.test(linkDislike.className);

  if (linkLikeActive) {
    linkInfo.state.isLiked  = true;
  } else if (linkDislikeActive) {
    linkInfo.state.isLiked  = false;
  } else {
    linkInfo.state.isLiked  = null;
  }
  
  linkInfo.state.score    = doc.getElementById("score_"+linkInfo.id).textContent;

  var linkComments        = doc.getElementById("comment_"+linkInfo.id);
  linkInfo.commentURL     = linkComments.href;
  
  var commentNum          = /((\d+)\s)?comment[s]?/.exec(linkComments.textContent)[2];
  if (commentNum) {
    linkInfo.state.commentCount = parseInt(commentNum);
  } else {
    linkInfo.state.commentCount = 0;
  }
  
  var linkSave            = doc.getElementById("save_"+linkInfo.id+"_a");
  var linkUnsave          = doc.getElementById("unsave_"+linkInfo.id+"_a");
  
  if (linkSave != null) {
    // If there's a save link
    // Whether it's clicked
    linkInfo.isSaved = (linkSave.style.display == "none");
  } else if (linkUnsave != null) {
    // If there's an unsave link (assumption)
    // Whether it's not clicked
    linkInfo.isSaved = (linkUnsave.style.display != "none");
  } else {
    // No save or unsave link present -- this shouldn't happen, as far as I know.
    debug_log(linkInfo.id, "Unexpected save link absence.");
  }
  
  // You'd think the link was hidden, the user couldn't have clicked on it
  // But they could find it in their hidden links list.
  var linkHide            = doc.getElementById("hide_"+linkInfo.id+"_a");
  var linkUnhide          = doc.getElementById("unsave_"+linkInfo.id+"_a");
  
  if (linkHide != null) {
    linkInfo.isHidden = false;
  } else if (linkUnhide != null) {
    linkInfo.isHidden = true;
  } else {
    // No hide or unhide link present -- this shouldn't happen, as far as I know.
    debug_log(linkInfo.id, "Unexpected hide link absence.");
  }
  
  // Add the information we collected to the watch list  
  debug_log(linkInfo.id, "Clicked");
  this.watchLink(link.href, linkInfo);
};

Socialite.watchLink = function(href, linkInfo) {
  if (this.linksWatchedQueue.length == this.linksWatchedLimit) {
    // Stop watching the oldest link
    delete this.linksWatched[this.linksWatchedQueue.shift()];
  }

  this.linksWatched[href] = linkInfo;
  this.linksWatchedQueue.push(href);
  
  debug_log("main", "Watching: " + href);
}

Socialite.linkStartLoad = function(win, isLoading) {
  var href = win.location.href;

  if (href in this.linksWatched) {
    var linkInfo = this.linksWatched[href];
    var browser = this.tabBrowser.getBrowserForDocument(win.document);
    
    debug_log(linkInfo.id, "Started loading");
  
    linkInfo.updateUIState()
    this.redditUpdateLinkInfo(linkInfo);
  
    // Show the banner, without allowing actions yet
    this.showNotificationBox(browser, linkInfo, isLoading);
  }
}

Socialite.redditUpdateLinkInfo = function(linkInfo) {
  linkInfo.update(
    hitchThis(this, function success(r, json, action) {
      // Only update the UI if the update started after the last user-caused UI update.
      if (action.startTime >= linkInfo.uiState.lastUpdated) {
        linkInfo.updateUIState();
        this.updateButtons(linkInfo);
      } else {
        debug_log(linkInfo.id, "UI changed since update request, not updating UI");
      }
    }),
    hitchThis(this, function failure(r, action) {
      this.failureNotification(linkInfo, r, action);
    })
  ).perform();
}

Socialite.revertUIState = function(linkInfo, properties, r, action) {
  linkInfo.revertUIState(properties, action.startTime);
  this.updateButtons(linkInfo);
}

Socialite.actionFailureHandler = function(linkInfo, r, action) {
  this.failureNotification(linkInfo, r, action);
  this.redditUpdateLinkInfo(linkInfo);
}

Socialite.failureNotification = function(linkInfo, r, action) {
  var text;
  
  var linkID;
  if (linkInfo) {
    linkID = linkInfo.id;
  } else {
    linkID = "unknown";
  }
  debug_log(linkID, "Failure occurred, action: " + action.name + ", status: " + r.status);
  
  if (r.status != 200) {
    text = "Unexpected HTTP status " + r.status + " recieved (" + action.name + ")";
  } else {
    text = "The requested action failed (" + action.name + ")";
  }
  
  alertsService.showAlertNotification(
    "chrome://global/skin/icons/Error.png",
    "Socialite Connection Error",
    text, 
    null, null, null, "socialite-failure");
}
  
Socialite.showNotificationBox = function(browser, linkInfo, isNewPage) {
  var notificationBox = this.tabBrowser.getNotificationBox(browser);
  var notificationName = "socialite-header"+"-"+linkInfo.id;
  
  var toRemove = null;    
  var curNotifications = notificationBox.allNotifications;
  for (var i=0; i < curNotifications.length; i++) {
    var n = curNotifications.item(i);
    
    if (n.value == notificationName) {
      debug_log(linkInfo.id, "Notification box already exists");
      
      if (isNewPage && (SocialitePrefs.getIntPref("persistmode") == 1)) {
        n.persistence = SocialitePrefs.getIntPref("persistlength");
        debug_log(linkInfo.id, "Reset notification persistence count");
      }
      
      return;
    }
    
    if (n.value.match(/^socialite-header/)) {
      debug_log(linkInfo.id, "Old notification found, queued to remove.");
      toRemove = n;
    }
  }
  
  var notification = notificationBox.appendNotification(
    linkInfo.title,
    notificationName,
    "chrome://socialite/content/reddit_favicon.ico",
    notificationBox.PRIORITY_INFO_MEDIUM,
    []
  );
  
  // Remove the notification after appending the new one, so we get a smooth in-place slide.
  if (toRemove) {
    notificationBox.removeNotification(toRemove);
  }
  
  // Ahoy! Commence the XUL hackage!
  // Let's make this notification a bit cooler.
  
  // XXX is this an okay approach? (compatibility, is there a better way, etc)
  
  var details = notification.boxObject.firstChild.getElementsByAttribute("anonid", "details")[0];
  var messageImage = document.getAnonymousElementByAttribute(notification, "anonid", "messageImage");
  var messageText = document.getAnonymousElementByAttribute(notification, "anonid", "messageText");
  
  var hboxFix = document.createElement("hbox");
  hboxFix.setAttribute("align", "center");
  details.insertBefore(hboxFix, messageText);  
  
  var siteLink = document.createElement("label");
  siteLink.setAttribute("id", "socialite_site_link_"+linkInfo.id);
  siteLink.setAttribute("value", "reddit");
  siteLink.setAttribute("class", "text-link");
  siteLink.setAttribute("hidden", !SocialitePrefs.getBoolPref("showlink"));
  siteLink.addEventListener("click", hitchHandler(this, "siteLinkClicked"), false);
  hboxFix.appendChild(siteLink);  
  
  messageImage.addEventListener("click", hitchHandler(this, "siteLinkClicked"), false);
  
  var labelScore = document.createElement("label");
  labelScore.setAttribute("id", "socialite_score_"+linkInfo.id);
  labelScore.setAttribute("hidden", !SocialitePrefs.getBoolPref("showscore"));
  // FIXME tooltip here
  linkInfo.ui.labelScore = labelScore;

  // We need to have some text in the label so that it has a display size.
  // This is important to the next line, for some reason.
  labelScore.setAttribute("value", " ");
  
  // FIXME Strangely, disturbingly, insertion only works with the proper ordering if we use details.childNodes[1] to refer to messageText, rather than a call to getAnonymousElementByAttribute.
  hboxFix.appendChild(labelScore);

  
  // Slight hack to fix description vertical centering
  // XXX Does this look good on all platforms?
  messageText.setAttribute("id", "socialite_title_"+linkInfo.id);
  messageText.setAttribute("class", "messageText socialite-title");
  
  // XUL hackage done.    
  
  var buttonLike = document.createElement("button");
  buttonLike.setAttribute("id", "socialite_mod_up_"+linkInfo.id);
  buttonLike.setAttribute("type", "checkbox");
  buttonLike.setAttribute("label", this.strings.getString("likeit"));
  buttonLike.setAttribute("accesskey", this.strings.getString("likeit.accesskey"));
  buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
  buttonLike.setAttribute("autoCheck", "false");
  buttonLike.addEventListener("click", hitchHandler(this, "buttonLikeClicked", linkInfo), false);
  notification.appendChild(buttonLike);
  linkInfo.ui.buttonLike = buttonLike;
  
  var buttonDislike = document.createElement("button");
  buttonDislike.setAttribute("id", "socialite_mod_down_"+linkInfo.id);
  buttonDislike.setAttribute("type", "checkbox");
  buttonDislike.setAttribute("label", this.strings.getString("dislikeit"));
  buttonDislike.setAttribute("accesskey", this.strings.getString("dislikeit.accesskey"));
  buttonDislike.setAttribute("image", REDDIT_DISLIKE_INACTIVE_IMAGE);
  buttonDislike.setAttribute("autoCheck", "false");
  notification.appendChild(buttonDislike);
  buttonDislike.addEventListener("click", hitchHandler(this, "buttonDislikeClicked", linkInfo), false);
  linkInfo.ui.buttonDislike = buttonDislike;
  
  var buttonComments = document.createElement("button");
  buttonComments.setAttribute("id", "socialite_comments_"+linkInfo.id);
  buttonComments.setAttribute("accesskey", this.strings.getString("comments.accesskey"));
  buttonComments.setAttribute("hidden", !SocialitePrefs.getBoolPref("showcomments"));
  buttonComments.addEventListener("click", hitchHandler(this, "buttonCommentsClicked", linkInfo), false);
  notification.appendChild(buttonComments);
  linkInfo.ui.buttonComments = buttonComments;
  
  var buttonSave = document.createElement("button");
  buttonSave.setAttribute("id", "socialite_save_"+linkInfo.id);
  buttonSave.setAttribute("hidden", !SocialitePrefs.getBoolPref("showsave"));
  buttonSave.addEventListener("click", hitchHandler(this, "buttonSaveClicked", linkInfo), false);
  notification.appendChild(buttonSave);
  linkInfo.ui.buttonSave = buttonSave;
  
  var buttonHide = document.createElement("button");
  buttonHide.setAttribute("id", "socialite_hide_"+linkInfo.id);
  buttonHide.setAttribute("hidden", !SocialitePrefs.getBoolPref("showhide"));
  buttonHide.addEventListener("click", hitchHandler(this, "buttonHideClicked", linkInfo), false);
  notification.appendChild(buttonHide);
  linkInfo.ui.buttonHide = buttonHide;
  
  var buttonRandom = document.createElement("button");
  buttonRandom.setAttribute("id", "socialite_random_"+linkInfo.id);
  buttonRandom.setAttribute("label", this.strings.getString("random"));
  buttonRandom.setAttribute("accesskey", this.strings.getString("random.accesskey"));
  buttonRandom.setAttribute("hidden", !SocialitePrefs.getBoolPref("showrandom"));
  buttonRandom.addEventListener("click", hitchHandler(this, "buttonRandomClicked"), false);
  notification.appendChild(buttonRandom);
  linkInfo.ui.buttonRandom = buttonRandom;
  
  this.updateButtons(linkInfo);

  // Persistence
  var persistMode = SocialitePrefs.getIntPref("persistmode");
  if (persistMode == 0) {
    notification.persistence = 0;
  } else if (persistMode == 1) {
    notification.persistence = SocialitePrefs.getIntPref("persistlength");
  } else if (persistMode == 2) {
    notification.persistence = -1;
  }   
  
  debug_log(linkInfo.id, "Notification box created");
  
  linkInfo.notification = notification;
};

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

Socialite.updateCommentsButton = function(ui, commentCount) {
  ui.buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [commentCount.toString()]));
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
  this.updateCommentsButton(linkInfo.ui, linkInfo.uiState.commentCount);
  this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);
  this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);
  
  debug_log(linkInfo.id, "Updated UI");
}

Socialite.buttonLikeClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isLiked == true) {
    linkInfo.uiState.isLiked = null;
  } else {
    linkInfo.uiState.isLiked = true;
  }

  // Provide instant feedback before sending
  this.updateLikeButtons(linkInfo.ui, linkInfo.uiState.isLiked);
  
  // Submit the vote, and then update state.
  // (proceeding after each AJAX call completes)
  var submit = new reddit.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
    sequenceCalls(
      hitchHandler(this, "revertUIState", linkInfo, ["isLiked"]),
      hitchHandler(this, "actionFailureHandler", linkInfo)
    )
  );    
    
  submit.perform(this.redditModHash, linkInfo.id, linkInfo.uiState.isLiked);
};

Socialite.buttonDislikeClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isLiked == false) {
    linkInfo.uiState.isLiked = null;
  } else {
    linkInfo.uiState.isLiked = false;
  }
  
  // Provide instant feedback before sending
  this.updateLikeButtons(linkInfo.ui, linkInfo.uiState.isLiked);
  
  // Submit the vote, and then update state.
  // (proceeding after the AJAX call completes)
  var submit = new reddit.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
    sequenceCalls(
      hitchHandler(this, "revertUIState", linkInfo, ["isLiked"]),
      hitchHandler(this, "actionFailureHandler", linkInfo)
    )
  );
    
  submit.perform(this.redditModHash, linkInfo.id, linkInfo.uiState.isLiked);
};

Socialite.buttonCommentsClicked = function(linkInfo, e) {
  openUILink(linkInfo.commentURL, e);
};

Socialite.buttonSaveClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isSaved) {
    
    linkInfo.uiState.isSaved = false;
    this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);

    (new reddit.unsave(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isSaved"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(this.redditModHash, linkInfo.id);
        
  } else {
  
    linkInfo.uiState.isSaved = true;
    this.updateSaveButton(linkInfo.ui, linkInfo.uiState.isSaved);

    (new reddit.save(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isSaved"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(this.redditModHash, linkInfo.id);
  }
};

Socialite.buttonHideClicked = function(linkInfo, e) {
  if (linkInfo.uiState.isHidden) {
    
    linkInfo.uiState.isHidden = false;
    this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);

    (new reddit.unhide(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isHidden"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(this.redditModHash, linkInfo.id);
        
  } else {
  
    linkInfo.uiState.isHidden = true;
    this.updateHideButton(linkInfo.ui, linkInfo.uiState.isHidden);

    (new reddit.hide(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      sequenceCalls(
        hitchHandler(this, "revertUIState", linkInfo, ["isHidden"]),
        hitchHandler(this, "actionFailureHandler", linkInfo)
      )
    )).perform(this.redditModHash, linkInfo.id);
  }
};

Socialite.buttonRandomClicked = function(e) {
  var self = this;

  (new reddit.randomrising(
    function (r, json) {
      var linkInfo = LinkInfoFromJSON(json);
      self.watchLink(linkInfo.url, linkInfo);
      openUILink(linkInfo.url, e);
    },
    hitchHandler(this, "failureNotification", null))
  ).perform();
};


Socialite.siteLinkClicked = function(e) {
  openUILink("http://www.reddit.com", e);
};

// ---

Socialite.init();
