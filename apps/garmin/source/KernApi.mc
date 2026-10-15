using Toybox.Application;
using Toybox.Communications;
using Toybox.Lang;
using Toybox.Math;
using Toybox.System;

class KernApi {
    private var _callback;
    private var _baseUrl;
    private var _token;
    private var _clientId;

    function initialize(callback) {
        _callback = callback;
        _baseUrl = Application.Properties.getValue("apiBaseUrl");
        _token = Application.Storage.getValue("garminToken");
        _clientId = Application.Storage.getValue("garminClientId");
        if (_clientId == null) {
            _clientId = "watch-" + System.getTimer().toString() + "-" + Math.rand().toString();
            Application.Storage.setValue("garminClientId", _clientId);
        }
    }

    function start() {
        if (_token != null && _token.length() > 0) {
            requestState();
            return;
        }
        var code = Application.Properties.getValue("pairingCode");
        if (code == null || code.length() == 0) {
            _callback.invoke(:error, null, "Add a pairing code in Connect IQ settings");
            return;
        }
        pair(code);
    }

    function pair(code) {
        Communications.makeWebRequest(
            _baseUrl + "/garmin/pair",
            {
                "code" => code,
                "clientId" => _clientId,
                "name" => "Garmin watch"
            },
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => {"Content-Type" => "application/json"},
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onPairResponse)
        );
    }

    function requestState() {
        Communications.makeWebRequest(
            _baseUrl + "/garmin/pet",
            {},
            requestOptions(Communications.HTTP_REQUEST_METHOD_GET),
            method(:onStateResponse)
        );
    }

    function shareSnack() {
        if (_token == null) {
            start();
            return;
        }
        var actionId = "watch-" + System.getTimer().toString() + "-" + Math.rand().toString();
        Communications.makeWebRequest(
            _baseUrl + "/garmin/actions",
            {"actionId" => actionId, "type" => "share_snack"},
            requestOptions(Communications.HTTP_REQUEST_METHOD_POST),
            method(:onSnackResponse)
        );
    }

    private function requestOptions(methodValue) {
        return {
            :method => methodValue,
            :headers => {
                "Content-Type" => "application/json",
                "Authorization" => "Bearer " + _token
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
    }

    function onPairResponse(code, data) {
        if (code == 201 && data != null && data["token"] != null) {
            _token = data["token"];
            Application.Storage.setValue("garminToken", _token);
            Application.Properties.setValue("pairingCode", "");
            acceptPetState(:paired, data);
            return;
        }
        _callback.invoke(:error, null, "Pairing failed. Create a fresh code in Kern");
    }

    function onStateResponse(code, data) {
        if (code == 200) {
            acceptPetState(:state, data);
        } else if (code == 401) {
            Application.Storage.deleteValue("garminToken");
            _token = null;
            _callback.invoke(:error, null, "Watch access expired. Pair again");
        } else {
            useCachedState("Reef is temporarily offline");
        }
    }

    function onSnackResponse(code, data) {
        if (code == 200) {
            acceptPetState(:snack, data);
        } else if (code == 401) {
            Application.Storage.deleteValue("garminToken");
            _token = null;
            _callback.invoke(:error, null, "Watch access expired. Pair again");
        } else {
            useCachedState("Snack could not sync");
        }
    }

    private function acceptPetState(kind, data) {
        if (data != null && data["petState"] != null) {
            Application.Storage.setValue("petState", data["petState"]);
            _callback.invoke(kind, data["petState"], null);
            return;
        }
        useCachedState("Kern sent an unexpected response");
    }

    private function useCachedState(message) {
        var cached = Application.Storage.getValue("petState");
        _callback.invoke(:cached, cached, message);
    }
}
