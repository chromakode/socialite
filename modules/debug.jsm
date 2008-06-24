Components.utils.import("resource://socialite/preferences.jsm");

var EXPORTED_SYMBOLS = ["debug_log"]

function debug_log(section, msg) {
  if (SocialitePrefs.getBoolPref("debug")) {
    if (SocialitePrefs.getBoolPref("debugInErrorConsole")) {
      const consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
      consoleService.logStringMessage("[Socialite] " + section + " -- " + msg + "\n");
    } else {
      dump("[Socialite] " + section + " -- " + msg + "\n");
    }
  }
}
