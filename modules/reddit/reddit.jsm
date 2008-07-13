Components.utils.import("resource://socialite/debug.jsm");
Components.utils.import("resource://socialite/reddit/redditAPI.jsm");
Components.utils.import("resource://socialite/reddit/bookmarkletAPI.jsm");

var EXPORTED_SYMBOLS = ["Reddit"];

function Reddit(site, sitename) {
  this.site = site;
  this.sitename = sitename;
  
  this.API = new RedditAPI(this);
  this.bookmarkletAPI = new BookmarkletAPI(this);
}
