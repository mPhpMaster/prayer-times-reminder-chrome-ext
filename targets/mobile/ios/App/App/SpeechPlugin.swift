import Foundation
import AVFoundation
import Speech
import UIKit
import Capacitor

/// Continuous speech-to-text for the dhikr game (iOS side of `Platform.speech`).
///
/// Same JS contract as the Android `SpeechPlugin` (jsName "Speech"), so
/// targets/mobile/web/adapter.js drives both unchanged:
///   isAvailable() -> { available, onDevice, permission, dialog: false, whisper: false }
///   start({ lang, preferOffline }) — resolves once the mic is open
///   stop()
///   events: "partial" {text}, "final" {text}, "state" {listening}, "error" {code, message}
///
/// SFSpeechRecognizer streams one growing transcription per task, so the plugin
/// cuts a task into "final" chunks itself: after a short pause in speech (no new
/// words for SILENCE seconds) it ends the task, emits its text as "final", and
/// starts a fresh task on the same audio stream — as Android's restart loop does.
/// Audio never leaves Apple's recognizer; nothing is recorded or stored.
@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkSupport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private static let silence: TimeInterval = 1.2   // pause that closes a chunk
    private static let maxTask: TimeInterval = 50    // Apple caps a task at ~1 min
    private static let maxErrorStreak = 4             // failed tasks in a row before giving up

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var continuous = false
    private var preferOffline = false
    private var lastText = ""
    private var errorStreak = 0
    private var generation = 0 // callbacks from a superseded task are ignored
    private var silenceTimer: Timer?
    private var maxTimer: Timer?

    override public func load() {
        // Never keep the mic open behind the user's back.
        NotificationCenter.default.addObserver(
            self, selector: #selector(didEnterBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    @objc private func didEnterBackground() {
        DispatchQueue.main.async {
            guard self.continuous || self.audioEngine.isRunning else { return }
            self.continuous = false
            self.stopEngine()
            self.emitState(false)
        }
    }

    // MARK: - JS methods

    @objc func isAvailable(_ call: CAPPluginCall) {
        let rec = SFSpeechRecognizer(locale: Locale(identifier: "ar-SA"))
        let granted = SFSpeechRecognizer.authorizationStatus() == .authorized
            && AVAudioSession.sharedInstance().recordPermission == .granted
        call.resolve([
            "available": rec?.isAvailable ?? false,
            "onDevice": rec?.supportsOnDeviceRecognition ?? false,
            "permission": granted,
            "dialog": false,  // no system voice dialog on iOS
            "whisper": false  // the bundled Whisper engine is Android-only
        ])
    }

    @objc func checkSupport(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "ar-SA"
        let wanted = Locale(identifier: lang).identifier.replacingOccurrences(of: "_", with: "-").lowercased()
        let supported = SFSpeechRecognizer.supportedLocales().contains {
            $0.identifier.replacingOccurrences(of: "_", with: "-").lowercased() == wanted
        }
        let rec = SFSpeechRecognizer(locale: Locale(identifier: lang))
        call.resolve([
            "supported": supported,
            "onDevice": (rec?.supportsOnDeviceRecognition ?? false) ? "available" : "unavailable"
        ])
    }

    @objc func downloadModel(_ call: CAPPluginCall) {
        // iOS manages its own speech models (Settings > General > Keyboard > Dictation).
        call.resolve(["ok": false, "reason": "managed-by-ios"])
    }

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "ar-SA"
        let offline = call.getBool("preferOffline") ?? false
        ensureAccess { granted, reason in
            DispatchQueue.main.async {
                guard granted else {
                    call.reject(reason)
                    return
                }
                do {
                    try self.begin(lang: lang, preferOffline: offline)
                    call.resolve()
                } catch let e as SpeechFailure {
                    call.reject(e.reason)
                } catch {
                    call.reject(error.localizedDescription)
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let wasRunning = self.continuous || self.audioEngine.isRunning
            self.continuous = false
            // Words heard since the last pause still count: hand them over now,
            // the task is cancelled below and would never deliver them.
            let pending = self.lastText.trimmingCharacters(in: .whitespacesAndNewlines)
            self.lastText = ""
            self.stopEngine()
            if !pending.isEmpty { self.notifyListeners("final", data: ["text": pending]) }
            if wasRunning { self.emitState(false) }
            call.resolve()
        }
    }

    // MARK: - Recognition

    private struct SpeechFailure: Error { let reason: String }

    private func ensureAccess(_ done: @escaping (Bool, String) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                done(false, "speech-denied")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { ok in
                done(ok, ok ? "" : "microphone-denied")
            }
        }
    }

    private func begin(lang: String, preferOffline: Bool) throws {
        stopEngine()
        guard let rec = SFSpeechRecognizer(locale: Locale(identifier: lang)) else {
            throw SpeechFailure(reason: "language-not-supported")
        }
        guard rec.isAvailable else { throw SpeechFailure(reason: "recognizer-unavailable") }
        recognizer = rec
        self.preferOffline = preferOffline

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.channelCount > 0, format.sampleRate > 0 else {
            throw SpeechFailure(reason: "no-microphone")
        }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()

        continuous = true
        errorStreak = 0
        startTask()
        emitState(true)
    }

    private func startTask() {
        guard continuous, let rec = recognizer else { return }
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if preferOffline && rec.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }
        if #available(iOS 16.0, *) { req.addsPunctuation = false }
        request = req
        lastText = ""
        generation += 1
        let gen = generation
        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async { self?.handle(gen: gen, result: result, error: error) }
        }
        maxTimer?.invalidate()
        maxTimer = Timer.scheduledTimer(withTimeInterval: SpeechPlugin.maxTask, repeats: false) { [weak self] _ in
            self?.request?.endAudio()
        }
    }

    private func handle(gen: Int, result: SFSpeechRecognitionResult?, error: Error?) {
        guard gen == generation else { return }
        if let result = result {
            let text = result.bestTranscription.formattedString
            if result.isFinal {
                finishTask(text: text)
                return
            }
            if !text.isEmpty && text != lastText {
                lastText = text
                notifyListeners("partial", data: ["text": text])
                armSilenceTimer()
            }
            return
        }
        guard let error = error else { return }
        let ns = error as NSError
        // "No speech detected", a cancelled or timed-out task: just listen again,
        // unless it keeps failing (no network, dictation turned off, ...).
        if continuous && errorStreak < SpeechPlugin.maxErrorStreak {
            if lastText.isEmpty { errorStreak += 1 }
            finishTask(text: lastText)
        } else if continuous {
            fail(code: ns.code, message: ns.localizedDescription)
        }
    }

    private func armSilenceTimer() {
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: SpeechPlugin.silence, repeats: false) { [weak self] _ in
            // Ends the task; the recognizer answers with its isFinal result.
            self?.request?.endAudio()
        }
    }

    private func finishTask(text: String) {
        silenceTimer?.invalidate()
        silenceTimer = nil
        maxTimer?.invalidate()
        maxTimer = nil
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty {
            errorStreak = 0
            notifyListeners("final", data: ["text": t])
        }
        lastText = ""
        task = nil
        request = nil
        if continuous { startTask() } else { emitState(false) }
    }

    private func stopEngine() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        maxTimer?.invalidate()
        maxTimer = nil
        generation += 1
        task?.cancel()
        task = nil
        request?.endAudio()
        request = nil
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func fail(code: Int, message: String) {
        continuous = false
        stopEngine()
        notifyListeners("error", data: ["code": code, "message": message])
        emitState(false)
    }

    private func emitState(_ listening: Bool) {
        notifyListeners("state", data: ["listening": listening])
    }
}
