pref("extensions.socialite.debug", false);
pref("extensions.socialite.debugInErrorConsole", false);

// Global preferences
pref("extensions.socialite.showSiteUrlBarIcons", true);
pref("extensions.socialite.showSiteMenuItems", true);
pref("extensions.socialite.consolidateSites", false);
pref("extensions.socialite.persistmode", 2);

// Sites
pref("extensions.socialite.sites", '["reddit"]');

// Default reddit site
pref("extensions.socialite.sites.reddit.siteClassID", "RedditSite");
pref("extensions.socialite.sites.reddit.siteName", "reddit");
pref("extensions.socialite.sites.reddit.siteURL", "http://www.reddit.com/");

pref("extensions.socialite.sites.reddit.RedditSite.compactDisplay", true);
pref("extensions.socialite.sites.reddit.RedditSite.showScore", true);
pref("extensions.socialite.sites.reddit.RedditSite.showSubreddit", true);
pref("extensions.socialite.sites.reddit.RedditSite.showComments", true);
pref("extensions.socialite.sites.reddit.RedditSite.showSave", true);
pref("extensions.socialite.sites.reddit.RedditSite.showHide", false);
pref("extensions.socialite.sites.reddit.RedditSite.showRandom", false);
pref("extensions.socialite.sites.reddit.RedditSite.showProfile", false);
pref("extensions.socialite.sites.reddit.RedditSite.watchRedditLinks", true);
