/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Socialite.
 *
 * The Initial Developer of the Original Code is
 * Chromakode.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */
 
 // Todo:
 // - Modularize
 // - Download list of current top links and auto-apply to pages
 // - Save button
 // - Button preferences
 
 // Outstanding issues:
 // - Raw images seem to not be handled by DOMContentLoaded
 // - Toolbar opening lag
 // - Open comments in new tab
 // - Popup blocker bar
 // - Reopen bar

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

// ---

const STATE_START = Components.interfaces.nsIWebProgressListener.STATE_START;
const STATE_STOP = Components.interfaces.nsIWebProgressListener.STATE_STOP;
const STATE_TRANSFERRING = Components.interfaces.nsIWebProgressListener.STATE_TRANSFERRING;
var SocialiteProgressListener =
{
  QueryInterface: function(aIID) {
   if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
       aIID.equals(Components.interfaces.nsISupports))
     return this;
   throw Components.results.NS_NOINTERFACE;
  },

  onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
    if(aFlag & STATE_STOP) {
      Socialite.linkFinishLoad(aWebProgress.DOMWindow);
    }
    
    return 0;
  },

  onLocationChange: function(aProgress, aRequest, aURI) {
    Socialite.linkStartLoad(aProgress.DOMWindow);
  },
  
  onProgressChange: function() {return 0;},
  onStatusChange: function() {return 0;},
  onSecurityChange: function() {return 0;},
  onLinkIconAvailable: function() {return 0;}
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
  this.initialized = true;
  this.strings = document.getElementById("socialite-strings");
  
  this.tabBrowser = document.getElementById("content");
  this.appContent = document.getElementById("appcontent");
  
  this.linksWatched = {};
  
  gBrowser.addEventListener("load", GM_hitch(this, "contentLoad"), true);
  this.tabBrowser.addProgressListener(SocialiteProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
  
};

Socialite.onUnload = function() {
  this.tabBrowser.removeProgressListener(SocialiteProgressListener);
};

Socialite.contentLoad = function(e) {
  var doc = e.originalTarget;
  
  if (doc instanceof HTMLDocument) {
    var win = doc.defaultView;
    var href = win.location.href;
    
    if (href.match(/^http:\/\/www\.reddit\.com/) && win == win.top) {
      // Iterate over each article link and register event listener
      var iterator = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );
      
      var redditLink = iterator.iterateNext();
      while (redditLink) {
        redditLink.addEventListener("mouseup", GM_hitch(this, "linkClicked"), false);
        redditLink = iterator.iterateNext();
      }	
    }
  }
};

Socialite.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
  //alert("clicked: " + link.textContent);
  
  var linkInfo = {
    linkTitle:      link.textContent,
    
    // Remove title_ from title_XX_XXXXX
    linkID:         link.id.slice(6),
  };
  
  // Get some information from the page while we can.
  var linkLike       = doc.getElementById("up_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkLikeActive = /upmod/.test(linkLike.className);
  
  var linkDislike    = doc.getElementById("down_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkDislikeActive = /downmod/.test(linkDislike.className);

  var linkComments   = doc.getElementById("comment_"+linkInfo.linkID);
  linkInfo.commentCount = parseInt(/(\d+) comments/.exec(linkComments.textContent)[1]);
  
  this.linksWatched[link.href] = linkInfo;
};

Socialite.linkStartLoad = function(win, href) {
  var href = win.location.href;

  if (href in this.linksWatched) {  
    var linkInfo = this.linksWatched[href];
    var browser = this.tabBrowser.getBrowserForDocument(win.document);
  
    // Show the banner, without allowing actions yet
    linkInfo.modActive = false;
    this.showBanner(browser, linkInfo);
  }
}

Socialite.linkFinishLoad = function(win) {
  var href = win.location.href;
  
  if (href in this.linksWatched) {
    var doc = win.document;
    var browser = this.tabBrowser.getBrowserForDocument(doc);
    var linkInfo = this.linksWatched[href];
  
    // Sneaky IFrame goodness
    linkInfo.modFrame       = doc.createElement("IFrame")
    linkInfo.modFrame.id    = "socialite-frame"
    linkInfo.modFrame.setAttribute("style", "display:none");

    // Add it.
    doc.body.appendChild(linkInfo.modFrame);

    // Watch it.
    makeOneShot(linkInfo.modFrame, "load", GM_hitch(this, "modFrameLoad", linkInfo), false);
    
    // Load it.
    linkInfo.modFrame.src   = "http://www.reddit.com/toolbar?id=" + linkInfo.linkID
    
    // Stop watching this href.
    delete this.linksWatched[href];
  }
};

Socialite.modFrameLoad = function(e, linkInfo) {
  var modFrameDoc = e.target.contentDocument;
  var doc = e.target.ownerDocument;  
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
  // Note: linkLike and linkDislike use wrappedJSObject to retrieve unprotected
  // chrome-internal javascript object.
  
  linkInfo.linkLike       = modFrameDoc.getElementById("up_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkLikeActive = /upmod/.test(linkInfo.linkLike.className);
  
  linkInfo.linkDislike    = modFrameDoc.getElementById("down_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkDislikeActive = /downmod/.test(linkInfo.linkDislike.className);

  linkInfo.linkComments   = modFrameDoc.getElementById("comment_"+linkInfo.linkID);
  
  // We got this earlier at linkClicked
  //linkInfo.commentCount   = parseInt(/(\d+) comments/.exec(linkInfo.linkComments.textContent)[1]);
  
  linkInfo.modActive = true;
  this.updateButtons(linkInfo);
};
  
Socialite.showBanner = function(browser, linkInfo) {
    var notificationBox = this.tabBrowser.getNotificationBox(browser);
    var notificationName = "socialite-header";
    
    var oldNotification = notificationBox.getNotificationWithValue(notificationName);
    if (oldNotification) {
      oldNotification.close();
    }
    
    var notification = notificationBox.appendNotification(
      "reddit: " + linkInfo.linkTitle,
      notificationName,
      "chrome://socialite/content/reddit_favicon.ico",
      notificationBox.PRIORITY_INFO_MEDIUM,
      []
    );
    
    var buttonLike = document.createElement("button");
    buttonLike.setAttribute("id", "socialite_mod_up");
    buttonLike.setAttribute("type", "checkbox");
    buttonLike.setAttribute("label", this.strings.getString("likeit"));
    buttonLike.setAttribute("accesskey", this.strings.getString("likeit.accesskey"));
    buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
    buttonLike.setAttribute("autoCheck", "false");
    buttonLike.addEventListener("click", GM_hitch(this, "buttonLikeClicked", linkInfo), false);
    notification.appendChild(buttonLike);
    linkInfo.buttonLike = buttonLike;
    
    var buttonDislike = document.createElement("button");
    buttonDislike.setAttribute("id", "socialite_mod_down");
    buttonDislike.setAttribute("type", "checkbox");
    buttonDislike.setAttribute("label", this.strings.getString("dislikeit"));
    buttonDislike.setAttribute("accesskey", this.strings.getString("dislikeit.accesskey"));
    buttonDislike.setAttribute("image", REDDIT_DISLIKE_INACTIVE_IMAGE);
    buttonDislike.setAttribute("autoCheck", "false");
    notification.appendChild(buttonDislike);
    buttonDislike.addEventListener("click", GM_hitch(this, "buttonDislikeClicked", linkInfo), false);
    linkInfo.buttonDislike = buttonDislike;
    
    var buttonComments = document.createElement("button");
    buttonComments.setAttribute("id", "socialite_comments");
    buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [linkInfo.commentCount.toString()]));
    buttonComments.setAttribute("accesskey", this.strings.getString("comments.accesskey"));
    buttonComments.addEventListener("click", GM_hitch(this, "buttonCommentsClicked", linkInfo), false);
    notification.appendChild(buttonComments);
    linkInfo.buttonComments = buttonComments;
    
    this.updateButtons(linkInfo);
    
    // Modify to prevent notifications from autoclosing
    //notification.persistence = 0;
};

Socialite.updateButtonLike = function(buttonLike, isActive) {
  if (isActive) {
    buttonLike.setAttribute("image", REDDIT_LIKE_ACTIVE_IMAGE);
    buttonLike.setAttribute("checked", true);
  } else {
    buttonLike.setAttribute("image", REDDIT_LIKE_INACTIVE_IMAGE);
    buttonLike.setAttribute("checked", false);
  }
};

Socialite.updateButtonDislike = function(buttonDislike, isActive) {
  if (isActive) {
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
  } else {
    linkInfo.buttonLike.setAttribute("disabled", true);
    linkInfo.buttonDislike.setAttribute("disabled", true);
  }
  
  if (linkInfo.linkLikeActive != null) {
    this.updateButtonLike(linkInfo.buttonLike, linkInfo.linkLikeActive);
  }
  
  if (linkInfo.linkDislikeActive != null) {
    this.updateButtonDislike(linkInfo.buttonDislike, linkInfo.linkDislikeActive);
  }
}

Socialite.buttonLikeClicked = function(e, linkInfo) {
  linkInfo.linkLike.onclick();
  
  // Deactivate other button, if applicable.
  if (linkInfo.linkDislikeActive) {
    linkInfo.linkDislikeActive = false;
  }
  
  if (linkInfo.linkLikeActive) {
    linkInfo.linkLikeActive = false;
  } else {
    linkInfo.linkLikeActive = true;
  }
  
  this.updateButtons(linkInfo);
};

Socialite.buttonDislikeClicked = function(e, linkInfo) {
  linkInfo.linkDislike.onclick();
  
  // Deactivate other button, if applicable.
  if (linkInfo.linkLikeActive) {
    linkInfo.linkLikeActive = false;
  }
  
  if (linkInfo.linkDislikeActive) {
    linkInfo.linkDislikeActive = false;
  } else {
    linkInfo.linkDislikeActive = true;
  }
  
  this.updateButtons(linkInfo);
};

Socialite.buttonCommentsClicked = function(e, linkInfo) {
  var link = e.target;
  var doc = link.ownerDocument;
  this.tabBrowser.loadURI(linkInfo.linkComments);
};

Socialite.init();
