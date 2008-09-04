Components.utils.import("resource://socialite/socialite.jsm");
Components.utils.import("resource://socialite/site.jsm");

var SocialiteSiteProperties = {

  init: function SSProps_init() {
  
    this.newSite = window.arguments[0].isNewSite;
    if (this.newSite) {
      this.siteID = Socialite.sites.requestID();
    } else {
      this.site = window.arguments[0].site;
      this.siteID = this.site.siteID
    }
    
    var preferencesSocialite = document.getElementById("preferencesSocialite");
    this.prefSiteName = this.addPreference(preferencesSocialite, this.siteID, "siteName", "string");
    this.prefSiteURL = this.addPreference(preferencesSocialite, this.siteID, "siteURL", "string");
    
    var buttonSiteClass = document.getElementById("buttonSiteClass");
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
    }
    
    this.prefSiteClassID = this.addPreference(preferencesSocialite, this.siteID, "siteClassID", "string");
    if (this.newSite) {
      this.prefSiteClassID.value = menuSiteClass.childNodes.item(0).value;
    } else {
      this.prefSiteClassID.disabled = true; 
    }
    
  },
  
  addPreference: function SSProps_addPreference(preferences, siteID, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefName);
    preference.setAttribute("name", "extensions.socialite.sites."+siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    preferences.appendChild(preference);
    return preference;
  },
  
  onAccept: function SSProps_onAccept(event) {
    if (this.newSite) {
      this.site = Socialite.sites.createSite(this.prefSiteClassID.value, this.siteID, this.prefSiteName.value, this.prefSiteURL.value)
      return true;
    } else {
      var needsReload = false;
      
      this.site.siteName = this.prefSiteName.value;
      if (this.site.siteURL != this.prefSiteURL.value) {
        this.site.siteURL = this.prefSiteURL.value;
        needsReload = true;
      }
      
      if (needsReload) {
        Socialite.sites.reloadSite(this.site); 
      }
      
      return true;
    }
  }

};