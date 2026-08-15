import UIKit
import WebKit

final class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 247/255, green: 248/255, blue: 245/255, alpha: 1)

        let controller = WKUserContentController()
        controller.add(self, name: "iosBridge")
        let bridgeScript = """
        window.IOSBridge = {
          exportJson: function(json, filename) {
            window.webkit.messageHandlers.iosBridge.postMessage({action:'exportJson', json:json, filename:filename});
          },
          toast: function(message) {
            window.webkit.messageHandlers.iosBridge.postMessage({action:'toast', message:message});
          }
        };
        window.AndroidBridge = window.IOSBridge;
        """
        controller.addUserScript(WKUserScript(source: bridgeScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.websiteDataStore = .default()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.allowsInlineMediaPlayback = true

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html") else {
            showAlert(title: "Başlatma hatası", message: "Uygulama dosyaları bulunamadı.")
            return
        }
        let readAccess = indexURL.deletingLastPathComponent()
        webView.loadFileURL(indexURL, allowingReadAccessTo: readAccess)
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "iosBridge")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url,
              let scheme = url.scheme?.lowercased() else {
            decisionHandler(.allow)
            return
        }

        if ["tel", "mailto"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if ["http", "https"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "iosBridge",
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "exportJson":
            guard let json = body["json"] as? String else { return }
            let filename = (body["filename"] as? String)?.isEmpty == false ? body["filename"] as! String : "komsum-yedek.json"
            shareJSON(json: json, filename: filename)
        case "toast":
            if let text = body["message"] as? String { showToast(text) }
        default:
            break
        }
    }

    private func shareJSON(json: String, filename: String) {
        do {
            let safeName = filename.replacingOccurrences(of: "/", with: "-")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
            if let data = json.data(using: .utf8) {
                try data.write(to: url, options: .atomic)
            }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = view
                popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            }
            present(sheet, animated: true)
        } catch {
            showAlert(title: "Yedekleme hatası", message: "Yedek dosyası oluşturulamadı.")
        }
    }

    private func showToast(_ message: String) {
        let label = PaddingLabel()
        label.text = message
        label.textColor = .white
        label.backgroundColor = UIColor.black.withAlphaComponent(0.78)
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.layer.cornerRadius = 12
        label.clipsToBounds = true
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            label.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.82)
        ])
        UIView.animate(withDuration: 0.25, delay: 2.0, options: []) {
            label.alpha = 0
        } completion: { _ in
            label.removeFromSuperview()
        }
    }

    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Tamam", style: .default))
        present(alert, animated: true)
    }
}

private final class PaddingLabel: UILabel {
    private let inset = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: inset))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + inset.left + inset.right,
                      height: size.height + inset.top + inset.bottom)
    }
}
