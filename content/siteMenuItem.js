Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
faviconWatch = Components.utils.import("resource://socialite/utils/faviconWatch.jsm");
Components.utils.import("resource://socialite/utils/domUtils.jsm");

var SOCIALITE_SITE_MENUITEM_ID = "socialite-site-menuitem-";
var SOCIALITE_SITE_MENUITEM_CLASS = "socialite-site-menuitem"; 

SocialiteWindow.SiteMenuItem = {
  create: function(site) {
    let fileMenuPopup = document.getElementById("menu_FilePopup");
    let sendMenuItem = document.getElementById("menu_sendLink");
    let siteMenuItem = document.createElement("menuitem");
    
    siteMenuItem.id = SOCIALITE_SITE_MENUITEM_ID + site.siteID;
    siteMenuItem.siteID = site.siteID;
    siteMenuItem.className = SOCIALITE_SITE_MENUITEM_CLASS;
    siteMenuItem.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(siteMenuItem, "image", site.siteURL);
    siteMenuItem.addEventListener("command", function(event) {
      SocialiteWindow.linkContextAction(site, event, true);
    }, false);
    
    siteMenuItem.updateSiteName = function(newSiteName) {
      siteMenuItem.setAttribute("label", SocialiteWindow.stringBundle.formatStringFromName("shareMenuItem.label", [ newSiteName ], 1));
      
      let siteMenuItems = SocialiteWindow.SiteMenuItem.getAll();
      if (siteMenuItems.length == 0) {
        fileMenuPopup.insertBefore(siteMenuItem, sendMenuItem.nextSibling);
      } else {
        insertSorted(siteMenuItem, siteMenuItems, function(item1, item2) {
          let label1 = item1.getAttribute("label"); 
          let label2 = item2.getAttribute("label"); 
          return label1.localeCompare(label2);
        });
      }
    }
    siteMenuItem.updateSiteName(site.siteName);
    
    return siteMenuItem;
  },
  
  get: function(site) {
    return document.getElementById(SOCIALITE_SITE_MENUITEM_ID + site.siteID);
  },
  
  getAll: function() {
    return document.getElementsByClassName(SOCIALITE_SITE_MENUITEM_CLASS);
  },
  
  remove: function(site) {
    let fileMenuPopup = document.getElementById("menu_FilePopup");
    let siteMenuItem = this.get(site);
    if (siteMenuItem.removeFaviconWatch) { siteMenuItem.removeFaviconWatch(); }
    fileMenuPopup.removeChild(siteMenuItem);
  },
  
  updateSiteName: function(site, siteName) {
    let siteMenuItem = this.get(site);
    siteMenuItem.updateSiteName(siteName);
  },
  
  onLoad: function() {
    for each (let site in Socialite.sites.byID) {
      if (site) {
        this.create(site);
      }
    };
  },
  
  onUnload: function() {
    Array.map(SocialiteWindow.SiteMenuItem.getAll(), function(siteMenuItem) {
      if (siteMenuItem.removeFaviconWatch) { siteMenuItem.removeFaviconWatch(); }
    });
  }
}