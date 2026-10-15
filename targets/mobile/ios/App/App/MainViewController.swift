import UIKit
import Capacitor

/// The app's web view controller. App-local plugins live in this target (not
/// in an npm package), so Capacitor can't discover them on its own: register
/// them here, before the web view loads its first page.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SpeechPlugin())
    }
}
