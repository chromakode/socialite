let modules = {};
let importModule = function(name) Components.utils.import(name, modules);

let Socialite = importModule("resource://socialite/socialite.jsm").Socialite;
let SiteClassRegistry = importModule("resource://socialite/site.jsm").SiteClassRegistry;

let IOService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);

var SocialiteSiteProperties = {

  init: function SSProps_init() {
    this.prefWindow = document.getElementById("socialiteSiteProperties");
    this.buttonAccept = this.prefWindow._buttons.accept;
    
    this.strings = document.getElementById("socialiteSitePropertiesStrings");
  
    this.isNewSite = window.arguments[0].isNewSite;
    if (this.isNewSite) {
      this.siteID = Socialite.sites.requestID();
    } else {
      this.site = window.arguments[0].site;
      this.siteID = this.site.siteID
    }
    
    // Set up preferences for the site
    this.preferences = document.getElementById("preferencesSocialite");
    
    // Site name and URL preferences
    this.textboxSiteName = document.getElementById("textboxSiteName");    
    this.textboxSiteURL = document.getElementById("textboxSiteURL");
    this.labelSiteURLError = document.getElementById("labelSiteURLError");
    
    this.prefSiteName = this.addSitePreference("prefSiteName", "siteName", "string");
    this.prefSiteURL = this.addSitePreference("prefSiteURL", "siteURL", "string");
    
    // Site class dropdown menu initialization (populate)
    let buttonSiteClass = document.getElementById("buttonSiteClass");
    let menuSiteClass = document.getElementById("menuSiteClass");
    for each (let siteClass in SiteClassRegistry.classes) {
      let menuItem = document.createElement("menuitem");
      
      menuItem.setAttribute("class", "menuitem-iconic");
      menuItem.setAttribute("label", siteClass.prototype.siteClassName);
      menuItem.setAttribute("image", siteClass.prototype.siteClassIconURI);
      menuItem.setAttribute("value", siteClass.prototype.siteClassID);
      
      menuSiteClass.appendChild(menuItem);
    }
       
    // Handler to update preferences pane for site class
    this.boxSiteProperties = document.getElementById("boxSiteProperties");
    buttonSiteClass.addEventListener("ValueChange", function(event) {
      let container = SocialiteSiteProperties.boxSiteProperties;
      
      // Remove old pane
      if (container.hasChildNodes()) {
        container.removeChild(container.firstChild);
      }
      
      // Add new pane
      let siteClassID = buttonSiteClass.selectedItem.value;
      let siteClass = SiteClassRegistry.getClass(siteClassID);
      let pane = siteClass.prototype.createPreferencesUI(document, SocialiteSiteProperties);
      container.appendChild(pane);
    }, false);
    
    // Site class preference initialization
    this.prefSiteClassID = this.addSitePreference("prefSiteClassID", "siteClassID", "string");
    if (this.isNewSite) {
      this.prefSiteClassID.value = menuSiteClass.childNodes.item(0).value;
    } else {
      this.prefSiteClassID.disabled = true; 
    }
    
    // Initial validation and form setup
    this.validate();
  },
  
  addSitePreference: function SSProps_addSitePreference(prefID, prefName, prefType) {
    let preference = document.createElement("preference");
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
      let needsReload = false;
      
      this.site.siteName = this.prefSiteName.value;
      
      let newSiteURL = IOService.newURI(this.prefSiteURL.value, null, null).spec;
      if (this.site.siteURL != newSiteURL) {
        this.site.siteURL = newSiteURL;
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
  },
  
  validate: function SSProps_validate(event) {
    if ((this.textboxSiteName.value == "") || (this.textboxSiteURL.value == "")) {
      // Short circuit case if either field is empty
      this.labelSiteURLError.value = "";
      this.buttonAccept.disabled = true;
    } else {
      let validURL;
      try {
        IOService.newURI(this.textboxSiteURL.value, null, null);
        validURL = true;
      } catch (e if e.name=="NS_ERROR_MALFORMED_URI") {
        // We were unable to create a URI, so the URL is invalid.
        validURL = false;
      }
      
      if (!validURL) {
        this.labelSiteURLError.value = this.strings.getString("siteURLInvalidError");
        this.buttonAccept.disabled = true;
      } else {
        this.labelSiteURLError.value = "";
        this.buttonAccept.disabled = false;
      }
    }
  }

};