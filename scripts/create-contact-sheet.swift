import AppKit
import Foundation

struct Item: Decodable {
    let id: String
    let name: String
    let filename: String
    let source: String
}

guard CommandLine.arguments.count == 4 else {
    fatalError("Usage: swift scripts/create-contact-sheet.swift <image-directory> <manifest> <output.png>")
}

let directory = CommandLine.arguments[1]
let manifestURL = URL(fileURLWithPath: CommandLine.arguments[2])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[3])
let items = try JSONDecoder().decode([Item].self, from: Data(contentsOf: manifestURL))
let columns = 5
let tileWidth = 240
let tileHeight = 205
let imageHeight = 160
let rows = Int(ceil(Double(items.count) / Double(columns)))
let canvas = NSImage(size: NSSize(width: columns * tileWidth, height: rows * tileHeight))

canvas.lockFocus()
NSColor(calibratedWhite: 0.08, alpha: 1).setFill()
NSRect(origin: .zero, size: canvas.size).fill()

let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let textAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph,
]

for (index, item) in items.enumerated() {
    let column = index % columns
    let row = index / columns
    let x = column * tileWidth
    let y = (rows - row - 1) * tileHeight
    let imageURL = URL(fileURLWithPath: directory).appendingPathComponent(item.filename)
    if let image = NSImage(contentsOf: imageURL) {
        let destination = NSRect(x: x + 8, y: y + 37, width: tileWidth - 16, height: imageHeight)
        image.draw(in: destination, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: [.interpolation: NSImageInterpolation.high])
    }
    let label = "\(item.name) [\(item.source)]" as NSString
    label.draw(in: NSRect(x: x + 4, y: y + 8, width: tileWidth - 8, height: 24), withAttributes: textAttributes)
}

canvas.unlockFocus()
guard let data = canvas.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: data),
      let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not render contact sheet")
}
try png.write(to: outputURL)
print("Wrote \(outputURL.path)")
