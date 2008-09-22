var EXPORTED_SYMBOLS = ["insertSorted", "addSorted", "insertListboxSorted"];

function insertSorted(insertElement, nodeList, compareFunc) {
  let i, curElement;
  for (i=0; i<nodeList.length; i++) {
    curElement = nodeList[i];
    
    // Iterate until the current element is greater than the element to insert
    if (compareFunc(insertElement, curElement) < 0) {
      break;
    }
  }
  
  let parentElement = curElement.parentNode;
  if (i == nodeList.length) {
    // Insert after the last node
    parentElement.insertBefore(insertElement, curElement.nextSibling);
  } else {
    parentElement.insertBefore(insertElement, curElement);
  }
}

function addSorted(insertElement, parentElement, compareFunc) {
  // Listbox elements are annoying because listhead and listcols are siblings to the list items.
  if (parentElement.hasChildNodes()) {
    insertSorted(insertElement, parentElement.childNodes, compareFunc);
  } else {
    parentElement.appendChild(insertElement);
  }
}

function insertListboxSorted(insertElement, listbox, compareFunc) {
  // Listbox elements are annoying because listhead and listcols are siblings to the list items.
  if (listbox.getRowCount() == 0) {
    listbox.appendChild(insertElement);
  } else {
    insertSorted(insertElement, listbox.getElementsByTagName("listitem"), compareFunc);
  }
}