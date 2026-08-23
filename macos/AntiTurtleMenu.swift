import AppKit
import Foundation

private let appVersion = "0.1.0"

private enum ConfigurationError: LocalizedError {
    case missingValue(String)
    case invalidValue(String, String)

    var errorDescription: String? {
        switch self {
        case .missingValue(let option):
            return "Missing value for \(option)."
        case .invalidValue(let option, let value):
            return "Invalid value for \(option): \(value)"
        }
    }
}

private struct AppConfiguration {
    var baseURL = "https://stage-codex-bridge-head-only.vercel.app"
    var session = "head-demo"
    var mode = "HEAD"
    var pollMilliseconds = 500
    var staleMilliseconds = 2_500
    var badSeconds = 3.0
    var cooldownSeconds = 30.0
    var notificationsEnabled = true
    var recoveryNotificationsEnabled = true
    var checkOnly = false
    var showVersion = false

    init(arguments: [String]) throws {
        var index = 0
        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--base-url":
                baseURL = try Self.nextValue(arguments, index: &index, option: argument)
            case "--session":
                session = try Self.nextValue(arguments, index: &index, option: argument)
            case "--mode":
                mode = try Self.nextValue(arguments, index: &index, option: argument).uppercased()
                guard mode == "HEAD" || mode == "HYBRID" else {
                    throw ConfigurationError.invalidValue(argument, mode)
                }
            case "--poll-ms":
                pollMilliseconds = try Self.integerValue(arguments, index: &index, option: argument, minimum: 100)
            case "--stale-ms":
                staleMilliseconds = try Self.integerValue(arguments, index: &index, option: argument, minimum: 100)
            case "--bad-seconds":
                badSeconds = try Self.doubleValue(arguments, index: &index, option: argument, minimum: 0)
            case "--cooldown-seconds":
                cooldownSeconds = try Self.doubleValue(arguments, index: &index, option: argument, minimum: 0)
            case "--no-notifications":
                notificationsEnabled = false
            case "--no-recovery":
                recoveryNotificationsEnabled = false
            case "--check":
                checkOnly = true
            case "--version":
                showVersion = true
            default:
                throw ConfigurationError.invalidValue("argument", argument)
            }
            index += 1
        }

        guard let parsedBaseURL = URL(string: baseURL),
              let scheme = parsedBaseURL.scheme,
              ["http", "https"].contains(scheme),
              parsedBaseURL.host != nil else {
            throw ConfigurationError.invalidValue("--base-url", baseURL)
        }
        guard !session.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ConfigurationError.invalidValue("--session", session)
        }
    }

    var telemetryURL: URL {
        var components = URLComponents(string: baseURL)!
        let existingPath = components.path.hasSuffix("/") ? String(components.path.dropLast()) : components.path
        components.path = existingPath + "/api/telemetry"
        components.queryItems = [
            URLQueryItem(name: "session", value: session),
            URLQueryItem(name: "mode", value: mode),
        ]
        return components.url!
    }

    var hudURL: URL? {
        var components = URLComponents(string: baseURL)
        components?.path = "/"
        components?.queryItems = [
            URLQueryItem(name: "camera", value: "1"),
            URLQueryItem(name: "source", value: mode == "HYBRID" ? "ble" : "head"),
            URLQueryItem(name: "session", value: session),
        ]
        return components?.url
    }

    private static func nextValue(_ arguments: [String], index: inout Int, option: String) throws -> String {
        index += 1
        guard index < arguments.count else { throw ConfigurationError.missingValue(option) }
        return arguments[index]
    }

    private static func integerValue(
        _ arguments: [String],
        index: inout Int,
        option: String,
        minimum: Int
    ) throws -> Int {
        let raw = try nextValue(arguments, index: &index, option: option)
        guard let value = Int(raw), value >= minimum else {
            throw ConfigurationError.invalidValue(option, raw)
        }
        return value
    }

    private static func doubleValue(
        _ arguments: [String],
        index: inout Int,
        option: String,
        minimum: Double
    ) throws -> Double {
        let raw = try nextValue(arguments, index: &index, option: option)
        guard let value = Double(raw), value >= minimum else {
            throw ConfigurationError.invalidValue(option, raw)
        }
        return value
    }
}

private struct TelemetryEnvelope: Decodable {
    let telemetry: Telemetry?
    let receivedAt: String?
}

private struct Telemetry: Decodable {
    let state: String?
    let forwardDeg: Double?
    let badDurationS: Double?
    let streamId: String?
    let seq: Int?
    let receivedAt: String?
}

private enum PosturePresentation {
    case stable
    case pending
    case warning
    case intervention
    case stale

    init(state: String) {
        switch state.uppercased() {
        case "STABLE": self = .stable
        case "PENDING": self = .pending
        case "WARNING": self = .warning
        case "INTERVENTION": self = .intervention
        default: self = .stale
        }
    }

    var color: NSColor {
        switch self {
        case .stable: return .systemGreen
        case .pending: return .systemYellow
        case .warning: return .systemOrange
        case .intervention: return .systemRed
        case .stale: return .secondaryLabelColor
        }
    }

    var label: String {
        switch self {
        case .stable: return "좋은 자세"
        case .pending: return "확인 중"
        case .warning: return "자세 주의"
        case .intervention: return "지금 교정"
        case .stale: return "데이터 대기"
        }
    }
}

private final class AntiTurtleMenuDelegate: NSObject, NSApplicationDelegate {
    private let configuration: AppConfiguration
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let postureItem = NSMenuItem(title: "상태: 데이터 대기", action: nil, keyEquivalent: "")
    private let angleItem = NSMenuItem(title: "머리 기준 편차: --°", action: nil, keyEquivalent: "")
    private let connectionItem = NSMenuItem(title: "연결: 확인 중", action: nil, keyEquivalent: "")
    private let sourceItem: NSMenuItem
    private let notificationItem = NSMenuItem(title: "자세 알림", action: #selector(toggleNotifications), keyEquivalent: "")
    private var pollTimer: Timer?
    private var requestInFlight = false
    private var lastEventID: String?
    private var lastAlertAt = Date.distantPast
    private var alertActive = false
    private var notificationsEnabled: Bool

    init(configuration: AppConfiguration) {
        self.configuration = configuration
        self.notificationsEnabled = configuration.notificationsEnabled
        self.sourceItem = NSMenuItem(
            title: "소스: \(configuration.mode) · \(configuration.session)",
            action: nil,
            keyEquivalent: ""
        )
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        configureMenu()
        renderStale(message: "연결: 확인 중")
        pollTelemetry()
        pollTimer = Timer.scheduledTimer(
            timeInterval: Double(configuration.pollMilliseconds) / 1_000,
            target: self,
            selector: #selector(pollTelemetry),
            userInfo: nil,
            repeats: true
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        pollTimer?.invalidate()
    }

    private func configureMenu() {
        let menu = NSMenu()
        postureItem.isEnabled = false
        angleItem.isEnabled = false
        connectionItem.isEnabled = false
        sourceItem.isEnabled = false

        menu.addItem(postureItem)
        menu.addItem(angleItem)
        menu.addItem(connectionItem)
        menu.addItem(sourceItem)
        menu.addItem(.separator())

        let openHUDItem = NSMenuItem(title: "카메라 HUD 열기", action: #selector(openHUD), keyEquivalent: "o")
        openHUDItem.target = self
        menu.addItem(openHUDItem)

        notificationItem.target = self
        notificationItem.state = notificationsEnabled ? .on : .off
        menu.addItem(notificationItem)
        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Anti Turtle 종료", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
        statusItem.menu = menu
    }

    @objc private func pollTelemetry() {
        guard !requestInFlight else { return }
        requestInFlight = true

        var request = URLRequest(url: configuration.telemetryURL)
        request.timeoutInterval = 5
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("anti-turtle-menu/\(appVersion)", forHTTPHeaderField: "User-Agent")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.requestInFlight = false

                guard error == nil,
                      let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200,
                      let data,
                      let envelope = try? JSONDecoder().decode(TelemetryEnvelope.self, from: data) else {
                    self.renderStale(message: "연결: 서버 응답 없음")
                    return
                }
                self.handle(envelope)
            }
        }.resume()
    }

    private func handle(_ envelope: TelemetryEnvelope) {
        guard let telemetry = envelope.telemetry,
              let angle = telemetry.forwardDeg,
              let state = telemetry.state,
              let timestamp = parseTimestamp(envelope.receivedAt ?? telemetry.receivedAt),
              Date().timeIntervalSince(timestamp) <= Double(configuration.staleMilliseconds) / 1_000 else {
            renderStale(message: "연결: 새 데이터 대기")
            return
        }

        let presentation = PosturePresentation(state: state)
        let title = String(format: "● %.1f°", angle)
        setStatusTitle(title, color: presentation.color)
        postureItem.title = "상태: \(presentation.label)"
        angleItem.title = String(format: "머리 기준 편차: %.1f°", angle)
        connectionItem.title = "연결: 실시간"
        statusItem.button?.toolTip = "Anti Turtle · \(presentation.label) · \(String(format: "%.1f°", angle))"

        evaluateNotification(telemetry: telemetry, angle: angle, state: state.uppercased())
    }

    private func renderStale(message: String) {
        setStatusTitle("○ --", color: PosturePresentation.stale.color)
        postureItem.title = "상태: 데이터 대기"
        angleItem.title = "머리 기준 편차: --°"
        connectionItem.title = message
        statusItem.button?.toolTip = "Anti Turtle · 새 텔레메트리 대기"
    }

    private func setStatusTitle(_ title: String, color: NSColor) {
        let font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .semibold)
        statusItem.button?.attributedTitle = NSAttributedString(
            string: title,
            attributes: [.foregroundColor: color, .font: font]
        )
        statusItem.length = NSStatusItem.variableLength
    }

    private func evaluateNotification(telemetry: Telemetry, angle: Double, state: String) {
        let eventID: String?
        if let streamID = telemetry.streamId, let sequence = telemetry.seq {
            eventID = "\(streamID):\(sequence)"
        } else {
            eventID = nil
        }
        if let eventID, eventID == lastEventID { return }
        if let eventID { lastEventID = eventID }

        let badDuration = telemetry.badDurationS ?? 0
        let alertDue = state == "INTERVENTION" ||
            (["WARNING", "INTERVENTION"].contains(state) && badDuration >= configuration.badSeconds)

        if alertDue,
           Date().timeIntervalSince(lastAlertAt) >= configuration.cooldownSeconds {
            lastAlertAt = Date()
            alertActive = true
            guard notificationsEnabled else { return }
            showNotification(
                body: "턱을 당기고 정수리를 위로 세워주세요.",
                subtitle: String(format: "머리 기준 편차 %.1f° · %.1f초", angle, badDuration)
            )
            return
        }

        if state == "STABLE", alertActive {
            alertActive = false
            guard notificationsEnabled, configuration.recoveryNotificationsEnabled else { return }
            showNotification(
                body: "좋은 자세로 돌아왔습니다.",
                subtitle: String(format: "머리 기준 편차 %.1f°", angle)
            )
        }
    }

    private func showNotification(body: String, subtitle: String) {
        DispatchQueue.global(qos: .utility).async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
            process.arguments = [
                "-e", "on run argv",
                "-e", "set notificationTitle to item 1 of argv",
                "-e", "set notificationBody to item 2 of argv",
                "-e", "set notificationSubtitle to item 3 of argv",
                "-e", "display notification notificationBody with title notificationTitle subtitle notificationSubtitle sound name \"Glass\"",
                "-e", "end run",
                "--", "Anti Turtle", body, subtitle,
            ]
            try? process.run()
        }
    }

    private func parseTimestamp(_ value: String?) -> Date? {
        guard let value else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) { return date }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }

    @objc private func toggleNotifications() {
        notificationsEnabled.toggle()
        notificationItem.state = notificationsEnabled ? .on : .off
    }

    @objc private func openHUD() {
        guard let hudURL = configuration.hudURL else { return }
        NSWorkspace.shared.open(hudURL)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

do {
    let configuration = try AppConfiguration(arguments: Array(CommandLine.arguments.dropFirst()))
    if configuration.showVersion {
        print("Anti Turtle Menu \(appVersion)")
        exit(0)
    }
    if configuration.checkOnly {
        print("telemetry=\(configuration.telemetryURL.absoluteString)")
        print("notifications=\(configuration.notificationsEnabled ? "on" : "off")")
        exit(0)
    }

    let application = NSApplication.shared
    let delegate = AntiTurtleMenuDelegate(configuration: configuration)
    application.delegate = delegate
    application.run()
} catch {
    fputs("Anti Turtle Menu: \(error.localizedDescription)\n", stderr)
    exit(2)
}
