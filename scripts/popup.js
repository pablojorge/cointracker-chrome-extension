var pending = [];

function init() {
	chrome.runtime.onMessage.addListener(
		function(message, sender, sendResponse) {
			if (message.priceUpdated || message.priceUnchanged)
				updateViewPrices(message.exchange);
			if (message.priceCheckFailed)
				updateViewError(message.exchange);
            if (message.mainExchangeSelected)
                updateViewPrices(message.exchange);
            if (message.allPricesLoaded || message.mainExchangeSelected)
                onAllPricesLoaded();
		});

    refreshPrices(false);

    selectable_exchanges.forEach(function(exchange){
    	$('#' + exchange + '-price-spot').click(function(ev){
            setMainExchange(exchange);
        }).attr("title", "Click here to set " + 
                         exchange_desc[exchange] + 
                         " as the main exchange");
    });

    exchanges.forEach(function(exchange){
        $('#' + exchange + '-price-loading > div').append($(
            '<div class="progress progress-striped active">' + 
              '<div class="progress-bar"></div>' + 
            '</div>'
        ));
        $('#' + exchange + '-price-error > div').append($(
		    '<p class="alert alert-danger">' +
              '<strong>ERROR</strong> ' + 
              'There was an error retrieving the current BTC price from ' + exchange_desc[exchange] + '.' + 
            '</p>'
        ));
    });

	$('#refresh-link').click(function(ev){
        refreshPrices(true);
    });

    $("a").attr("title", function(){
        return $(this).attr("href");
    });

    document.getElementById('footer').focus();
}

function setMainExchange(exchange) {
    chrome.storage.sync.get(SETTINGS_KEY, function(items){
	    $('#' + items[SETTINGS_KEY]['main-exchange'] + '-price-cluster').removeClass('selected');
        items[SETTINGS_KEY]['main-exchange'] = exchange;
        chrome.storage.sync.set(items, function(){
		    chrome.runtime.sendMessage({mainExchangeSelected: true, exchange: exchange});
        });
    });
}

function formatPrice(number){
    return Number(number).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
}

function updateViewPrices(exchange) {
	chrome.storage.sync.get(null, function(items){
		main_exchange = items[SETTINGS_KEY]['main-exchange'];		
		$('.lookup-amount').html(items[SETTINGS_KEY]['lookup-amount']);		

        current = items.prices[exchange].current;
        
        for (key in current) {
		    $('#' + exchange + '-' + key).html(formatPrice(current[key]));
        }

		$('#' + exchange + '-uact').html(current.uact);
		$('#' + exchange + '-timestamp').html(customDate(current.timestamp, '#DD#/#MM#/#YY# #hhh#:#mm#'));

	    $('#' + exchange + '-price-loading').addClass('hide');
	    $('#' + exchange + '-price-cluster').removeClass('hide');
		$('#' + exchange + '-updated-at').removeClass('invisible');

        pending.splice(pending.indexOf(exchange), 1);

        if(main_exchange == exchange) {
	        $('#' + exchange + '-price-cluster').addClass('selected');
        }

        if(!pending.length) {
		    chrome.runtime.sendMessage({allPricesLoaded: true,  params: items});
		}
	});
}

function onAllPricesLoaded(){
	chrome.storage.sync.get(null, function(items){
        $("#dolarblue-price-btc").html(formatPrice(items.prices[main_exchange].current["price-spot"] * 
                                                   items.prices["dolarblue"].current["price-spot"]));
        $("#bullionvault-btcxau-ratio").html(Number(items.prices[main_exchange].current["price-spot"] / 
                                                   items.prices["bullionvault"].current["price-gold"] * 100).toFixed(2));
    });
}

function refreshPrices(force) {
	chrome.runtime.getBackgroundPage(function(bg) {
		chrome.storage.sync.get(SETTINGS_KEY, function(items){
            exchanges.forEach(function(exchange){
                $('#' + exchange + '-price-loading').removeClass('hide');
	            $('#' + exchange + '-price-cluster').addClass('hide');
	            $('#' + exchange + '-price-error').addClass('hide');
		        $('#' + exchange + '-updated-at').addClass('invisible');
    			bg.checkPrice(exchange, items, force);
                pending.push(exchange);
            });
		});
    });
}

function updateViewError(exchange) {
	$('#' + exchange + '-price-cluster, #' + exchange + '-price-loading').addClass('hide');
	$('#' + exchange + '-price-error').removeClass('hide');
	$('#' + exchange + '-updated-at').addClass('invisible');
}

window.addEventListener('load', init, false);
