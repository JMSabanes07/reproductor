console.log('Background service worker running')

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed')
})
