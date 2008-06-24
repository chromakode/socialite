 // Todo:
 // - Modularize
 // - Download list of current top links and auto-apply to pages
 // + Save button
 // + Button preferences
 // - Login detection/button
 // - Display score
 // - Display subreddit
 // + Persistence Options
 // - Better error handling/retry
 // - Submit link command
 
 // Outstanding issues:
 // + Raw images seem to not be handled by DOMContentLoaded
 // + Toolbar opening lag
 // + Open comments in new tab
 // + Popup blocker bar
 // + Preserve after back-forward
 // + Reopen bar
 // + Some links still not working
 // - Link title alignment off
 // - m.reddit.com support (Pickegnome)
 // - Handle RSS readers
 // - Disable on fullscreen

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

RETRY_COUNT = 3;
RETRY_DELAY = 5000;

Components.utils.import("resource://socialite/preferences.jsm");
Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/utils/action.jsm");
Components.utils.import("resource://socialite/utils/retry_action.jsm");
reddit = Components.utils.import("resource://socialite/reddit/reddit.jsm");
Components.utils.import("resource://socialite/reddit/link_info.jsm");

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
  var linkHref  = link.href;
  var linkID    = link.id.slice(6);
  var linkTitle = link.textContent;
  
  var linkInfo = new LinkInfo(linkHref, linkID, linkTitle);
  
  // Get some "preloaded" information from the page while we can.
  var linkLike            = doc.getElementById("up_"+linkInfo.linkID);
  var linkLikeActive      = /upmod/.test(linkLike.className);
  
  var linkDislike         = doc.getElementById("down_"+linkInfo.linkID);
  var linkDislikeActive   = /downmod/.test(linkDislike.className);

  if (linkLikeActive) {
    linkInfo.linkIsLiked  = true;
  } else if (linkDislikeActive) {
    linkInfo.linkIsLiked  = false;
  } else {
    linkInfo.linkIsLiked  = null;
  }

  var linkComments        = doc.getElementById("comment_"+linkInfo.linkID);
  linkInfo.commentURL     = linkComments.href;
  
  var commentNum          = /((\d+)\s)?comment[s]?/.exec(linkComments.textContent)[2];
  if (commentNum) {
    linkInfo.commentCount = parseInt(commentNum);
  } else {
    linkInfo.commentCount = 0;
  }
  
  var linkSave            = doc.getElementById("save_"+linkInfo.linkID+"_a");
  var linkUnsave          = doc.getElementById("unsave_"+linkInfo.linkID+"_a");
  
  if (linkSave != null) {
    // If there's a save link
    // Whether it's clicked
    linkInfo.linkIsSaved = (linkSave.style.display == "none");
  } else if (linkUnsave != null) {
    // If there's an unsave link (assumption)
    // Whether it's not clicked
    linkInfo.linkIsSaved = (linkUnsave.style.display != "none");
  } else {
    // No save or unsave link present -- this shouldn't happen, as far as I know.
    throw "Unexpected save link absence.";
  }
  
  debug_log(linkInfo.linkID, "Clicked");
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
    
    debug_log(linkInfo.linkID, "Started loading");
  
    this.redditUpdateLinkInfo(linkInfo);
  
    // Show the banner, without allowing actions yet
    this.showNotificationBox(browser, linkInfo, isLoading);
  }
}

Socialite.redditUpdateLinkInfo = function(linkInfo) {
  linkInfo.update(hitchHandler(this, "updateButtons", linkInfo)).perform();
}
  
Socialite.showNotificationBox = function(browser, linkInfo, isNewPage) {
  var notificationBox = this.tabBrowser.getNotificationBox(browser);
  var notificationName = "socialite-header"+"-"+linkInfo.linkID;
  
  var toRemove = null;    
  var curNotifications = notificationBox.allNotifications;
  for (var i=0; i < curNotifications.length; i++) {
    var n = curNotifications.item(i);
    
    if (n.value == notificationName) {
      debug_log(linkInfo.linkID, "Notification box already exists");
      
      if (isNewPage && (SocialitePrefs.getIntPref("persistmode") == 1)) {
        n.persistence = SocialitePrefs.getIntPref("persistlength");
        debug_log(linkInfo.linkID, "Reset notification persistence count");
      }
      
      return;
    }
    
    if (n.value.match(/^socialite-header/)) {
      debug_log(linkInfo.linkID, "Old notification found, queued to remove.");
      toRemove = n;
    }
  }
  
  var notification = notificationBox.appendNotification(
    linkInfo.linkTitle,
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
  
  var roothbox = notification.boxObject.firstChild;
  var details = roothbox.getElementsByAttribute("anonid", "details")[0];
  var messageImage = roothbox.getElementsByAttribute("anonid", "messageImage")[0];
  var messageText = roothbox.getElementsByAttribute("anonid", "messageText")[0];
  
  // Muahahahahaha
  var siteLink = document.createElement("label");
  siteLink.setAttribute("id", "socialite_site_link_"+linkInfo.linkID);
  siteLink.setAttribute("value", "reddit");
  siteLink.setAttribute("class", "text-link");
  siteLink.setAttribute("flex", true);
  siteLink.setAttribute("hidden", !SocialitePrefs.getBoolPref("showlink"));
  siteLink.addEventListener("click", hitchHandler(this, "siteLinkClicked"), false);
  messageImage.addEventListener("click", hitchHandler(this, "siteLinkClicked"), false);
  details.insertBefore(siteLink, messageText);
  
  // XUL hackage done.    
  
  var buttonLike = document.createElement("button");
  buttonLike.setAttribute("id", "socialite_mod_up_"+linkInfo.linkID);
  buttonLike.setAttribute("type", "checkbox");
  buttonLike.setAttribute("label", this.strings.getString("likeit"));
  buttonLike.setAttribute("accesskey", this.strings.getString("likeit.accesskey"));
  buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
  buttonLike.setAttribute("autoCheck", "false");
  buttonLike.addEventListener("click", hitchHandler(this, "buttonLikeClicked", linkInfo), false);
  notification.appendChild(buttonLike);
  linkInfo.buttonLike = buttonLike;
  
  var buttonDislike = document.createElement("button");
  buttonDislike.setAttribute("id", "socialite_mod_down_"+linkInfo.linkID);
  buttonDislike.setAttribute("type", "checkbox");
  buttonDislike.setAttribute("label", this.strings.getString("dislikeit"));
  buttonDislike.setAttribute("accesskey", this.strings.getString("dislikeit.accesskey"));
  buttonDislike.setAttribute("image", REDDIT_DISLIKE_INACTIVE_IMAGE);
  buttonDislike.setAttribute("autoCheck", "false");
  notification.appendChild(buttonDislike);
  buttonDislike.addEventListener("click", hitchHandler(this, "buttonDislikeClicked", linkInfo), false);
  linkInfo.buttonDislike = buttonDislike;
  
  var buttonComments = document.createElement("button");
  buttonComments.setAttribute("id", "socialite_comments_"+linkInfo.linkID);
  buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [linkInfo.commentCount.toString()]));
  buttonComments.setAttribute("accesskey", this.strings.getString("comments.accesskey"));
  buttonComments.setAttribute("hidden", !SocialitePrefs.getBoolPref("showcomments"));
  buttonComments.addEventListener("click", hitchHandler(this, "buttonCommentsClicked", linkInfo), false);
  notification.appendChild(buttonComments);
  linkInfo.buttonComments = buttonComments;
  
  var buttonSave = document.createElement("button");
  buttonSave.setAttribute("id", "socialite_save_"+linkInfo.linkID);
  buttonSave.setAttribute("hidden", !SocialitePrefs.getBoolPref("showsave"));
  buttonSave.addEventListener("click", hitchHandler(this, "buttonSaveClicked", linkInfo), false);
  notification.appendChild(buttonSave);
  linkInfo.buttonSave = buttonSave;
  
  var buttonRandom = document.createElement("button");
  buttonRandom.setAttribute("id", "socialite_random_"+linkInfo.linkID);
  buttonRandom.setAttribute("label", this.strings.getString("random"));
  buttonRandom.setAttribute("accesskey", this.strings.getString("random.accesskey"));
  buttonRandom.setAttribute("hidden", !SocialitePrefs.getBoolPref("showrandom"));
  buttonRandom.addEventListener("click", hitchHandler(this, "buttonRandomClicked"), false);
  notification.appendChild(buttonRandom);
  linkInfo.buttonRandom = buttonRandom;
  
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
  
  debug_log(linkInfo.linkID, "Notification box created");
  
  linkInfo.notification = notification;
};

Socialite.updateButtonLike = function(buttonLike, isLiked) {
  if (isLiked == true) {
    buttonLike.setAttribute("image", REDDIT_LIKE_ACTIVE_IMAGE);
    buttonLike.setAttribute("checked", true);
  } else {
    buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
    buttonLike.setAttribute("checked", false);
  }
};

Socialite.updateButtonDislike = function(buttonDislike, isLiked) {
  if (isLiked == false) {
    buttonDislike.setAttribute("image", REDDIT_DISLIKE_ACTIVE_IMAGE);
    buttonDislike.setAttribute("checked", true);
  } else {
    buttonDislike.setAttribute("image", REDDIT_DISLIKE_INACTIVE_IMAGE);
    buttonDislike.setAttribute("checked", false);
  }
};

Socialite.updateButtons = function(linkInfo) {
  if (linkInfo.modActive) {
    linkInfo.buttonLike.setAttribute("disabled", false);
    linkInfo.buttonDislike.setAttribute("disabled", false);
    linkInfo.buttonSave.setAttribute("disabled", false);
  } else {
    linkInfo.buttonLike.setAttribute("disabled", true);
    linkInfo.buttonDislike.setAttribute("disabled", true);
    linkInfo.buttonSave.setAttribute("disabled", true);
  }
  
  if (linkInfo.linkIsSaved) {
    linkInfo.buttonSave.setAttribute("label", this.strings.getString("unsave"));
    linkInfo.buttonSave.setAttribute("accesskey", this.strings.getString("unsave.accesskey"));
  } else {
    linkInfo.buttonSave.setAttribute("label", this.strings.getString("save"));
    linkInfo.buttonSave.setAttribute("accesskey", this.strings.getString("save.accesskey"));
  }
  
  this.updateButtonLike(linkInfo.buttonLike, linkInfo.linkIsLiked);
  this.updateButtonDislike(linkInfo.buttonDislike, linkInfo.linkIsLiked);
  
  debug_log(linkInfo.linkID, "Updated buttons");
}

Socialite.buttonLikeClicked = function(linkInfo, e) {
  if (linkInfo.linkIsLiked == true) {
    linkInfo.linkIsLiked = null;
  } else {
    linkInfo.linkIsLiked = true;
  }

  // Provide instant feedback before sending
  this.updateButtons(linkInfo);
  
  // Submit the vote, and then update state.
  // (proceeding after each AJAX call completes)
  var submit = new reddit.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
    retryAction(RETRY_COUNT, RETRY_DELAY)
  );    
    
  submit.perform(this.redditModHash, linkInfo.linkID, linkInfo.linkIsLiked);
};

Socialite.buttonDislikeClicked = function(linkInfo, e) {
  if (linkInfo.linkIsLiked == false) {
    linkInfo.linkIsLiked = null;
  } else {
    linkInfo.linkIsLiked = false;
  }
  
  // Provide instant feedback before sending
  this.updateButtons(linkInfo);
  
  // Submit the vote, and then update state.
  // (proceeding after the AJAX call completes)
  var submit = new reddit.vote(
    hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
    retryAction(RETRY_COUNT, RETRY_DELAY)
  );
    
  submit.perform(this.redditModHash, linkInfo.linkID, linkInfo.linkIsLiked);
};

Socialite.buttonCommentsClicked = function(linkInfo, e) {
  openUILink(linkInfo.commentURL, e);
};

Socialite.buttonSaveClicked = function(linkInfo, e) {
  if (linkInfo.linkIsSaved) {
    
    linkInfo.linkIsSaved = false;    
    this.updateButtons(linkInfo);

    (new reddit.unsave(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      retryAction(RETRY_COUNT, RETRY_DELAY)
    )).perform(this.redditModHash, linkInfo.linkID);
        
  } else {
  
    linkInfo.linkIsSaved = true;    
    this.updateButtons(linkInfo);

    (new reddit.save(
      hitchHandler(this, "redditUpdateLinkInfo", linkInfo),
      retryAction(RETRY_COUNT, RETRY_DELAY)
    )).perform(this.redditModHash, linkInfo.linkID);
  }
};

Socialite.buttonRandomClicked = function(e) {
  openUILink("http://www.reddit.com/random/", e);
};


Socialite.siteLinkClicked = function(e) {
  openUILink("http://www.reddit.com", e);
};

Socialite.init();
