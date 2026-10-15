using Toybox.WatchUi;

class KernDelegate extends WatchUi.BehaviorDelegate {
    private var _view;

    function initialize(view) {
        BehaviorDelegate.initialize();
        _view = view;
    }

    function onSelect() {
        _view.shareSnack();
        return true;
    }

    function onMenu() {
        _view.refresh();
        return true;
    }

    function onBack() {
        WatchUi.popView(WatchUi.SLIDE_IMMEDIATE);
        return true;
    }
}
