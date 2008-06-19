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
 
 // Outstanding issues:
 // - Raw images seem to not be handled by DOMContentLoaded

REDDIT_LIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_aupgray.png"
REDDIT_LIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_aupmod.png"
REDDIT_DISLIKE_INACTIVE_IMAGE = "chrome://socialite/content/reddit_adowngray.png"
REDDIT_DISLIKE_ACTIVE_IMAGE = "chrome://socialite/content/reddit_adownmod.png"

var Socialite = new Object();

Socialite.init = function() {
  window.addEventListener("load", GM_hitch(this, "onLoad"), false);
};

Socialite.onLoad = function() {
  // initialization code
  this.initialized = true;
  this.strings = document.getElementById("socialite-strings");
  
  this.tabBrowser = document.getElementById("content");
  this.appContent = document.getElementById("appcontent");
  
  this.linksWatched = {};
  
  this.appContent.addEventListener("DOMContentLoaded", GM_hitch(this, "contentLoad"), false);
};
  
Socialite.contentLoad = function(e) {
  var doc = e.target;
  var win = doc.defaultView;
  var href = win.location.href;
  
  if (href.match(/^http:\/\/www\.reddit\.com/) && win == win.top) {
    // Iterate over each article link and register event listener
    var iterator = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null );
    
    var redditLink = iterator.iterateNext();
    while (redditLink) {
      redditLink.addEventListener("mousedown", GM_hitch(this, "linkClicked"), false);
      redditLink = iterator.iterateNext();
    }	
  }
  
  if (href in this.linksWatched) {
    this.linkLoad(doc, this.linksWatched[href]);
    delete this.linksWatched[href];
  }  
};

Socialite.linkClicked = function(e) {
  var link = e.target;
  var doc = link.ownerDocument;
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
  var linkInfo = {
    linkTitle:      link.textContent,
    
    // Remove title_ from title_XX_XXXXX
    linkID:         link.id.slice(6),
  };
  
  this.linksWatched[link.href] = linkInfo;
};

Socialite.linkLoad = function(doc, linkInfo) {
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
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
};

Socialite.modFrameLoad = function(e, linkInfo) {
  var modFrameDoc = e.target.contentDocument;
  var doc = e.target.ownerDocument;  
  var browser = this.tabBrowser.getBrowserForDocument(doc);
  
  // Note: linkLike and linkDislike use wrappedJSObject to retrieve unprotected
  // chrome-internal javascript object.
  
  linkInfo.linkLike       = modFrameDoc.getElementById("up_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkLikeActive = /upmod/.test(linkInfo.linkLike.className);
  
  linkInfo.linkDislike     = modFrameDoc.getElementById("down_"+linkInfo.linkID).wrappedJSObject;
  linkInfo.linkDislikeActive   = /downmod/.test(linkInfo.linkDislike.className);

  linkInfo.linkComments   = modFrameDoc.getElementById("comment_"+linkInfo.linkID);
  linkInfo.commentCount   = parseInt(/(\d+) comments/.exec(linkInfo.linkComments.textContent)[1]);
  
  this.showBanner(browser, linkInfo);
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
    buttonLike.setAttribute("autoCheck", "false");
    this.updateButtonLike(buttonLike, linkInfo.linkLikeActive);
    buttonLike.addEventListener("click", GM_hitch(this, "buttonLikeClicked", linkInfo), false);
    notification.appendChild(buttonLike);
    linkInfo.buttonLike = buttonLike;
    
    var buttonDislike = document.createElement("button");
    buttonDislike.setAttribute("id", "socialite_mod_down");
    buttonDislike.setAttribute("type", "checkbox");
    buttonDislike.setAttribute("label", this.strings.getString("dislikeit"));
    buttonDislike.setAttribute("accesskey", this.strings.getString("dislikeit.accesskey"));
    buttonDislike.setAttribute("autoCheck", "false");
    this.updateButtonDislike(buttonDislike, linkInfo.linkDislikeActive);
    notification.appendChild(buttonDislike);
    buttonDislike.addEventListener("click", GM_hitch(this, "buttonDislikeClicked", linkInfo), false);
    linkInfo.buttonDislike = buttonDislike;
    
    var buttonComments = document.createElement("button");
    buttonComments.setAttribute("id", "socialite_comments");
    buttonComments.setAttribute("label", this.strings.getFormattedString("comments", [linkInfo.commentCount.toString()]));
    buttonComments.setAttribute("accesskey", this.strings.getString("comments.accesskey"));
    buttonComments.addEventListener("click", GM_hitch(this, "buttonCommentsClicked", linkInfo.linkComments), false);
    notification.appendChild(buttonComments);
    
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

Socialite.buttonLikeClicked = function(e, linkInfo) {
  linkInfo.linkLike.onclick();
  
  // Deactivate other button, if applicable.
  if (linkInfo.linkDislikeActive) {
    linkInfo.linkDislikeActive = false;
    this.updateButtonDislike(linkInfo.buttonDislike, linkInfo.linkLikeActive);
  }
  
  if (linkInfo.linkLikeActive) {
    linkInfo.linkLikeActive = false;
  } else {
    linkInfo.linkLikeActive = true;
  }
  
  this.updateButtonLike(linkInfo.buttonLike, linkInfo.linkLikeActive);
};

Socialite.buttonDislikeClicked = function(e, linkInfo) {
  linkInfo.linkDislike.onclick();
  
  // Deactivate other button, if applicable.
  if (linkInfo.linkLikeActive) {
    linkInfo.linkLikeActive = false;
    this.updateButtonLike(linkInfo.buttonLike, linkInfo.linkLikeActive);
  }
  
  if (linkInfo.linkDislikeActive) {
    linkInfo.linkDislikeActive = false;
  } else {
    linkInfo.linkDislikeActive = true;
  }
  
  this.updateButtonDislike(linkInfo.buttonDislike, linkInfo.linkDislikeActive);
};

Socialite.buttonCommentsClicked = function(e, linkComments) {
  var link = e.target;
  var doc = link.ownerDocument;
  this.tabBrowser.loadURI(linkComments);
};

Socialite.init();
