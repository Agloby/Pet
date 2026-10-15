using Toybox.Graphics;
using Toybox.WatchUi;

class KernView extends WatchUi.View {
    private var _api;
    private var _state;
    private var _status;
    private var _busy;

    function initialize() {
        View.initialize();
        _api = new KernApi(method(:onApiResult));
        _state = null;
        _status = "Opening the reef...";
        _busy = false;
    }

    function onShow() {
        refresh();
    }

    function refresh() {
        if (_busy) { return; }
        _busy = true;
        _status = "Checking the reef...";
        WatchUi.requestUpdate();
        _api.start();
    }

    function shareSnack() {
        if (_busy) { return; }
        _busy = true;
        _status = "Sharing a snack...";
        WatchUi.requestUpdate();
        _api.shareSnack();
    }

    function onApiResult(kind, state, error) {
        _busy = false;
        if (state != null) { _state = state; }
        if (kind == :snack) {
            _status = "Snack shared!";
        } else if (kind == :paired) {
            _status = "Watch paired";
        } else if (error != null) {
            _status = error;
        } else {
            _status = "SELECT: snack  MENU: refresh";
        }
        WatchUi.requestUpdate();
    }

    function onUpdate(dc) {
        var width = dc.getWidth();
        var height = dc.getHeight();
        dc.setColor(0x061b2a, 0x061b2a);
        dc.clear();

        drawWater(dc, width, height);
        drawShark(dc, width / 2, height / 2 - 8, width * 0.26);

        var name = _state == null ? "Kern" : _state["name"];
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 14, Graphics.FONT_MEDIUM, name, Graphics.TEXT_JUSTIFY_CENTER);

        if (_state != null) {
            var fullness = _state["fullness"].toString() + "% full";
            var mood = _state["mood"];
            dc.setColor(0x72e3dc, Graphics.COLOR_TRANSPARENT);
            dc.drawText(width / 2, height - 60, Graphics.FONT_SMALL, fullness + "  ·  " + mood, Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(0x91aab5, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, height - 34, Graphics.FONT_XTINY, _status, Graphics.TEXT_JUSTIFY_CENTER);
    }

    private function drawWater(dc, width, height) {
        dc.setColor(0x0d4a64, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(width / 2, height / 2, width / 2 - 4);
        dc.setColor(0x17677b, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(width / 2, height / 3, width / 3);
        dc.setColor(0x197086, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);
        dc.drawArc(width / 2, 42, width / 3, Graphics.ARC_COUNTER_CLOCKWISE, 205, 335);
        dc.drawArc(width / 2, 49, width / 4, Graphics.ARC_COUNTER_CLOCKWISE, 205, 335);
    }

    private function drawShark(dc, centerX, centerY, size) {
        dc.setColor(0xb9d3dc, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([
            [centerX - size, centerY],
            [centerX - size - 18, centerY - 16],
            [centerX - size - 13, centerY],
            [centerX - size - 18, centerY + 18],
            [centerX - size + 2, centerY + 8],
            [centerX + size, centerY],
            [centerX - size + 4, centerY - 9]
        ]);
        dc.fillPolygon([
            [centerX - 8, centerY - 7],
            [centerX + 2, centerY - size],
            [centerX + 15, centerY - 6]
        ]);
        dc.fillPolygon([
            [centerX - 4, centerY + 6],
            [centerX + 10, centerY + size - 3],
            [centerX + 21, centerY + 4]
        ]);
        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_TRANSPARENT);
        dc.fillCircle(centerX + size - 13, centerY - 4, 2);
    }
}
