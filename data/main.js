/* See license.txt for terms of usage */

let Controller = {
  _filterURL: null,
  _filterName: null,
  _filterMaxPages: 10,

  _search: null,
  _searchTimeout: null,

  _data: null,
  _activeURL: null,

  init: function() {
    this._filterURL = document.getElementById('filterURL');
    this._filterName = document.getElementById('filterName');
    this._filterMaxPages = document.getElementById('filterMaxPages');

    this._search = document.getElementById('search');
    this._search.onkeypress = function() {
      this.searchChanged();
    }.bind(this);

    document.getElementById("buttonSearch").onclick = function() {
      this.searchChanged();
      return false;
    }.bind(this);

    let that = this;
    $('#settingsForm').isHappy({
      fields: {
        '#filterName': {
          required: true,
          message: 'We need a name for this filter'
        },
        '#filterURL': {
          required: true,
          message: 'It has to be a valid filter URL',
          test: function() {
            var filter = document.getElementById("filterURL");
            return filter.value.indexOf('http://') == 0 ||
                   filter.value.indexOf('https://') == 0;
          }
        },
        '#filterMaxPages': {
          required: true,
          message: 'It has to be higher then 0',
          test: function() {
            var filter = document.getElementById("filterMaxPages");
            return parseInt(filter.value) > 0;
          }
        }
      },
      happy: function() {
        that.settingsSave();
        return false;
      }
    });

    document.getElementById('settingsAnchor').onclick = function() {
      this.settings();
      return false;
    }.bind(this);

    document.getElementById('titleAnchor').onclick = function() {
      this.mainPage();
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

    document.getElementById('pageBack').onclick = function() {
      this.goBack();
      return false;
    }.bind(this);

    document.getElementById('pageForward').onclick = function() {
      this.goForward();
      return false;
    }.bind(this);

    document.getElementById('pageReload').onclick = function() {
      this.goReload();
      return false;
    }.bind(this);

    $(window).resize(function() {
      this.resize();
    }.bind(this));

    self.port.emit('dataNeeded');
  },

  searchChanged: function() {
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }

    this._searchTimeout = setTimeout(function() {
      $('.button-search').toggleClass('icon-search').toggleClass('icon-repeat');
      this.refreshDataNeeded();
    }.bind(this), 300);
  },

  showPage: function(aPage) {
    let pages = [ 'settingsPage', 'gridPageNoResult', 'gridPageNoTab', 'gridPageRest', 'listPage' ];
    for (let i = 0; i < pages.length; ++i) {
      if (aPage == pages[i]) {
        $("#" + pages[i]).show();
      } else {
        $("#" + pages[i]).hide();
      }
    }
  },

  settings: function() {
    this.showPage('settingsPage');
  },

  mainPage: function() {
    this._activeURL = null;
    this.refreshDataNeeded();
  },

  updateTitle: function() {
    $("#filterTitleName").text(this._filterName.value);
    $("title").text("B:Tab - " + this._filterName.value);
  },

  settingsSave: function() {
    this.updateTitle();
    self.port.emit('filterChanged', { url: this._filterURL.value,
                                      name: this._filterName.value,
                                      maxPages: parseInt(this._filterMaxPages.value) });
    this.mainPage();
  },

  refreshDataNeeded: function() {
    if (this._data.match != '' || this._data.name != '') {
      this._filterURL.value = this._data.match;
      this._filterName.value = this._data.name;
      this._filterMaxPages.value = this._data.maxPages;
      this.updateTitle();
    } else {
      this.settings();
      return;
    }

    if (this._activeURL) {
      this.listPage(false);
    } else {
      this.gridPage();
    }
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

  gridPage: function() {
    if (this._data.pages.length == 0) {
      this.showPage('gridPageNoTab');
      return;
    }

    let pages = this.filterPages();
    if (pages.length == 0) {
      $("#searchGridResult").text(this._search.value);
      this.showPage('gridPageNoResult');
      return;
    }

    let container = document.getElementById('gridPageRest');
    while(container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (this._search.value != "") {
      let h = document.createElement('h3');
      h.setAttribute('class', 'search-query');
      h.appendChild(document.createTextNode('your searched for: '));
      container.appendChild(h);

      let em = document.createElement('em');
      em.appendChild(document.createTextNode(this._search.value));
      h.appendChild(em);
    } else {
      let h = document.createElement('h3');
      h.setAttribute('class', 'search-query');
      h.appendChild(document.createTextNode('Your tabs'));
      container.appendChild(h);
    }

    for (let i = 0; i < pages.length; ++i) {
      let page = this.createPage(pages[i]);

      let div = document.createElement('div');
      div.setAttribute('class', 'large-3 columns end');
      div.appendChild(page);

      container.appendChild(div);
    }

    this.showPage('gridPageRest');
  },

  showIframe: function() {
    let container = document.getElementById('iframe-content');

    let iframe;
    for (let i = 0; i < container.children.length; ++i) {
      if (container.children[i].src == this._activeURL) {
        $(container.children[i]).show();
        iframe = container.children[i];
      } else {
        $(container.children[i]).hide();
      }
    }

    if (!iframe) {
      iframe = document.createElement('iframe');
      container.appendChild(iframe);
    }

    this.resize();

    if (iframe.src != this._activeURL) {
      iframe.src = this._activeURL;
    }

    while (container.children.length > parseInt(this._filterMaxPages.value)) {
      container.removeChild(container.firstChild);
    }
  },

  listPage: function(aPartial) {
    if (this._data.pages.length == 0) {
      dump("BTAB: This seems a bug!\n");
      this.mainPage();
      return;
    }

    let visible = $("#listPage").is(":visible");
    this.showPage('listPage');
    this.updateListPage();

    if (!aPartial || !visible) {
      let container = document.getElementById('listPageList');
      while(container.firstChild) {
        container.removeChild(container.firstChild);
      }

      let pages = this.filterPages();

      if (this._search.value != "") {
        let h = document.createElement('h3');
        h.setAttribute('class', 'search-query');
        h.appendChild(document.createTextNode('your searched for: '));
        container.appendChild(h);

        let em = document.createElement('em');
        em.appendChild(document.createTextNode(this._search.value));
        h.appendChild(em);
      } else {
        let h = document.createElement('h3');
        h.setAttribute('class', 'search-query');
        h.appendChild(document.createTextNode('Your tabs'));
        container.appendChild(h);
      }

      for (let i = 0; i < pages.length; ++i) {
        let page = this.createPage(pages[i]);
        container.appendChild(page);
      }
    }
  },

  updateListPage: function() {
    this.showIframe();
    $("#pageURL").attr('value', this._activeURL);

    if (this.canGoBack()) {
      $("#pageBack").removeClass('disabled');
    } else {
      $("#pageBack").addClass('disabled');
    }

    if (this.canGoForward()) {
      $("#pageForward").removeClass('disabled');
    } else {
      $("#pageForward").addClass('disabled');
    }
  },

  resize: function() {
    // Just for the list page
    if (!$("#listPage").is(":visible")) {
      return;
    }

    var height_screen = $(window).height();
    var width_screen = $(window).width();
    $('.content-wrapper').css('height', height_screen - $('.content-wrapper').offset().top);
    $('#tabs').css('height', height_screen - $('#tabs').offset().top);
    $('iframe').css('width', width_screen - $('iframe').offset().left);
    $('iframe').css('height', height_screen - $('iframe').offset().top);
  },

  createPage: function(aPage) {
    let item = document.createElement('div');
    item.setAttribute('class', 'single-item');

    let title = document.createElement('h2');
    title.appendChild(document.createTextNode(aPage.title));
    item.appendChild(title);

    let ul = document.createElement('ul');
    ul.setAttribute('class', 'toolbar'); // TODO active
    item.appendChild(ul);

    let li = document.createElement('li');
    li.setAttribute('class', 'item icon-star');
    ul.appendChild(li);

    li.onclick = function() {
      // TODO
      return false;
    }.bind(this);

    li = document.createElement('li');
    li.setAttribute('class', 'item icon-trash');
    ul.appendChild(li);

    li.onclick = function(e) {
      self.port.emit('closeURL', aPage.url);
      e.stopPropagation();
      return false;
    }.bind(this);

    item.onclick = function(e) {
      this._activeURL = aPage.url;
      this.listPage(true);
      e.stopPropagation();
      return false;
    }.bind(this);

    return item;
  },

  canGoBack: function() {
    for (let i = 1; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == this._activeURL) {
        return this._data.pages[i - 1].url;
      }
    }
    return null;
  },

  canGoForward: function() {
    for (let i = 0; i < this._data.pages.length - 1; ++i) {
      if (this._data.pages[i].url == this._activeURL) {
        return this._data.pages[i + 1].url;
      }
    }
    return null;
  },

  goBack: function() {
    let url = this.canGoBack();
    if (!url) {
      return;
    }

    this._activeURL = url;
    this.updateListPage();
  },

  goForward: function() {
    let url = this.canGoForward();
    if (!url) {
      return;
    }

    this._activeURL = url;
    this.updateListPage();
  },

  goReload: function() {
    $("iframe").attr('src', this._activeURL);
  },
};

Controller.init();
