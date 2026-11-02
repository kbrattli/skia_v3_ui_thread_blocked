# Skia 3.9: the first draw of a `<Canvas>` blocks the UI thread on iOS

On a fresh install, the first draw of a plain `<Canvas>` blocks the main thread on iOS. After that it's fine, including after a relaunch. This repo is the smallest version of my app that shows it: a card that opens into a page, with the same open animation and the same `<Canvas>` as the app.

All of this is iOS.

## Video

[first-vs-second-open.mp4](docs/first-vs-second-open.mp4), at 0.125x. Left pair: the first open after a fresh install, on 2.14 and 3.9. They freeze, then jump to the finished page. Right pair: the same installs relaunched, which play through. It's my app on an iPhone 17 Pro simulator in a debug build, not this repo, with the page's window written per frame on the UI thread on all four (`CLIP_ON_UI_THREAD` below). The page is a different flat colour on the two sides only because of how my app picks a colour in that mode.

## What's in it

- `App.tsx`: the card, plus a readout of the longest UI thread gap since the tap. It reads the gap in a `useFrameCallback`, which runs on the main thread on iOS.
- `src/Overlay.tsx`: the card-to-page animation from my app, with `react-native-smooth-clip-view`.
- `src/SunArcCanvas.tsx`, `src/sunArc.ts`: the drawing, copied unchanged from my app. No warm-up, no `static`, no flags.
- `src/SunCard.tsx`: the card around it, with a fixed evening so every run draws the same thing. The canvas mounts in the commit after the card's first layout, as in the app.

`react-native-skia` 3.9.0, Expo SDK 57, RN 0.86.3, New Architecture, Reanimated 4.7.1. There's no `react-native-webgpu` here.

## Run it

```bash
npm install
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/SkiaV3Blocked.xcworkspace -scheme SkiaV3Blocked -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath ios/build-sim
```

Make the simulator cold, install, and launch. Deleting the app isn't enough on a simulator, because `SimMetalHost` keeps compiled shaders until a reboot and also has a copy on disk:

```bash
xcrun simctl shutdown <udid>
xcrun simctl boot <udid>
rm -rf "$(getconf DARWIN_USER_CACHE_DIR)com.apple.CoreSimulator.SimRenderingServices.SimMetalHost"/com.apple.metal*
# Wait about 40 s for the simulator to settle after the boot.
xcrun simctl uninstall <udid> com.kbrattli.skiav3uithreadblocked
xcrun simctl install <udid> ios/build-sim/Build/Products/Release-iphonesimulator/SkiaV3Blocked.app
xcrun simctl launch <udid> com.kbrattli.skiav3uithreadblocked
```

Then:

1. Tap the card and read the gap at the bottom of the screen.
2. Tap the page to close it, tap the card again, and read the gap. It's clean.
3. Force quit, reopen, tap the card, and read the gap. It's clean too.

## Results

### This repo

iPhone 17 Pro simulator, iOS 27, Release, cold as above. Longest UI thread gap:

| Take | First open | Reopen, same run | Second launch |
| --- | --- | --- | --- |
| 1 | 1199 ms | none over 50 ms | none over 50 ms |
| 2 | 1186 ms | none over 50 ms | none over 50 ms |
| 3 | 1190 ms | none over 50 ms | none over 50 ms |

Every take compiles 32 Metal shaders since launch, all of them after the tap. In the screen recordings of those three takes the screen holds for 1190–1200 ms.

This is longer than the stall in my app on the same simulator (about 500 ms, below), and I wouldn't read 1.2 s as the real cost. Nothing has compiled in this process before the tap, and the first compile alone takes 507 ms in the compiler log. My app compiles 58 other shaders before the tap, for its map, sky and CoreImage.

I've only run this repo on the simulator. The phone numbers below are from my app.

### My app, iPhone 15 Pro, release

iOS 27.0.1, tapped by hand, uninstall and install before each first open. Longest main thread gap:

| | 2.14.0 | 3.9.0 |
| --- | --- | --- |
| First open after install | 359 ms | 524 ms |
| Second launch of that install | 122 ms | 127 ms |

That's one clean install per version, so it shows the stall is there on 3.9.0 better than it shows how the two versions compare. About 125 ms on both second launches looks like the cost of opening the page, not Skia. Another 3.9.0 install gave 562 / 131 ms, but a UI automation runner was attached for its first open, so I'm not counting it.

### My app, iPhone 17 Pro simulator, debug

The WebGPU sky canvases are off for these takes, so the Skia canvas draws while the page opens.

| | 2.14.0 | 3.9.0 |
| --- | --- | --- |
| Main thread stall, cold | 417–430 ms (4 takes) | 498–508 ms (4 takes) |
| Longest main thread gap, warm | 62 ms (2 takes) | 57 ms (3 takes) |
| Metal compiles after the tap, cold / warm | 34 / 0 | 32 / 0 |
| Tap to the drawing on screen, cold | 776–784 ms | 870–896 ms |
| Tap to the drawing on screen, warm | 632–644 ms | 626–637 ms |

## Where the main thread waits

Recording runs on the `RNSkia Render` threads and the pipelines compile on Dawn's workers. On iOS, though, the display link is on the main run loop (`SkiaView.mm`), and the first present waits for those pipelines.

This is my app on the iPhone 15 Pro, release, recorded with Instruments on one more fresh 3.9.0 install. The recorder makes it run long: the Hangs instrument reports 655 ms on the main thread. 653 of the 656 ms it spends in that window are in one display link tick:

```
-[SkiaView onFrame:]
  RNSkView::presentFrame
    RNSkWindowSurface::presentRecordings
      DawnContext::insertRecordings
        QueueManager::addRecording
          ...
          529 ms
            DawnCommandBuffer::addDrawPass -> bindGraphicsPipeline
              DawnGraphicsPipeline::dawnRenderPipeline
                dawn::native::EventManager::WaitAny
          112 ms
            DawnCommandBuffer::beginRenderPass
              CommandEncoder::BeginRenderPass -> ExpandResolveTextureWithDraw
                DeviceBase::CreateRenderPipeline
                  metal::ShaderModule::CreateFunction -> newLibraryWithSource
          9 ms
            newRenderPipelineState for that same pipeline
```

The second group is Dawn's own pipeline for `ExpandResolveTextureWithDraw`, and it compiles directly on the main thread.

`sample` shows the same stack on the simulator, in both apps:

| | In `onFrame` | `WaitAny` | `ExpandResolveTextureWithDraw` |
| --- | --- | --- | --- |
| My app | 183 samples | 138 | 38 |
| This repo | 476 samples | 427 | 41 |

## Seeing the stall

`CLIP_ON_UI_THREAD` at the top of `src/Overlay.tsx` picks how the page's window animates:

- `true`, the default: the window is written per frame on the UI thread, so it freezes where it is during the stall and then jumps to the finished page. The takes above use this, and so do the numbers from my app.
- `false`: the window runs on Core Animation, as my shipped app does. It keeps opening smoothly through the stall, because the render server doesn't need the main thread, but the UI thread is still blocked. One cold take gave 1243 ms, and the sun card only appeared about 1.8 s after the press.

## What I do in the app

I draw on a CPU surface (`Skia.Surface.MakeRaster` on 3.x) on a worklet runtime and show the PNG in an RN `<Image>`. Nothing compiles, but it only works for drawings that don't change every frame.
