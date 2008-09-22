Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
faviconWatch = Components.utils.import("resource://socialite/utils/faviconWatch.jsm");
Components.utils.import("resource://socialite/utils/domUtils.jsm");

var SOCIALITE_SITE_URLBARICON_ID = "socialite-site-urlbar-icon-";
var SOCIALITE_SITE_URLBARICON_CLASS = "socialite-site-urlbar-icon"; 

SocialiteWindow.SiteUrlBarIcon = {
  create: function(site) {
    let urlBarIconParent = document.getElementById("urlbar-icons");
    let urlBarIcons = this.getAll();
    let feedButton = document.getElementById("feed-button");
    let urlBarIcon = document.createElement("image");
    
    urlBarIcon.id = SOCIALITE_SITE_URLBARICON_ID + site.siteID;
    urlBarIcon.siteID = site.siteID;
    urlBarIcon.siteName = site.siteName;
    urlBarIcon.className = SOCIALITE_SITE_URLBARICON_CLASS + " urlbar-icon";
    urlBarIcon.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(urlBarIcon, "src", site.siteURL);
    urlBarIcon.setAttribute("tooltiptext", site.siteName);
    urlBarIcon.addEventListener("click", function(event) {
      SocialiteWindow.linkContextAction(site, event)
    }, false);
    
    if (urlBarIcons.length == 0) {
      urlBarIconParent.insertBefore(urlBarIcon, feedButton);
    } else {
      insertSorted(urlBarIcon, urlBarIcons, this.compareUrlBarIcons);
    }
    
    return urlBarIcon;
  },
  
  compareUrlBarIcons: function compare(urlBarIcon1, urlBarIcon2) {
    // Compare site names alphabetically
    return urlBarIcon1.siteName.localeCompare(urlBarIcon2.siteName);
  },
  
  get: function(site) {
    return document.getElementById(SOCIALITE_SITE_URLBARICON_ID + site.siteID);
  },
  
  getAll: function() {
    return document.getElementsByClassName(SOCIALITE_SITE_URLBARICON_CLASS);
  },
  
  remove: function(site) {
    let urlBarIcons = document.getElementById("urlbar-icons");
    let urlBarIcon = this.get(site);
    if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
    urlBarIcons.removeChild(urlBarIcon)
  },
  
  updateSiteName: function(site, siteName) {
    let urlBarIcon = this.get(site);
    urlBarIcon.siteName = siteName;
    urlBarIcon.setAttribute("tooltiptext", siteName);
    
    // Reorder in the list
    insertSorted(urlBarIcon, this.getAll(), this.compareUrlBarIcons);
  },
  
  onLoad: function() {
    for each (let site in Socialite.sites.byID) {
      if (site) {
        this.create(site);
      }
    };
  },
  
  onUnload: function() {
    Array.map(SocialiteWindow.SiteUrlBarIcon.getAll(), function(urlBarIcon) {
      if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
    });
  }
}