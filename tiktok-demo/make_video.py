"""
Build tiktok_demo.mp4  —  TikTok developer app review demo
1280 × 720, 30 fps, ~60 seconds
Covers: OAuth (Login Kit), user.info.basic, video.upload, video.publish
"""

from PIL import Image, ImageDraw, ImageFont
import subprocess, os, shutil, math, textwrap

# ── colours ──────────────────────────────────────────────────────────────────
BG      = (1,   1,   1)
GRAY    = (26,  26,  26)
MID     = (43,  43,  43)
LIGHT   = (138, 138, 138)
RED     = (254, 44,  85)
CYAN    = (37,  244, 238)
GREEN   = (0,   212, 106)
AMBER   = (255, 184, 0)
WHITE   = (255, 255, 255)
YELLOW  = (247, 215, 116)
CODE_G  = (168, 255, 120)
DARK_BG = (10,  10,  10)

W, H = 1280, 720
FPS  = 30
OUT_DIR = "/home/user/m2training/tiktok-demo/frames"

# ── fonts ─────────────────────────────────────────────────────────────────────
BASE = "/usr/share/fonts/truetype/dejavu"
def f(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"{BASE}/{name}", size)
def mono(size):
    return ImageFont.truetype(f"{BASE}/DejaVuSansMono.ttf", size)

os.makedirs(OUT_DIR, exist_ok=True)

# ── drawing helpers ───────────────────────────────────────────────────────────

def pill(d, x, y, w, h, r, color):
    d.rectangle([x+r, y, x+w-r, y+h], fill=color)
    d.rectangle([x, y+r, x+w, y+h-r], fill=color)
    d.ellipse([x, y, x+2*r, y+2*r], fill=color)
    d.ellipse([x+w-2*r, y, x+w, y+2*r], fill=color)
    d.ellipse([x, y+h-2*r, x+2*r, y+h], fill=color)
    d.ellipse([x+w-2*r, y+h-2*r, x+w, y+h], fill=color)

def nav(d, img, title="Guilds and Grains × TikTok Integration Demo"):
    d.rectangle([0, 0, W, 54], fill=GRAY)
    d.rectangle([0, 54, W, 56], fill=(50, 50, 50))
    # logo circle
    d.ellipse([16, 10, 44, 44], fill=RED)
    d.text((22, 14), "🌾", font=f(20), fill=WHITE)
    d.text((52, 10), "Guilds and Grains", font=f(18, bold=True), fill=WHITE)
    d.text((52, 33), "Content Automation Platform", font=f(12), fill=LIGHT)
    # right badge
    badge_w = 360
    pill(d, W-badge_w-16, 14, badge_w, 28, 14, RED)
    d.text((W-badge_w-16+12, 18), title, font=f(12, bold=True), fill=WHITE)

def progress(d, step, total=6):
    d.rectangle([0, H-6, W, H], fill=(30,30,30))
    fill_w = int(W * step / total)
    for x in range(fill_w):
        t = x / max(fill_w-1, 1)
        r = int(RED[0] + (CYAN[0]-RED[0])*t)
        g = int(RED[1] + (CYAN[1]-RED[1])*t)
        b = int(RED[2] + (CYAN[2]-RED[2])*t)
        d.rectangle([x, H-6, x+1, H], fill=(r,g,b))
    d.text((W-60, H-22), f"{step}/{total}", font=f(12), fill=LIGHT)

def code_block(d, x, y, w, lines, fsize=12):
    """Draw a dark code block. lines = list of (text, color) tuples."""
    lh = fsize + 8
    h = len(lines) * lh + 20
    d.rectangle([x, y, x+w, y+h], fill=DARK_BG)
    d.rectangle([x, y, x+w, y+h], outline=(42,42,42), width=1)
    cy = y + 10
    for text, color in lines:
        d.text((x+14, cy), text, font=mono(fsize), fill=color)
        cy += lh
    return y + h

def scope_item(d, x, y, name, desc, fsize=13):
    d.rectangle([x, y, x+460, y+36], fill=MID)
    pill(d, x+12, y+14, 8, 8, 4, CYAN)
    d.text((x+28, y+8), name, font=mono(fsize), fill=CYAN)
    d.text((x+200, y+10), desc, font=f(12), fill=LIGHT)

def step_badge(d, num, label, x=40, y=60):
    d.ellipse([x, y, x+28, y+28], fill=RED)
    d.text((x+7, y+4), str(num), font=f(14, bold=True), fill=WHITE)
    d.text((x+36, y+7), label, font=f(13), fill=LIGHT)

def section_tag(d, text, x=40, y=96, color=RED):
    bg = (*color[:3], 40)
    pill(d, x, y, len(text)*8+20, 26, 8, (*color, 35))
    d.text((x+10, y+4), text, font=f(11, bold=True), fill=color)

def divider(d, y):
    d.rectangle([0, y, W, y+1], fill=(40,40,40))

def gradient_bg(img, top=(26,8,16), bot=(1,1,1)):
    """Radial-ish gradient from centre."""
    pixels = img.load()
    cx, cy = W//2, H//2+60
    maxd = math.sqrt(cx**2 + cy**2)
    for py in range(H):
        for px in range(W):
            d = math.sqrt((px-cx)**2 + (py-cy)**2) / maxd
            d = min(d, 1)
            r = int(top[0] + (bot[0]-top[0])*d)
            g = int(top[1] + (bot[1]-top[1])*d)
            b = int(top[2] + (bot[2]-top[2])*d)
            pixels[px,py] = (r,g,b)

# ═══════════════════════════════════════════════════════════════════════════════
# SLIDE BUILDERS
# ═══════════════════════════════════════════════════════════════════════════════

def slide_intro():
    img = Image.new("RGB", (W, H), BG)
    gradient_bg(img, (26,8,16), (1,1,1))
    d = ImageDraw.Draw(img)
    nav(d, img, "TikTok Developer App Review — Sandbox Demo")
    progress(d, 1)

    # big logo hexagon
    cx, cy = W//2, 310
    d.ellipse([cx-52, cy-52, cx+52, cy+52], fill=RED)
    d.text((cx-22, cy-26), "🌾", font=f(42), fill=WHITE)

    d.text((0, 0), "", font=f(40, bold=True), fill=WHITE)  # dummy to warm up

    t1 = "Guilds and Grains"
    t2 = "× TikTok API Integration"
    d.text((W//2 - 240, 390), t1, font=f(38, bold=True), fill=WHITE)
    d.text((W//2 - 230, 438), t2, font=f(30, bold=True), fill=RED)

    d.text((W//2 - 310, 492),
           "Content automation platform: AI generates lifestyle videos,",
           font=f(14), fill=LIGHT)
    d.text((W//2 - 280, 514),
           "TikTok Content Posting API publishes them automatically.",
           font=f(14), fill=LIGHT)

    # scope pills
    pills = ["user.info.basic", "video.upload", "video.publish"]
    px = W//2 - 310
    for p in pills:
        pw = len(p)*9 + 28
        pill(d, px, 550, pw, 30, 8, (20,40,40))
        d.rectangle([px, 550, px+pw, 580], outline=CYAN, width=1)
        d.text((px+10, 556), p, font=mono(13), fill=CYAN)
        px += pw + 14

    # step boxes
    steps = [("1","OAuth\nLogin"), ("2","User\nInfo"), ("3","Video\nUpload"), ("4","Video\nPublish")]
    bx = W//2 - 260
    for num, lbl in steps:
        d.rectangle([bx, 598, bx+110, 660], fill=MID, outline=(60,60,60), width=1)
        d.text((bx+14, 604), num, font=f(24, bold=True), fill=RED)
        for i, ln in enumerate(lbl.split("\n")):
            d.text((bx+46, 608 + i*16), ln, font=f(11), fill=LIGHT)
        bx += 128

    return img

def slide_oauth_start():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # left panel
    d.rectangle([0, 56, W//2, H-6], fill=GRAY)
    # right panel
    d.rectangle([W//2, 56, W, H-6], fill=DARK_BG)
    nav(d, img)
    progress(d, 2)

    # ── LEFT ──
    step_badge(d, 1, "Step 1 of 4 — OAuth Authorization", 40, 70)
    section_tag(d, "🔐  LOGIN KIT", 40, 102, RED)
    d.text((40, 136), "User Authorizes the App", font=f(24, bold=True), fill=WHITE)
    d.text((40, 166), "via TikTok OAuth 2.0", font=f(20), fill=LIGHT)
    d.text((40, 206),
           "User clicks \"Connect TikTok\" on the Guilds and", font=f(13), fill=LIGHT)
    d.text((40, 224),
           "Grains dashboard. Our edge function builds the", font=f(13), fill=LIGHT)
    d.text((40, 242),
           "authorization URL and redirects to TikTok.", font=f(13), fill=LIGHT)

    code_block(d, 40, 270, 570, [
        ("// tiktok-oauth-start edge function", LIGHT),
        ("GET  tiktok.com/v2/auth/authorize/", CYAN),
        ("  ?client_key=sbawxxx…", YELLOW),
        ("  &scope=user.info.basic,", CODE_G),
        ("         video.upload,video.publish", CODE_G),
        ("  &response_type=code", YELLOW),
        ("  &redirect_uri=…/tiktok-oauth-callback", RED),
    ], fsize=12)

    scope_item(d, 40, 450, "user.info.basic", "read display_name & open_id")
    scope_item(d, 40, 494, "video.upload",    "upload video bytes FILE_UPLOAD")
    scope_item(d, 40, 538, "video.publish",   "publish post to TikTok feed")

    # ── RIGHT: browser + TikTok consent screen ──
    bx, by = W//2+30, 70
    bw, bh = 590, 580

    # browser chrome
    d.rectangle([bx, by, bx+bw, by+bh], fill=(28,28,28), outline=(51,51,51), width=1)
    d.rectangle([bx, by, bx+bw, by+38], fill=(37,37,37))
    d.ellipse([bx+10, by+10, bx+22, by+22], fill=(255,95,87))
    d.ellipse([bx+28, by+10, bx+40, by+22], fill=(254,188,46))
    d.ellipse([bx+46, by+10, bx+58, by+22], fill=(40,200,64))
    d.rectangle([bx+70, by+8, bx+bw-10, by+30], fill=(26,26,26))
    d.text((bx+78, by+11), "tiktok.com/v2/auth/authorize/?client_key=...", font=mono(10), fill=(100,100,100))

    # TikTok auth card (white bg)
    cx2, cy2 = bx+30, by+50
    cw, ch = bw-60, bh-60
    d.rectangle([cx2, cy2, cx2+cw, cy2+ch], fill=WHITE)

    # TikTok logo
    d.text((cx2+20, cy2+16), "TikTok", font=f(26, bold=True), fill=(17,17,17))
    # underline the T in red
    d.rectangle([cx2+20, cy2+46, cx2+80, cy2+48], fill=RED)

    d.text((cx2+20, cy2+60), "Guilds and Grains would like to", font=f(14, bold=True), fill=(17,17,17))
    d.text((cx2+20, cy2+80), "access your TikTok account", font=f(14, bold=True), fill=(17,17,17))
    d.text((cx2+20, cy2+106), "Sandbox mode — review & approve permissions", font=f(12), fill=(100,100,100))

    d.rectangle([cx2+20, cy2+126, cx2+cw-20, cy2+127], fill=(220,220,220))

    perms = [
        "View your basic profile info (display name, avatar)",
        "Upload video files to your account",
        "Publish posts to your TikTok feed",
    ]
    for i, perm in enumerate(perms):
        py2 = cy2 + 136 + i * 34
        d.ellipse([cx2+20, py2+4, cx2+32, py2+16], fill=(0,200,83))
        d.text((cx2+22, py2+5), "✓", font=f(10, bold=True), fill=WHITE)
        d.text((cx2+40, py2+2), perm, font=f(12), fill=(51,51,51))

    # Allow button
    pill(d, cx2+20, cy2+245, cw-40, 44, 10, RED)
    d.text((cx2+cw//2-30, cy2+258), "Allow", font=f(16, bold=True), fill=WHITE)

    # Deny button
    d.rectangle([cx2+20, cy2+298, cx2+cw-20, cy2+336], outline=(200,200,200), width=1)
    d.text((cx2+cw//2-20, cy2+309), "Deny", font=f(14), fill=(100,100,100))

    return img

def slide_oauth_callback():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 56, W//2, H-6], fill=GRAY)
    d.rectangle([W//2, 56, W, H-6], fill=DARK_BG)
    nav(d, img)
    progress(d, 3)

    # ── LEFT ──
    step_badge(d, 2, "Step 2 of 4 — user.info.basic", 40, 70)
    section_tag(d, "👤  user.info.basic", 40, 102, CYAN)
    d.text((40, 136), "Tokens Stored &", font=f(24, bold=True), fill=WHITE)
    d.text((40, 166), "User Profile Fetched", font=f(20), fill=LIGHT)

    d.text((40, 206),
           "TikTok redirects back with an auth code.", font=f(13), fill=LIGHT)
    d.text((40, 224),
           "Callback exchanges it for tokens, then calls", font=f(13), fill=LIGHT)
    d.text((40, 242),
           "/v2/user/info/ to read display_name.", font=f(13), fill=LIGHT)

    code_block(d, 40, 270, 570, [
        ("// GET /v2/user/info/?fields=display_name", LIGHT),
        ("Authorization: Bearer act.sandbox_7Kp…", YELLOW),
        ("", WHITE),
        ("// Response 200 OK:", LIGHT),
        ('{  "data": {', WHITE),
        ('     "user": {', WHITE),
        ('       "display_name": "guildsandgrains"', CODE_G),
        ('     }', WHITE),
        ('}', WHITE),
    ], fsize=12)

    # user card
    d.rectangle([40, 480, 590, 540], fill=MID, outline=(60,60,60), width=1)
    d.ellipse([56, 492, 108, 528], fill=RED)
    d.text((66, 498), "🌾", font=f(24), fill=WHITE)
    d.text((120, 495), "guildsandgrains", font=f(18, bold=True), fill=WHITE)
    d.text((120, 518), "open_id: sandbox_UID_4f2a9c…", font=mono(11), fill=LIGHT)
    # scope badge
    pill(d, 120, 534, 170, 22, 6, (10,30,30))
    d.text((128, 537), "✓ user.info.basic", font=mono(11), fill=CYAN)

    # ── RIGHT ──
    d.text((W//2+30, 70), "Token exchange response:", font=f(13), fill=LIGHT)
    code_block(d, W//2+30, 94, 580, [
        ("// POST /v2/oauth/token/ → 200 OK", LIGHT),
        ("{", WHITE),
        ('  "access_token":  "act.sandbox_7Kp…",', CODE_G),
        ('  "refresh_token": "rft.sandbox_mQn…",', CODE_G),
        ('  "expires_in": 86400,', YELLOW),
        ('  "open_id": "sandbox_UID_4f2a9c",', YELLOW),
        ('  "scope": "user.info.basic,', CYAN),
        ('           video.upload,video.publish"', CYAN),
        ("}", WHITE),
    ], fsize=12)

    # success badge
    pill(d, W//2+30, 360, 580, 54, 10, (0,30,20))
    d.rectangle([W//2+30, 360, W//2+610, 414], outline=(0,100,50), width=1)
    d.text((W//2+56, 375), "✅", font=f(24), fill=GREEN)
    d.text((W//2+100, 372), "Connected successfully", font=f(14, bold=True), fill=GREEN)
    d.text((W//2+100, 392), "Tokens persisted to Supabase DB", font=f(12), fill=LIGHT)

    # DB row
    d.rectangle([W//2+30, 428, W//2+610, 476], fill=(17,17,17), outline=(40,40,40), width=1)
    d.text((W//2+50, 442), "🗄️  Table: tiktok_oauth_tokens", font=f(13), fill=LIGHT)
    d.text((W//2+50, 460), "UPSERT on open_id — auto-refreshes before expiry", font=mono(11), fill=CYAN)

    return img

def slide_video_upload(progress_pct=100):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 56, int(W*0.58), H-6], fill=GRAY)
    d.rectangle([int(W*0.58), 56, W, H-6], fill=DARK_BG)
    nav(d, img)
    progress(d, 4)

    # ── LEFT ──
    step_badge(d, 3, "Step 3 of 4 — video.upload", 40, 70)
    section_tag(d, "🎬  video.upload", 40, 102, RED)
    d.text((40, 136), "AI-Generated Video", font=f(24, bold=True), fill=WHITE)
    d.text((40, 166), "Uploaded via FILE_UPLOAD", font=f(20), fill=LIGHT)

    d.text((40, 206),
           "System generates lifestyle video (AI images →", font=f(13), fill=LIGHT)
    d.text((40, 224),
           "AVI/MJPEG, 8s), uploads via Content Posting API.", font=f(13), fill=LIGHT)

    code_block(d, 40, 252, 700, [
        ("// POST /v2/post/publish/video/init/", LIGHT),
        ("{", WHITE),
        ('  "post_info": {', WHITE),
        ('    "title": "My AI posted 5 products… #sidehustle",', CODE_G),
        ('    "privacy_level": "PUBLIC_TO_EVERYONE"', YELLOW),
        ('  },', WHITE),
        ('  "source_info": {', WHITE),
        ('    "source": "FILE_UPLOAD",', CYAN),
        ('    "video_size": 2097152,', YELLOW),
        ('    "chunk_size": 2097152,', YELLOW),
        ('    "total_chunk_count": 1', YELLOW),
        ('  }', WHITE),
        ("}", WHITE),
    ], fsize=11)

    code_block(d, 40, 498, 700, [
        ("// PUT <upload_url>", LIGHT),
        ("Content-Type: video/avi", YELLOW),
        ("Content-Range: bytes 0-2097151/2097152", YELLOW),
        ("<video bytes>", LIGHT),
    ], fsize=11)

    # ── RIGHT ──
    # video thumbnail card
    rx = int(W*0.58) + 30
    d.rectangle([rx, 80, rx+200, 400], fill=(20,10,20), outline=(60,60,60), width=1)
    # play button
    d.ellipse([rx+70, 190, rx+130, 250], fill=RED)
    d.polygon([rx+92, 206, rx+92, 234, rx+120, 220], fill=WHITE)
    d.text((rx+10, 270), "My AI posted 5", font=f(11), fill=LIGHT)
    d.text((rx+10, 288), "products on Etsy", font=f(11), fill=LIGHT)
    d.text((rx+10, 306), "while I was at", font=f(11), fill=LIGHT)
    d.text((rx+10, 324), "the gym", font=f(11), fill=LIGHT)

    # upload progress bar
    bar_x, bar_y = rx, 420
    d.rectangle([bar_x, bar_y, bar_x+200, bar_y+8], fill=(50,50,50))
    fill_w = int(200 * progress_pct / 100)
    if fill_w > 0:
        for bxi in range(fill_w):
            t = bxi / max(fill_w-1,1)
            r = int(RED[0]+(CYAN[0]-RED[0])*t)
            g = int(RED[1]+(CYAN[1]-RED[1])*t)
            b = int(RED[2]+(CYAN[2]-RED[2])*t)
            d.rectangle([bar_x+bxi, bar_y, bar_x+bxi+1, bar_y+8], fill=(r,g,b))
    status_txt = "✅ Upload complete" if progress_pct >= 100 else f"Uploading… {progress_pct}%"
    d.text((bar_x, bar_y+16), status_txt, font=f(12), fill=GREEN if progress_pct>=100 else LIGHT)

    code_block(d, rx, 460, 250, [
        ("// Init response:", LIGHT),
        ('{', WHITE),
        ('  "publish_id":', WHITE),
        ('   "v_sb_pub_88f2…",', CODE_G),
        ('  "upload_url":', WHITE),
        ('   "https://upload…"', CODE_G),
        ('}', WHITE),
    ], fsize=10)

    return img

def slide_video_publish():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 56, W//2, H-6], fill=GRAY)
    d.rectangle([W//2, 56, W, H-6], fill=DARK_BG)
    nav(d, img)
    progress(d, 5)

    # ── LEFT ──
    step_badge(d, 4, "Step 4 of 4 — video.publish", 40, 70)
    section_tag(d, "📤  video.publish", 40, 102, GREEN)
    d.text((40, 136), "Video Published", font=f(24, bold=True), fill=WHITE)
    d.text((40, 166), "to TikTok Feed", font=f(20), fill=LIGHT)

    d.text((40, 206),
           "After upload, TikTok processes async. We poll", font=f(13), fill=LIGHT)
    d.text((40, 224),
           "/v2/post/publish/status/fetch/ with publish_id", font=f(13), fill=LIGHT)
    d.text((40, 242),
           "until status = PUBLISH_COMPLETE.", font=f(13), fill=LIGHT)

    code_block(d, 40, 268, 570, [
        ("// POST /v2/post/publish/status/fetch/", LIGHT),
        ('{ "publish_id": "v_sb_pub_88f2…" }', YELLOW),
        ("", WHITE),
        ("// Response 200:", LIGHT),
        ("{", WHITE),
        ('  "status": "PUBLISH_COMPLETE",', CODE_G),
        ('  "publicly_available_post_id":', WHITE),
        ('    ["7380123456789012345"]', CODE_G),
        ("}", WHITE),
    ], fsize=12)

    # success badge
    pill(d, 40, 450, 570, 52, 10, (0,30,20))
    d.rectangle([40, 450, 610, 502], outline=(0,100,50), width=1)
    d.text((64, 464), "✅", font=f(22), fill=GREEN)
    d.text((106, 462), "PUBLISH_COMPLETE", font=f(14, bold=True), fill=GREEN)
    d.text((106, 482), "Video live on TikTok feed — scope confirmed", font=f(12), fill=LIGHT)

    # DB row
    d.rectangle([40, 516, 610, 560], fill=(17,17,17), outline=(40,40,40), width=1)
    d.text((58, 528), "🗄️  Table: tiktok_posts", font=f(13), fill=LIGHT)
    d.text((58, 548), "publish_id + status logged for attribution", font=mono(11), fill=CYAN)

    # ── RIGHT: TikTok post card ──
    rx = W//2+30
    # card
    d.rectangle([rx, 70, rx+550, 620], fill=MID, outline=(60,60,60), width=1)
    # header
    d.ellipse([rx+14, 82, rx+54, 122], fill=RED)
    d.text((rx+22, 88), "🌾", font=f(24), fill=WHITE)
    d.text((rx+64, 85), "guildsandgrains", font=f(14, bold=True), fill=WHITE)
    d.text((rx+64, 104), "@guildsandgrains · just now", font=f(12), fill=LIGHT)
    # video area
    d.rectangle([rx+14, 132, rx+536, 400], fill=(20,10,20))
    d.ellipse([rx+240, 236, rx+296, 296], fill=RED)
    d.polygon([rx+260, 252, rx+260, 280, rx+290, 266], fill=WHITE)
    d.text((rx+200, 310), "8s · AI-generated lifestyle video", font=f(12), fill=LIGHT)
    # caption
    caption = "My AI posted 5 products on Etsy while I was at the gym"
    d.text((rx+14, 412), caption, font=f(13), fill=(220,220,220))
    tags = "#sidehustle #passiveincome #etsy #etsyseller #aitools"
    d.text((rx+14, 434), tags, font=f(12), fill=CYAN)
    tags2 = "#makemoneyonline #printondemand #automation #workfromhome"
    d.text((rx+14, 454), tags2, font=f(12), fill=CYAN)
    # divider
    d.rectangle([rx+14, 476, rx+536, 477], fill=(60,60,60))
    # stats
    d.text((rx+24, 488), "❤️  —", font=f(13), fill=LIGHT)
    d.text((rx+100, 488), "💬  —", font=f(13), fill=LIGHT)
    d.text((rx+180, 488), "↗️  —", font=f(13), fill=LIGHT)
    d.text((rx+430, 488), "✓ Public", font=f(13), fill=GREEN)

    return img

def slide_summary():
    img = Image.new("RGB", (W, H), BG)
    gradient_bg(img, (5,20,10), (1,1,1))
    d = ImageDraw.Draw(img)
    nav(d, img)
    progress(d, 6)

    d.text((W//2-24, 90), "✅", font=f(56), fill=GREEN)
    d.text((W//2-220, 170), "Integration Complete", font=f(36, bold=True), fill=WHITE)
    # green underline
    d.rectangle([W//2-222, 212, W//2+220, 216], fill=GREEN)

    d.text((W//2-350, 230),
           "Guilds and Grains successfully demonstrates all 3 TikTok API scopes in sandbox mode.",
           font=f(14), fill=LIGHT)

    # 3 summary cards
    cards = [
        ("🔑", "user.info.basic",
         "OAuth 2.0 flow\n/v2/user/info/\ndisplay_name read"),
        ("⬆️", "video.upload",
         "FILE_UPLOAD method\n/post/publish/video/init/\nchunk PUT upload"),
        ("📡", "video.publish",
         "PUBLIC_TO_EVERYONE\nstatus polling\nPUBLISH_COMPLETE"),
    ]
    cx_start = W//2 - 330
    for i, (icon, title, body) in enumerate(cards):
        cx3 = cx_start + i * 240
        d.rectangle([cx3, 274, cx3+220, 440], fill=MID, outline=(60,60,60), width=1)
        d.text((cx3+14, 286), icon, font=f(28), fill=WHITE)
        d.text((cx3+14, 330), title, font=mono(13), fill=CYAN)
        d.rectangle([cx3+14, 348, cx3+200, 349], fill=(60,60,60))
        for j, ln in enumerate(body.split("\n")):
            d.text((cx3+14, 356 + j*22), ln, font=f(12), fill=LIGHT)

    # endpoint summary
    d.text((W//2-400, 464),
           "OAuth callback: zmyczlfuufhngzovkjdh.supabase.co/functions/v1/tiktok-oauth-callback",
           font=mono(11), fill=(80,80,80))
    d.text((W//2-260, 484),
           "App: Guilds and Grains  |  Sandbox mode  |  Scopes: all 3 granted",
           font=f(12), fill=(80,80,80))

    return img

# ═══════════════════════════════════════════════════════════════════════════════
# RENDER ALL FRAMES
# ═══════════════════════════════════════════════════════════════════════════════

# Slide timing: (slide_func, duration_secs, extra_kwargs)
SLIDES = [
    (slide_intro,          7,  {}),
    (slide_oauth_start,    10, {}),
    (slide_oauth_callback, 10, {}),
    # Upload slide: animate progress bar from 0 → 100 over first 4s, hold
    None,  # placeholder — handled below
    (slide_video_publish,  10, {}),
    (slide_summary,        8,  {}),
]

frame_num = 0

def write_frame(img, n):
    path = f"{OUT_DIR}/frame_{n:05d}.jpg"
    img.save(path, "JPEG", quality=90)
    return path

def repeat(img, secs):
    global frame_num
    count = int(secs * FPS)
    for _ in range(count):
        write_frame(img, frame_num)
        frame_num += 1

print("Rendering slide 1/6: Intro…")
repeat(slide_intro(), 7)

print("Rendering slide 2/6: OAuth Start…")
repeat(slide_oauth_start(), 10)

print("Rendering slide 3/6: OAuth Callback…")
repeat(slide_oauth_callback(), 10)

print("Rendering slide 4/6: Video Upload (animated)…")
# 4 seconds animating 0→100%, then hold 6s
anim_secs = 4
hold_secs = 6
anim_frames = int(anim_secs * FPS)
for i in range(anim_frames):
    pct = int(100 * i / max(anim_frames - 1, 1))
    img = slide_video_upload(pct)
    write_frame(img, frame_num); frame_num += 1
repeat(slide_video_upload(100), hold_secs)

print("Rendering slide 5/6: Video Publish…")
repeat(slide_video_publish(), 10)

print("Rendering slide 6/6: Summary…")
repeat(slide_summary(), 8)

total = frame_num
print(f"Total frames rendered: {total} (~{total/FPS:.1f}s)")

# ── Encode with ffmpeg ────────────────────────────────────────────────────────
OUT_PATH = "/home/user/m2training/tiktok-demo/tiktok_demo.mp4"
cmd = [
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", f"{OUT_DIR}/frame_%05d.jpg",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    OUT_PATH,
]
print("Encoding MP4…")
result = subprocess.run(cmd, capture_output=True, text=True)
if result.returncode != 0:
    print("FFMPEG ERROR:", result.stderr[-2000:])
else:
    size_mb = os.path.getsize(OUT_PATH) / 1_048_576
    print(f"✅  Done: {OUT_PATH}  ({size_mb:.1f} MB)")

# cleanup frames
shutil.rmtree(OUT_DIR)
print("Frames cleaned up.")
