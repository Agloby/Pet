using Toybox.Application;
using Toybox.WatchUi;

class KernApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() {
        var view = new KernView();
        return [view, new KernDelegate(view)];
    }
}
