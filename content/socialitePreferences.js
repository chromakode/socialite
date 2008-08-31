Components.utils.import("resource://socialite/socialite.jsm");

var siteListbox;

var SocialiteSitePreferences = {

  init: function() {
    siteListbox = document.getElementById("socialiteSiteListbox"); 
    Socialite.sites.siteList.forEach(function(site, index, array) {
      var newItem = document.createElement("listitem");
      newItem.value = site;
      
      var siteCell = document.createElement("listcell");
      siteCell.setAttribute("class", "listcell-iconic");
      siteCell.setAttribute("label", site.siteName);
      siteCell.setAttribute("image", site.getIconURI());
      newItem.appendChild(siteCell);
      
      var urlCell = document.createElement("listcell");
      urlCell.setAttribute("label", site.siteURL);
      newItem.appendChild(urlCell);
      
      siteListbox.appendChild(newItem);
    });
  },

  siteAdd: function(event) {
    
  },
  
  siteProperties: function(event) {
    var item = siteListbox.selectedItem
    var site = item.value;
    document.documentElement.openSubDialog("chrome://socialite/content/socialiteSiteProperties.xul", "", site)
  },
  
  siteRemove: function(event) {
    var item = siteListbox.selectedItem
    var site = item.value;
    Socialite.sites.deleteSite(site);
    Socialite.sites.saveConfiguredSites();
    siteListbox.removeChild(item);
  }

};
