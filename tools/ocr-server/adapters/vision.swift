// vision.swift — Apple Vision text recognition, for the fold's OCR server. Runs on this Mac (the Vision
// framework's text recogniser is on-device); it opens no sockets, and tools/ocr-server/check.mjs proves it by
// running it with the network denied by the OS.
//
//   vision --selftest                         -> one JSON line: { ok, engine, revision, languages }
//   vision accurate|fast [--lang en-US,fr-FR] image...
//                                             -> one JSON line per image:
//        { image, w, h, ms, lines:[{ t, c, b:[x0,y0,x1,y1], words:[{ t, b }] }] }
// Boxes are in image pixels, origin top-left. `c` is Vision's own 0..1 confidence for the line. `fast` is in
// here for completeness; measured against a PDF's text layer it was far worse than `accurate` and is never used.
import Vision
import AppKit
import Foundation

func emit(_ o: [String: Any]) {
  if let d = try? JSONSerialization.data(withJSONObject: o, options: [.withoutEscapingSlashes]),
     let s = String(data: d, encoding: .utf8) { print(s); fflush(stdout) }
}

let args = Array(CommandLine.arguments.dropFirst())

if args.first == "--selftest" {
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = .accurate
  emit(["ok": true, "engine": "apple-vision", "revision": VNRecognizeTextRequest.currentRevision,
        "languages": (try? req.supportedRecognitionLanguages()) ?? []])
  exit(0)
}

guard args.count >= 2, args[0] == "accurate" || args[0] == "fast" else {
  fputs("usage: vision --selftest | vision accurate|fast [--lang en-US,...] image...\n", stderr)
  exit(2)
}
let level: VNRequestTextRecognitionLevel = args[0] == "fast" ? .fast : .accurate
var langs = ["en-US"]
var first = 1
if args[1] == "--lang", args.count >= 4 { langs = args[2].split(separator: ",").map(String.init); first = 3 }

for path in args[first...] {
  let t0 = Date()
  guard let img = NSImage(contentsOfFile: path),
        let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    emit(["image": path, "error": "could not decode the image"]); continue
  }
  let W = Double(cg.width), H = Double(cg.height)
  func px(_ r: CGRect) -> [Int] {   // Vision: normalised, origin bottom-left -> pixels, origin top-left
    [Int(r.minX * W), Int((1 - r.maxY) * H), Int(r.maxX * W), Int((1 - r.minY) * H)]
  }
  let req = VNRecognizeTextRequest()
  req.recognitionLevel = level
  req.usesLanguageCorrection = true
  req.recognitionLanguages = langs
  do { try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req]) }
  catch { emit(["image": path, "error": "\(error)"]); continue }
  var lines: [[String: Any]] = []
  for o in req.results ?? [] {
    guard let c = o.topCandidates(1).first else { continue }
    let s = c.string
    var words: [[String: Any]] = []
    var i = s.startIndex
    while i < s.endIndex {
      if s[i].isWhitespace { i = s.index(after: i); continue }
      var j = i
      while j < s.endIndex && !s[j].isWhitespace { j = s.index(after: j) }
      var w: [String: Any] = ["t": String(s[i..<j])]
      if let bb = try? c.boundingBox(for: i..<j) { w["b"] = px(bb.boundingBox) }
      words.append(w)
      i = j
    }
    lines.append(["t": s, "c": Double(c.confidence), "b": px(o.boundingBox), "words": words])
  }
  emit(["image": path, "w": cg.width, "h": cg.height, "ms": Int(Date().timeIntervalSince(t0) * 1000), "lines": lines])
}
