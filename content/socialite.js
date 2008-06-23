 // Todo:
 // - Modularize
 // - Download list of current top links and auto-apply to pages
 // + Save button
 // + Button preferences
 // - Login detection/button
 // - Display score
 // - Persistence Options
 
 // Outstanding issues:
 // + Raw images seem to not be handled by DOMContentLoaded
 // + Toolbar opening lag
 // + Open comments in new tab
 // + Popup blocker bar
 // + Preserve after back-forward
 // + Reopen bar
 // + Some links still not working

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
                 .createInstance(Components.interfaces.nsIJSON);

Components.utils.import("resource://socialite/reddit.jsm");

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
      Socialite.linkStartLoad(window);
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
  window.addEventListener("load", GM_hitch(this, "onLoad"), false);
  window.addEventListener("unload", GM_hitch(this, "onUnload"), false);
};

Socialite.onLoad = function() {
  // initialization code
  this.strings = document.getElementById("socialite-strings");
  
  this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
      .getService(Components.interfaces.nsIPrefService)
      .getBranch("extensions.socialite.");
  this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
  
  this.tabBrowser = document.getElementById("content");
  this.appContent = document.getElementById("appcontent");
  
  this.linksWatched = {};
  
  // FIFO queue for removing old watched links
  this.linksWatchedQueue = [];
  this.linksWatchedLimit = 100;
  
  // Authentication hash
  this.redditModHash = null;
  
  this.tabBrowser.addEventListener("DOMContentLoaded", GM_hitch(this, "contentLoad"), false);
  
  // Watch for new tabs to add progress listener to them
  this.tabBrowser.addEventListener("TabOpen", GM_hitch(this, "tabOpened"), false);
  this.tabBrowser.addEventListener("TabClose", GM_hitch(this, "tabClosed"), false);
  
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
    var href = win.location.href;
    
    if (href.match(/^http:\/\/www\.reddit\.com/) && win == win.top) {
      // Iterate over each article link and register event listener
      var res = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
      
      for (var i=0; i < res.snapshotLength; i++) {
        var siteLink = res.snapshotItem(i);
        siteLink.addEventListener("mouseup", GM_hitch(this, "linkClicked"), false);
        //siteLink.style.color = "red";
      }	
      
      // Snarf the authentication hash using wrappedJSObject
      this.redditModHash = win.wrappedJSObject.modhash
    }
  }
};

Socialite.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
  var linkInfo = {
    linkTitle:      link.textContent,
    
    // Remove title_ from title_XX_XXXXX
    linkHref:       link.href,
    linkID:         link.id.slice(6),
  };
  
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
  
  linkInfo.modActive = true;
  
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

Socialite.linkStartLoad = function(win) {
  var href = win.location.href;

  if (href in this.linksWatched) {
    var linkInfo = this.linksWatched[href];
    var browser = this.tabBrowser.getBrowserForDocument(win.document);
    
    debug_log(linkInfo.linkID, "Started loading");
  
    this.redditUpdateLinkInfo(linkInfo, GM_hitch(this, "updateButtons"));
  
    // Show the banner, without allowing actions yet
    this.showNotificationBox(browser, linkInfo);
  }
}
  
Socialite.redditUpdateLinkInfo = function(linkInfo, callback) {
  debug_log(linkInfo.linkID, "Making ajax info call");
  
  var params   = {
    url:    linkInfo.linkHref,
    sr:     "",
    count:  1,
  };
    
  redditRequest("info.json", params, GM_hitch(this, "redditUpdateLinkInfoResp", linkInfo, callback), "get");
}

Socialite.redditUpdateLinkInfoResp = function(linkInfo, r) {
  var d = nativeJSON.decode(r.responseText);
  var linkData = d.data.children[0].data;
  
  linkInfo.linkIsLiked  = linkData.likes;
  linkInfo.commentCount = linkData.num_comments;
  linkInfo.linkIsSaved  = linkData.saved;
  
  debug_log(linkInfo.linkID, "Received ajax info call response: "        +
                             "liked: "    + linkInfo.isLiked + ", "      +
                             "comments: " + linkInfo.commentCount + ", " +
                             "saved: "    + linkInfo.linkIsSaved);
  
  if (callback) {
    callback(linkInfo);
  }
}

Socialite.redditVote = function(linkInfo, isLiked, callback) {
  debug_log(linkInfo.linkID, "Making ajax vote call");
  
  var dir;
  if (isLiked == true) {
    dir = 1;
  } else if (isLiked == false) {
    dir = -1;
  } else {
    dir = 0;
  }
  
  var params   = {
    id:    linkInfo.linkID,
    uh:    this.redditModHash,
    dir:   dir,
  };
  
  redditRequest("vote", params, function(r){ callback(linkInfo); });
}
  
Socialite.showNotificationBox = function(browser, linkInfo) {
    var notificationBox = this.tabBrowser.getNotificationBox(browser);
    var notificationName = "socialite-header"+"-"+linkInfo.linkID;
    
    var oldNotification = notificationBox.getNotificationWithValue(notificationName);
    if (oldNotification) {
      debug_log(linkInfo.linkID, "Notification box already exists");
      return;
    }
    
    var notification = notificationBox.appendNotification(
      linkInfo.linkTitle,
      notificationName,
      "chrome://socialite/content/reddit_favicon.ico",
      notificationBox.PRIORITY_INFO_MEDIUM,
      []
    );
    
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
    siteLink.setAttribute("hidden", !this.prefs.getBoolPref("showlink"));
    siteLink.addEventListener("click", GM_hitch(this, "siteLinkClicked"), false);
    messageImage.addEventListener("click", GM_hitch(this, "siteLinkClicked"), false);
    details.insertBefore(siteLink, messageText);
    
    // XUL hackage done.    
    
    var buttonLike = document.createElement("button");
    buttonLike.setAttribute("id", "socialite_mod_up_"+linkInfo.linkID);
    buttonLike.setAttribute("type", "checkbox");
    buttonLike.setAttribute("label", this.strings.getString("likeit"));
    buttonLike.setAttribute("accesskey", this.strings.getString("likeit.accesskey"));
    buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
    buttonLike.setAttribute("autoCheck", "false");
    buttonLike.addEventListener("click", GM_hitch(this, "buttonLikeClicked", linkInfo), false);
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
    buttonDislike.addEventListener("click", GM_hitch(this, "buttonDislikeClicked", linkInfo), false);
    linkInfo.buttonDislike = buttonDislike;
    
    var buttonComments = document.createElement("button");
    buttonComments.setAttribute("id", "socialite_comments_"+linkInfo.linkID);
    buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [linkInfo.commentCount.toString()]));
    buttonComments.setAttribute("accesskey", this.strings.getString("comments.accesskey"));
    buttonComments.setAttribute("hidden", !this.prefs.getBoolPref("showcomments"));
    buttonComments.addEventListener("click", GM_hitch(this, "buttonCommentsClicked", linkInfo), false);
    notification.appendChild(buttonComments);
    linkInfo.buttonComments = buttonComments;
    
    var buttonSave = document.createElement("button");
    buttonSave.setAttribute("id", "socialite_save_"+linkInfo.linkID);
    buttonSave.setAttribute("hidden", !this.prefs.getBoolPref("showsave"));
    buttonSave.addEventListener("click", GM_hitch(this, "buttonSaveClicked", linkInfo), false);
    notification.appendChild(buttonSave);
    linkInfo.buttonSave = buttonSave;
    
    this.updateButtons(linkInfo);
    
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
  
  // Submit the vote, update the link information, and then update the buttons
  // (proceeding after each AJAX call completes)
  this.redditVote(linkInfo, linkInfo.linkIsLiked,
    GM_hitch_flip(this, "redditUpdateLinkInfo",
      GM_hitch_flip(this, "updateButtons")));
};

Socialite.buttonDislikeClicked = function(linkInfo, e) {
  if (linkInfo.linkIsLiked == false) {
    linkInfo.linkIsLiked = null;
  } else {
    linkInfo.linkIsLiked = false;
  }
  
  // Provide instant feedback before sending
  this.updateButtons(linkInfo);
  
  // Submit the vote, update the link information, and then update the buttons
  // (proceeding after each AJAX call completes)
  this.redditVote(linkInfo, linkInfo.linkIsLiked,
    GM_hitch_flip(this, "redditUpdateLinkInfo",
      GM_hitch_flip(this, "updateButtons")));
};

Socialite.buttonCommentsClicked = function(linkInfo, e) {
  openUILink(linkInfo.commentURL, e);
};

Socialite.buttonSaveClicked = function(linkInfo, e) {
  if (linkInfo.linkIsSaved) {
    linkInfo.linkUnsave.onclick();
    linkInfo.buttonSave.setAttribute("label", this.strings.getString("unsaved"));
  } else {
    linkInfo.linkSave.onclick()
    linkInfo.buttonSave.setAttribute("label", this.strings.getString("saved"));
  }
  
  linkInfo.buttonSave.setAttribute("disabled", true);
};


Socialite.siteLinkClicked = function(e) {
  openUILink("http://www.reddit.com", e);
};

Socialite.init();
