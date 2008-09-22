Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
persistence = Components.utils.import("resource://socialite/persistence.jsm");
faviconWatch = Components.utils.import("resource://socialite/utils/faviconWatch.jsm");

var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

var SOCIALITE_CONTENT_NOTIFICATION_VALUE = "socialite-contentbar-notification";
var SOCIALITE_SUBMIT_NOTIFICATION_VALUE = "socialite-submitbar-notification"; 
var SOCIALITE_SITE_URLBARICON_ID = "socialite-site-urlbar-icon-";
var SOCIALITE_SITE_URLBARICON_CLASS = "socialite-site-urlbar-icon"; 

// ---

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
      var isLoadingText;
      if (aProgress.isLoadingDocument) {
        isLoadingText = "(loading)"; 
      } else {
        isLoadingText = ""; 
      }
      logger.log("SocialiteProgressListener", "onLocationChange " + isLoadingText + ": " + aProgress.DOMWindow.location.href);
      SocialiteWindow.linkStartLoad(window, aProgress.isLoadingDocument);
    }
  },
  
  onProgressChange: function() {return 0;},
  onStatusChange: function() {return 0;},
  onSecurityChange: function() {return 0;}
}

// ---

var SocialiteWindow = 
{
  
  init: function() {
    window.addEventListener("load", SocialiteWindow.onLoad, false);
    window.addEventListener("unload", SocialiteWindow.onUnload, false);
  },
  
  onLoad: function() {
    Socialite.load();
    
    observerService.addObserver(SocialiteWindow.siteObserver, "socialite-load-site", false);
    observerService.addObserver(SocialiteWindow.siteObserver, "socialite-unload-site", false);
    
    Socialite.preferences.addObserver("", SocialiteWindow.preferenceObserver, false);
    
    SocialiteWindow.SiteUrlBarIcon.onLoad();
    
    gBrowser.addEventListener("DOMContentLoaded", function(event) {
      var doc = event.originalTarget;
      
      if (doc instanceof HTMLDocument) {
        var win = doc.defaultView;
        if (win == win.top) {
          Socialite.sites.onContentLoad(doc, win);
        }
      }
    }, false);
    
    // Watch for new tabs to add progress listener to them
    gBrowser.addEventListener("TabOpen", function(event) {
      var browser = event.originalTarget.linkedBrowser;
      var win = browser.contentWindow;
      // Opening a new tab may not always have a URL set (e.g. CTRL-t)
      if (browser.currentURI) {
        logger.log("main", "Tab opened: " + browser.currentURI.spec);    
        SocialiteWindow.linkStartLoad(win, true)
      }
    }, false);
    
    gBrowser.addEventListener("TabClose", function(event) {
      var tab = event.originalTarget;
      logger.log("main", "Tab closed: " + event.originalTarget.linkedBrowser.currentURI.spec);
    }, false);
    
    // Add progress listener to tabbrowser. This fires progress events for the current tab.
    SocialiteWindow.setupProgressListener(gBrowser);
  },
  
  onUnload: function() {
    SocialiteWindow.SiteUrlBarIcon.onUnload();
    
    Socialite.preferences.removeObserver("", this.preferenceObserver);
    
    observerService.removeObserver(SocialiteWindow.siteObserver, "socialite-load-site");
    observerService.removeObserver(SocialiteWindow.siteObserver, "socialite-unload-site");
    // Remove remaining progress listeners.
    SocialiteWindow.unsetProgressListener(gBrowser);
  },
  
  setupProgressListener: function(browser) {
    logger.log("main", "Progress listener added.");
    browser.addProgressListener(SocialiteProgressListener,  Components.interfaces.nsIWebProgress.NOTIFY_ALL);
  },
  
  unsetProgressListener: function(browser) {
    logger.log("main", "Progress listener removed.");
    browser.removeProgressListener(SocialiteProgressListener);
  },

  linkStartLoad: function(win, isLoading) {
    var href = win.location.href;
    var browser = gBrowser.getBrowserForDocument(win.document);
    var notificationBox = gBrowser.getNotificationBox(browser);
  
    socialiteBar = notificationBox.getNotificationWithValue(SOCIALITE_CONTENT_NOTIFICATION_VALUE);
    if (socialiteBar) {
      // Handle persistence changes, if any.
      if (!persistence.onLocationChange(socialiteBar.url, href)) {
        notificationBox.removeNotification(socialiteBar);
        socialiteBar = null;
      } else { 
        socialiteBar.refresh();
      }
    } 
    
    if (!socialiteBar && Socialite.watchedURLs.isWatched(href)) {
      // This is a watched link. Create a notification box and initialize.
      var newBar = SocialiteWindow.createContentBar(notificationBox, href);
      
      // Populate the bar
      for each (entry in Socialite.watchedURLs.getWatches(href)) {
        newBar.addSiteUI(entry.site, entry.site.createBarContentUI(document, entry.linkInfo));
      };
    }
  },
  
  createContentBar: function(notificationBox, url) {
    var notification = notificationBox.appendNotification(
      "",
      SOCIALITE_CONTENT_NOTIFICATION_VALUE,
      "",
      notificationBox.PRIORITY_INFO_LOW,
      []
    );
    
    // Note: the notification XBL binding is changed by CSS
  
    // Make the notification immortal -- we'll handle closing it.
    notification.persistence = -1;
    
    // Set url property so we know the location the bar was originally opened for.
    notification.url = url;
    
    logger.log("SocialiteWindow", "Content notification created");
    return notification;
  },
  
  createSubmitBar: function(notificationBox, url) {
    var notification = notificationBox.appendNotification(
      "",
      SOCIALITE_SUBMIT_NOTIFICATION_VALUE,
      "",
      notificationBox.PRIORITY_INFO_MEDIUM, // Appear on top of socialite content notifications
      []
    );
    
    // Note: the notification XBL binding is changed by CSS
  
    // Make the notification immortal
    notification.persistence = -1;
    
    // Set url property so we know the location the bar was originally opened for.
    notification.url = url;
    
    logger.log("SocialiteWindow", "Submit notification created");
    return notification;
  },
  
  linkContextAction: function(site, event) {
    var selectedBrowser = gBrowser.selectedBrowser;
    var currentURL = selectedBrowser.currentURI.spec;
    var notificationBox = gBrowser.getNotificationBox(selectedBrowser);
    
    // Helper function to open the bar with some content.
    var socialiteBar = notificationBox.getNotificationWithValue(SOCIALITE_CONTENT_NOTIFICATION_VALUE);
    function openContentBarTo(site, siteUI) {
      if (socialiteBar && socialiteBar.url != currentURL) {
        // The bar was opened for another URL. We will replace it.
        socialiteBar.close();
        socialiteBar = null;
      }
      if (!socialiteBar) {
        socialiteBar = SocialiteWindow.createContentBar(notificationBox, currentURL);
      }
      socialiteBar.addSiteUI(site, siteUI);
    }
    
    // Helper function to open the submit bar with a particular destination site selected.
    var submitBar = notificationBox.getNotificationWithValue(SOCIALITE_SUBMIT_NOTIFICATION_VALUE);
    function openSubmitBarTo(site) {
      if (!submitBar) {
        submitBar = SocialiteWindow.createSubmitBar(notificationBox, currentURL);
      }
      submitBar.siteSelector.selectSite(site);
    }
    
    if (event.button == 1) {
      // Middle-click forces submit action
      openSubmitBarTo(site)
    } else {
  
      var watchLinkInfo = Socialite.watchedURLs.getWatchLinkInfo(currentURL, site);
      if (submitBar || (socialiteBar && socialiteBar.hasSiteUI(site))) {
        // If the bar is open, the user intends to submit.
        openSubmitBarTo(site);
      } else if (watchLinkInfo) {
        // If the site is watched, it is already posted, so we should open the bar for it.
        openContentBarTo(site, site.createBarContentUI(document, watchLinkInfo));
      } else {
        // We have no local information about the URL, so we need to check the socialite site to see if the URL is already submitted.
        site.getLinkInfo(currentURL, function(linkInfo) {
          if (linkInfo) {
            // If the URL is already submitted, open the bar for it.
            openContentBarTo(site, site.createBarContentUI(document, linkInfo));
          } else {
            // If the URL has not already been submitted, open the submit UI.
            openSubmitBarTo(site);
          }
        });
      }
    }
  },
  
  SiteUrlBarIcon: {
    create: function(site) {
      let urlBarIcons = document.getElementById("urlbar-icons");
      let feedButton = document.getElementById("feed-button");
      let urlBarIcon = document.createElement("image");
      
      urlBarIcon.id = SOCIALITE_SITE_URLBARICON_ID + site.siteID;
      urlBarIcon.siteID = site.siteID;
      urlBarIcon.className = SOCIALITE_SITE_URLBARICON_CLASS + " urlbar-icon";
      urlBarIcon.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(urlBarIcon, "src", site.siteURL);
      urlBarIcon.setAttribute("tooltiptext", site.siteName);
      urlBarIcon.addEventListener("click", function(event) {
        SocialiteWindow.linkContextAction(site, event)
      }, false);
      
      urlBarIcons.insertBefore(urlBarIcon, feedButton);
      
      return urlBarIcon;
    },
    
    get: function(site) {
      return document.getElementById(SOCIALITE_SITE_URLBARICON_ID + site.siteID);
    },
    
    getAll: function() {
      return document.getElementsByClassName(SOCIALITE_SITE_URLBARICON_CLASS);
    },
    
    remove: function(site) {
      let urlBarIcons = document.getElementById("urlbar-icons");
      let urlBarIcon = SocialiteWindow.SiteUrlBarIcon.get(site);
      if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
      urlBarIcons.removeChild(urlBarIcon)
    },
    
    updateSiteName: function(site, siteName) {
      let urlBarIcon = SocialiteWindow.SiteUrlBarIcon.get(site);
      urlBarIcon.setAttribute("tooltiptext", siteName);
    },
    
    onLoad: function() {
      for each (let site in Socialite.sites.byID) {
        if (site) {
          SocialiteWindow.SiteUrlBarIcon.create(site);
        }
      };
    },
    
    onUnload: function() {
      Array.map(SocialiteWindow.SiteUrlBarIcon.getAll(), function(urlBarIcon) {
        if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
      });
    }
  },

  siteObserver: { 
    
    observe: function(subject, topic, data) {
      if (topic == "socialite-load-site") {
        let site = Socialite.sites.byID[data];
        SocialiteWindow.SiteUrlBarIcon.create(site);
      } else if (topic == "socialite-unload-site") {
        let site = Socialite.sites.byID[data];
        SocialiteWindow.SiteUrlBarIcon.remove(site);
        for (let i=0; i<gBrowser.browsers.length; i++) {
          let browser = gBrowser.browsers[i];
          socialiteBar = gBrowser.getNotificationBox(browser).getNotificationWithValue(SOCIALITE_CONTENT_NOTIFICATION_VALUE);
          if (socialiteBar) {
            socialiteBar.removeSiteUI(site);
            if (socialiteBar.contentCount == 0) {
               socialiteBar.close(); 
            }
          }
        }
      }
    }
  
  },
  
  preferenceObserver: {
    
    observe: function(subject, topic, data) {
      // data is of the form siteID.preference
      let splitData = data.split(".");
      let prefStart = splitData[0];
      if (prefStart == "sites") {
        let [prefStart, siteID, prefName] = splitData;
        
        // Update the UI if the site name changes.
        if (prefName == "siteName") {
          let newSiteName = Socialite.preferences.getCharPref(data);
          let site = Socialite.sites.byID[siteID];
          SocialiteWindow.SiteUrlBarIcon.updateSiteName(site, newSiteName);
        }
      }
    }
  
  }

}

SocialiteWindow.init();
