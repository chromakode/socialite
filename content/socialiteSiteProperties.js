Components.utils.import("resource://socialite/socialite.jsm");
Components.utils.import("resource://socialite/site.jsm");

var SocialiteSiteProperties = {

  init: function SSProps_init() {
  
    this.newSite = window.arguments[0].isNewSite;
    if (!this.newSite) {
      this.site = window.arguments[0].site;
    }
    
    var preferencesSocialite = document.getElementById("preferencesSocialite");
    this.prefSiteName = this.addPreference(preferencesSocialite, this.site, "siteName", "string");
    this.prefSiteURL = this.addPreference(preferencesSocialite, this.site, "siteURL", "string");
    this.prefSiteClassID = this.addPreference(preferencesSocialite, this.site, "siteClassID", "string");
    
    var menuSiteClass = document.getElementById("menuSiteClass");
    for each (var siteClass in siteClassRegistry.classes) {
      var menuItem = document.createElement("menuitem");
      
      menuItem.setAttribute("class", "menuitem-iconic");
      menuItem.setAttribute("label", siteClass.prototype.siteClassName);
      menuItem.setAttribute("image", siteClass.prototype.siteClassIconURI);
      menuItem.setAttribute("value", siteClass.prototype.siteClassID);
      
      menuItem.addEventListener("command", function(event) {
        
      }, false);
      
      menuSiteClass.appendChild(menuItem);
      
      // If the item is for the site's current class, select it. 
      if (siteClass.prototype.siteClassID == this.site.siteClassID) {
       menuItem.doCommand(); 
      }
    }
  },
  
  addPreference: function SSProps_addPreference(preferences, site, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefName);
    preference.setAttribute("name", "extensions.socialite.sites."+site.siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    preferences.appendChild(preference);
    return preference;
  },
  
  onAccept: function SSProps_onAccept(event) {
    if (SocialiteSiteProperties.newSite) {
      var site = Socialite.createSite(null, this.prefSiteName.value, this.prefSiteURL.value)
      Socialite.loadSite(site);
    } else {
      var site = SocialiteSiteProperties.site;
      var needsReload = false;
      
      site.siteName = this.prefSiteName.value;
      if (site.siteURL != this.prefSiteURL.value) {
        site.siteURL = this.prefSiteURL.value;
        needsReload = true;
      }
      
      if (needsReload) {
        Socialite.reloadSite(site); 
      }
      
      return true;
    }
  }

};