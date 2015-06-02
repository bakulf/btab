/* See license.txt for terms of usage */

let Controller = {
  _filter: null,
  _search: null,
  _searchTimeout: null,

  _data: null,
  _activeURL: null,

  init: function() {
    this._filter = document.getElementById('filter');

    this._search = document.getElementById('search');
    this._search.onkeypress = function() {
      this.searchChanged();
    }.bind(this);

    document.getElementById('settingsForm').onsubmit = function() {
      return this.settingsSave();
    }.bind(this);

    document.getElementById('settingsAnchor').onclick = function() {
      this.settings();
      return false;
    }.bind(this);

    document.getElementById('titleAnchor').onclick = function() {
      this._activeURL = null;
      this.refreshDataNeeded();
      return false;
    }.bind(this);

    self.port.on('refreshData', function(aData) {
      this._data = aData.data;

      if (aData.activeURL) {
        this._activeURL = aData.activeURL;
      }

      this.refreshDataNeeded();
    }.bind(this));

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState == 'visible') {
        self.port.emit('dataNeeded');
      }
    }.bind(this));

    self.port.emit('dataNeeded');
  },

  settingsValidation: function() {
    if (this._filter.value.indexOf('http://') != 0 &&
        this._filter.value.indexOf('https://') != 0) {
      $('#filterAlert').show();
      return false;
    }

    return true;
  },

  searchChanged: function() {
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }

    this._searchTimeout = setTimeout(function() {
      this.refreshDataNeeded();
    }.bind(this), 300);
  },

  settings: function() {
    $('#filterAlert').hide();
    $('#settingsModal').foundation('reveal', 'open');

    $(document).on('closed.fndtn.reveal', '[data-reveal]', function() {
      if (!this.settingsSave()) {
        this.settings();
        $('#filterAlert').show();
      }
    }.bind(this));
  },

  settingsSave: function() {
    if (!this.settingsValidation()) {
      return false;
    }

    self.port.emit('filterChanged', this._filter.value);
    return true;
  },

  refreshDataNeeded: function() {
    if (this._data.match != '') {
      this._filter.value = this._data.match
    } else {
      this.settings();
      return;
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

    let pages = this.filterPages();

    if (this._activeURL) {
      this.showListAndPage(pages, container);
      return;
    }

    this.showGrid(pages, container);
  },

  filterPages: function() {
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

    return pages;
  },

  showGrid: function(aPages, aContainer) {
    if (aPages.length == 0) {
      let h3 = document.createElement('h3');
      h3.appendChild(document.createTextNode('No results found'));
      aContainer.appendChild(h3);
      return;
    }

    let row;
    for (let i = 0; i < aPages.length; ++i) {
      if (!(i % 4)) {
        row = null;
      }

      if (!row) {
        row = document.createElement('div');
        row.setAttribute('class', 'row');
        aContainer.appendChild(row);
      }

      let page = this.createPage(aPages[i]);
      row.appendChild(page);
    }
  },

  showListAndPage: function(aPages, aContainer) {
    let mainRow = document.createElement('div');
    mainRow.setAttribute('class', 'row');
    aContainer.appendChild(mainRow);

    let list = document.createElement('div');
    list.setAttribute('class', 'row span3');
    mainRow.appendChild(list);

    let page = document.createElement('div');
    page.setAttribute('class', 'row span9');
    mainRow.appendChild(page);

    let iframe = document.createElement('iframe');
    iframe.setAttribute('src', this._activeURL);
    page.appendChild(iframe);

    if (aPages.length == 0) {
      let h3 = document.createElement('h3');
      h3.appendChild(document.createTextNode('No results found'));
      list.appendChild(h3);
    }

    // TODO: scroll to the right position!
    // TODO: activate the correct one
    for (let i = 0; i < aPages.length; ++i) {
      let row = document.createElement('div');
      row.setAttribute('class', 'row');
      list.appendChild(row);

      let page = this.createPage(aPages[i]);
      row.appendChild(page);
    }
  },

  createPage: function(aPage) {
    let div = document.createElement('div');
    div.setAttribute('class', 'large-3');

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
    this._activeURL = aPage.url;
    this.refreshDataNeeded();
  }
};

Controller.init();
