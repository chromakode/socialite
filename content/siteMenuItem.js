Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");
faviconWatch = Components.utils.import("resource://socialite/utils/faviconWatch.jsm");
Components.utils.import("resource://socialite/utils/domUtils.jsm"); 

SocialiteWindow.SiteMenuItem = {
  SITE_MENUITEM_ID: "socialite-site-menuitem-",
  SITE_MENUITEM_CLASS: "socialite-site-menuitem",
  MENUITEM_CLASS: "socialite-menuitem",
  GENERAL_MENUITEM_ID: "socialite-menuitem",
  
  create: function(site) {
    let fileMenuPopup = document.getElementById("menu_FilePopup");
    let sendMenuItem = document.getElementById("menu_sendLink");
    let siteMenuItem = document.createElement("menuitem");
    
    siteMenuItem.id = this.SITE_MENUITEM_ID + site.siteID;
    siteMenuItem.className = [this.SITE_MENUITEM_CLASS, this.MENUITEM_CLASS].join(" ");
    siteMenuItem.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(siteMenuItem, "image", site.siteURL);
    
    siteMenuItem.updateVisibility = function(visible, consolidated) {
      siteMenuItem.setAttribute("hidden", !visible || consolidated);
    }
    siteMenuItem.updateVisibility(
      Socialite.preferences.getBoolPref("showSiteMenuItems"),
      Socialite.preferences.getBoolPref("consolidateSites")
    );
    
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
  
  createGeneral: function() {
    let fileMenuPopup = document.getElementById("menu_FilePopup");
    let sendMenuItem = document.getElementById("menu_sendLink");
    let siteMenuItem = document.createElement("menuitem");
    
    siteMenuItem.id = this.GENERAL_MENUITEM_ID;
    siteMenuItem.className = this.MENUITEM_CLASS;
    siteMenuItem.setAttribute("src", "chrome://socialite/content/socialite-small.png");
    siteMenuItem.setAttribute("label", SocialiteWindow.stringBundle.GetStringFromName("generalMenuItem.label"));
    
    siteMenuItem.updateVisibility = function(visible, consolidated) {
      siteMenuItem.setAttribute("hidden", !visible || !consolidated);
    }
    siteMenuItem.updateVisibility(
      Socialite.preferences.getBoolPref("showSiteMenuItems"),
      Socialite.preferences.getBoolPref("consolidateSites")
    );
    
    siteMenuItem.addEventListener("command", function(event) {
      SocialiteWindow.linkContextAction(null, event, true);
    }, false);
    
    fileMenuPopup.insertBefore(siteMenuItem, sendMenuItem.nextSibling);
    
    return siteMenuItem;
  },
  
  get: function(site) {
    return document.getElementById(this.SITE_MENUITEM_ID + site.siteID);
  },
  
  getAll: function() {
    return document.getElementsByClassName(this.SITE_MENUITEM_CLASS);
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
  
  updateVisibility: function() {
    let visible = Socialite.preferences.getBoolPref("showSiteMenuItems");
    let consolidated = Socialite.preferences.getBoolPref("consolidateSites");
    this.generalItem.updateVisibility(visible, consolidated);
    Array.map(this.getAll(), function(siteMenuItem) {
      siteMenuItem.updateVisibility(visible, consolidated);
    });
  },
  
  onLoad: function() {
    this.generalItem = this.createGeneral();
    for (let site in Socialite.sites) {
      this.create(site);
    }
  },
  
  onUnload: function() {
    Array.map(this.getAll(), function(siteMenuItem) {
      if (siteMenuItem.removeFaviconWatch) { siteMenuItem.removeFaviconWatch(); }
    });
  }
}