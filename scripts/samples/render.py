"""샘플 서류를 파일로 만드는 도구 모음 (HTML → PDF/PNG, 스캔·사진 효과, 메일, 엑셀)."""
import io
import math
import random
from email.message import EmailMessage
from email.utils import format_datetime, make_msgid
import datetime as dt

import cv2
import numpy as np
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

KST = dt.timezone(dt.timedelta(hours=9))

BASE_CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: 794px; min-height: 1123px; background: #fff; color: #111;
       font-family: 'Noto Sans CJK KR', 'Noto Sans KR', sans-serif; font-size: 13px; }
.page { padding: 56px 60px; position: relative; min-height: 1123px; }
table { border-collapse: collapse; width: 100%; }
td, th { border: 1px solid #333; padding: 7px 9px; vertical-align: middle; }
th { background: #eee; font-weight: 700; }
.r { text-align: right; } .c { text-align: center; }
.muted { color: #555; }
.small { font-size: 10px; }
"""


class Renderer:
    def __init__(self):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch()

    def close(self):
        self._browser.close()
        self._pw.stop()

    def _page(self, html, scale=1):
        page = self._browser.new_page(viewport={"width": 794, "height": 1123}, device_scale_factor=scale)
        page.set_content(f"<html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>{html}</body></html>")
        page.wait_for_timeout(150)
        return page

    def pdf(self, html, path):
        page = self._page(html)
        page.pdf(path=str(path), format="A4", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        page.close()

    def png(self, html, scale=2):
        page = self._page(html, scale)
        data = page.screenshot(full_page=False, clip={"x": 0, "y": 0, "width": 794, "height": 1123})
        page.close()
        return Image.open(io.BytesIO(data)).convert("RGB")


# ---------- 스캔 효과 ----------
def scanify(img: Image.Image, seed: int, angle: float = 0.8) -> Image.Image:
    """흑백, 약간 기울기, 잡티, 약한 번짐. 팩스·복합기 스캔처럼."""
    rnd = random.Random(seed)
    g = img.convert("L")
    g = g.rotate(angle, resample=Image.BICUBIC, expand=False, fillcolor=255)
    arr = np.array(g).astype(np.float32)
    # 대비를 조금 올리고 회색을 날린다
    arr = np.clip((arr - 40) * 1.25, 0, 255)
    # 잡티
    h, w = arr.shape
    nrng = np.random.default_rng(seed)
    arr += nrng.normal(0, 9, arr.shape)
    for _ in range(900):
        x, y = rnd.randrange(w), rnd.randrange(h)
        r = rnd.choice([1, 1, 1, 2])
        arr[max(0, y - r):y + r, max(0, x - r):x + r] = rnd.randrange(0, 90)
    # 가로 줄무늬 (팩스 줄)
    for _ in range(6):
        y = rnd.randrange(h)
        arr[y:y + 1, :] = np.minimum(arr[y:y + 1, :], 200)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr).filter(ImageFilter.GaussianBlur(0.7))
    # 200dpi 근처로 줄인다 (A4 폭 1654px)
    out = out.resize((1654, int(1654 * out.height / out.width)), Image.LANCZOS)
    return out


def save_scan_pdf(img: Image.Image, path):
    img.save(str(path), "PDF", resolution=200.0)


# ---------- 사진 효과 (촬영이 어려울 때 쓰는 합성본) ----------
def photoify(img: Image.Image, seed: int, crop_right: float = 0.0, crop_bottom: float = 0.0) -> Image.Image:
    rnd = random.Random(seed)
    src = np.array(img.convert("RGB"))
    h, w = src.shape[:2]
    # 종이 질감: 아주 약간 누렇게
    paper = src.astype(np.float32) * np.array([0.97, 0.96, 0.92])
    src = np.clip(paper, 0, 255).astype(np.uint8)

    W, H = int(w * 1.25), int(h * 1.18)
    # 책상 배경
    bg = np.zeros((H, W, 3), np.float32)
    bg[:] = (92, 104, 118)
    bg += np.random.default_rng(seed).normal(0, 6, bg.shape)
    # 원근: 위가 살짝 좁은 사다리꼴
    dx = w * rnd.uniform(0.04, 0.07)
    ox, oy = (W - w) / 2, (H - h) / 2
    dst = np.float32([
        [ox + dx + rnd.uniform(-8, 8), oy + rnd.uniform(-6, 10)],
        [ox + w - dx * 0.6 + rnd.uniform(-8, 8), oy + rnd.uniform(-10, 6)],
        [ox + w + dx * 0.4 + rnd.uniform(-6, 6), oy + h + rnd.uniform(-6, 6)],
        [ox - dx * 0.2 + rnd.uniform(-6, 6), oy + h + rnd.uniform(-6, 6)],
    ])
    srcpts = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(srcpts, dst)
    warped = cv2.warpPerspective(src, M, (W, H), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    mask = cv2.warpPerspective(np.full((h, w), 255, np.uint8), M, (W, H))
    m = (mask / 255.0)[..., None]
    out = warped.astype(np.float32) * m + bg * (1 - m)
    # 조명: 한쪽이 어둡고 그림자
    yy, xx = np.mgrid[0:H, 0:W]
    light = 1.0 - 0.22 * (xx / W) - 0.10 * (yy / H)
    cx, cy = W * rnd.uniform(0.65, 0.85), H * rnd.uniform(0.7, 0.9)
    shadow = 1.0 - 0.18 * np.exp(-(((xx - cx) / (W * 0.25)) ** 2 + ((yy - cy) / (H * 0.2)) ** 2))
    out = out * (light * shadow)[..., None]
    out = np.clip(out + np.random.default_rng(seed + 1).normal(0, 4, out.shape), 0, 255).astype(np.uint8)
    pil = Image.fromarray(out).filter(ImageFilter.GaussianBlur(1.1))
    # 잘림
    if crop_right or crop_bottom:
        pil = pil.crop((0, 0, int(pil.width * (1 - crop_right)), int(pil.height * (1 - crop_bottom))))
    # 휴대폰 사진 크기로
    pil = pil.resize((1600, int(1600 * pil.height / pil.width)), Image.LANCZOS)
    return pil


# ---------- 메일 ----------
def kdate(y, m, d, hh=10, mm=0):
    return dt.datetime(y, m, d, hh, mm, tzinfo=KST)


def kdate_text(t: dt.datetime):
    wd = "월화수목금토일"[t.weekday()]
    ampm = "오전" if t.hour < 12 else "오후"
    h12 = t.hour if 1 <= t.hour <= 12 else (t.hour - 12 if t.hour > 12 else 12)
    return f"{t.year}년 {t.month}월 {t.day}일 {wd}요일 {ampm} {h12}:{t.minute:02d}"


def quote_block_ko(sender, to, sent: dt.datetime, subject, body):
    return (
        "\n\n-----Original Message-----\n"
        f"보낸 사람: {sender}\n"
        f"보낸 날짜: {kdate_text(sent)}\n"
        f"받는 사람: {to}\n"
        f"제목: {subject}\n\n"
        f"{body}"
    )


def quote_block_en(sender, to, sent: dt.datetime, subject, body):
    return (
        "\n\nFrom: " + sender + "\n"
        f"Sent: {sent.strftime('%A, %B %d, %Y %I:%M %p')}\n"
        f"To: {to}\n"
        f"Subject: {subject}\n\n"
        f"{body}"
    )


def make_eml(path, frm, to, subject, sent: dt.datetime, body, attachments=None):
    msg = EmailMessage()
    msg["From"] = frm
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = format_datetime(sent)
    domain = frm.split("@")[-1].rstrip(">")
    msg["Message-ID"] = make_msgid(domain=domain)
    msg.set_content(body, charset="utf-8")
    for name, data, maintype, subtype in attachments or []:
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=name)
    with open(path, "wb") as f:
        f.write(bytes(msg))
