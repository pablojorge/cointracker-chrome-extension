// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime,
	coinBaseRoot = 'https://coinbase.com',
	pricesBuyURL= '/api/v1/prices/buy',
	pricesSellURL= '/api/v1/prices/sell',
	pricesSpotRateURL= '/api/v1/prices/spot_rate',
    mtgoxURL='https://data.mtgox.com/api/1/BTCUSD/ticker_fast',
	// keys for accessing local storage
	CURRENT_KEY = 'current',
	PREVIOUS_KEY = 'previous',
	SETTINGS_KEY = 'userSettings',
	SETTINGS_DEFAULTS = {
        'main-exchange': 'coinbase',
		'poll-frequency': '5',
		'lookup-amount': '1',
		'timestamp': Date.now()
	},
	requestTimeout = 1000 * 2;  // 2 seconds



function onInit() {
	chrome.storage.sync.get(SETTINGS_KEY, function(items){
		// initialize settings
		if( items.userSettings === undefined ){
			initializeSettings();
		} else {
			checkPrice(items, false);
		}
	});
}

// alarm handler
function onAlarm(alarm) {
	// |alarm| can be undefined because onAlarm also gets called from
	// window.setTimeout on old chrome versions.
	if (alarm && alarm.name == 'watchdog') {
		chrome.storage.sync.get(SETTINGS_KEY, function(items){
			checkPrice(items, false);
		});
	}
}

// Check to see if the price data needs an update
function checkPrice(params, forceUpdate) {
	// check for recent updates
	chrome.storage.sync.get(CURRENT_KEY, function(items){
		// exit if the last update was less than 5 minutes ago
		if( items.current &&
			(Date.now() - items.current.timestamp) < (params['userSettings']['poll-frequency'] * 60000 * 0.95) &&
			forceUpdate != true) {
			console.log('price is fresh');
			chrome.runtime.sendMessage({priceUnchanged: true});
		} else {
			console.log('price is old, refreshing');
			refreshPrice(params);
		}
	});
}

// update the current prices and cache them in chrome storage
function refreshPrice(params) {
	var storageData = {},
		prices = {coinbase: {},
                  mtgox: {}},
		lookupAmount,
		requestsPending = 0;

	function requestPrice(theUrl, handler) {
		var xhr = new XMLHttpRequest();
		var abortTimerId = window.setTimeout(function() {
			xhr.abort();  // synchronously calls onreadystatechange
		}, requestTimeout);

		function handleSuccess(response) {
			window.clearTimeout(abortTimerId);
            handler(response);
		}

		function handleError() {
			window.clearTimeout(abortTimerId);
			chrome.runtime.sendMessage({priceCheckFailed: true});
		}

		try {
			xhr.onreadystatechange = function() {
				if (xhr.readyState < 4 || xhr.status == 0) {
					return;
				}

				requestsPending--;

				if (xhr.status === 200 || xhr.status === 304) {
					handleSuccess(xhr.responseText);
					return;
				}

				console.log(xhr);

				handleError();
			};

			xhr.onerror = function(error) {
				handleError();
			};

			requestsPending++;

			xhr.open( "GET", theUrl, true );
			xhr.send( null );
		} catch(e) {
			console.error(chrome.i18n.getMessage("coinbase_check_exception", e));
			handleError();
		}
	}

	// polling function 
	function checkRequests(){
		if(requestsPending == 0){

			window.clearInterval(pollRequests); //Clear Interval via ID for single time execution

			if(prices){
				storageData[CURRENT_KEY] = {
					prices: prices,
					timestamp: Date.now()
				};

				// cache the previous price
				chrome.storage.sync.get(CURRENT_KEY, function(items){
					storageData[PREVIOUS_KEY] = items.current;

					console.log('storageData new: ' + storageData.current + ' storageData old: ' + storageData.previous);

					// save the new price data and wait for the messaging callback
					chrome.storage.sync.set(storageData, function(){
						chrome.runtime.sendMessage({priceUpdated: true});
					});

				});

			} else {
				console.log('prices: ' + prices);
				chrome.runtime.sendMessage({priceCheckFailed: true});
			}
		}
	}

	// trigger the price calls
	if (params['userSettings']['lookup-amount']) {
		lookupAmount = params['userSettings']['lookup-amount'];
	} else {
		lookupAmount = 1;
	}
    
    function requestCoinbase() {
        function buildHandler(priceType, parser) {
            return function(response) {
                prices.coinbase[priceType] = parser(response);
            }
        }

    	requestPrice(coinBaseRoot + pricesSpotRateURL, buildHandler('spotPrice', function(response){return JSON.parse(response).amount}));
	    requestPrice(coinBaseRoot + pricesBuyURL + '?qty="' + lookupAmount + '"', buildHandler('buyPrice', function(response){return JSON.parse(response).total.amount}));
    	requestPrice(coinBaseRoot + pricesSellURL + '?qty="' + lookupAmount + '"', buildHandler('sellPrice',  function(response){return JSON.parse(response).total.amount}));
    }

    function requestMtGox() {
        function handler(response) {
            _return = JSON.parse(response)["return"];

            prices.mtgox = {
                spotPrice: _return.last.value,
                buyPrice: _return.buy.value * lookupAmount,
                sellPrice: _return.sell.value * lookupAmount,
            }
        }

    	requestPrice(mtgoxURL, handler);
    }

    requestCoinbase();
    requestMtGox();

	// The polling call
	var pollRequests = window.setInterval(function(){ checkRequests() }, 100);
}

// Updates the badge UI
function updateBadge(userSettings, newValue, oldValue, priceCheckStatus) { 
	var badgeColor = '#46b8da',
		percentChange = 0;

	// update price on badge
	if (priceCheckStatus != 'failed') {
        newPrice = newValue.prices[userSettings["main-exchange"]].spotPrice;
		// format the price
		var badgePrice = newPrice < 100 ? String(parseFloat(newPrice).toFixed(1)) : String(parseInt(newPrice));  chrome.browserAction.setBadgeText({text: badgePrice});
	} else {
		chrome.browserAction.setBadgeText({text: '!'});
	}

	// update badge color
	if(oldValue){
        oldPrice = oldValue.prices[userSettings["main-exchange"]].spotPrice;
		var percentChange = (newPrice - oldPrice)/oldPrice * 100
		console.log("percent change = " + percentChange);
	}
	if (percentChange < -0.25 || priceCheckStatus == 'failed') { badgeColor = '#d43f3a'; } else
	if (percentChange > 0.25) { badgeColor = '#4cae4c'; }

	chrome.browserAction.setBadgeBackgroundColor({color: badgeColor});

	chrome.runtime.sendMessage({badgeUpdated: true});
}

// Initializes settings
function initializeSettings() {
	var storageData = {};
		storageData[SETTINGS_KEY] = SETTINGS_DEFAULTS;

	chrome.storage.sync.set(storageData, function(){
		chrome.runtime.sendMessage({settingsSaved: true,  params: storageData});
	});
}

// Chrome Message Listener
chrome.runtime.onMessage.addListener(
	function(msg, sender, sendResponse) {
		if (msg.settingsSaved) {
			// create the watchdog
			chrome.alarms.create('watchdog', {periodInMinutes:parseInt(msg.params[SETTINGS_KEY]['poll-frequency'])});
			checkPrice(msg.params, true);
		}

		// if the AJAX request failed
		if (msg.priceCheckFailed){
			updateBadge(null,null,null,'failed');
		}

		if (msg.priceUnchanged){
			chrome.storage.sync.get([SETTINGS_KEY, CURRENT_KEY], function(items){
				updateBadge(items.userSettings, items.current);
			});
		}
		
		if (msg.priceUpdated){
			chrome.storage.sync.get([SETTINGS_KEY, PREVIOUS_KEY, CURRENT_KEY], function(items){
				updateBadge(items.userSettings, items.current, items.previous);
			});
			return true;
		}

		if (msg.badgeUpdated){
			sendResponse({farewell: "goodbye"});
		} else {
			return true;
		}
});


// INITIALIZE
// ----------

if (oldChromeVersion) {
	onInit();
} else {
	chrome.runtime.onInstalled.addListener(onInit);
	chrome.alarms.onAlarm.addListener(onAlarm);
}
