// ==UserScript==
// @name        Empornium ThreadMan
// @description Thread visibility management
// @namespace   Empornium Scripts
// @version     1.0.1
// @author      vandenium
// @grant       GM_setValue
// @grant       GM_getValue
// ---
// @include /^https://www\.empornium\.(me|sx|is)\/torrents.php/
// @include /^https://www\.empornium\.(me|sx|is)\/forum\/*/
// @include /^https://www\.empornium\.(me|sx|is)\/article*/
// @include /^https://www\.empornium\.(me|sx|is)\/userhistory*/
// ==/UserScript==
// Changelog:
// Version 1.0.1
//  - Update hotkey thread highlighting
// Version 1.0.0
//  - The initial version:
//    - Features:
//    - Whitelist/blacklist/Mark Read
//    - Works on Latest Forum Threads and Forum pages.
//    - Hide thread based on whether you've clicked since most recent.
//    - Hotkeys: blacklist (b), whitelist (w), mark read (r)
//    - Settings dialog to set/clear above.
// Todo:
//    - Status area (how many threads currently hidden, etc.)

const initialOptions = {
  options: {
    whitelist: {
      threads: new Set(),
    },
    blacklist: {
      threads: new Set(),
    },
  },
  userSelected: {
    threads: new Set(),
  },
};

const optionsKey = 'empornium-threadman-options';
const getOptions = () => {
  const options = GM_getValue(optionsKey);
  if (options) {
    const rawOptions = JSON.parse(options);

    // convert whitelist/blacklist back to sets
    rawOptions.options.whitelist.threads = new Set(JSON.parse(rawOptions.options.whitelist.threads));
    rawOptions.options.blacklist.threads = new Set(JSON.parse(rawOptions.options.blacklist.threads));
    rawOptions.userSelected.threads = new Set(JSON.parse(rawOptions.userSelected.threads));

    // console.log('Options from GM: ', JSON.stringify(rawOptions, null, 4))

    return rawOptions;
  }
  return initialOptions;
}
const setOptions = (options = initialOptions) => {
  console.log(`Setting options to ${optionsKey}:`, options);

  // convert sets to arrays
  options.options.whitelist.threads = JSON.stringify([...options.options.whitelist.threads]);
  options.options.blacklist.threads = JSON.stringify([...options.options.blacklist.threads]);
  options.userSelected.threads = JSON.stringify([...options.userSelected.threads]);

  GM_setValue(optionsKey, JSON.stringify(options ? options : initialOptions));
};
const getLatestForumThreads = () => Array.from(document.querySelectorAll('.latest_threads > span'));
const getForumThreads = () => Array.from(document.querySelectorAll('table.forum_list tr.rowa, table.forum_list tr.rowb'));
const getThreadMetaData = (thread) => {
  if (thread.children[0].nodeName.toLowerCase() === 'span') { // Latest forum thread
    const link = thread.children[1].href;
    return {
      id: link.split('/thread/')[1].split('?')[0],
      name: thread.children[1].textContent.trim(),
      timestamp: new Date(thread.children[3].title),
    }
  } else { // forum
    const firstAnchor = thread.querySelector('a');
    return {
      name: firstAnchor.textContent,
      id: firstAnchor.href.split('/thread/')[1],
      timestamp: thread.querySelector('span.time').title,
    };
  }
};

// Shows/hides threads based on options and displayed threads.
//  - Latest Forums section (top of multiple pages)
//  - Forum Page
const processThreads = (threads) => {
  const options = getOptions();
  threads.forEach(thread => {
    const threadMetaData = getThreadMetaData(thread);

    // Handle whitelist threads
    if (options.options.whitelist.threads.size > 0) {
      if (options.options.whitelist.threads.has(threadMetaData.id)) {
        thread.hidden = false;
      } else {
        thread.hidden = true;
      }
    } else {
      // Handle blacklisted threads
      if (options.options.blacklist.threads.has(threadMetaData.id)) {
        thread.hidden = true;
      }
    }

    // Handle clicked threads. Iterate over userselected threads. if any match current thread, check date and optionally hide.
    options.userSelected.threads.forEach(selectedThread => {
      if (selectedThread.id === threadMetaData.id) {
        const threadDate = new Date(threadMetaData.timestamp);
        const clickedDate = new Date(selectedThread.lastClicked);

        //console.log('thread data', threadDate);
        //console.log('last clicked', clickedDate)

        if (clickedDate > threadDate) {
          console.log(`Hiding already viewed thread, ${threadMetaData.name}`)
          thread.hidden = true;
        }
      }
    })
  });
};

//-----------Settings Dialog----------------
const template = `
  <style>
  #threadman-options-outer-container {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    top: 50%;
    width: 800px;
    height: 400px;
    border: solid #333 1px;
    background-color: rgb(0,0,0,0.9);
    border-radius: 15px;
    margin: 5px;
  }

  .threadman-options-container {
    max-width: 1000px;
    width: 100%;
    position: relative;
    margin: 15px;
  }

    .options-inner {
      width: 30%;
      margin-right: 5px;
      display: inline-block;
    }

    #threadman-save-settings {
      margin-top: 10px;
    }

    #close-threadman-settings a {
      float: right;
      margin: 0px 30px;
      text-decoration:none;
      width: 20px;
      height: 20px;
      border-radius: 10px;
      font-size: 1.3em;
    }

    #close-threadman-settings a:hover {
      background-color: rgba(100,100,10,0.9);
    }


  </style>

  <div class="threadman-options-container" id="threadman-option-container">
    <div id='close-threadman-settings'><a href='#'>✖️</a></div>
    <h1>Empornium ThreadMan Settings</h1>

    <div>
      <div class='options-inner'>
        <h3>Blacklist</h3>
        <textarea id= "blacklist" rows="15" cols="27" placeholder="Hide all threads in this list (comma-separated thread IDs)"></textarea>
      </div>
      <div class='options-inner'>
        <h3>Whitelist</h3>
        <textarea id="whitelist" rows="15" cols="27" placeholder="Only show threads in this list (comma-separated thread IDs, Blacklist ignored)"></textarea>
      </div>
      <div class='options-inner'>
        <h3>Thread Click Log</h3>
        <textarea id="userclicks" rows="15" cols="27"></textarea>
      </div>
    </div>

    <div>
      <button id='threadman-save-settings'>Save Settings</button>
    </div>

  </div>
  `;

//-----------------------------------------

const hideSettings = () => document.querySelector('#threadman-options-outer-container').remove();
const isNumeric = (num) => !isNaN(num);
const cleanUserSettings = (list) => list.filter(val => val !== '' && isNumeric(val));
const showSettings = () => {
  const createTemplateDOM = (str) => {
    const template = document.createElement("div");
    template.id = "threadman-options-outer-container";
    template.innerHTML = str;
    return template;
  };

  const dom = createTemplateDOM(template);

  // Get settings
  const options = getOptions();

  console.log('options in settings', options)

  // Set blacklist settings
  dom.querySelector('#blacklist').textContent = [...options.options.blacklist.threads];

  // Set blacklist settings
  dom.querySelector('#whitelist').textContent = [...options.options.whitelist.threads];

  // Set userclicks
  dom.querySelector('#userclicks').textContent = JSON.stringify([...options.userSelected.threads]);

  // Save settings
  dom.querySelector('#threadman-save-settings').addEventListener('click', () => {
    const blacklistSettingsRaw = dom.querySelector('#blacklist').value.trim();
    const whitelistSettingsRaw = dom.querySelector('#whitelist').value.trim();
    const userSelectedRaw = dom.querySelector('#userclicks').value.trim();

    // clean blacklist
    const blacklistSettingsListRaw = blacklistSettingsRaw.split(',');
    const blacklistSettings = cleanUserSettings(blacklistSettingsListRaw)

    // clean whitelist
    const whitelistSettingsListRaw = whitelistSettingsRaw.split(',');
    const whitelistSettings = cleanUserSettings(whitelistSettingsListRaw);

    // set options, save, close, refresh.
    options.options.blacklist.threads = new Set(blacklistSettings);
    options.options.whitelist.threads = new Set(whitelistSettings);
    options.userSelected.threads = userSelectedRaw === '' ? new Set() : new Set(JSON.parse(userSelectedRaw))

    setOptions(options);
    hideSettings();
    window.location.reload();
  });

  // Close settings
  dom.querySelector('#close-threadman-settings a').addEventListener('click', hideSettings);

  // Add to document.
  const body = document.querySelector('body');
  body.appendChild(dom);
}

// On click, need to set the lastClicked property on options.
// Search through all threads, if exists, update, else create new.
const addClickToOptions = (threadMetaData) => {
  const options = getOptions();
  const userSelectedThreads = [...options.userSelected.threads];
  const found = userSelectedThreads.find(thread => thread.id === threadMetaData.id);

  if (found) { // delete old value, add new with updated date
    options.userSelected.threads.delete(found);

    options.userSelected.threads.add({
      id: found.id,
      lastClicked: new Date(),
    });

  } else {
    options.userSelected.threads.add({
      id: threadMetaData.id,
      lastClicked: new Date(),
    });
  }
  setOptions(options);
};

/**
 * Adds click handlers to threads
 * @param {*} threads List of threads
 * @param {*} selectorToThread Selector to the top-level element of thread starting from the event target.
 */
const addClickHandlerToThreads = (threads, selectorToThread) => {
  threads.forEach(thread => {
    thread.addEventListener('click', (el) => {
      const threadMetaData = getThreadMetaData(el.target.closest(selectorToThread));
      addClickToOptions(threadMetaData);
    })

    thread.addEventListener('mouseenter', (e) => {
      e.target.classList.add('threadman-thread-target');
    });

    thread.addEventListener('mouseleave', (e) => {
      e.target.classList.remove('threadman-thread-target');
    });
  });
};

// Add settings link to page.
const addSettingsLink = () => {
  const el = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#';
  a.textContent = 'ThreadMan🦸‍♂️Settings';
  a.addEventListener('click', (e) => {
    showSettings();
  });
  el.appendChild(a);
  const container = document.querySelector('#userinfo_username');
  container.appendChild(el);
}

/**
 * Main execution
 */
//setOptions();  // For clearing out all settings.

// Get threads
const latestForumThreads = getLatestForumThreads();
const forumThreads = getForumThreads();

// Click handlers
addClickHandlerToThreads(latestForumThreads, '.latest_threads > span')
addClickHandlerToThreads(forumThreads, 'tr')

// Process Latest Forum threads
processThreads(latestForumThreads);

// Process Forum Pages
processThreads(forumThreads);

// UI

// Settings link
addSettingsLink();

const markThread = (type, thread) => {
  let bgColor;

  if (type === 'blacklist') {
    bgColor = '#333';
    thread.classList.remove('rowa');
    thread.classList.remove('rowb');
    thread.style.transition = 'opacity 0.75s';
    thread.style.opacity = 0;
    thread.style.border = 'solid gainsboro 1px';
  }
  if (type === 'whitelist') {
    bgColor = 'whitesmoke';
    thread.classList.remove('rowa');
    thread.classList.remove('rowb');
    thread.style.border = 'solid gainsboro 1px';
    thread.style.transition = 'opacity 0.75s';
  }

  if (type === 'read') {
    bgColor = '#ACE1AF' //'celadon'// '#8FBC8B';
    thread.classList.remove('rowa');
    thread.classList.remove('rowb');
    thread.style.transition = 'opacity 1.2s';
    thread.style.opacity = 0;
    thread.style.border = 'solid gainsboro 1px';
  }
  
  thread.style.backgroundColor = bgColor;
  thread.style.borderRadius = '2px';

  if (type === 'blacklist' || type === 'read') {
    setTimeout(() => {
      thread.remove();
    }, 700);
  }
};

// Handles hotkey presses for latest forum and forum threads
const hotkeyHandler = (thread, e) => {
  const threadMetaData = getThreadMetaData(thread);
  if (e.keyCode === 66) { // b blacklist
    if (thread.classList.contains('threadman-thread-target')) {

      // add thread id to blacklist options
      const options = getOptions();
      options.options.blacklist.threads.add(threadMetaData.id);
      setOptions(options);
      markThread('blacklist', thread);
    }
  }

  if (e.keyCode === 87) { // w whitelist
    if (thread.classList.contains('threadman-thread-target')) {
      const options = getOptions();
      if (!options.options.whitelist.threads.has(threadMetaData.id)) {
        options.options.whitelist.threads.add(threadMetaData.id);
      }
      setOptions(options);
      markThread('whitelist', thread);
    }
  }

  if (e.keyCode === 82) { // r read
    if (thread.classList.contains('threadman-thread-target')) {
      addClickToOptions(threadMetaData);
      markThread('read', thread);
    }
  }
}

// Hotkeys
document.querySelector('body').addEventListener('keydown', (e) => {
  // Escape closes options dialog
  if (e.key === "Escape") {
    hideSettings();
  }

  // Setup hotkey functionality for latest forum and forum threads.
  latestForumThreads.forEach((thread) => hotkeyHandler(thread, e));
  forumThreads.forEach((thread) => hotkeyHandler(thread, e));
});