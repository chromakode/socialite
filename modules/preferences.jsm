var EXPORTED_SYMBOLS = ["SocialitePrefs"]

var SocialitePrefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService)
                    .getBranch("extensions.socialite.");
SocialitePrefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
