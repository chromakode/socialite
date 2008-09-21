var IOService = Components.classes["@mozilla.org/network/io-service;1"]
                .getService(Components.interfaces.nsIIOService);

var faviconService = Components.classes["@mozilla.org/browser/favicon-service;1"]
                                        .getService(Components.interfaces.nsIFaviconService);

var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"]
                     .getService(Components.interfaces.nsINavHistoryService);

var EXPORTED_SYMBOLS = ["setFavicon", "getFavicon", "addFaviconWatch", "removeFaviconWatch", "useFaviconAsAttribute"];

var watches = {};

function setFavicon(siteURL, faviconURL, skipLoad) {
  var siteURI = IOService.newURI(siteURL, null, null);
  var faviconURI = IOService.newURI(faviconURL, null, null);
  
  if (!skipLoad) {
    faviconService.setAndLoadFaviconForPage(siteURI, faviconURI, false);
  }
  return faviconService.getFaviconImageForPage(siteURI).spec;
}

function getFavicon(siteURL) {
  var siteURI = IOService.newURI(siteURL, null, null);
  return faviconService.getFaviconImageForPage(siteURI).spec;
}

function addFaviconWatch(siteURL, changedCallback) {
  var siteURI = IOService.newURI(siteURL, null, null);
  
  // Add the watch
  if (!watches[siteURI.spec]) {
    watches[siteURI.spec] = [];
  }
  watches[siteURI.spec].push(changedCallback);
  
  function removeFunction() {
    removeFaviconWatch(siteURL, changedCallback);
  }
  return removeFunction;
}

function removeFaviconWatch(siteURL, changedCallback) {
  var siteURI = IOService.newURI(siteURL, null, null);
  
  if (watches[siteURI.spec]) {
    // Find the specific callback and remove it
    var index = watches[siteURI.spec].indexOf(changedCallback);
    if (index != -1) {
      watches[siteURI.spec].splice(index, 1);
    }
    
    // Delete the entry if the list is empty
    if (watches[siteURI.spec].length == 0) {
       delete watches[siteURI.spec];
    }
  }
}

function useFaviconAsAttribute(element, attributeName, siteURL) {
  function update(faviconURL) {
    element.setAttribute(attributeName, faviconURL);
  }
  
  var removeFunction = addFaviconWatch(siteURL, update);
  update(getFavicon(siteURL));
  return removeFunction;
}

historyObserver = {
  onPageChanged: function(URI, what, value) {
    if (what == Components.interfaces.nsINavHistoryObserver.ATTRIBUTE_FAVICON) {
      // Notify all watches that the favicon has changed, passing the new URI
      var watchlist = watches[URI.spec];
      if (watchlist) {
        for (var i=0; i<watchlist.length; i++) {
          watchlist[i](value);
        }
      }
    }
  },

  onBeginUpdateBatch: function() {},
  onEndUpdateBatch: function() {},
  onVisit: function() {},
  onTitleChanged: function() {},
  onDeleteURI: function() {},
  onClearHistory: function() {},
  onPageExpired: function() {},
}

// This module persists for the lifetime of the app, so don't worry about removing the observer.
historyService.addObserver(historyObserver, false);