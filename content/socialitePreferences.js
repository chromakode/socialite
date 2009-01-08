let modules = {};
let importModule = function(name) Components.utils.import(name, modules);

let Socialite = importModule("resource://socialite/socialite.jsm").Socialite;
let faviconWatch = importModule("resource://socialite/utils/faviconWatch.jsm");
let domUtils = importModule("resource://socialite/utils/domUtils.jsm");

let observerService = Components.classes["@mozilla.org/observer-service;1"]
                                         .getService(Components.interfaces.nsIObserverService);

let promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                       .getService(Components.interfaces.nsIPromptService); 

var SocialiteSitePreferences = {

  load: function SSPrefs_load() {
    this.strings = document.getElementById("socialitePreferencesStrings");
    this.siteListbox = document.getElementById("socialiteSiteListbox"); 
    this.siteListbox.addSite = function(site) {
      let newItem = document.createElement("listitem");
      newItem.value = site.siteID;
      
      let siteCell = document.createElement("listcell");
      newItem.appendChild(siteCell);
      let urlCell = document.createElement("listcell");
      newItem.appendChild(urlCell);
      
      newItem.update = function() {
        siteCell.setAttribute("class", "listcell-iconic");
        
        if (siteCell.getAttribute("label") != site.siteName) {
          siteCell.setAttribute("label", site.siteName);
          domUtils.insertListboxSorted(newItem, SocialiteSitePreferences.siteListbox, function(item1, item2) {
            let label1 = item1.firstChild.getAttribute("label"); 
            let label2 = item2.firstChild.getAttribute("label"); 
            return label1.localeCompare(label2);
          });
        }
        
        if (newItem.removeFaviconWatch) { newItem.removeFaviconWatch(); }
        newItem.removeFaviconWatch = faviconWatch.useFaviconAsAttribute(siteCell, "image", site.siteURL);
        
        urlCell.setAttribute("label", site.siteURL);
      };
      
      newItem.update();
    }
    this.siteListbox.getItemBySiteID = function(siteID) {
      for (let i=0; i<this.childNodes.length; i++) {
        if (this.childNodes[i].value == siteID)
          return this.childNodes[i];
      }
      return null;
    }
    this.siteListbox.removeSite = function(siteID) {
      let item = this.getItemBySiteID(siteID);
      if (item) {
        if (item.removeFaviconWatch) { item.removeFaviconWatch(); }
        this.removeChild(item);
      }
    }
    
    // Populate the list
    for (let [siteID, site] in Socialite.sites) {
      this.siteListbox.addSite(site);
    }
    
    // Set the minimum of the refresh interval textbox
    let refreshIntervalTextbox = document.getElementById("refreshIntervalTextbox");
    refreshIntervalTextbox.min = Math.ceil(Socialite.globals.MINIMUM_REFRESH_INTERVAL / 60);
    
    observerService.addObserver(this.siteObserver, "socialite-load-site", false);
    observerService.addObserver(this.siteObserver, "socialite-unload-site", false);
  },
  
  unload: function SSPrefs_unload() {
    Array.map(this.siteListbox.childNodes, function(item) {
      if (item.removeFaviconWatch) { item.removeFaviconWatch(); }
    });
    
    observerService.removeObserver(this.siteObserver, "socialite-load-site");
    observerService.removeObserver(this.siteObserver, "socialite-unload-site");
  },
  
  siteObserver: {
    observe: function(subject, topic, data) {
      if (topic == "socialite-load-site") {
        SocialiteSitePreferences.siteListbox.addSite(Socialite.sites.byID[data]);
      } else if (topic == "socialite-unload-site") {
        SocialiteSitePreferences.siteListbox.removeSite(data);
      }
    }
  },

  siteAdd: function SSPrefs_siteAdd(event) {
    let newSiteInfo = {};
    let dialog = document.documentElement.openSubDialog("chrome://socialite/content/socialiteSiteProperties.xul", "", {
      isNewSite: true,
      newSiteInfo: newSiteInfo
    });
    
    this.site = Socialite.sites.createSite(newSiteInfo["siteClassID"], newSiteInfo["siteID"], newSiteInfo["siteName"], newSiteInfo["siteURL"])
  },
  
  siteProperties: function SSPrefs_siteProperties(event) {
    let item = this.siteListbox.selectedItem;
    if (item) {
      let site = Socialite.sites.byID[item.value];
      let dialog = document.documentElement.openSubDialog("chrome://socialite/content/socialiteSiteProperties.xul", "", {
        isNewSite: false, 
        site: site
      });
      item.update();
    }
  },
  
  siteRemove: function SSPrefs_siteRemove(event) {
    let item = this.siteListbox.selectedItem;
    if (item) {
      let site = Socialite.sites.byID[item.value];
      
      let confirmed = promptService.confirm(window,
          this.strings.getString("removeSiteConfirm.title"),
          this.strings.getFormattedString("removeSiteConfirm.message", [ site.siteName ])
      );
      
      if (confirmed) {      
        Socialite.sites.deleteSite(site);
        Socialite.sites.saveConfiguredSites();
      }
    }
  },
  
  refreshIntervalEnabledFromPreference: function SSPrefs_refreshIntervalEnabledFromPreference() {
    let pref = document.getElementById("prefRefreshIntervalEnabled");
    let textbox = document.getElementById("refreshIntervalTextbox");
    textbox.disabled = !pref.value;
    return pref.value;
  },
  
  refreshIntervalFromPreference: function SSPrefs_refreshIntervalFromPreference() {
    let pref = document.getElementById("prefRefreshInterval");
    let seconds = pref.value;
    return Math.ceil(seconds / 60);
  },
  
  refreshIntervalToPreference: function SSPrefs_refreshIntervalToPreference() {
    let textbox = document.getElementById("refreshIntervalTextbox");
    let minutes = textbox.valueNumber;
    return minutes*60;
  }

};
