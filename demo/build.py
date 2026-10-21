#!/usr/bin/env python3
# Builds the Mandate demo video from the raw simulator recording.
import os, subprocess, sys

D = os.path.dirname(os.path.abspath(__file__))
RAW = f"{D}/clips/walkthrough.mp4"
OUT = f"{D}/out"
os.makedirs(OUT, exist_ok=True)

BG = "#F6F3EC"
INK = "#16161A"
SUB = "#4A4A50"
TEAL = "#5E9C93"
SERIF = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
SANSB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"

# Phone placement (recording is 1320x2868).
PW, PH = 442, 960
PX, PY = 1219, 60
OFFSET = 5.3  # step marks are this many seconds ahead of the video


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{r.stderr[-2000:]}")


def frame_base():
    path = f"{OUT}/frame.png"
    x0, y0, x1, y1 = PX, PY, PX + PW, PY + PH
    run(["magick", "-size", "1920x1080", f"xc:{BG}", "-fill", INK, "-draw",
         f"roundrectangle {x0-12},{y0-12},{x1+12},{y1+12},64,64", f"{OUT}/fb.png"])
    run(["magick", "-size", "1920x1080", "xc:white", "-fill", "black", "-draw",
         f"roundrectangle {x0},{y0},{x1},{y1},52,52", f"{OUT}/mask.png"])
    run(["magick", f"{OUT}/fb.png", f"{OUT}/mask.png", "-alpha", "off",
         "-compose", "CopyOpacity", "-composite", path])
    return path


def wordmark(base, out, x=140, y=64, size=44):
    run(["magick", base,
         "(", "-background", "none", "-font", SERIF, "-pointsize", str(size), "-fill", INK, "label:mandate",
         "-font", SERIF, "-pointsize", str(size), "-fill", TEAL, "label:.", "+append", ")",
         "-geometry", f"+{x}+{y}", "-composite",
         "-font", SANS, "-pointsize", "24", "-fill", SUB, "-annotate", "+140+1030",
         "Base Sepolia test network · test funds only", out])


def caption(base, out, kicker, head, sub, width=960):
    block = ["(", "-background", "none",
             "-size", f"{width}x", "-font", SANSB, "-pointsize", "26", "-fill", TEAL, f"caption:{kicker.upper()}",
             "-size", f"{width}x18", "xc:none",
             "-size", f"{width}x", "-font", SERIF, "-pointsize", "78", "-fill", INK, "-interline-spacing", "-6", f"caption:{head}",
             "-size", f"{width}x22", "xc:none",
             "-size", f"{width}x", "-font", SANS, "-pointsize", "36", "-fill", SUB, "-interline-spacing", "8", f"caption:{sub}",
             "-append", ")"]
    run(["magick", base, *block, "-gravity", "West", "-geometry", "+140+0", "-composite", out])


def steady_source():
    # The simulator writes a frame only when the screen changes; a steady
    # 30 fps copy keeps cuts aligned with the step marks.
    path = f"{OUT}/steady.mp4"
    if not os.path.exists(path):
        run(["ffmpeg", "-v", "error", "-y", "-i", RAW, "-vf", f"scale={PW}:{PH},fps=30",
             "-fps_mode", "cfr", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
             "-g", "30", path])
    return path


def phone_segment(i, a, b, speed, png):
    dur = (b - a) / speed
    out = f"{OUT}/seg{i:02d}.mp4"
    fc = (f"[0:v]setpts=(PTS-STARTPTS)/{speed},fps=30[ph];"
          f"color=c={BG}:s=1920x1080:r=30[bg];[bg][ph]overlay={PX}:{PY}:shortest=1[b];"
          f"[b][1:v]overlay=0:0:shortest=1,format=yuv420p[v]")
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.2f}", "-to", f"{b:.2f}", "-i", f"{OUT}/steady.mp4",
         "-loop", "1", "-i", png, "-filter_complex", fc, "-map", "[v]", "-t", f"{dur:.2f}",
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", out])
    return out, dur


def clip_segment(i, src, start, dur, png, still=False):
    out = f"{OUT}/seg{i:02d}.mp4"
    inp = (["-loop", "1", "-t", str(dur), "-i", src] if still
           else ["-ss", str(start), "-i", src])
    fc = (f"[0:v]scale={PW}:{PH},fps=30,setpts=PTS-STARTPTS,"
          f"tpad=stop_mode=clone:stop_duration={dur}[ph];"
          f"color=c={BG}:s=1920x1080:r=30[bg];[bg][ph]overlay={PX}:{PY}:shortest=1[b];"
          f"[b][1:v]overlay=0:0:shortest=1,format=yuv420p[v]")
    run(["ffmpeg", "-v", "error", "-y", *inp, "-loop", "1", "-i", png,
         "-filter_complex", fc, "-map", "[v]", "-t", str(dur),
         "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", out])
    return out, dur


def card_segment(i, png, dur):
    out = f"{OUT}/seg{i:02d}.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", str(dur), "-i", png,
         "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out])
    return out, dur


M = lambda t: t - OFFSET  # step mark -> video time

# (start, end, speed, kicker, headline, subline)
PHONE = [
    (M(20.1), M(25.1), 1.0, "Step 1 · Start", "A fresh install", "Your wallet lives on this phone. Agents get a separate one."),
    (M(25.1), M(49.1), 2.0, "Step 2 · Restore", "Restore the demo wallet", "Twelve test words. A demo account with test funds only."),
    (M(49.1), M(69.8), 2.0, "Step 3 · Unlock", "Face ID guards every signature", "The same address comes back, along with its agent wallet."),
    (M(69.8), M(74.9), 1.0, "Step 4 · Your wallet", "Your own wallet", "Receive, send and scan. Your keys never leave the phone."),
    (M(74.9), M(92.2), 1.5, "Step 5 · Agent wallet", "A separate wallet for your agent", "A smart-contract wallet holding 19.62 test USDC. It can't touch your account."),
    (M(92.2), M(101.0), 1.0, "Step 6 · Safety", "One tap stops it", "Pause all agents, or freeze the wallet until you unfreeze it."),
    (M(101.0), M(118.4), 1.5, "Step 7 · Limits", "You set the limits", "0.50 per payment, 2 a day, 5 a week. Read from the chain, enforced by the contract."),
    (M(118.4), M(146.5), 2.5, "Step 8 · Who it may pay", "Only who you allow", "An allowlist of recipients. The test shop is on it."),
    (M(146.5), M(165.3), 2.0, "Step 9 · Delivery", "A test delivery address", "It stays on the phone. Orders carry only a salted fingerprint."),
    (M(165.3), M(202.4), 3.0, "Step 10 · Connect", "Connect the agent wallet", "After a restore, register it with the Mandate service again."),
    (M(202.4), M(221.3), 2.0, "Step 10 · Connect", "Connected", "The service finds the same wallet recorded on chain."),
    (M(221.3), M(231.0), 1.0, "Step 11 · Ask", "Just ask", "Try an example, or type anything. The shop is one of the services it can pay."),
    (M(231.0), M(245.1), 1.5, "Step 12 · Search", "The agent searches the shop", "Each tool call shows as a step while it works."),
    (M(245.1), M(250.8), 1.0, "Step 12 · Search", "Real products, real prices", "Straight from the Mandate Test Shop. Nothing invented."),
    (M(250.8), M(274.1), 2.0, "Step 13 · Choose", "You choose. It asks what's missing.", "Cloudstep Lite. Which size?"),
    (M(274.1), M(289.1), 1.5, "Step 14 · Order", "It prepares the order", "It can open an order, but it can't pay on its own."),
    (M(289.1), M(298.1), 1.0, "Step 14 · Order", "Nothing is paid yet", "The order waits for your approval."),
    (M(298.1), M(320.4), 1.5, "Step 15 · Approve", "See exactly what you buy", "Item, size, price, shop, address. The phone checks the permission matches the order."),
    (M(320.4), M(334.1), 1.0, "Step 16 · Pay", "Hold to pay, with Face ID", "One payment of 0.29 USDC to the shop, and nothing more."),
    (M(334.1), M(342.0), 1.0, "Step 17 · Settle", "Approved", "The permission lands on chain, then the agent pays the shop."),
    (612.0, 619.6, 1.0, "A few minutes later", "Paid. Receipt signed.", "Order 0x5948…c48c · 0.29 USDC · payment 0x16ca…18b8 on Base Sepolia."),
]


def main():
    steady_source()
    base = frame_base()
    wordmark(base, f"{OUT}/frame_wm.png")
    segs = []
    # Title card.
    title = f"{OUT}/title.png"
    run(["magick", "-size", "1920x1080", f"xc:{BG}",
         "-font", SANSB, "-pointsize", "30", "-fill", TEAL, "-annotate", "+160+400", "INTRODUCING",
         "-font", SERIF, "-pointsize", "170", "-fill", INK, "-annotate", "+150+570", "mandate",
         "-fill", TEAL, "-draw", "circle 945,553 945,569",
         "-font", SANS, "-pointsize", "48", "-fill", SUB, "-annotate", "+160+700",
         "Agents do the work. You hold the seal.",
         "-font", SANS, "-pointsize", "28", "-fill", SUB, "-annotate", "+160+1000",
         "A real walkthrough on the Base Sepolia test network", title])
    segs.append(card_segment(0, title, 5))
    for n, (a, b, speed, k, h, s) in enumerate(PHONE, start=1):
        png = f"{OUT}/cap{n:02d}.png"
        caption(f"{OUT}/frame_wm.png", png, k, h, s, width=980)
        segs.append(phone_segment(n, a, b, speed, png))
    n = len(segs)
    extra = [
        (f"{D}/clips/basescan.png", 0, 7, True, "Step 18 · Proof", "Public on BaseScan",
         "0.29 USDC from the agent wallet to the shop. Status: Success. Block 48486080."),
        (f"{D}/clips/history.mp4", 0, 6, False, "Step 19 · History", "Every chat is kept",
         "Both orders, each with a check mark. Come back any time."),
    ]
    for j, (src, st, dur, still, k, h, sub) in enumerate(extra):
        png = f"{OUT}/capx{j}.png"
        caption(f"{OUT}/frame_wm.png", png, k, h, sub, width=980)
        segs.append(clip_segment(n + j, src, st, dur, png, still))
    # Proof card.
    proof = f"{OUT}/proof.png"
    lines = [
        ("Personal wallet", "0xC6231dB66DECE674aE83633C07e9015C26C2D64B"),
        ("Agent wallet", "0x20a3597894fAC8DF7F608104A873c14c2d02C151"),
        ("Mandate Test Shop", "0x96EEaf3A973ff962f950089c30fc6b5ff380A068"),
        ("This order's payment", "0x16ca45fe68967c5ecdff283ef2823d38989196aa223be49609bcd0f46bc018b8"),
    ]
    cmd = ["magick", "-size", "1920x1080", f"xc:{BG}",
           "-font", SANSB, "-pointsize", "28", "-fill", TEAL, "-annotate", "+160+230", "DON'T TRUST US. VERIFY.",
           "-font", SERIF, "-pointsize", "84", "-fill", INK, "-annotate", "+160+340", "Check it yourself on BaseScan",
           "-font", SANS, "-pointsize", "34", "-fill", SUB, "-annotate", "+160+410",
           "Every address and payment below is public on sepolia.basescan.org"]
    y = 520
    for label, value in lines:
        cmd += ["-font", SANSB, "-pointsize", "30", "-fill", INK, "-annotate", f"+160+{y}", label,
                "-font", MONO, "-pointsize", "28", "-fill", SUB, "-annotate", f"+160+{y+44}", value]
        y += 120
    run(cmd + [proof])
    segs.append(card_segment(len(segs), proof, 10))
    # End card.
    end = f"{OUT}/end.png"
    run(["magick", "-size", "1920x1080", f"xc:{BG}",
         "(", "-background", "none", "-font", SERIF, "-pointsize", "150", "-fill", INK, "label:mandate",
         "-font", SERIF, "-pointsize", "150", "-fill", TEAL, "label:.", "+append", ")",
         "-gravity", "center", "-geometry", "+0-80", "-composite",
         "-gravity", "center", "-font", SANS, "-pointsize", "46", "-fill", SUB, "-annotate", "+0+60",
         "Let agents work, and keep the final say.",
         "-font", SANSB, "-pointsize", "30", "-fill", TEAL, "-annotate", "+0+150", "TRY IT ON BASE SEPOLIA", end])
    segs.append(card_segment(len(segs), end, 5))

    with open(f"{OUT}/list.txt", "w") as f:
        for path, _ in segs:
            f.write(f"file '{path}'\n")
    final = f"{D}/mandate-demo.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{OUT}/list.txt",
         "-c", "copy", "-movflags", "+faststart", final])
    total = sum(d for _, d in segs)
    print(f"{final} {total:.1f}s from {len(segs)} segments")


if __name__ == "__main__":
    main()
