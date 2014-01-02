// Legacy support for pre-event-pages.
var oldChromeVersion = !chrome.runtime,
	// keys for accessing local storage
	PRICES_KEY = 'prices',
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
            exchange = items.userSettings["main-exchange"];
			checkPrice(exchange, items, false);
		}
	});
}

// alarm handler
function onAlarm(alarm) {
	// |alarm| can be undefined because onAlarm also gets called from
	// window.setTimeout on old chrome versions.
	if (alarm && alarm.name == 'watchdog') {
		chrome.storage.sync.get(SETTINGS_KEY, function(items){
            exchange = items.userSettings["main-exchange"];
			checkPrice(exchange, items, false);
		});
	}
}

// Check to see if the price data needs an update
function checkPrice(exchange, params, forceUpdate) {
	// check for recent updates
	chrome.storage.sync.get(PRICES_KEY, function(items){
		// exit if the last update was less than X minutes ago
		if( items.prices &&
            items.prices[exchange] &&
			(Date.now() - items.prices[exchange].current.timestamp) < (params['userSettings']['poll-frequency'] * 60000 * 0.95) &&
			forceUpdate != true) {
			console.log('price of ' + exchange + ' is fresh');
			chrome.runtime.sendMessage({priceUnchanged: true, exchange: exchange});
		} else {
			console.log('price of ' + exchange + ' is old, refreshing');
			refreshPrice(exchange, params);
		}
	});
}

// update the current prices and cache them in chrome storage
function refreshPrice(exchange, params) {
	var current = {},
		lookupAmount = 1,
		requestsPending = 0,
        exchangeHandler = {};

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

			if(current){
				current.timestamp = Date.now();

				// cache the previous price
				chrome.storage.sync.get(PRICES_KEY, function(items){
                    if (items.prices===undefined)
                        items.prices={}
                    if (items.prices[exchange]===undefined)
                        items.prices[exchange]={}
                    items.prices[exchange].previous = items.prices[exchange].current;
                    items.prices[exchange].current = current;

					// save the new price data and wait for the messaging callback
					chrome.storage.sync.set(items, function(){
						chrome.runtime.sendMessage({priceUpdated: true, exchange: exchange});
					});

				});

			} else {
				chrome.runtime.sendMessage({priceCheckFailed: true, exchange: exchange});
			}
		}
	}

	// trigger the price calls
	if (params['userSettings']['lookup-amount']) {
		lookupAmount = params['userSettings']['lookup-amount'];
	}
    
    exchangeHandler.coinbase = function () {
        var coinBaseRoot = 'https://coinbase.com',
	        pricesBuyURL= '/api/v1/prices/buy',
	        pricesSellURL= '/api/v1/prices/sell',
	        pricesSpotRateURL= '/api/v1/prices/spot_rate';

        function buildHandler(priceType, parser) {
            return function(response) {
                current[priceType] = parser(response);
            }
        }

    	requestPrice(coinBaseRoot + pricesSpotRateURL, buildHandler('price-spot', function(response){return JSON.parse(response).amount}));
	    requestPrice(coinBaseRoot + pricesBuyURL + '?qty="' + lookupAmount + '"', buildHandler('price-buy', function(response){return JSON.parse(response).total.amount}));
    	requestPrice(coinBaseRoot + pricesSellURL + '?qty="' + lookupAmount + '"', buildHandler('price-sell',  function(response){return JSON.parse(response).total.amount}));
    }

    exchangeHandler.mtgox = function () {
        var mtgoxURL = 'https://data.mtgox.com/api/1/BTCUSD/ticker_fast';

        function handler(response) {
            _return = JSON.parse(response)["return"];

            current = {
                "price-spot": _return.last.value,
            }
        }

    	requestPrice(mtgoxURL, handler);
    }

    exchangeHandler.btce = function () {
        var btceURL = 'https://btc-e.com/api/2/btc_usd/ticker';

        function handler(response) {
            ticker = JSON.parse(response)["ticker"];

            current = {
                "price-spot": ticker.buy,
            }
        }

    	requestPrice(btceURL, handler);
    }

    exchangeHandler.bitstamp = function () {
        var bitstampURL = 'https://www.bitstamp.net/api/ticker/';

        function handler(response) {
            current = {
                "price-spot": JSON.parse(response).ask,
            }
        }

    	requestPrice(bitstampURL, handler);
    }

    exchangeHandler.virwox = function () {
        var bestPricesURL = 'https://www.virwox.com/api/json.php?method=getBestPrices&symbols[0]=BTC/SLL&symbols[1]=USD/SLL';

        function handler(response) {
            result = JSON.parse(response)["result"];
            current = {
                "price-spot": result[0].bestSellPrice,
                "price-sll": result[1].bestBuyPrice,
                "price-usd": result[0].bestSellPrice / result[1].bestBuyPrice,
            }
        }

    	requestPrice(bestPricesURL, handler);
    }

    exchangeHandler.dolarblue = function () {
        var url = 'http://www.eldolarblue.net/getDolarBlue.php?as=xml';

        function handler(response) {
            doc = (new window.DOMParser()).parseFromString(response, "text/xml");
            buy = doc.getElementsByTagName("buy")[0].firstChild.data
            sell = doc.getElementsByTagName("sell")[0].firstChild.data

            current = {
                "price-spot": sell,
                "price-sell": buy,
            }
        }

    	requestPrice(url, handler);
    }

    exchangeHandler.dolaroficial = function () {
        var url = 'http://www.eldolarblue.net/getDolarLibre.php?as=xml';

        function handler(response) {
            doc = (new window.DOMParser()).parseFromString(response, "text/xml");
            sell = doc.getElementsByTagName("sell")[0].firstChild.data

            current = {
                "price-spot": sell,
                "price-tarjeta": sell * 1.35,
                "price-paypal": sell * 1.35 * 1.04
            }
        }

    	requestPrice(url, handler);
    }

    exchangeHandler.bullionvault = function () {
        var url = 'https://live.bullionvault.com/secure/api/v2/view_market_xml.do?considerationCurrency=USD';

        function handler(response) {
            doc = (new window.DOMParser()).parseFromString(response, "text/xml");
            prices = { gold: [],
                       silver: [] }

            for (security in prices) {
                expr = '//sellPrices/price[../../@securityClassNarrative="' + security.toUpperCase() + '"]/@limit'
                node_set = doc.evaluate(expr, doc, null, XPathResult.ANY_TYPE, null)
                while (limit = node_set.iterateNext()) {
                    prices[security].push(limit.nodeValue);
                }
            }

            current = {
                "price-gold": Math.min.apply(null, prices.gold) / 32.15,
                "price-silver": Math.min.apply(null, prices.silver) / 32.15,
            }
        }

    	requestPrice(url, handler);
    }

    exchangeHandler[exchange]();

	// The polling call
	var pollRequests = window.setInterval(function(){ checkRequests() }, 100);
}

// Updates the badge UI
function updateBadge(exchange, prices, settings, priceCheckStatus) { 
	var badgeColor = '#46b8da',
		percentChange = 0;

    if (!settings || settings["main-exchange"] != exchange) {
        console.log("badge: ignoring update of " + exchange);
        return;
    }

	// update price on badge
	if (priceCheckStatus != 'failed') {
        newPrice = prices[exchange].current["price-spot"];
		// format the price
		var badgePrice = newPrice < 100 ? String(parseFloat(newPrice).toFixed(2)) : String(parseInt(newPrice));  
        chrome.browserAction.setBadgeText({text: badgePrice});
	} else {
		chrome.browserAction.setBadgeText({text: '!'});
	}

	// update badge color
	if (prices[exchange].previous) {
        oldPrice = prices[exchange].previous["price-spot"];
		var percentChange = (newPrice - oldPrice)/oldPrice * 100
		console.log("percent change = " + percentChange);
	}

	if (percentChange < -0.25 || priceCheckStatus == 'failed') { 
        badgeColor = '#d43f3a'; 
    } else if (percentChange > 0.25) { 
        badgeColor = '#4cae4c'; 
    }

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
            exchange = msg.params[SETTINGS_KEY]["main-exchange"];
			checkPrice(exchange, msg.params, true);
		}

		// if the AJAX request failed
		if (msg.priceCheckFailed){
			updateBadge(null,null,null,'failed');
		}

		if (msg.priceUnchanged){
			chrome.storage.sync.get([PRICES_KEY, SETTINGS_KEY], function(items){
				updateBadge(msg.exchange, items[PRICES_KEY], items[SETTINGS_KEY]);
			});
		}
		
		if (msg.priceUpdated){
			chrome.storage.sync.get([PRICES_KEY, SETTINGS_KEY], function(items){
				updateBadge(msg.exchange, items[PRICES_KEY], items[SETTINGS_KEY]);
			});
			return true;
		}

        if (msg.mainExchangeSelected){
			chrome.storage.sync.get([PRICES_KEY, SETTINGS_KEY], function(items){
				updateBadge(msg.exchange, items[PRICES_KEY], items[SETTINGS_KEY]);
			});
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
