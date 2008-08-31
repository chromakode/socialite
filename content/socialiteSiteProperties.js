Components.utils.import("resource://socialite/socialite.jsm");

var SocialiteSiteProperties = {

  init: function() {
    var site = window.arguments[0];
    
    var preferencesSocialite = document.getElementById("preferencesSocialite");
    this.addPreference(preferencesSocialite, site, "siteName", "string");
    this.addPreference(preferencesSocialite, site, "siteURL", "string");
  },
  
  addPreference: function(preferences, site, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefName);
    preference.setAttribute("name", "extensions.socialite.sites."+site.siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    preferences.appendChild(preference);
    return preference;
  },

};