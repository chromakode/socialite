Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/site.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
//Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");
Components.utils.import("resource://socialite/reddit/redditLinkInfo.jsm");
Components.utils.import("resource://socialite/reddit/redditUtils.jsm");

var EXPORTED_SYMBOLS = ["RedditSite"];

stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                  .getService(Components.interfaces.nsIStringBundleService)
                                  .createBundle("chrome://socialite/locale/reddit.properties")

function RedditSite(siteID, siteName, siteURL) {
  SocialiteSite.apply(this, arguments);
}

RedditSite.prototype.__proto__ = SocialiteSite.prototype;

RedditSite.prototype.onLoad = function() {
  SocialiteSite.prototype.onLoad.apply(this, arguments);
  this.API = new RedditAPI();
  this.API.auth = new RedditAuth(this.siteURL);
  this.API.auth.refreshAuthInfo().perform();
};

RedditSite.prototype.setDefaultPreferences = function(siteDefaultBranch) {
  siteDefaultBranch.setBoolPref("compactDisplay", true);
  siteDefaultBranch.setBoolPref("showScore", true);
  siteDefaultBranch.setBoolPref("showSubreddit", true);
  siteDefaultBranch.setBoolPref("showComments", true);
  siteDefaultBranch.setBoolPref("showSave", true);
  siteDefaultBranch.setBoolPref("showHide", false);
  siteDefaultBranch.setBoolPref("showRandom", false);
  siteDefaultBranch.setBoolPref("showProfile", false);
};

RedditSite.prototype.onSitePageLoad = function(doc, win) {
  // Iterate over each article link and register event listener
  const XPathResult = Components.interfaces.nsIDOMXPathResult;
  var res = doc.evaluate('//a[@class="title loggedin"]', doc.documentElement, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null );
   
  for (var i=0; i < res.snapshotLength; i++) {
    var siteLink = res.snapshotItem(i);
    
    // FIXME: click event listeners can persist after unloading, preventing the site from unloading properly and being garbage collected.
    // I'll allow this to happen for now, with a "loaded" check to cause the handlers to do nothing once the site is unloaded.
    // This is hopefully less demanding than keeping track of and cleaning up the listeners, or simply watching all links that are seen.
    siteLink.addEventListener("mouseup", hitchThis(this, function(e) {
      if (this.loaded) {
        this.linkClicked(e);
      }
    }), false);
    
    // For debugging purposes
    //siteLink.style.color = "red";
  }
  
  logger.log("RedditSite", this.siteName, "Added click handlers to " + res.snapshotLength + " links on " + win.location.href);
  
  // Snarf the authentication hash using wrappedJSObject
  // This should be safe, since Firefox 3 uses a XPCSafeJSObjectWrapper
  // See http://developer.mozilla.org/en/docs/XPConnect_wrappers#XPCSafeJSObjectWrapper
  this.API.auth.snarfAuthInfo(doc, win);
};

RedditSite.prototype.linkClicked = function(event) {
  var link = event.target;
  var doc = link.ownerDocument;
  var linkURL   = link.href;
  
  if (Socialite.watchedURLs.isWatchedBy(linkURL, this)) {
    // Ensure that the URL isn't hidden
    Socialite.watchedURLs.get(linkURL).activate();
  } else {
    try {
      // Remove title_ from title_XX_XXXXX
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
        logger.log("RedditSite", this.siteName, "Unexpected save link absence.");
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
        logger.log("RedditSite", this.siteName, "Unexpected hide link absence.");
      }
    } catch (e) {
      logger.log("RedditSite", this.siteName, "Caught exception while reading data from DOM: " + e.toString());
    }
    
    // Add the information we collected to the watch list  
    Socialite.watchedURLs.watch(linkInfo.url, this, linkInfo);
  }
};

RedditSite.prototype.getLinkInfo = function(URL, callback) {
  var infoCall = this.API.info(
    hitchThis(this, function success(r, json) {
      if (json.data.children.length > 0) {
        var linkInfo = RedditLinkInfoFromJSON(this.API, json);
        Socialite.watchedURLs.watch(URL, this, linkInfo);
        callback(linkInfo);
      } else {
        callback(null);
      }
    }),
    function failure(r) { callback(null); }
  );
  
  // We supply null since we do not know the subreddit.
  infoCall.perform(URL, null);
};


RedditSite.prototype.createBarContentUI = function(document, linkInfo) {
  var barContent = document.createElement("hbox");
  barContent.setAttribute("flex", "1");
  
  barContent.siteID = this.siteID;
  barContent.linkInfo = linkInfo;
  barContent.sitePreferences = this.sitePreferences;
  
  // We define behaviors here since I intend the RedditBarContent XBL to only be responsible for the display of a RedditLinkInfo instance.
  // In other words, we'll treat it more like a support widget and define handlers for its commands here. This is helpful because the scripting scope in XBL is limited.
  // FIXME: We'll use this 'afterBound' hack because I'm tired of trying to figure out how to make XBL apply synchronously.
  var site = this;
  barContent.afterBound = function() {
    
    // Action failure handlers for info updates are disabled because the messages are too frequent and unhelpful.
    var voteUpdateHandler = function() {
      barContent.linkInfo.update(
        hitchThis(barContent, barContent.update)/*,
        hitchThis(site, site.actionFailureHandler)*/
      ).perform(["score"]);
    }
    var updateHandler = function() {
      barContent.linkInfo.update(
        hitchThis(barContent, barContent.update)/*,
        (hitchThis(site, site.actionFailureHandler)*/
      ).perform([]);
    }
    var subredditURL = function() {
      return site.siteURL+"r/"+barContent.linkInfo.localState.subreddit+"/";
    }
    
    this.refreshCallback = updateHandler;
    
    this.labelSubreddit.addEventListener("click", function(e) {
      Socialite.openUILink(subredditURL(), e);
    }, false);
        
    this.buttonLike.addEventListener("click", function(e) {
      var vote = barContent.linkInfo.vote(
        voteUpdateHandler,
        site.actionFailureHandler
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
        site.actionFailureHandler
      );
      if (barContent.linkInfo.localState.isLiked == false) {
        vote.perform(null);
      } else {
        vote.perform(false);
      }
      barContent.update();
    }, false);
    
    this.buttonComments.addEventListener("click", function(e) {
      Socialite.openUILink(subredditURL()+"info/"+barContent.linkInfo.getID()+"/comments/", e);
    }, false);
    
    this.buttonSave.addEventListener("click", function(e) {
      if (barContent.linkInfo.localState.isSaved) {
        var submit = barContent.linkInfo.unsave(
          updateHandler,
          site.actionFailureHandler
        );
      } else {
        var submit = barContent.linkInfo.save(
          updateHandler,
          site.actionFailureHandler
        );
      }
      submit.perform()
      barContent.update();
    }, false);
    
    this.buttonHide.addEventListener("click", function(e) {
      if (barContent.linkInfo.localState.isHidden) {
        var submit = barContent.linkInfo.unhide(
          updateHandler,
          site.actionFailureHandler
        );
      } else {
        var submit = barContent.linkInfo.hide(
          updateHandler,
          site.actionFailureHandler
        );
      }
      submit.perform()
      barContent.update();
    }, false);
    
    this.buttonRandom.addEventListener("click", function(e) {
      site.API.randomrising(
        function (r, json) {
          var linkInfo = RedditLinkInfoFromJSON(site.API, json);
          Socialite.watchedURLs.watch(linkInfo.url, site, linkInfo);
          Socialite.openUILink(linkInfo.url, e);
        },
        site.actionFailureHandler
      ).perform();
    }, false);
    
    this.buttonProfile.addEventListener("click", function(e) {
      Socialite.openUILink(subredditURL()+"user/"+barContent.linkInfo.redditAPI.auth.username+"/", e);
    }, false);
    
  };
  
  barContent.style.MozBinding = "url(chrome://socialite/content/reddit/redditBar.xml#reddit-content-ui)"; 
  return barContent;
};

RedditSite.prototype.createBarSubmitUI = function(document) {
  var barSubmit = document.createElement("hbox");
  barSubmit.setAttribute("flex", "1");
  
  var site = this;
  barSubmit.afterBound = function() {
    // Get subreddit listing and initialize menu
    site.API.mysubreddits(
      function success(r, json) {
        // Sort the subreddits like on the submit page.
        json.data.children.sort(subredditSort);
                
        if (json.data.children.length == 0) {
          Socialite.siteFailureMessage(site, "createBarSubmitUI", "No subscribed subreddits found.");
          barSubmit.menulistSubreddit.hidden = true;
        } else {
          for each (var subredditInfo in json.data.children) {
            let subredditURL = subredditInfo.data.url;
            let subredditURLName = /^\/r\/(.+)\/$/.exec(subredditURL)[1];
            
            // Remove the '/' at the beginning
            subredditURL = subredditURL.substring(1);
            
            barSubmit.menulistSubreddit.appendItem(subredditURLName, subredditURL);
          }
        }
        
        barSubmit.menulistSubreddit.selectedIndex = 0;
      },
      site.actionFailureHandler
    ).perform();
    
    this.buttonSubmit.addEventListener("click", function(e) {
      var subredditURL;
      if (barSubmit.menulistSubreddit.selectedItem && !barSubmit.hidden) {
        subredditURL = barSubmit.menulistSubreddit.selectedItem.value;
      } else {
        // Degrade to general submission page if no subreddit is set.
        subredditURL = "";
      }
      var submitURL = barSubmit.parentNode.URL;
      var submitTitle = barSubmit.textboxTitle.value;
      
      // Use ?resubmit GET parameter so reddit doesn't jump straight to the "already submitted" page
      formURL = site.siteURL+subredditURL+"submit/?resubmit=true"+
                  "&url="+encodeURIComponent(submitURL)+
                  "&title="+encodeURIComponent(submitTitle);
      
      Socialite.openUILink(formURL, e);
      barSubmit.parentNode.close();
    }, false);
  };
  
  barSubmit.style.MozBinding = "url(chrome://socialite/content/reddit/redditBar.xml#reddit-submit-ui)"; 
  return barSubmit;
};

RedditSite.prototype.createPreferencesUI = function(document, propertiesWindow) {
  var propertiesBox = document.createElement("vbox");
  
  function addGroupbox(title) {
    var groupbox = document.createElement("groupbox");
    groupbox.setAttribute("flex", "1");
    
    var groupboxCaption = document.createElement("caption");
    groupboxCaption.setAttribute("label", title);
    groupbox.appendChild(groupboxCaption);
    
    propertiesBox.appendChild(groupbox);
    return groupbox;
  }
  
  function addBooleanPreferenceUI(parent, prefName, defaultValue) {
    var capitalizedName = prefName[0].toUpperCase() + prefName.substr(1);
    var prefID = "pref"+capitalizedName;
    var preference = propertiesWindow.addSitePreference(prefID, prefName, "bool");
    
    checkbox = document.createElement("checkbox");
    checkbox.setAttribute("label", stringBundle.GetStringFromName(prefName+"Preference.label"));
    checkbox.setAttribute("accesskey", stringBundle.GetStringFromName(prefName+"Preference.accesskey"));
    checkbox.setAttribute("preference", prefID);
    preference.setElementValue(checkbox);
    
    parent.appendChild(checkbox);
  }
  
  var generalGroup = addGroupbox(stringBundle.GetStringFromName("generalGroup.caption"));
  addBooleanPreferenceUI(generalGroup, "compactDisplay");
  
  var displayGroup = addGroupbox(stringBundle.GetStringFromName("displayGroup.caption"));
  addBooleanPreferenceUI(displayGroup, "showScore");
  addBooleanPreferenceUI(displayGroup, "showSubreddit");
  addBooleanPreferenceUI(displayGroup, "showComments");
  addBooleanPreferenceUI(displayGroup, "showSave");
  addBooleanPreferenceUI(displayGroup, "showHide");
  addBooleanPreferenceUI(displayGroup, "showRandom");
  addBooleanPreferenceUI(displayGroup, "showProfile");
    
  return propertiesBox;  
};

RedditSite.prototype.actionFailureHandler = function(r, action) {
  // 5xx error codes
  if (r.status >= 500 && r.status < 600) {
    text = "Unable to perform the requested action. Please try again.";
  } else {
    text = "HTTP status " + r.status + " recieved.";
  }
  
  Socialite.siteFailureMessage(this, action.name, text);
};

// Register this class for instantiation
RedditSite.prototype.siteClassID = "RedditSite";
RedditSite.prototype.siteClassName = "Reddit API";
RedditSite.prototype.siteClassIconURI = "chrome://socialite/content/reddit/reddit.ico";
SiteClassRegistry.addClass(RedditSite);