/* See license.txt for terms of usage */

// addon-SDK includes
let buttons = require('sdk/ui/button/action');
let {Cc, Ci} = require("chrome");
let self = require('sdk/self');
let ss = require('sdk/simple-storage')
let tabs = require('sdk/tabs');

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

    let observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.addObserver(this, "http-on-examine-response", false);
    observerService.addObserver(this, "http-on-examine-cached-response", false);
    observerService.addObserver(this, "http-on-examine-merged-response", false);
  },

  shutdown: function() {
    let observerService = Cc["@mozilla.org/observer-service;1"]
                            .getService(Ci.nsIObserverService);
    observerService.removeObserver(this, "http-on-examine-response");
    observerService.removeObserver(this, "http-on-examine-cached-response");
    observerService.removeObserver(this, "http-on-examine-merged-response");
  },

  activate: function() {
    if (this._tab) {
      this._tab.activate();
    }
  },

  activated: function() {
    this._worker = this._tab.attach({
      contentScriptFile: [ 'js/vendor/jquery.js',  'js/foundation.min.js', 'js/happy.js', 'main.js' ]
    });

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
        this.refreshData(null);
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

    let data = {
      url: aTab.url,
      title: aTab.title,
      thumbnail: aTab.getThumbnail()
    };

    // No duplicate.
    let duplicate = false;
    for (let i = 0; i < ss.storage.data.pages.length; ++i) {
      if (ss.storage.data.pages[i].url == aTab.url) {
        ss.storage.data.pages[i] = data;
        duplicate = true;
      }
    }

    if (!duplicate) {
      ss.storage.data.pages.unshift(data);
    }

    let active = aTab.activate;
    aTab.close();

    this.refreshData(active ? data.url : null);
  },

  observe: function(subject, topic, data) {
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
    if (!httpChannel) {
      return;
    }

    if (ss.storage.data.match == "" ||
        httpChannel.URI.spec.indexOf(ss.storage.data.match) != 0) {
      return;
    }

    let header;
    try {
      header = httpChannel.getResponseHeader("X-Frame-Options");
    } catch(e) {
      return;
    }

    if (header == 'DENY' || header == 'SAMEORIGIN') {
      httpChannel.setResponseHeader("X-Frame-Options", "", false);
    }
  }
};
