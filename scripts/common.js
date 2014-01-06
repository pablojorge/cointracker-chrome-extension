// keys for accessing local storage
var	PRICES_KEY = 'prices',
	SETTINGS_KEY = 'userSettings';

var SETTINGS_DEFAULTS = {
        'main-exchange': 'coinbase',
		'poll-frequency': '5',
		'lookup-amount': '1',
		'timestamp': Date.now()
	};

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
    };

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

