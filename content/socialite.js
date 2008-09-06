Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
persistence = Components.utils.import("resource://socialite/persistence.jsm");

var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                         .getService(Components.interfaces.nsIObserverService);

SOCIALITE_NOTIFICATION_VALUE = "socialitebar-notification"; 

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
      logger.log("SocialiteProgressListener", "onLocationChange (loading): " + aProgress.DOMWindow.location.href);
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

    observerService.addObserver(SocialiteWindow, "socialite-unload-site", false);
  
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
      logger.log("main", "Tab opened: " + browser.currentURI.spec);    
      SocialiteWindow.linkStartLoad(win, true)
    }, false);
    
    gBrowser.addEventListener("TabClose", function(event) {
      var tab = event.originalTarget;
      logger.log("main", "Tab closed: " + event.originalTarget.linkedBrowser.currentURI.spec);
    }, false);
    
    // Add progress listener to tabbrowser. This fires progress events for the current tab.
    SocialiteWindow.setupProgressListener(gBrowser);
  },
  
  onUnload: function() {
    observerService.removeObserver(SocialiteWindow, "socialite-unload-site");
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
    var browser = gBrowser.getBrowserForDocument(win.document);  // Use tabbrowser's cached tab position property
    var notificationBox = gBrowser.getNotificationBox(browser);
  
    socialiteBar = notificationBox.getNotificationWithValue(SOCIALITE_NOTIFICATION_VALUE);
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
      var newBar = SocialiteWindow.createNotificationBar(notificationBox);
      newBar.url = href;
      
      // Populate the bar
      for each (entry in Socialite.watchedURLs.getWatches(href)) {
        newBar.addSiteContent(entry.site, entry.site.createBarContentUI(document, entry.linkInfo));
      };
      newBar.refresh();
    }
  },
  
  createNotificationBar: function(notificationBox) {
    var notification = notificationBox.appendNotification(
      "",
      SOCIALITE_NOTIFICATION_VALUE,
      "",
      notificationBox.PRIORITY_INFO_MEDIUM,
      []
    );
    
    // Note: the notification XBL binding is changed by CSS
  
    // Make the notification immortal -- we'll handle closing it.
    notification.persistence = -1;
    
    logger.log("Socialite", "Notification created");
    return notification;
  },
  
  observe: function(subject, topic, data) {
    if (topic == "socialite-unload-site") {
      for (var i=0; i<gBrowser.browsers.length; i++) {
        browser = gBrowser.browsers[i];
        socialiteBar = gBrowser.getNotificationBox(browser).getNotificationWithValue(SOCIALITE_NOTIFICATION_VALUE);
        if (socialiteBar) {
          socialiteBar.removeSiteContent(Socialite.sites.byID[data]);
          
          if (socialiteBar.contentCount == 0) {
             socialiteBar.close(); 
          }
        }
      };
    }
  }

}

SocialiteWindow.init();
