Components.utils.import("resource://socialite/socialite.jsm");

var socialiteSitePreferences = {

  init: function() {
    var siteListbox = document.getElementById("socialiteSiteListbox"); 
    Socialite.sites.siteList.forEach(function(site, index, array) {
      var newItem = document.createElement("listitem");
      
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

  addSite: function(event) {
   
  },
  
  editSite: function(event) {
    
  },
  
  removeSite: function(event) {
    
  }

};
