Components.utils.import("resource://socialite/socialite.jsm");
Components.utils.import("resource://socialite/site.jsm");

var SocialiteSiteProperties = {

  init: function SSProps_init() {
  
    this.isNewSite = window.arguments[0].isNewSite;
    if (this.isNewSite) {
      this.siteID = Socialite.sites.requestID();
    } else {
      this.site = window.arguments[0].site;
      this.siteID = this.site.siteID
    }
    
    this.preferences = document.getElementById("preferencesSocialite");
    this.prefSiteName = this.addSitePreference("prefSiteName", "siteName", "string");
    this.prefSiteURL = this.addSitePreference("prefSiteURL", "siteURL", "string");
    
    var buttonSiteClass = document.getElementById("buttonSiteClass");
    var menuSiteClass = document.getElementById("menuSiteClass");
    for each (var siteClass in siteClassRegistry.classes) {
      var menuItem = document.createElement("menuitem");
      
      menuItem.setAttribute("class", "menuitem-iconic");
      menuItem.setAttribute("label", siteClass.prototype.siteClassName);
      menuItem.setAttribute("image", siteClass.prototype.siteClassIconURI);
      menuItem.setAttribute("value", siteClass.prototype.siteClassID);
      
      menuSiteClass.appendChild(menuItem);
    }
    
    this.boxSiteProperties = document.getElementById("boxSiteProperties");
    
    // Handler to update preferences pane 
    buttonSiteClass.addEventListener("ValueChange", function(event) {
      var container = SocialiteSiteProperties.boxSiteProperties;
      
      // Remove old pane
      if (container.hasChildNodes()) {
        container.removeChild(container.childNodes[0]);
      }
      
      // Add new pane
      var siteClassID = buttonSiteClass.selectedItem.value;
      var siteClass = siteClassRegistry.getClass(siteClassID);
      var pane = siteClass.prototype.createPreferencesUI(document, SocialiteSiteProperties);
      container.appendChild(pane);
    }, false);
    
    this.prefSiteClassID = this.addSitePreference("prefSiteClassID", "siteClassID", "string");
    if (this.isNewSite) {
      this.prefSiteClassID.value = menuSiteClass.childNodes.item(0).value;
    } else {
      this.prefSiteClassID.disabled = true; 
    }
    
  },
  
  addSitePreference: function SSProps_addSitePreference(prefID, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefID);
    preference.setAttribute("name", "extensions.socialite.sites."+this.siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    this.preferences.appendChild(preference);
    return preference;
  },
  
  onAccept: function SSProps_onAccept(event) {
    if (this.isNewSite) {
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
  },
  
  onCancel: function SSProps_onCancel(event) {
    // If we we're cancelling adding a new site, we need to release the ID we requested
    if (this.isNewSite) {
      Socialite.sites.releaseID(this.siteID);
      return true;
    }
  }

};