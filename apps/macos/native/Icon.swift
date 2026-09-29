import AppKit
let destination=CommandLine.arguments[1]
let image=NSImage(size:NSSize(width:1024,height:1024))
image.lockFocus()
NSColor.clear.setFill();NSRect(x:0,y:0,width:1024,height:1024).fill()
let shape=NSBezierPath(roundedRect:NSRect(x:40,y:40,width:944,height:944),xRadius:208,yRadius:208)
let gradient=NSGradient(starting:NSColor(red:0.24,green:0.27,blue:0.28,alpha:1),ending:NSColor(red:0.09,green:0.105,blue:0.11,alpha:1))!
gradient.draw(in:shape,angle:-60)
NSColor(white:1,alpha:0.16).setStroke();shape.lineWidth=2;shape.stroke()
let pi=NSBezierPath();pi.lineWidth=49;pi.lineCapStyle = .round;pi.lineJoinStyle = .round
pi.move(to:NSPoint(x:280,y:668));pi.line(to:NSPoint(x:745,y:668))
pi.move(to:NSPoint(x:415,y:666));pi.curve(to:NSPoint(x:343,y:345),controlPoint1:NSPoint(x:395,y:552),controlPoint2:NSPoint(x:370,y:415))
pi.move(to:NSPoint(x:635,y:666));pi.curve(to:NSPoint(x:589,y:390),controlPoint1:NSPoint(x:608,y:550),controlPoint2:NSPoint(x:584,y:445));pi.curve(to:NSPoint(x:699,y:350),controlPoint1:NSPoint(x:590,y:334),controlPoint2:NSPoint(x:650,y:325))
NSColor(red:0.85,green:0.9,blue:0.83,alpha:1).setStroke();pi.stroke()
image.unlockFocus()
let sizes=[16,32,128,256,512]
for size in sizes {for scale in [1,2] {
 let px=size*scale
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:px,pixelsHigh:px,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap);image.draw(in:NSRect(x:0,y:0,width:px,height:px));NSGraphicsContext.restoreGraphicsState()
 let suffix=scale==2 ? "@2x" : ""
 try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:destination+"/icon_\(size)x\(size)\(suffix).png"))
}}
