let isEnable = false
let timerValue = 0
let ignorePinnedTabs = false
let ignoreAudioPlayback = false
let ignoreOfficeTabs = false
// let ignoreTabs = []

function getOption(){
  return new Promise(resolve => {
    chrome.storage.local.get({
      isEnable: isEnable,
      ignorePinnedTabs: ignorePinnedTabs,
      ignoreAudioPlayback: ignoreAudioPlayback,
      ignoreOfficeTabs: ignoreOfficeTabs
    }, option => {
      resolve(option)
    })
  })
}

function run(){
  removeTimerForSleep()
  getOption().then(option => {
    isEnable = option.isEnable
    timerValue = option.timerValue
    ignorePinnedTabs = option.ignorePinnedTabs
    ignoreAudioPlayback = option.ignoreAudioPlayback
    ignoreOfficeTabs = option.ignoreOfficeTabs
    if(isEnable) enable()
    else disable()
  })
}

function enable(){
  chrome.webNavigation.onCompleted.addListener(discardAllTab)
  if(chrome.tabs.onHighlightChanged){
    chrome.tabs.onHighlightChanged.addListener(discardAllTab)
  } else {
    chrome.tabs.onHighlighted.addListener(discardAllTab)
  }
  isEnable = true
  setEnableIcon()
  setSleepBadge()
  discardAllTab()
  wakeUpIgnoreTabs()
}

function disable(){
  isEnable = false
  chrome.webNavigation.onCompleted.removeListener(discardAllTab)
  if(chrome.tabs.onHighlightChanged){
    chrome.tabs.onHighlightChanged.removeListener(discardAllTab)
  } else {
    chrome.tabs.onHighlighted.removeListener(discardAllTab)
  }
  setDisableIcon()
  removeSleepBadge()
  reloadAllTab()
}

function startSleepModeTab(tabId){
  changeTabTitle(tabId).then(()=>{
    discardTab(tabId)
  })
}

function setEnableIcon(){
  chrome.browserAction.setIcon({
      path : "icon/enable.png"
  })
}

function setDisableIcon(){
  chrome.browserAction.setIcon({
      path : "icon/disable.png"
  })
}

function reloadAllTab(){
  chrome.tabs.query({url: "*://*/*", discarded: true }, tabs => {
      tabs.forEach(tab => {
        reload(tab)
      })
  })
}

function reload(tab){
  chrome.tabs.reload(tab.id)
}

function discardTab(tabId){
  try {
    chrome.tabs.discard(tabId)
  } catch(error){
  }
}

function changeTabTitle(tabId){
  return new Promise(resolve => {
    try {
      chrome.tabs.executeScript(tabId, {code:"if(!document.title.includes('☾ ')) document.title = '☾ '+document.title"}, () => {
        resolve(true)
      })
    } catch(error){
      resolve(true)
    }
  })
}

function setSleepBadge(){
  const badge = isEnable? '☾': ''
  chrome.browserAction.setBadgeText({text: badge})
  chrome.browserAction.setBadgeBackgroundColor({color: '#F00'})
}

function removeSleepBadge(){
  chrome.browserAction.setBadgeText({text: ''})
}

function isTabHighlighted(tab){
  return tab.highlighted === true
}

function isPinnedTab(tab){
  return tab.pinned
}

function isAudioPlaybackTab(tab){
  return tab.audible && !tab.muted
}

function discardAllTab(){
  chrome.tabs.query({url: "*://*/*", active: false}, tabs => {
      tabs.forEach(tab => {
        if(isIgnoreTab(tab)) return
        startSleepModeTab(tab.id)
      })
  })
}

function isIgnoreTab(tab){
  return isChromeSettingTab(tab)
        || isFirefoxSettingTab(tab)
        || (ignorePinnedTabs && isPinnedTab(tab))
        || (ignoreAudioPlayback && isAudioPlaybackTab(tab))
        || isTabHighlighted(tab)
        || (ignoreOfficeTabs && isOfficeTab(tab))
        || isManuallyIgnoredTab(tab)
}

function isManuallyIgnoredTab(tabDetail){
  return ignoreTabs[tabDetail.id]? true: false
}

function isChromeSettingTab(tabDetail){
  return tabDetail.url.includes('chrome://')
}

function isFirefoxSettingTab(tabDetail){
  return tabDetail.url.includes('about:')
}

function isOfficeTab(tabDetail){
  return isGoogleDocsTab(tabDetail) || isOneDriveTab(tabDetail)
}

function isGoogleDocsTab(tabDetail){
  return tabDetail.url.includes('docs.google.com')
}

function isOneDriveTab(tabDetail){
  return tabDetail.url.includes('onedrive.live.com')
}

function wakeUpIgnoreTabs(){
  if(ignorePinnedTabs) wakeUpPinnedTabs()
  if(ignoreAudioPlayback) wakeUpAudioTabs()
}

function wakeUpAudioTabs(){
  chrome.tabs.query({url: "*://*/*", audible: true, discarded: true}, tabs => {
    tabs.forEach(tab => {
      reload(tab)
    })
  })
}

function wakeUpPinnedTabs(){
  chrome.tabs.query({url: "*://*/*", pinned: true, discarded: true}, tabs => {
    tabs.forEach(tab => {
      reload(tab)
    })
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if(message.msg === 'OPTION_START'){
    onOptionStart(message.time)
  }
  else if(message.msg === 'OPTION_DISABLE'){
    onOptionDisable()
  }
  else if(message.msg === 'IGNORE_TABS'){
    ignoreTabs = message.ignoreTabs
  }
})

function onOptionStart(time){
  isEnable = true
  timerValue = getValidTimerValue(time)
  if(timerValue>0){
    timerForSleep()
  } else {
    run()
  }
}

function onOptionDisable(){
  isEnable = false
  run()
}

const timeUnitBase = 60 * 1000 // 1mins = 60*1000 miliseconds
function getValidTimerValue(value){
  return value * timeUnitBase
}

let timerInterval = null
let timerCount = 0
const interval = 60000 // every 1m
removeTimerForSleep()
function timerForSleep(){
  removeTimerForSleep()
  let remainTime = timerValue / timeUnitBase
  setCountdownBadge(remainTime)
  timerInterval = setInterval(()=>{
    processTimerForSleepInterval()
  }, interval)
}

function removeTimerForSleep(){
  if(timerInterval !== null) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function processTimerForSleepInterval(){
  timerCount+= interval
  let remainTime = (timerValue - timerCount)/ timeUnitBase
  remainTime = formatTimeToReadable(remainTime)
  setCountdownBadge(remainTime)
  if(timerCount==timerValue){
    run()
  }
}

function formatTimeToReadable(remainTime){
  return remainTime
}

function setCountdownBadge(remainTime){
  chrome.browserAction.setBadgeText({text: ""+remainTime})
  chrome.browserAction.setBadgeBackgroundColor({color: 'black'})
}

run()