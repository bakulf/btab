/* See license.txt for terms of usage */

// addon-SDK includes
let buttons = require('sdk/ui/button/action');
let {Cc, Ci, Cu} = require("chrome");
let { indexedDB } = require('sdk/indexed-db');
let self = require('sdk/self');
let tabs = require('sdk/tabs');
let { viewFor } = require("sdk/view/core");

Cu.import("resource://gre/modules/Services.jsm");

// Button
let button = buttons.ActionButton({
  id: 'B-button',
  label: 'Open B:Tab',
  icon: {
    '16': './img/icon-16.png',
    '32': './img/icon-32.png',
    '64': './img/icon-64.png'
  },
  onClick: function(aState) {
    sBTab.activate();
  }
});

// Main class - implementation
function BTab() {
  this.init();
}

BTab.prototype = {
  init: function() {
    this._loading = true;
    this.openDatabase(function() {
      this._loading = false;

      if (this._toActivate) {
        this.activate();
      }

      this.iterateTabs(true);

      tabs.on('ready', function(aTab) {
        if (aTab) {
          this.checkTab(aTab, true);
        }
      }.bind(this));
    }.bind(this));

    Services.prefs.setBoolPref("dom.mozBrowserFramesEnabled", true);
  },

  openDatabase: function(aCb) {
    let request = indexedDB.open("btab", "1");
    request.onupgradeneeded = function(e) {
      let db = e.target.result;
      db.createObjectStore("data");
    };

    request.onsuccess = function(e) {
      this._db = e.target.result;
      this.getData(aCb);
    }.bind(this);
  },

  getData: function(aCb) {
    let trans = this._db.transaction(["data"], "readonly");
    let store = trans.objectStore("data");
    let request = store.get("data");

    request.onsuccess = function(e) {
      if (e.target.result == undefined) {
        this._data = {
          match: '',
          name: '',
          maxPages: 10,
          pages: []
        };
      } else {
        this._data = e.target.result;
      }
    }.bind(this);

    trans.oncomplete = function() {
      aCb();
    }.bind(this);
  },

  saveData: function(aCb) {
    let trans = this._db.transaction(["data"], "readwrite");
    let store = trans.objectStore("data");
    let request = store.put(this._data, "data");

    trans.oncomplete = function() {
      if (aCb) aCb();
    }.bind(this);
  },

  activate: function() {
    if (this._loading) {
      this._toActivate = true;
      return;
    }

    if (this._tab) {
      this._tab.activate();
      return;
    }

    tabs.open({
      url: self.data.url('index.html'),
      onReady: function(aTab) {
        this._tab = aTab;
        this.activated();
      }.bind(this)
    });
  },

  activated: function() {
    this._tab.on('close', function() {
      this._tab = null;
    }.bind(this));

    this._worker = this._tab.attach({
      contentScriptFile: [ 'js/vendor/jquery.js',  'js/foundation.min.js', 'js/happy.js', 'main.js' ]
    });

    let principal = viewFor(this._tab.window).gBrowser.contentDocument.nodePrincipal;
    let secMan = Services.scriptSecurityManager;
    Services.perms.addFromPrincipal(principal, "browser", Ci.nsIPermissionManager.ALLOW_ACTION);
    Services.perms.addFromPrincipal(principal, "embed-apps", Ci.nsIPermissionManager.ALLOW_ACTION);

    this._worker.port.on('dataNeeded', function() {
      this.refreshData(null);
    }.bind(this));

    this._worker.port.on('filterChanged', function(aMsg) {
      this.filterChanged(aMsg);
    }.bind(this));

    this._worker.port.on('closeURL', function(aMsg) {
      this.closeURL(aMsg);
    }.bind(this));

    this._worker.port.on('starredURL', function(aMsg) {
      this.starredURL(aMsg.url, aMsg.starred);
    }.bind(this));

    this._worker.port.on('urlVisited', function(aMsg) {
      this.urlVisited(aMsg);
    }.bind(this));

    this._worker.port.on('titleChanged', function(aMsg) {
      this.titleChanged(aMsg.url, aMsg.title);
    }.bind(this));

    this._worker.port.on('iconChanged', function(aMsg) {
      this.iconChanged(aMsg.url, aMsg.iconUrl);
    }.bind(this));

    this._worker.port.on('urlChanged', function(aMsg) {
      this.urlChanged(aMsg.oldURL, aMsg.newURL);
    }.bind(this));
  },

  refreshData: function(aActiveURL) {
    this._worker.port.emit('refreshData', {
      data: this._data,
      activeURL: aActiveURL
    });
  },

  filterChanged: function(aFilter) {
    let oldMatch = this._data.match;

    this._data.match = aFilter.url;
    this._data.name = aFilter.name;
    this._data.maxPages = aFilter.maxPages;

    this.saveData(function() {
      if (oldMatch != aFilter.url) {
        let pages = this._data.pages;
        this._data.pages = [];

        this.iterateTabs(false);

        for (let i = pages.length - 1; i >= 0; --i) {
          tabs.open({ url: pages[i].url, inBackground: true });
        }
      }

      this.refreshData(null);
    }.bind(this));
  },

  closeURL: function(aURL) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aURL) {
        this._data.pages.splice(i, 1);
        this.saveData(null);
        break;
      }
    }
  },

  starredURL: function(aURL, aStarred) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aURL) {
        this._data.pages[i].starred = aStarred;
        this.saveData(null);
        break;
      }
    }
  },

  urlVisited: function(aURL) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aURL) {
        this._data.pages[i].visited = true;
        this.saveData(null);
        break;
      }
    }
  },

  titleChanged: function(aUrl, aTitle) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages[i].title = aTitle;
        this.saveData(null);
        break;
      }
    }
  },

  iconChanged: function(aUrl, aIconUrl) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aUrl) {
        this._data.pages[i].iconUrl = aIconUrl;
        this.saveData(null);
        break;
      }
    }
  },

  urlChanged: function(aOldUrl, aNewUrl) {
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aOldUrl) {
        this._data.pages[i].url = aNewUrl;
        this.saveData(null);
        break;
      }
    }
  },

  iterateTabs: function(aMaybeSelf) {
    for (let tab of tabs) {
      this.checkTab(tab, aMaybeSelf);
    }
  },

  checkSelfTab: function(aTab) {
    if (aTab.url != self.data.url('index.html')) {
      return false;
    }

    if (this._tab && this._tab != aTab) {
      // no duplicate!
      this._tab.activate();
      aTab.close();
      return true;
    }

    this._tab = aTab;
    this.activated();
    return true;
  },

  checkTab: function(aTab, aMaybeSelf) {
    if (!aTab) {
      return;
    }

    if (aTab.readyState != 'complete' && aTab.readyState != 'interactive') {
      return;
    }

    if (aMaybeSelf && this.checkSelfTab(aTab)) {
      return;
    }

    if (this._data.match == '') {
      return;
    }

    if (aTab.url.indexOf(this._data.match) != 0) {
      return;
    }

    // No duplicate.
    let duplicate = false;
    for (let i = 0; i < this._data.pages.length; ++i) {
      if (this._data.pages[i].url == aTab.url) {
        this._data.pages[i].title = aTab.title;

        // Move in front.
        let data = this._data.pages.splice(i, 1);
        this._data.pages.unshift(data[0]);

        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      let data = {
        url: aTab.url,
        title: aTab.title,
        iconUrl: null,
        visited: tabs.activeTab == aTab,
        starred: false
      };

      this._data.pages.unshift(data);
    }

    let active = tabs.activeTab == aTab;
    let url = aTab.url;

    // After this aTab cannot be used!
    aTab.close();

    this.saveData(function() {
      if (active) {
        this.refreshData(url);
        this.activate();
      } else {
        this.refreshData(null);
      }
    }.bind(this));
  }
};

// Main class - singleton
let sBTab = new BTab();
