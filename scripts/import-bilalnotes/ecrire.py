# -*- coding: utf-8 -*-
"""Ecriture xlsx : on CLONE le gabarit officiel et on n y remplace que les lignes.

Pourquoi cloner plutot que fabriquer : le gabarit est le fichier que
l application distribue et sait relire (cellules inlineStr, listes deroulantes,
colonnes en format texte pour les telephones et codes postaux). En repartir
garantit que le fichier produit se lit comme lui ; en fabriquer un de zero,
c est parier sur une structure qu on n a jamais eprouvee.
"""
import zipfile

GABARIT = 'public/gabarit-import-apprenants.xlsx'


def ech(v):
    return (str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def lettre(i):
    s, n = '', i
    while True:
        s = chr(65 + n % 26) + s
        n = n // 26 - 1
        if n < 0:
            break
    return s


def cellule(j, r, v, style=None):
    st = ' s="%d"' % style if style is not None else ''
    return ('<c r="%s%d" t="inlineStr"%s><is><t xml:space="preserve">%s</t></is></c>'
            % (lettre(j), r, st, ech(v)))


def ligne_xml(num, valeurs):
    cs = [cellule(i, num, v) for i, v in enumerate(valeurs)
          if v is not None and str(v) != '']
    return '<row r="%d">%s</row>' % (num, ''.join(cs))


def ecrire_depuis_gabarit(sortie, lignes_donnees):
    """`lignes_donnees` : listes de valeurs, SANS en-tete (celle du gabarit est gardee)."""
    src = zipfile.ZipFile(GABARIT)
    sheet1 = src.read('xl/worksheets/sheet1.xml').decode('utf-8')
    corps = ''.join(ligne_xml(i + 2, l) for i, l in enumerate(lignes_donnees))
    sheet1 = sheet1.replace('</sheetData>', corps + '</sheetData>')
    with zipfile.ZipFile(sortie, 'w', zipfile.ZIP_DEFLATED) as out:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == 'xl/worksheets/sheet1.xml':
                data = sheet1.encode('utf-8')
            out.writestr(item, data)
    src.close()


def ecrire_classeur(sortie, feuilles):
    """Classeur autonome. `feuilles` : [(nom, lignes)], la 1re ligne est l en-tete."""
    n = len(feuilles)
    types = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
             '<Default Extension="xml" ContentType="application/xml"/>',
             '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
             '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>']
    for i in range(n):
        types.append('<Override PartName="/xl/worksheets/sheet%d.xml" '
                     'ContentType="application/vnd.openxmlformats-officedocument.'
                     'spreadsheetml.worksheet+xml"/>' % (i + 1))
    types.append('</Types>')

    rels_racine = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/'
                   '2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')

    sheets_xml = ''.join('<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (ech(nm), i + 1, i + 1)
                         for i, (nm, _) in enumerate(feuilles))
    workbook = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets>%s</sheets></workbook>' % sheets_xml)

    rels_wb = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
               '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
    for i in range(n):
        rels_wb.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/'
                       'officeDocument/2006/relationships/worksheet" '
                       'Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1))
    rels_wb.append('<Relationship Id="rId%d" Type="http://schemas.openxmlformats.org/'
                   'officeDocument/2006/relationships/styles" Target="styles.xml"/>' % (n + 1))
    rels_wb.append('</Relationships>')

    # numFmtId 49 = TEXTE sur toutes les cellules : sans lui Excel mange le zero
    # de tete des telephones et des codes postaux (piege paye le 16 aout).
    styles = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
              '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
              '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
              '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
              '<borders count="1"><border/></borders>'
              '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0"/></cellStyleXfs>'
              '<cellXfs count="2"><xf numFmtId="49" fontId="0" xfId="0" applyNumberFormat="1"/>'
              '<xf numFmtId="49" fontId="1" xfId="0" applyNumberFormat="1" applyFont="1"/>'
              '</cellXfs>'
              '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
              '</styleSheet>')

    with zipfile.ZipFile(sortie, 'w', zipfile.ZIP_DEFLATED) as out:
        out.writestr('[Content_Types].xml', '\n'.join(types))
        out.writestr('_rels/.rels', rels_racine)
        out.writestr('xl/workbook.xml', workbook)
        out.writestr('xl/_rels/workbook.xml.rels', '\n'.join(rels_wb))
        out.writestr('xl/styles.xml', styles)
        for i, (nm, lignes) in enumerate(feuilles):
            largeur = max((len(l) for l in lignes), default=1)
            cols = ''.join('<col min="%d" max="%d" width="24" customWidth="1" style="0"/>'
                           % (j + 1, j + 1) for j in range(largeur))
            corps = []
            for r, l in enumerate(lignes, 1):
                cs = [cellule(j, r, v, 1 if r == 1 else 0)
                      for j, v in enumerate(l) if v is not None and str(v) != '']
                corps.append('<row r="%d">%s</row>' % (r, ''.join(cs)))
            out.writestr('xl/worksheets/sheet%d.xml' % (i + 1),
                         '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                         '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                         '<sheetViews><sheetView workbookViewId="0">'
                         '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
                         '</sheetView></sheetViews>'
                         '<cols>%s</cols><sheetData>%s</sheetData></worksheet>'
                         % (cols, ''.join(corps)))
