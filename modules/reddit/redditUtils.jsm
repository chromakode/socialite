var EXPORTED_SYMBOLS = ["subredditSort"];

/**
 * Sort subreddits in the "Asciibetical" ordering, with the "reddit.com"
 * subreddit first, as seen in the submit page dropdown.
 * 
 * @param a
 * @param b
 * @return
 */
function subredditSort(a, b) {
  if (a.data.url == "/r/reddit.com/") {
    return -1;
  } else if (b.data.url == "/r/reddit.com/") {
    return 1;
  } else {
    if (a.data.url < b.data.url) {
      return -1;
    } else if (a.data.url > b.data.url) {
      return 1;
    } else {
      return 0;
    }
  }
}