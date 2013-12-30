//adding listener when body is loaded to call init function.
var CURRENT_KEY = 'current',
	SETTINGS_KEY = 'userSettings';

var exchanges = ["coinbase", "mtgox", "btce", "virwoxbtc", "virwoxsll"],
    pending = [];

function init() {
	chrome.runtime.onMessage.addListener(
		function(message, sender, sendResponse) {
			if (message.priceUpdated || message.priceUnchanged)
				updateViewPrices(message.exchange);
			if (message.priceCheckFailed)
				updateViewError();
		});

    refreshPrices(false);

	$('#refresh-link').click(function(ev){
        refreshPrices(true);
    });

    document.getElementById('prices').focus();
}

function updateViewPrices(exchange) {
	chrome.storage.sync.get(null, function(items){
		$('.lookup-amount').html(items[SETTINGS_KEY]['lookup-amount']);		
		$('.lookup-amount-sll').html(items[SETTINGS_KEY]['lookup-amount-sll']);		

        function formatPrice(number){return Number(number).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');}

        prices = items.prices[exchange].current;

		$('#' + exchange + '-price-spot').html(formatPrice(prices.spotPrice));
		$('#' + exchange + '-price-buy').html(formatPrice(prices.buyPrice));
		$('#' + exchange + '-price-sell').html(formatPrice(prices.sellPrice));
		$('#' + exchange + '-timestamp').html(customDate(prices.timestamp, '#DD#/#MM#/#YY# #hh#:#mm##ampm#'));

	    $('#' + exchange + '-price-cluster').removeClass('hide');
		$('#' + exchange + '-updated-at').removeClass('invisible');

        pending.splice(pending.indexOf(exchange), 1);

        if(!pending.length) {
		    $('#price-loading').addClass('hide');
		}
	});
}

function refreshPrices(force) {
    $('#price-loading').removeClass('hide');

	chrome.runtime.getBackgroundPage(function(bg) {
		chrome.storage.sync.get(SETTINGS_KEY, function(items){
            exchanges.forEach(function(exchange){
	            $('#' + exchange + '-price-cluster').addClass('hide');
		        $('#' + exchange + '-updated-at').addClass('invisible');
    			bg.checkPrice(exchange, items, force);
                pending.push(exchange);
            });
		});
    });
}

function updateViewError() {
	$('#price-cluster, #price-loading').addClass('hide');
	$('#price-error').removeClass('hide');
	$('#updated-at').addClass('invisible');
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
