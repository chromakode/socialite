let modules = {};
let importModule = function(name) Components.utils.import(name, modules);

let Socialite = importModule("resource://socialite/socialite.jsm").Socialite;
let logger = importModule("resource://socialite/utils/log.jsm");
let faviconWatch = importModule("resource://socialite/utils/faviconWatch.jsm");
let domUtils = importModule("resource://socialite/utils/domUtils.jsm");

SocialiteWindow.SiteUrlBarIcon = {
  SITE_URLBARICON_ID: "socialite-site-urlbar-icon-",
  SITE_URLBARICON_CLASS: "socialite-site-urlbar-icon",
  URLBARICON_CLASS: "socialite-urlbar-icon",
  GENERAL_URLBARICON_ID: "socialite-urlbar-icon",
    
  create: function(site) {
    let urlBarIconParent = document.getElementById("urlbar-icons");
    let feedButton = document.getElementById("feed-button");
    let urlBarIcon = document.createElement("image");
    
    urlBarIcon.id = this.SITE_URLBARICON_ID + site.siteID;
    urlBarIcon.className = [this.SITE_URLBARICON_CLASS, this.URLBARICON_CLASS, "urlbar-icon"].join(" ");
    urlBarIcon.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(urlBarIcon, "src", site.siteURL);
   
    urlBarIcon.updateVisibility = function(visible, consolidated) {
      urlBarIcon.setAttribute("hidden", !visible || consolidated);
    }
    urlBarIcon.updateVisibility(
      Socialite.preferences.getBoolPref("showSiteUrlBarIcons"), 
      Socialite.preferences.getBoolPref("consolidateSites")
    );
    
    urlBarIcon.addEventListener("click", function(event) {
      SocialiteWindow.linkContextAction(site, event);
    }, false);
    
    urlBarIcon.updateSiteName = function(newSiteName) {
      urlBarIcon.setAttribute("tooltiptext", newSiteName);

      let urlBarIcons = SocialiteWindow.SiteUrlBarIcon.getAll();
      if (urlBarIcons.length == 0) {
        urlBarIconParent.insertBefore(urlBarIcon, feedButton);
      } else {
        domUtils.insertSorted(urlBarIcon, urlBarIcons, function compare(urlBarIcon1, urlBarIcon2) {
          let name1 = urlBarIcon1.getAttribute("tooltiptext"); 
          let name2 = urlBarIcon2.getAttribute("tooltiptext"); 
          return name1.localeCompare(name2);
        });
      }
    }
    urlBarIcon.updateSiteName(site.siteName);
    
    return urlBarIcon;
  },
  
  createGeneral: function() {
    let urlBarIconParent = document.getElementById("urlbar-icons");
    let feedButton = document.getElementById("feed-button");
    let urlBarIcon = document.createElement("image");
    
    urlBarIcon.id = this.GENERAL_URLBARICON_ID;
    urlBarIcon.className = [this.URLBARICON_CLASS, "urlbar-icon"].join(" ");
    urlBarIcon.setAttribute("src", "chrome://socialite/content/socialite-small.png");
    urlBarIcon.setAttribute("tooltiptext", SocialiteWindow.stringBundle.GetStringFromName("generalUrlBarIcon.tooltip"));
   
    urlBarIcon.updateVisibility = function(visible, consolidated) {
      urlBarIcon.setAttribute("hidden", !visible || !consolidated);
    }
    urlBarIcon.updateVisibility(Socialite.preferences.getBoolPref("showSiteUrlBarIcons"), 
                                Socialite.preferences.getBoolPref("consolidateSites"));
    
    urlBarIcon.addEventListener("click", function(event) {
      SocialiteWindow.linkContextAction(null, event);
    }, false);
    
    urlBarIconParent.insertBefore(urlBarIcon, feedButton);
    
    return urlBarIcon;
  },

  get: function(site) {
    return document.getElementById(this.SITE_URLBARICON_ID + site.siteID);
  },
  
  getAll: function() {
    return document.getElementsByClassName(this.SITE_URLBARICON_CLASS);
  },
  
  remove: function(site) {
    let urlBarIcons = document.getElementById("urlbar-icons");
    let urlBarIcon = this.get(site);
    if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
    urlBarIcons.removeChild(urlBarIcon)
  },
  
  updateSiteName: function(site, siteName) {
    let urlBarIcon = this.get(site);
    urlBarIcon.updateSiteName(siteName);
  },
  
  updateVisibility: function() {
    let visible = Socialite.preferences.getBoolPref("showSiteUrlBarIcons");
    let consolidated = Socialite.preferences.getBoolPref("consolidateSites");
    this.generalIcon.updateVisibility(visible, consolidated);
    Array.forEach(this.getAll(), function(urlBarIcon) {
      urlBarIcon.updateVisibility(visible, consolidated);
    });
  },
  
  onLoad: function() {
    this.generalIcon = this.createGeneral();
    for (let site in Socialite.sites) {
      this.create(site);
    }
  },
  
  onUnload: function() {
    Array.forEach(this.getAll(), function(urlBarIcon) {
      if (urlBarIcon.removeFaviconWatch) { urlBarIcon.removeFaviconWatch(); }
    });
  }
}