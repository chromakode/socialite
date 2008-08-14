logger = Components.utils.import("resource://socialite/utils/log.jsm");

var EXPORTED_SYMBOLS = ["SocialiteBar", "SocialiteBarContent"];

function SocialiteBar(doc, nbox) {
  this.document = doc;
  this.notificationBox = nbox;
}

SocialiteBar.prototype.buildNotification = function() {
  var notificationName = "socialite-header";

  this.notification = notificationBox.appendNotification(
    "",
    notificationName,
    "",
    notificationBox.PRIORITY_INFO_MEDIUM,
    []
  );
  
  var details = this.notification.boxObject.firstChild.getElementsByAttribute("anonid", "details")[0];
  var messageImage = this.document.getAnonymousElementByAttribute(this.notification, "anonid", "messageImage");
  
  this.box = this.document.createElement("hbox");
  this.box.setAttribute("align", "center");
  this.box.setAttribute("pack", "start");
  this.box.setAttribute("flex", "1");
  
  // Bye bye, annoying XBL bindings
  details.replaceChild(customHBox, messageImage);
  
  this.siteBox = this.document.createElement("hbox");
  this.siteBox.setAttribute("align", "center");
  
  this.siteIcon = this.document.createElement("image");
  this.siteBox.appendChild(this.siteIcon);
  
  this.siteLink = this.document.createElement("label");
  this.siteLink.setAttribute("id", "socialite_site_link");
  //this.siteLink.setAttribute("value", "");
  this.siteLink.setAttribute("class", "text-link socialite-sitelink");
  this.siteLink.setAttribute("hidden", !SocialitePrefs.getBoolPref("showlink"));
  this.siteBox.appendChild(this.siteLink);
  
  this.siteBox.addEventListener("click", hitchHandler(this, "siteLinkClicked"), false);
  
  customHBox.appendChild(this.siteBox);
  
  this.separator = this.document.createElement("separator");
  this.separator.setAttribute("width", "0px");
  this.separator.setAttribute("height", "18px");
  this.separator.setAttribute("orient", "vertical");
  this.separator.setAttribute("class", "socialite-separator");
  this.box.appendChild(this.separator);
  
  this.siteContentDeck = this.document.createElement("deck");
  this.siteContentDeck.setAttribute("align", "center");
  this.siteContentDeck.appendChild(siteDeck);
  this.box.appendChild(this.siteContentDeck);
  
  // Make the notification immortal -- we'll handle closing it.
  this.notification.persistence = -1;
  
  logger.log("SocialiteBar", "Notification box created");
}

SocialiteBar.prototype.addContent = function(barContent) {
  siteBox.appendChild(barContent.box); 
}

// ---

function SocialiteBarContent(doc) {
  this.document = doc;
}

SocialiteBarContent.prototype.build = function() {
  this.box = this.document.createElement("hbox");

  var spacer = this.document.createElement("spacer");
  // FIXME: Take up all available space. I know of no better way.
  spacer.setAttribute("flex", "9999");
  customHBox.appendChild(spacer);

}