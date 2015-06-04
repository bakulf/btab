/* See license.txt for terms of usage */

const DEFAULT_ICONURL = "TODO.png";

let Controller = {
  _filterURL: null,
  _filterName: null,
  _filterMaxPages: 10,

  _search: null,
  _searchTimeout: null,

  _data: null,
  _activeURL: null,

  _pages: [
    { name: 'settingsPage',
      init: function(aObj) {} },
    { name: 'gridPageNoResult',
      init: function(aObj) { $("#searchGridResult").text(aObj._search.value); } },
    { name: 'gridPageNoTab',
      init: function(aObj) {} },
    { name: 'gridPageRest',
      init: function(aObj) { aObj.gridPageRestInit(); } },
    { name: 'listPage',
      init: function(aObj) { aObj.listPageInit(); } } ],
  _currentPage: null,

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
            let filter = document.getElementById("filterURL");
            return filter.value.indexOf('http://') == 0 ||
                   filter.value.indexOf('https://') == 0;
          }
        },
        '#filterMaxPages': {
          required: true,
          message: 'It has to be higher then 0',
          test: function() {
            let filter = document.getElementById("filterMaxPages");
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

    self.port.on('iconReady', function(aData) {
      this.iconReady(aData.url, aData.iconUrl);
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

  openURL: function(aURL) {
    this._activeURL = aURL;
    if (this._currentPage != 'listPage') {
      this.listPage();
      return;
    }

    this.updateBrowserController();
  },

  // Pages --------------------------------------------------------------------

  showPage: function(aPage) {
    for (let i = 0; i < this._pages.length; ++i) {
      if (aPage == this._pages[i].name) {
        this._currentPage = this._pages[i].name;
        $("#" + this._pages[i].name).show();
        this._pages[i].init(this);
      } else {
        $("#" + this._pages[i].name).hide();
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

  gridPage: function() {
    if (this._data.pages.length == 0) {
      this.showPage('gridPageNoTab');
      return;
    }

    if (this._filteredPages.length == 0) {
      this.showPage('gridPageNoResult');
      return;
    }

    this.showPage('gridPageRest');
  },

  gridPageRestInit: function() {
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

    for (let i = 0; i < this._filteredPages.length; ++i) {
      let page = this.createPage(this._filteredPages[i]);

      let div = document.createElement('div');
      div.setAttribute('class', 'large-3 columns end');
      div.appendChild(page);

      container.appendChild(div);
    }
  },

  listPageInit: function() {
    let container = document.getElementById('listPageList');
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

    for (let i = 0; i < this._filteredPages.length; ++i) {
      let page = this.createPage(this._filteredPages[i]);
      container.appendChild(page);
    }

    this.updateBrowserController();
  },

  listPage: function(aPartial) {
    if (this._data.pages.length == 0) {
      dump("BTAB listPage: This seems a bug!\n");
      this.mainPage();
      return;
    }

    this.showPage('listPage');
  },

  // UI callbacks -------------------------------------------------------------

  searchChanged: function() {
    if (this._searchTimeout) {
      clearTimeout(this._searchTimeout);
    }

    this._searchTimeout = setTimeout(function() {
      $('.button-search').toggleClass('icon-search').toggleClass('icon-repeat');
      this.refreshDataNeeded();
    }.bind(this), 300);
  },

  settingsSave: function() {
    this.updateTitle();
    self.port.emit('filterChanged', { url: this._filterURL.value,
                                      name: this._filterName.value,
                                      maxPages: parseInt(this._filterMaxPages.value) });
    this.mainPage();
  },

  urlChanged: function(aOld, aNew) {
    self.port.emit('urlChanged', { oldURL: aOld, newURL: aNew });

    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aOld) {
        this._data.pages[i].url = aNew;
        break;
      }
    }

    $(".single-item").each(function() {
      if ($(this).attr("data-url") == aOld) {
        $(this).attr("data-url", aNew);
        // What about duplicates?!?
      }
    });

    if (aOld == this._activeURL) {
      this._activeURL = aNew;
      this.updateBrowserController();
    }
  },

  iconChanged: function(aUrl, aIconUrl) {
    self.port.emit('iconChanged', { url: aUrl, iconUrl: aIconUrl });

    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages[i].iconUrl = aIconUrl;
        break;
      }
    }

    $(".single-item").each(function() {
      if ($(this).attr("data-url") == aUrl) {
        $(this).find('img').attr('src', aIconUrl);
      }
    });
  },

  titleChanged: function(aUrl, aTitle) {
    self.port.emit('titleChanged', { url: aUrl, title: aTitle });

    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages[i].title = aTitle;
        break;
      }
    }

    $(".single-item").each(function() {
      if ($(this).attr("data-url") == aUrl) {
        $(this).find('.single-item-title').text(aTitle);
      }
    });
  },

  closeURL: function(aUrl) {
    self.port.emit('closeURL', aUrl);
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages.splice(i, 1);
        break;
      }
    }

    $(".single-item").each(function() {
      if ($(this).attr("data-url") == aUrl) {
        $(this).remove();
      }
    });

    $("iframe").each(function() {
      if ($(this).attr('src') == aUrl) {
        $(this).remove();
      }
    });

    if (this._activeURL == aUrl) {
      this.mainPage();
    }
  },

  loadingStart: function(aIframe) {
    $("#pageReload").addClass('icon-repeat');
  },

  loadingEnd: function(aIframe) {
    $("#pageReload").removeClass('icon-repeat');
  },

  maybeVisited: function() {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == this._activeURL) {
        if (!this._data.pages[i].visited) {
          this._data.pages[i].visited = true;

          let url = this._activeURL;
          $(".single-item").each(function() {
            if ($(this).attr("data-url") == url) {
              $(this).removeClass('unvisited');
            }
          });

          self.port.emit('urlVisited', this._activeURL);
        }
        break;
      }
    }
  },

  // UI methods ---------------------------------------------------------------

  updateTitle: function() {
    $("#filterTitleName").text(this._filterName.value);
    $("title").text("B:Tab - " + this._filterName.value);
  },

  createIframe: function() {
    let url = this._activeURL;
    let iframe = document.createElement('iframe');
    iframe.setAttribute('mozbrowser', true);

    iframe.addEventListener('mozbrowserlocationchange', function(a) {
      if (a.detail != url) {
        this.urlChanged(url, a.detail);
        url = a.detail;
        if (this._activeURL == url) {
          this._activeURL = a.detail;
          this.updateBrowserController();
        }
      }
    }.bind(this));

    iframe.addEventListener('mozbrowsericonchange', function(a) {
      this.iconChanged(url, a.detail.href);
    }.bind(this));

    iframe.addEventListener('mozbrowsertitlechange', function(a) {
      this.titleChanged(url, a.detail);
    }.bind(this));

    iframe.addEventListener('mozbrowserloadstart', function(a) {
      this.loadingStart(iframe);
    }.bind(this));

    iframe.addEventListener('mozbrowserloadend', function(a) {
      this.loadingEnd(iframe);
    }.bind(this));

    return iframe;
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
      iframe = this.createIframe();
      container.appendChild(iframe);
    }

    this.resize();

    if (iframe.src != this._activeURL) {
      iframe.src = this._activeURL;
    }

    while (container.children.length > parseInt(this._filterMaxPages.value)) {
      container.removeChild(container.firstChild);
    }

    this._iframe = iframe;
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
    this.updateBrowserController();
  },

  goForward: function() {
    let url = this.canGoForward();
    if (!url) {
      return;
    }

    this._activeURL = url;
    this.updateBrowserController();
  },

  goReload: function() {
    if (!this._iframe) {
      dump("BTAB goReaload: This seems a bug!\n");
      return;
    }

    this._iframe.reload();
  },

  createPage: function(aPage) {
    let item = document.createElement('div');
    item.setAttribute('class', 'single-item' + (aPage.visited ? '' : ' unvisited'));
    item.setAttribute('data-url', aPage.url);

    let title = document.createElement('h2');
    title.setAttribute('class', 'single-item-title');
    title.appendChild(document.createTextNode(aPage.title != "" ? aPage.title : aPage.url));
    item.appendChild(title);

    let ul = document.createElement('ul');
    ul.setAttribute('class', 'toolbar'); // TODO active
    item.appendChild(ul);

    let li = document.createElement('li');
    li.setAttribute('class', 'item icon-star');
    ul.appendChild(li);

    let img = document.createElement('img');
    img.setAttribute('src', aPage.iconUrl ? aPage.iconUrl : DEFAULT_ICONURL)
    item.appendChild(img);

    li.onclick = function() {
      // TODO
      return false;
    }.bind(this);

    li = document.createElement('li');
    li.setAttribute('class', 'item icon-trash');
    ul.appendChild(li);

    li.onclick = function(e) {
      this.closeURL(aPage.url);
      e.stopPropagation();
      return false;
    }.bind(this);

    item.onclick = function(e) {
      this.openURL(aPage.url);
      e.stopPropagation();
      return false;
    }.bind(this);

    return item;
  },

  resize: function() {
    // Just for the list page
    if (this._currentPage != 'listPage') {
      return;
    }

    let height_screen = $(window).height();
    let width_screen = $(window).width();
    $('.content-wrapper').css('height', height_screen - $('.content-wrapper').offset().top);
    $('#tabs').css('height', height_screen - $('#tabs').offset().top);
    $('iframe').css('width', width_screen - $('#iframe-content').offset().left);
    $('iframe').css('height', height_screen - $('#iframe-content').offset().top);
  },

  updateBrowserController: function() {
    this.maybeVisited();

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

  // Data received ------------------------------------------------------------

  refreshDataNeeded: function() {
    if (this._data.match == '' || this._data.name == '') {
      this.settings();
      return;
    }

    this._filterURL.value = this._data.match;
    this._filterName.value = this._data.name;
    this._filterMaxPages.value = this._data.maxPages;
    this.updateTitle();

    this.filterPages();

    if (this._activeURL) {
      this.listPage();
    } else {
      this.gridPage();
    }
  },

  iconReady: function(aUrl, aIconUrl) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages[i].iconUrl = aIconUrl;
      }
    }

    $(".single-item").each(function() {
      if ($(this).attr("data-url") == aUrl) {
        $(this).find('img').attr('src', aIconUrl);
      }
    });
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
              pages[i].url.indexOf(parts[p]) != -1) {
            tmp.push(pages[i]);
          }
        }

        pages = tmp;
      }
    }

    this._filteredPages = pages;
  },
};

Controller.init();
