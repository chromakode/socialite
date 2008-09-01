Components.utils.import("resource://socialite/socialite.jsm");

var SocialiteSiteProperties = {

  init: function() {
    this.site = window.arguments[0];
    
    var preferencesSocialite = document.getElementById("preferencesSocialite");
    this.prefSiteName = this.addPreference(preferencesSocialite, this.site, "siteName", "string");
    this.prefSiteURL = this.addPreference(preferencesSocialite, this.site, "siteURL", "string");
  },
  
  addPreference: function(preferences, site, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefName);
    preference.setAttribute("name", "extensions.socialite.sites."+site.siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    preferences.appendChild(preference);
    return preference;
  },
  
  onAccept: function(event) {
    this.site.siteName = this.prefSiteName.value;
    return true;
  }

};