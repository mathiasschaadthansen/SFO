#!/usr/bin/env python3
"""Skaerer den hvide baggrund fra et AI-billede og gemmer det som PNG med
gennemsigtighed, klar til games/*/billeder/.

Brug: vaerktoej/fritlaeg.py <ind.png|jpg> <ud.png> [--bredde 256] [--taerskel 235]

Alle pixels, der er lysere end taersklen i alle tre kanaler, bliver
gennemsigtige. Kanten bloedes over et par pixels, saa figuren ikke faar en
haard hvid kant, billedet beskaeres til figuren, og skaleres til den bredde
spillet bruger (figurer ca. 256 px, dele ca. 512 px). Kraever Pillow og numpy.
"""
import argparse
import numpy as np
from PIL import Image, ImageFilter


def fritlaeg(ind, ud, bredde=256, taerskel=235, kant=2):
    img = Image.open(ind).convert('RGBA')
    px = np.asarray(img).astype(np.int16)
    rgb = px[:, :, :3]
    # Hvor lys er pixlen? 0 = helt hvid, 255 = helt moerk i den moerkeste kanal.
    moerkhed = 255 - rgb.min(axis=2)
    graense = 255 - taerskel
    # Blød overgang: helt gennemsigtig ved hvid, helt daekkende lidt under taersklen.
    alfa = np.clip((moerkhed - graense) * (255.0 / max(graense, 1)), 0, 255)
    alfa_img = Image.fromarray(alfa.astype(np.uint8), 'L')
    # Fjern hvide oeer inde i figuren (fx det hvide i oejnene): alt, der ikke
    # haenger sammen med billedets kant, skal blive daekkende.
    fyld = alfa_img.point(lambda v: 255 if v > 0 else 0)
    from PIL import ImageDraw
    ImageDraw.floodfill(fyld, (0, 0), 128, thresh=0)
    ImageDraw.floodfill(fyld, (fyld.width - 1, 0), 128, thresh=0)
    ImageDraw.floodfill(fyld, (0, fyld.height - 1), 128, thresh=0)
    ImageDraw.floodfill(fyld, (fyld.width - 1, fyld.height - 1), 128, thresh=0)
    inde = np.asarray(fyld) != 128
    alfa = np.where(inde, 255, alfa).astype(np.uint8)
    alfa_img = Image.fromarray(alfa, 'L')
    if kant:
        alfa_img = alfa_img.filter(ImageFilter.MinFilter(kant * 2 + 1)).filter(ImageFilter.GaussianBlur(kant / 2))
    # Farven i den halvgennemsigtige kant skal vaere figurens, ikke hvid:
    # trykke de lyse kantpixels lidt ned mod naboerne.
    ud_img = Image.fromarray(px[:, :, :3].astype(np.uint8), 'RGB').convert('RGBA')
    ud_img.putalpha(alfa_img)
    boks = alfa_img.getbbox()
    if boks is None:
        raise SystemExit(f'{ind}: alt var hvidt, intet at skaere ud')
    ud_img = ud_img.crop(boks)
    if bredde and ud_img.width > bredde:
        h = round(ud_img.height * bredde / ud_img.width)
        ud_img = ud_img.resize((bredde, h), Image.LANCZOS)
    ud_img.save(ud, optimize=True)
    print(f'{ud}: {ud_img.width}x{ud_img.height}')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('ind')
    p.add_argument('ud')
    p.add_argument('--bredde', type=int, default=256)
    p.add_argument('--taerskel', type=int, default=235)
    a = p.parse_args()
    fritlaeg(a.ind, a.ud, a.bredde, a.taerskel)
