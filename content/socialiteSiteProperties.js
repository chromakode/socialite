Components.utils.import("resource://socialite/socialite.jsm");
Components.utils.import("resource://socialite/site.jsm");

var SocialiteSiteProperties = {

  init: function SSProps_init() {
  
    this.prefWindow = document.getElementById("socialiteSiteProperties");
    this.buttonAccept = this.prefWindow._buttons.accept;
  
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
    
    this.prefSiteName = this.addSitePreference("prefSiteName", "siteName", "string");
    this.prefSiteURL = this.addSitePreference("prefSiteURL", "siteURL", "string");
    
    // Site class dropdown menu initialization (populate)
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
       
    // Handler to update preferences pane for site class
    this.boxSiteProperties = document.getElementById("boxSiteProperties");
    buttonSiteClass.addEventListener("ValueChange", function(event) {
      var container = SocialiteSiteProperties.boxSiteProperties;
      
      // Remove old pane
      if (container.hasChildNodes()) {
        container.removeChild(container.firstChild);
      }
      
      // Add new pane
      var siteClassID = buttonSiteClass.selectedItem.value;
      var siteClass = siteClassRegistry.getClass(siteClassID);
      var pane = siteClass.prototype.createPreferencesUI(document, SocialiteSiteProperties);
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
    this.setSampleValue(this.textboxSiteName, "Example");
    this.setSampleValue(this.textboxSiteURL, "http://www.example.com");
    this.validate();
  },
  
  addSitePreference: function SSProps_addSitePreference(prefID, prefName, prefType) {
    var preference = document.createElement("preference");
    preference.setAttribute("id", prefID);
    preference.setAttribute("name", "extensions.socialite.sites."+this.siteID+"."+prefName);
    preference.setAttribute("type", prefType);    
    this.preferences.appendChild(preference);
    return preference;
  },
  
  setSampleValue: function SSProps_setSampleValue(element, value) {
    function setupSampleValue(element, value) {
      if (element.value == "") {
        // We'll create a span to stick inside the element instead of modifying the value, which is associated with a preference.
        var spanSample = document.createElement("span");
        spanSample.setAttribute("class", "socialite-sample-input");
        spanSample.textContent = value;
        
        element.appendChild(spanSample);    
    
        function clearSample() {
          element.removeChild(spanSample);
          element.removeEventListener("focus", clearSample, false);
        };
        element.addEventListener("focus", clearSample, false);
        
        // When the span is clicked on, we must focus the textbox manually.
        spanSample.addEventListener("click", function() {
          element.focus();
        }, false);
      }
    }
    
    // Re-add the sample text upon loss of focus
    element.addEventListener("blur", function() {
      setupSampleValue(element, value);
    }, false);
    
    // Initial sample value setup
    setupSampleValue(element, value);
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
  },
  
  validate: function SSProps_validate(event) {
    this.buttonAccept.disabled = ((this.textboxSiteName.value == "") || (this.textboxSiteURL.value == "")); 
  }

};