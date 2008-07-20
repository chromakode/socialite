logger = Components.utils.import("resource://socialite/utils/log.jsm");
Components.utils.import("resource://socialite/utils/action/action.jsm");
Components.utils.import("resource://socialite/utils/hitch.jsm");
Components.utils.import("resource://socialite/reddit/authentication.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");

var EXPORTED_SYMBOLS = ["Reddit"];

function Reddit(sitename, site) {
  this.sitename = sitename;
  this.site = site;
  
  this.auth = null;
  this.API = new RedditAPI(this);
  this.bookmarkletAPI = new BookmarkletAPI(this);
  
  this.authenticate = Action("reddit.authenticate", hitchThis(this, function(action) {
    (new getAuthHash(
      hitchThis(this, function success(auth) {
        this.auth = auth;
        action.success(auth);
      }),
      function failure() { action.failure(); }
    )).perform(this.site);
  }));
}
