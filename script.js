function saveState() {
      var container = document.getElementById("container");
      var rows = container.getElementsByClassName("row");
      var state = [];
      
      for (var i = 0; i < rows.length; i++) {
        var inputs = rows[i].getElementsByTagName("input");
        var text1 = inputs[0].value;
        var text2 = inputs[1].value;
        state.push([text1, text2]);
      }
      
      localStorage.setItem("textboxState", JSON.stringify(state));
}

    function loadState() {
      var container = document.getElementById("container");
      var savedState = localStorage.getItem("textboxState");

      if (savedState) {
        var state = JSON.parse(savedState);

        for (var i = 0; i < state.length; i++) {
          var row = document.createElement("div");
          var rowId = "row"+i;
          row.className = "row";
          row.id=rowId;
          row.innerHTML = `
            <input type="text" name="textbox1[]" placeholder="Name" value="${state[i][0]}" oninput="saveState()">
            <input type="text" name="textbox2[]" placeholder="Value" value="${state[i][1]}" oninput="saveState()">
            <button id="copy">Copy</button>
            <button id="del">Delete</button>
          `;
          container.appendChild(row);
          var rowElem = document.querySelector('#'+rowId);
        rowElem.addEventListener('click', function(event) {
        if (event.target.matches('#copy')) {
            copyText(event.target.previousElementSibling);
        } else if (event.target.matches('#del')) {
            deleteRow(event.target.parentNode);
        }
        });
        }
      }
    }

    function addRow() {
      var container = document.getElementById("container");
      var rows = container.getElementsByClassName("row");
      var row = document.createElement("div");
      var rowId = "row"+rows.length;
      row.className = "row";
      row.id = rowId;
      row.innerHTML = `
        <input type="text" name="textbox1[]" placeholder="Name">
        <input type="text" name="textbox2[]" placeholder="Value">
        <button id="copy">Copy</button>
        <button id="del">Delete</button>
      `;
      container.appendChild(row);
      var descElement = document.querySelector('.desc');
        if (descElement) {
        descElement.style.display = 'none';
        }
      saveState();
      var rowElem = document.querySelector('#'+rowId);
      rowElem.addEventListener('click', function(event) {
        if (event.target.matches('#copy')) {
            copyText(event.target.previousElementSibling);
        } else if (event.target.matches('#del')) {
            deleteRow(event.target.parentNode);
        } 
        });
        var textboxes = rowElem.querySelectorAll('input[type="text"]');
        textboxes.forEach(function(textbox) {
            textbox.addEventListener('input', function(event) {
                saveState();
            });
          });     
    }

    function deleteRow(row) {
      var container = document.getElementById("container");
      container.removeChild(row);
      saveState();
    }

    function copyText(textbox) {
      var text = textbox.value;
      textbox.select();
      textbox.setSelectionRange(0, 99999);
      document.execCommand("copy");
    }
document.addEventListener('DOMContentLoaded', function() {
    loadState();
    var bodyElement = document.querySelector('body');
    bodyElement.addEventListener('load', function(event) {
        loadState();
     });
    var rowElem = document.querySelector('#addRow');
    rowElem.addEventListener('click', function(event) {
        addRow();
    });
    var textboxes = document.querySelectorAll('input[type="text"]');
    textboxes.forEach(function(textbox) {
        textbox.addEventListener('input', function(event) {
            saveState();
        });
    });   
});