# -*- coding: utf-8 -*-
"""Lecteur xlsx minimal : zip + XML. Aucune dependance."""
import zipfile, re, datetime
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'


def _col(ref):
    """A1 -> 0, AB12 -> 27."""
    letters = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n - 1


def lire(chemin, sheet='xl/worksheets/sheet1.xml'):
    z = zipfile.ZipFile(chemin)
    # Chaines partagees
    partagees = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(NS + 'si'):
            # Un <si> peut etre decoupe en plusieurs <r><t>
            partagees.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    # Formats de nombre : reperer les colonnes de DATE
    styles = ET.fromstring(z.read('xl/styles.xml'))
    fmt_perso = {int(n.get('numFmtId')): n.get('formatCode')
                 for n in styles.iter(NS + 'numFmt')}
    xf_fmt = []
    cellXfs = styles.find(NS + 'cellXfs')
    if cellXfs is not None:
        for xf in cellXfs.findall(NS + 'xf'):
            xf_fmt.append(int(xf.get('numFmtId', 0)))
    DATES_STD = set(list(range(14, 18)) + [22, 27, 30, 36, 45, 46, 47, 50, 57, 58])

    def est_date(style_idx):
        if style_idx is None:
            return False
        i = int(style_idx)
        if i >= len(xf_fmt):
            return False
        fid = xf_fmt[i]
        if fid in DATES_STD:
            return True
        code = fmt_perso.get(fid, '')
        return bool(code) and bool(re.search(r'[dmyhDMY]', code)) and '[' not in code

    lignes = {}
    for row in ET.fromstring(z.read(sheet)).iter(NS + 'row'):
        cells = {}
        for c in row.findall(NS + 'c'):
            ref = c.get('r')
            t = c.get('t')
            v = c.find(NS + 'v')
            isx = c.find(NS + 'is')
            if t == 's' and v is not None:
                val = partagees[int(v.text)]
            elif t == 'inlineStr' and isx is not None:
                val = ''.join(x.text or '' for x in isx.iter(NS + 't'))
            elif v is not None:
                val = v.text
                if est_date(c.get('s')):
                    try:
                        n = float(val)
                        d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(n))
                        val = d.isoformat()
                    except Exception:
                        pass
            else:
                continue
            if val is not None and str(val).strip() != '':
                cells[_col(ref)] = str(val).strip()
        if cells:
            lignes[int(row.get('r'))] = cells

    if not lignes:
        return []
    largeur = max(max(c.keys()) for c in lignes.values()) + 1
    return [[lignes.get(r, {}).get(i) for i in range(largeur)]
            for r in range(1, max(lignes.keys()) + 1)]
