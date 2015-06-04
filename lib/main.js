/* See license.txt for terms of usage */

// addon-SDK includes
let buttons = require('sdk/ui/button/action');
let {Cc, Ci, Cu} = require("chrome");
let self = require('sdk/self');
let ss = require('sdk/simple-storage')
let tabs = require('sdk/tabs');
let { viewFor } = require("sdk/view/core");

Cu.import("resource://gre/modules/Services.jsm");

// Main class - singleton
let sBTab;

// BUtton
let button = buttons.ActionButton({
  id: 'B-button',
  label: 'Open B:Tab',
  icon: {
    '16': './img/icon-16.png',
    '32': './img/icon-32.png',
    '64': './img/icon-64.png'
  },
  onClick: function(aState) {
    if (!sBTab) {
      sBTab = new BTab();
      sBTab.init();
    } else {
      sBTab.activate();
    }
  }
});

// Main class - implementation
function BTab() {}
BTab.prototype =
{
  init: function() {
    if (!ss.storage.data) {
      ss.storage.data = {
        match: '',
        name: '',
        maxPages: 10,
        pages: []
      };
    }

    tabs.open({
      url: self.data.url('index.html'),
      onReady: function(aTab) {
        this._tab = aTab;
        this.activated();
      }.bind(this),
      onClose: function() {
        sBTab.shutdown();
        sBTab = null;
      }
    });

    Services.prefs.setBoolPref("dom.mozBrowserFramesEnabled", true);
  },

  shutdown: function() {},

  activate: function() {
    if (this._tab) {
      this._tab.activate();
    }
  },

  activated: function() {
    this._worker = this._tab.attach({
      contentScriptFile: [ 'js/vendor/jquery.js',  'js/foundation.min.js', 'js/happy.js', 'main.js' ]
    });

    let principal = viewFor(this._tab.window).gBrowser.contentDocument.nodePrincipal;
    let secMan = Services.scriptSecurityManager;
    Services.perms.addFromPrincipal(principal, "browser", Ci.nsIPermissionManager.ALLOW_ACTION);
    Services.perms.addFromPrincipal(principal, "embed-apps", Ci.nsIPermissionManager.ALLOW_ACTION);

    this.iterateTabs();

    tabs.on('ready', function(aTab) {
      if (aTab) {
        this.checkTab(aTab);
      }
    }.bind(this));

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
      data: ss.storage.data,
      activeURL: aActiveURL
    });
  },

  filterChanged: function(aFilter) {
    ss.storage.data.match = aFilter.url;
    ss.storage.data.name = aFilter.name;
    ss.storage.data.maxPages = aFilter.maxPages;

    let pages = ss.storage.data.pages;
    ss.storage.data.pages = [];

    this.iterateTabs();

    for (let i = pages.length - 1; i >= 0; --i) {
      tabs.open({ url: pages[i].url, inBackground: true });
    }

    this.refreshData(null);
  },

  closeURL: function(aURL) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aURL) {
        ss.storage.data.pages.splice(i, 1);
        break;
      }
    }
  },

  starredURL: function(aURL, aStarred) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aURL) {
        ss.storage.data.pages[i].starred = aStarred;
        break;
      }
    }
  },

  urlVisited: function(aURL) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aURL) {
        ss.storage.data.pages[i].visited = true;
        break;
      }
    }
  },

  titleChanged: function(aUrl, aTitle) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aUrl) {
        ss.storage.data.pages[i].title = aTitle;
        return;
      }
    }
  },

  iconChanged: function(aUrl, aIconUrl) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aUrl) {
        ss.storage.data.pages[i].iconUrl = aIconUrl;
        return;
      }
    }
  },

  urlChanged: function(aOldUrl, aNewUrl) {
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aOldUrl) {
        ss.storage.data.pages[i].url = aNewUrl;
        return;
      }
    }
  },

  iterateTabs: function() {
    for (let tab of tabs) {
      this.checkTab(tab);
    }
  },

  checkTab: function(aTab) {
    if (!aTab) {
      return;
    }

    if (aTab.readyState != 'complete' && aTab.readyState != 'interactive') {
      return;
    }

    if (ss.storage.data.match == '') {
      return;
    }

    if (aTab.url.indexOf(ss.storage.data.match) != 0) {
      return;
    }

    // No duplicate.
    let duplicate = false;
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aTab.url) {
        ss.storage.data.pages[i].title = aTab.title;

        // Move in front.
        let data = ss.storage.data.pages.splice(i, 1);
        ss.storage.data.pages.unshift(data[0]);

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

      ss.storage.data.pages.unshift(data);
    }

    let active = tabs.activeTab == aTab;
    let url = aTab.url;

    // After this aTab cannot be used!
    aTab.close();

    if (active) {
      this.refreshData(url);
      this.activate();
    } else {
      this.refreshData(null);
    }
  }
};
