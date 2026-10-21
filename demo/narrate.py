#!/usr/bin/env python3
# Adds an OpenAI TTS voiceover and an original generated music bed to the
# video built by build.py. The OpenAI key is read from Key Vault into memory.
import array, json, math, os, subprocess, sys, urllib.request, wave

D = os.path.dirname(os.path.abspath(__file__))
OUT = f"{D}/out"
VO = f"{OUT}/vo"
os.makedirs(VO, exist_ok=True)
VAULT = "mandate-app-kv-04323111"

# One line per segment, in the order of out/list.txt.
LINES = [
    "Meet Mandate. Agents do the work. You hold the seal.",
    "This is a fresh install of the Mandate wallet.",
    "We restore a demo wallet from its twelve recovery words. It only holds test funds.",
    "Face ID guards every signature. The same address comes back, along with its agent wallet.",
    "This is your own wallet. Your keys never leave the phone.",
    "Your agent gets a separate smart-contract wallet, holding test USDC. It can't touch your personal account.",
    "One tap pauses every agent, or freezes the wallet.",
    "You set the limits: half a USDC per payment, two a day, five a week. The contract enforces them.",
    "And you choose exactly who the agent may pay. The test shop is on the list.",
    "We add a test delivery address. It stays on the phone. Orders only carry a salted fingerprint of it.",
    "After a restore, we reconnect the agent wallet to the Mandate service.",
    "The service finds the same wallet, recorded on chain.",
    "Now, just ask. Let's find running shoes under zero point four USDC.",
    "The agent searches the Mandate Test Shop. Every tool call shows up as a step.",
    "Real products, with real prices.",
    "We choose the Cloudstep Lite, and the agent asks for the size.",
    "It prepares the order. The agent can open an order, but it can't pay on its own.",
    "Nothing is paid until you approve.",
    "The sheet shows exactly what you're buying, and the phone checks that the permission matches the order.",
    "Hold to pay, and confirm with Face ID. One payment of zero point two nine USDC, and nothing more.",
    "Approved. The permission lands on chain, then the agent pays the shop.",
    "A few minutes later: paid, with a signed receipt from the shop.",
    "And it's public. On BaseScan, the transfer from the agent wallet to the shop succeeded.",
    "Every chat is kept, so you can always see what your agent did.",
    "Don't trust us. Verify. Every address and payment is public on BaseScan.",
    "Mandate. Let agents work, and keep the final say.",
]
LEAD = 0.4  # seconds of silence before each line


def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode:
        sys.exit(f"FAILED: {cmd[0]} {cmd[1] if len(cmd) > 1 else ''}\n{r.stderr[-1500:]}")
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", path]).strip())


def tts(key, text, path):
    if os.path.exists(path):
        return
    body = json.dumps({
        "model": "gpt-4o-mini-tts",
        "voice": "sage",
        "input": text,
        "instructions": "Calm, confident and friendly product demo narrator. Unhurried, warm, clear.",
        "response_format": "wav",
    }).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, "wb") as f:
        f.write(r.read())


def music(path, seconds, rate=22050):
    # Original plucked-chord bed: C - Am - F - G at 100 BPM.
    beat = 0.6
    chords = [(48, 52, 55), (45, 48, 52), (41, 45, 48), (43, 47, 50)]
    n = int(seconds * rate)
    buf = array.array("f", [0.0]) * n

    def pluck(midi, length, gain, decay):
        f = 440 * 2 ** ((midi - 69) / 12)
        m = int(length * rate)
        return [gain * min(1, i / (0.006 * rate)) * math.exp(-decay * i / rate)
                * (math.sin(2 * math.pi * f * i / rate) + 0.3 * math.sin(4 * math.pi * f * i / rate))
                for i in range(m)]

    cache = {}
    t, bar = 0.0, 0
    while t < seconds:
        root, third, fifth = chords[bar % 4]
        notes = [(root - 12, 2.4, 0.22, 1.2)]  # bass
        pattern = [root + 12, fifth + 12, third + 24, fifth + 12]
        for b, note in enumerate(pattern):
            notes.append((note, 1.2, 0.10, 3.5, b))
        for spec in notes:
            midi, length, gain, decay = spec[:4]
            start = t + (spec[4] * beat if len(spec) > 4 else 0)
            key = (midi, length, gain, decay)
            if key not in cache:
                cache[key] = pluck(*key)
            s = int(start * rate)
            for i, v in enumerate(cache[key]):
                if s + i >= n:
                    break
                buf[s + i] += v
        t += 4 * beat
        bar += 1
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(array.array("h", (int(max(-1, min(1, v)) * 20000) for v in buf)).tobytes())


def main():
    segs = [l.split("'")[1] for l in open(f"{OUT}/list.txt") if l.strip()]
    if len(segs) != len(LINES):
        sys.exit(f"{len(segs)} segments but {len(LINES)} lines")
    key = run(["az", "keyvault", "secret", "show", "--vault-name", VAULT, "-n",
               "openai-api-key", "--query", "value", "-o", "tsv"]).strip()
    voiced, starts, t = [], [], 0.0
    for i, (seg, line) in enumerate(zip(segs, LINES)):
        wav = f"{VO}/{i:02d}.wav"
        tts(key, line, wav)
        need = LEAD + duration(wav) + 0.5
        have = duration(seg)
        out = seg
        if need > have:
            out = seg.replace(".mp4", "-vo.mp4")
            run(["ffmpeg", "-v", "error", "-y", "-i", seg, "-vf",
                 f"tpad=stop_mode=clone:stop_duration={need - have:.2f}",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", out])
            have = duration(out)
        voiced.append(out)
        starts.append(t)
        t += have
    del key
    total = t
    with open(f"{OUT}/list-vo.txt", "w") as f:
        for p in voiced:
            f.write(f"file '{p}'\n")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{OUT}/list-vo.txt",
         "-c", "copy", f"{OUT}/video-vo.mp4"])
    bed = f"{OUT}/music.wav"
    if not os.path.exists(bed):
        music(bed, total + 2)
    # Voice lines at their segment starts; music underneath, ducked, faded out.
    inputs, parts = [], []
    for i, s in enumerate(starts):
        inputs += ["-i", f"{VO}/{i:02d}.wav"]
        ms = int((s + LEAD) * 1000)
        parts.append(f"[{i + 2}:a]aresample=48000,adelay={ms}|{ms}[v{i}]")
    mix = ";".join(parts)
    vlist = "".join(f"[v{i}]" for i in range(len(starts)))
    fc = (f"{mix};{vlist}amix=inputs={len(starts)}:normalize=0,asplit=2[voice][key];"
          f"[1:a]aresample=48000,volume=0.35,afade=t=in:d=2,afade=t=out:st={total - 4:.2f}:d=4[bed];"
          f"[bed][key]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=400[ducked];"
          f"[ducked][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]")
    final = f"{D}/mandate-demo-voiced.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-i", f"{OUT}/video-vo.mp4", "-i", bed, *inputs,
         "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.2f}", "-movflags", "+faststart", final])
    print(f"{final} {total:.1f}s")


if __name__ == "__main__":
    main()
