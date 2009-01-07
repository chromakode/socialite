Components.utils.import("resource://socialite/socialite.jsm");
logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["SocialiteMigration"];

let versionCompare = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                        .getService(Components.interfaces.nsIVersionComparator)
                                        .compare;

let extensionManager = Components.classes["@mozilla.org/extensions/manager;1"]
                                           .getService(Components.interfaces.nsIExtensionManager);

let EXTENSION_ID = "socialite@chromakode";

var SocialiteMigration = {
  perform: function() {  
    let currentVersion = extensionManager.getItemForID(EXTENSION_ID).version;
    
    let lastVersion;
    if (Socialite.preferences.prefHasUserValue("lastVersion")) {
      lastVersion = Socialite.preferences.getCharPref("lastVersion");
    } else {
      lastVersion = "0";
    }
    
    if (lastVersion != currentVersion) {
      logger.log("migration", "Detected new version of Socialite installed (old: " + lastVersion + " new: " + currentVersion + ")")
      
      if (versionCompare(lastVersion, "1.2.4") < 0) {
        if (Socialite.preferences.prefHasUserValue("persistmode")) {
          logger.log("migration", "Migrating persistmode preference (renamed to persistMode)")
          
          let oldValue = Socialite.preferences.getIntPref("persistmode");
          Socialite.preferences.setIntPref("persistMode", oldValue);
          Socialite.preferences.clearUserPref("persistmode");
        }
      }
      
      // Update the record of the last version seen
      Socialite.preferences.setCharPref("lastVersion", currentVersion); 
    }
  }
};