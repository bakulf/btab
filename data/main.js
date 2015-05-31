/* See license.txt for terms of usage */

let Controller = {
  _filter: null,
  _search: null,
  _searchTimeout: null,

  _data: null,
  _activeURL: null,

  init: function() {
    this._filter = document.getElementById('filter');
    this._filter.onchange = function() {
      this.filterChanged();
    }.bind(this);

    this._search = document.getElementById('search');
    this._search.onkeypress = function() {
      this.searchChanged();
    }.bind(this);

    document.getElementById('settingsForm').onsubmit = function() {
      return this.filterChanged();
    }.bind(this);

    document.getElementById('settingsAnchor').onclick = function() {
      this.settings();
      return false;
    }.bind(this);

    self.port.on('refreshData', function(aData) {
      this._data = aData.data;

      if (aData.activeURL) {
        this._activeURL = aData.activeURL;
      }

      this.refreshDataReceived();
    }.bind(this));

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState == 'visible') {
        self.port.emit('dataNeeded');
      }
    }.bind(this));

    self.port.emit('dataNeeded');
  },

  filterChanged: function() {
    if (this._filter.value.indexOf('http://') != 0 &&
        this._filter.value.indexOf('https://') != 0) {
      $('#filterAlert').removeClass('hide');
      return false;
    }
    
    self.port.emit('filterChanged', this._filter.value);
    return true;
  },

  searchChanged: function() {
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }

    this._searchTimeout = setTimeout(function() {
      this.refreshDataReceived();
    }.bind(this), 300);
  },

  settings: function() {
    $('#filterAlert').addClass('hide');
    $('#settingsModal').modal({
      keyboard: false,
      backdrop: 'static'
    });
  },

  refreshDataReceived: function() {
    if (this._data.match != '') {
      this._filter.value = this._data.match
    } else {
      this.settings();
    }
  
    let container = document.getElementById('container');
    while(container.firstChild) {
      container.removeChild(container.firstChild);
    }
  
    if (this._data.pages.length == 0) {
      let h3 = document.createElement('h3');
      h3.appendChild(document.createTextNode('Open some patch matching the filter URL'));
      container.appendChild(h3);
      return;
    }
  
    let pages = this._data.pages;
    let search = this._search.value;
    if (search != '') {
      search = search.toLocaleLowerCase();

      let parts = search.split(' ');
      for (let p = 0; p < parts.length && pages.length; ++p) {
        if (!parts[p].length) {
          continue;
        }

        let tmp = [];
        for (let i = 0; i < pages.length; ++i) {
          if (pages[i].title.toLocaleLowerCase().indexOf(parts[p]) != -1 ||
              pages[i].url.indexOf(parts[i]) != -1) {
            tmp.push(pages[i]);
          }
        }

        pages = tmp;
      }
    }

    if (pages.length == 0) {
      let h3 = document.createElement('h3');
      h3.appendChild(document.createTextNode('No results found'));
      container.appendChild(h3);
    } else {
      let row;
      for (let i = 0; i < pages.length; ++i) {
        if (!(i % 4)) {
          row = null;
        }
        if (!row) {
          row = document.createElement('div');
          row.setAttribute('class', 'row');
          container.appendChild(row);
        }
    
        let page = this.createPage(pages[i]);
        row.appendChild(page);
      }
    }
  
    if (this._activeURL) {
      for (let i = 0; i < this._data.pages.length; ++i) {
        if (this._data.pages[i].url == this._activeURL) {
          this.showPage(this._data.pages[i]);
          break;
        }
      }
    }
  },

  createPage: function(aPage) {
    let div = document.createElement('div');
    div.setAttribute('class', 'span3 well well-small');
  
    let anchor = document.createElement('a');
    anchor.setAttribute('href', '');
    anchor.setAttribute('title', aPage.title);
    div.appendChild(anchor);
  
    let title = document.createElement('h4');
    title.appendChild(document.createTextNode(aPage.title));
    anchor.appendChild(title);
  
    let img = document.createElement('img');
    img.setAttribute('src', aPage.thumbnail);
    anchor.appendChild(img);
  
    let closeAnchor = document.createElement('a');
    closeAnchor.appendChild(document.createTextNode('close'));
    closeAnchor.setAttribute('href', '');
    closeAnchor.setAttribute('title', 'Close tab');
    div.appendChild(closeAnchor);
  
    anchor.onclick = function() {
      this.showPage(aPage);
      return false;
    }.bind(this);
  
    closeAnchor.onclick = function() {
      self.port.emit('closeURL', aPage.url);
      return false;
    }
  
    return div;
  },

  showPage: function(aPage) {
    // TODO
  },

  alert: function(aMsg) {
    $('#alertMessage').text(aMsg);
    $('#alertModal').modal('show');
  }
};

Controller.init();

