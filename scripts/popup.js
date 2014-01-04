//adding listener when body is loaded to call init function.
var SETTINGS_KEY = 'userSettings';

var selectable_exchanges = ["coinbase", 
                            "mtgox", 
                            "btce", 
                            "bitstamp"],
    other_exchanges = ["virwox", 
                       "dolarblue", 
                       "dolaroficial",
                       "bullionvault"],
    exchanges = selectable_exchanges.concat(other_exchanges),
    exchange_desc = {
        coinbase: "Coinbase",
        mtgox: "MtGox",
        btce: "BTC-e",
        bitstamp: "Bitstamp",
        virwox: "VirWox",
        dolarblue: "Dolar Blue",
        dolaroficial: "Dolar Oficial",
        bullionvault: "Bullion Vault"
    }
    pending = [];

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

		$('#' + exchange + '-timestamp').html(customDate(current.timestamp, '#DD#/#MM#/#YY# #hh#:#mm##ampm#'));

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

// UTILITIES
// ---------

// via http://phrogz.net/JS/FormatDateTime_JS.txt
function customDate(timestamp, formatString){
    var YYYY,YY,MMMM,MMM,MM,M,DDDD,DDD,DD,D,hhh,hh,h,mm,m,ss,s,ampm,AMPM,dMod,th;
    var dateObject = new Date(timestamp);
    YY = ((YYYY=dateObject.getFullYear())+"").slice(-2);
    MM = (M=dateObject.getMonth()+1)<10?('0'+M):M;
    MMM = (MMMM=["January","February","March","April","May","June","July","August","September","October","November","December"][M-1]).substring(0,3);
    DD = (D=dateObject.getDate())<10?('0'+D):D;
    DDD = (DDDD=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dateObject.getDay()]).substring(0,3);
    th=(D>=10&&D<=20)?'th':((dMod=D%10)==1)?'st':(dMod==2)?'nd':(dMod==3)?'rd':'th';
    formatString = formatString.replace("#YYYY#",YYYY).replace("#YY#",YY).replace("#MMMM#",MMMM).replace("#MMM#",MMM).replace("#MM#",MM).replace("#M#",M).replace("#DDDD#",DDDD).replace("#DDD#",DDD).replace("#DD#",DD).replace("#D#",D).replace("#th#",th);

    h=(hhh=dateObject.getHours());
    if (h==0) h=24;
    if (h>12) h-=12;
    hh = h<10?('0'+h):h;
    AMPM=(ampm=hhh<12?'am':'pm').toUpperCase();
    mm=(m=dateObject.getMinutes())<10?('0'+m):m;
    ss=(s=dateObject.getSeconds())<10?('0'+s):s;
    return formatString.replace("#hhh#",hhh).replace("#hh#",hh).replace("#h#",h).replace("#mm#",mm).replace("#m#",m).replace("#ss#",ss).replace("#s#",s).replace("#ampm#",ampm).replace("#AMPM#",AMPM);
}

window.addEventListener('load', init, false);
