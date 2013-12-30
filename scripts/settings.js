var SETTINGS_KEY = 'userSettings',
		SETTINGS_DEFAULTS = {
            'main-exchange': 'coinbase',
			'poll-frequency': '5',
			'lookup-amount': '1',
            'lookup-amount-sll' : '1',
			'timestamp': Date.now()
		};

function init() {
	loadSettings();

	// UI handlers
	$('#user-settings input').on('change', function(){
		saveSettings();
	});
}

function loadSettings() {
	chrome.storage.sync.get(SETTINGS_KEY, function(items){
		// initialize settings
		if( items.userSettings === undefined ){
			saveSettings(SETTINGS_DEFAULTS);
			initializeForm(SETTINGS_DEFAULTS);
		} else {
			// pass user-defined values to the form
			initializeForm(items.userSettings);
		}
	});
}

// fill out the form with the passed values
function initializeForm(properties) {
	for (var key in properties) {
		if( properties.hasOwnProperty( key ) ) {
			switch (key){
                case 'main-exchange':
                    $('#'+key+'-'+properties[key]).attr('checked', true);
                    break
				case 'poll-frequency':
					$('#'+key+properties[key]).attr('checked', true);
					break;
				case 'lookup-amount':
					$('#'+key).val(properties[key]);
					break;
				case 'lookup-amount-sll':
					$('#'+key).val(properties[key]);
					break;
			}
        }
	}
}

function saveSettings(properties) {
	var storageData = {},
			settingsValues;
	if(properties){
		console.log('saving default settings');
		settingsValues = properties;
	} else {
		console.log('saving form values');
		settingsValues = $('#user-settings').serializeObject();
		settingsValues['timestamp'] = Date.now();
	}

	storageData[SETTINGS_KEY] = settingsValues;

	chrome.storage.sync.set(storageData, function(){
		chrome.runtime.sendMessage({settingsSaved: true,  params: storageData});
	});
}

//
// Use internal $.serializeArray to get list of form elements which is
// consistent with $.serialize
//

(function($){
	$.fn.serializeObject = function () {
		"use strict";

		var result = {};
		var extend = function (i, element) {
				var node = result[element.name];

				// If node with same name exists already, need to convert it to an array as it
				// is a multi-value field (i.e., checkboxes)

				if ('undefined' !== typeof node && node !== null) {
					if ($.isArray(node)) {
						node.push(element.value);
					} else {
						result[element.name] = [node, element.value];
					}
				} else {
					result[element.name] = element.value;
				}
		};

		$.each(this.serializeArray(), extend);
		return result;
	};
})(jQuery);

window.addEventListener('load', init, false);
