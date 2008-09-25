Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
persistence = Components.utils.import("resource://socialite/persistence.jsm");

var observerService = Components.classes["@mozilla.org/observer-service;1"]
                      .getService(Components.interfaces.nsIObserverService);

var SOCIALITE_CONTENT_NOTIFICATION_VALUE = "socialite-contentbar-notification";
var SOCIALITE_SUBMIT_NOTIFICATION_VALUE = "socialite-submitbar-notification"; 

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
    SocialiteWindow.stringBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                                   .getService(Components.interfaces.nsIStringBundleService)
                                   .createBundle("chrome://socialite/locale/socialite.properties")
                                   
    window.addEventListener("load", SocialiteWindow.onLoad, false);
    window.addEventListener("unload", SocialiteWindow.onUnload, false);
  },
  
  onLoad: function() {
    Socialite.load();
    
    observerService.addObserver(SocialiteWindow.siteObserver, "socialite-load-site", false);
    observerService.addObserver(SocialiteWindow.siteObserver, "socialite-unload-site", false);
    
    Socialite.preferences.addObserver("", SocialiteWindow.preferenceObserver, false);
    
    SocialiteWindow.SiteUrlBarIcon.onLoad();
    SocialiteWindow.SiteMenuItem.onLoad();
    
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
    SocialiteWindow.SiteMenuItem.onUnload();
    
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
        // If we're not closing the bar, refresh it.
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
  
  linkContextAction: function(site, event, forceSubmit) {
    var selectedBrowser = gBrowser.selectedBrowser;
    var currentURL = selectedBrowser.currentURI.spec;
    var notificationBox = gBrowser.getNotificationBox(selectedBrowser);
   
    //
    // *** Helper functions ***
    //
    
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
      if (site) {
        submitBar.siteSelector.selectSite(site);
      }
    }
    
    // Helper function to get link info from a watch, falling back to querying the site
    function getWatchLinkInfo(URL, site, callback) {
      let watchLinkInfo = Socialite.watchedURLs.getWatchLinkInfo(currentURL, site);
      if (watchLinkInfo) {
        // If the site is watched, return the stored information.
        openContentBarTo(site, site.createBarContentUI(document, watchLinkInfo));
        callback(watchLinkInfo);
      } else {
        // We have no local information about the URL, so we need to check the Socialite site to see if the URL is already submitted.
        site.getLinkInfo(currentURL, function(linkInfo) {
          if (linkInfo) {
            openContentBarTo(site, site.createBarContentUI(document, linkInfo));
          }
          callback(linkInfo);
        });
      }
    }
    
    // Helper function to sequentially call getWatchLinkInfo for a group of sites.
    // Since each call happens asynchronously, we iterate by making a chain of callbacks.
    function getSiteWatchLinkInfos(URL, sites, callback) {
      linkInfos = [];
      
      // Iterate over each site given
      siteIterator = Iterator(sites);
      
      function next(linkInfo) {
        linkInfos.push(linkInfo);
        try {
          site = siteIterator.next();
          getWatchLinkInfo(URL, site, next);
        } catch (e if e instanceof StopIteration) {
          // No more sites left. We're done.
          callback(linkInfos);
        }
      }
      
      // Get the sequence started.
      getWatchLinkInfo(URL, siteIterator.next(), next);
    }
    
    //
    // *** Context Logic ***
    //
    
    // *** Step 1: UI cases where the intended action is clearly to submit
    if (event.button == 1 || forceSubmit) {
      // Middle-click forces submit action
      openSubmitBarTo(site)
    } else if (submitBar) {
      // If the submit bar is already open, we will simply update it
      openSubmitBarTo(site);
    } else if (socialiteBar && (!site || socialiteBar.hasSiteUI(site))) {
      // If the content bar is already open, we will open the submit bar, with one exception:
      // If a single site has been specified, and the content bar does not have  
      openSubmitBarTo(site);
    } else {
      // *** Step 2: We must check the link info and figure out whether the link has been posted before.
      // If it exists on any sites, open content bar. Otherwise, open submit bar.
      if (site) {
        getWatchLinkInfo(currentURL, site, function(linkInfo) {
          if (!linkInfo) {
            // If we didn't find any linkInfo, open the submit bar 
            openSubmitBarTo(site);
          }
        });
      } else {
        getSiteWatchLinkInfos(currentURL, Socialite.sites, function(linkInfos) {
          // If every linkInfo is null, we didn't find anything.
          if (linkInfos.every(function(x) x == null)) {
            // If we didn't find a single site that knows about this link, open the submit bar 
            openSubmitBarTo();
          }
        });
      }
    }
  },

  siteObserver: { 
    
    observe: function(subject, topic, data) {
      let site = Socialite.sites.byID[data];
      switch (topic) {
      
        case "socialite-load-site":
          SocialiteWindow.SiteUrlBarIcon.create(site);
          SocialiteWindow.SiteMenuItem.create(site);
          break;
          
        case "socialite-unload-site":
          SocialiteWindow.SiteUrlBarIcon.remove(site);
          SocialiteWindow.SiteMenuItem.remove(site);
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
          break;
          
      }
    }
  
  },
  
  preferenceObserver: {
    
    observe: function(subject, topic, data) {
      // data is of the form siteID.preference
      let splitData = data.split(".");
      let prefStart = splitData[0];
      switch (prefStart) {
      
        case "sites":
          let [prefStart, siteID, prefName] = splitData;
          // Update the UI if the site name changes.
          if (prefName == "siteName") {
            let newSiteName = Socialite.preferences.getCharPref(data);
            let site = Socialite.sites.byID[siteID];
            SocialiteWindow.SiteUrlBarIcon.updateSiteName(site, newSiteName);
            SocialiteWindow.SiteMenuItem.updateSiteName(site, newSiteName);
          }
          break;
          
        case "showSiteUrlBarIcons":
          SocialiteWindow.SiteUrlBarIcon.updateVisibility();
          break;
          
        case "showSiteMenuItems":
          SocialiteWindow.SiteMenuItem.updateVisibility();
          break;
          
        case "consolidateSites":
          SocialiteWindow.SiteUrlBarIcon.updateVisibility();
          SocialiteWindow.SiteMenuItem.updateVisibility();
          break;
          
      }
    }
  
  }

}

SocialiteWindow.init();
