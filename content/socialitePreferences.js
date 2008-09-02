Components.utils.import("resource://socialite/socialite.jsm");

var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                       .getService(Components.interfaces.nsIPromptService); 

var SocialiteSitePreferences = {

  init: function SSPrefs_init() {
    this.strings = document.getElementById("socialitePreferencesStrings");
    this.siteListbox = document.getElementById("socialiteSiteListbox"); 
    this.siteListbox.addSite = function(site) {
      var newItem = document.createElement("listitem");
      newItem.value = site;
      
      var siteCell = document.createElement("listcell");
      newItem.appendChild(siteCell);
      var urlCell = document.createElement("listcell");
      newItem.appendChild(urlCell);
      
      newItem.update = function() {
        siteCell.setAttribute("class", "listcell-iconic");
        siteCell.setAttribute("label", site.siteName);
        siteCell.setAttribute("image", site.getIconURI());
        urlCell.setAttribute("label", site.siteURL);
      };
      newItem.update();
      
      SocialiteSitePreferences.siteListbox.appendChild(newItem);
    }
    
    for each (var site in Socialite.sites.byID) {
      this.siteListbox.addSite(site);
    };
  },

  siteAdd: function SSPrefs_siteAdd(event) {
    var item = SocialiteSitePreferences.siteListbox.selectedItem;
    if (item) {
      var dialog = document.documentElement.openSubDialog("chrome://socialite/content/socialiteSiteProperties.xul", "", {
        isNewSite: true
      });
    }
  },
  
  siteProperties: function SSPrefs_siteProperties(event) {
    var item = SocialiteSitePreferences.siteListbox.selectedItem;
    if (item) {
      var site = item.value;
      var dialog = document.documentElement.openSubDialog("chrome://socialite/content/socialiteSiteProperties.xul", "", {
        isNewSite: false, 
        site: site
      });
      item.update();
    }
  },
  
  siteRemove: function SSPrefs_siteRemove(event) {
    var item = SocialiteSitePreferences.siteListbox.selectedItem;
    if (item) {
      var site = item.value;
      
      var confirmed = promptService.confirm(window, 
          SocialiteSitePreferences.strings.getString("removeSiteConfirm.title"), 
          SocialiteSitePreferences.strings.getFormattedString("removeSiteConfirm.message", [ site.siteName ])
      );
      
      if (confirmed) {      
        Socialite.sites.deleteSite(site);
        Socialite.sites.saveConfiguredSites();
        SocialiteSitePreferences.siteListbox.removeChild(item);
      }
    }
  }

};
