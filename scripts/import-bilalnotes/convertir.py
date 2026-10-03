# -*- coding: utf-8 -*-
"""
CONVERSION DES DEUX EXPORTS DE L ANCIEN LOGICIEL VERS LE GABARIT D IMPORT.

Les deux fichiers se lient par ID PARENTS (verifie : 0 enfant orphelin).

Les regles ci-dessous sont des DECISIONS, pas des details techniques : chacune
est ecrite ici pour que l ecole puisse la contredire. Tout ce qui est ecarte est
reporte dans le fichier de complement — jamais perdu en silence.
"""
import io, os, sys, re, unicodedata, datetime, difflib
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx import lire
from ecrire import ecrire_depuis_gabarit, ecrire_classeur

AUJ = datetime.date(2026, 10, 3)
AGE_ADULTE = 18

P = lire('Export_Parents_Administratif_BilalNotes_27_09_2026.xlsx')
E = lire('Export_Enfants_Pedagogique_BilalNotes_27_09_2026.xlsx')
pr, er = P[1:], E[1:]

IDP, NP, PP, EP, TP, VP, CPP, VIP, NM, PM, EM, TM, VM, CPM, VIM = range(15)
IDE, ENOM, EPRE, EAGE, EDN, ECOM, ESEX, A1, A2, A3, ECLA, ESEA, EENS, EIDP = range(14)

rapport = []
w = rapport.append


def norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().upper()


def lettres(s):
    """Prenom reduit a ses lettres : « Zakariya-Ilyes » et « zakariya ilyes »
    doivent se comparer, les traits d union et la casse ne sont pas des faits."""
    if not s:
        return ''
    s = unicodedata.normalize('NFD', str(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^A-Za-z]', '', s).upper()


def age(r):
    if not r[EDN]:
        return None
    try:
        return (AUJ - datetime.date.fromisoformat(r[EDN])).days / 365.25
    except Exception:
        return None


# ── R7 : TELEPHONE ───────────────────────────────────────────────────────────
# L app accepte un numero de 10 chiffres commencant par 0 (elle en fait +33...).
# Elle REFUSE tout le reste sans indicatif explicite — elle ne devine pas.
# Le tableur a mange le zero de tete de 10 numeros : 9 chiffres => on le remet,
# ce qui est sans ambiguite dans le plan de numerotation francais.
def tel(v):
    if not v:
        return '', None
    d = re.sub(r'\D', '', str(v))
    if len(d) == 9:
        d = '0' + d
    if len(d) == 10 and d.startswith('0'):
        return ' '.join(d[i:i + 2] for i in range(0, 10, 2)), None
    return '', 'telephone illisible : %s' % v


# ── R6 : ADRESSE ─────────────────────────────────────────────────────────────
# Le code postal de l ancien logiciel vaut « 0 » dans 95 cas sur 118, et la voie
# contient souvent le code postal ET la ville (« 30 rue Moliere 69250 Neuville »).
# On extrait donc de la voie ce que la colonne ne porte pas, au lieu de laisser
# trois champs a moitie vides.
def adresse(voie, cp, ville):
    voie = (voie or '').strip()
    cp = re.sub(r'\D', '', str(cp or ''))
    ville = (ville or '').strip()
    note = None
    if cp in ('', '0'):
        cp = ''
    m = re.search(r'\b(\d{5})\b', voie)
    if m:
        if not cp:
            cp = m.group(1)
        reste = voie[m.end():].strip(' ,-')
        if reste and not ville:
            ville = reste
        voie = voie[:m.start()].strip(' ,-')
    if cp and len(cp) != 5:
        note = 'code postal a verifier : %s' % cp
        if len(cp) < 5:
            cp = cp.zfill(5)
        else:
            cp, note = '', 'code postal illisible, efface : %s' % m
    return voie, cp, ville.upper(), note


JUNK = {'AAA', 'XXX', 'ZZZ', '-', '.'}


def junk(n):
    """Nom de remplissage : liste connue, ou pas une seule lettre (« ????? »)."""
    return (not n) or norm(n) in JUNK or not re.search(r'[A-Za-zÀ-ÿ]', str(n))


# « REDJEM EPOUSE » : la mention d alliance n appartient pas au nom de famille.
# Elle se retire sans rien deviner — on ne touche qu au mot parasite.
def sans_mention(n):
    if not n:
        return n
    return re.sub(r'\s*\b(EPOUSE|ÉPOUSE|VEUVE|NEE|NÉE|DIT|DITE)\b.*$', '', str(n),
                  flags=re.IGNORECASE).strip() or n

RE_MAIL = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


# ── EMAIL : on retire les espaces, jamais autre chose ────────────────────────
# Trois adresses de l ancien logiciel portent un espace a l interieur
# (« Raouf1614@hotmail .com »), et le lecteur de l app les refuse — a raison.
# Un espace n est JAMAIS valide dans une adresse : le retirer est sans
# ambiguite. Toute autre adresse illisible est signalee, pas devinee.
def mail(v):
    if not v:
        return '', None
    t = re.sub(r'\s+', '', str(v))
    if RE_MAIL.match(t):
        return t, ('espace retire : %s' % v if t != str(v).strip() else None)
    return '', 'adresse email illisible : %s' % v


def utilisable(nom_, pre, m):
    """Un tuteur 1 doit porter NOM + Prenom + Email : les trois sont obligatoires."""
    return (not junk(nom_)) and bool(pre) and bool(mail(m)[0])


# ═══ R3 : DEDOUBLONNAGE DES FOYERS ═══════════════════════════════════════════
# L ancien logiciel a cree un SECOND foyer quand une famille s est reinscrite :
# 13 personnes y figurent deux fois. Le declencheur en base refuse une personne
# presente deux fois dans l etablissement — sans fusion, ces foyers seraient
# rejetes a l import. On regroupe donc par identite de tuteur.
foyer = {r[IDP]: r for r in pr}
enfants = defaultdict(list)
for r in er:
    enfants[r[EIDP]].append(r)

# R1 : seuls les foyers ayant au moins un enfant peuvent passer par cet ecran
# (NOM, Prenom, date et genre de l enfant y sont obligatoires).
avec_enfant = [r[IDP] for r in pr if r[IDP] in enfants]

parent_de = {}


def racine(x):
    while parent_de.get(x, x) != x:
        x = parent_de[x]
    return x


def unir(a, b):
    ra, rb = racine(a), racine(b)
    if ra != rb:
        parent_de[ra] = rb


for i in avec_enfant:
    parent_de.setdefault(i, i)
par_personne = defaultdict(list)
for i in avec_enfant:
    f = foyer[i]
    for nom_, pre in ((f[NP], f[PP]), (f[NM], f[PM])):
        if not junk(nom_):
            par_personne[(norm(nom_), norm(pre))].append(i)
for ids in par_personne.values():
    for j in ids[1:]:
        unir(ids[0], j)

groupes = defaultdict(list)
for i in avec_enfant:
    groupes[racine(i)].append(i)

# ═══ CONSTRUCTION DES LIGNES ═════════════════════════════════════════════════
#
# UN SEUL FICHIER (decision du 03/10). Le decoupage « avec classe / sans classe »
# reposait entierement sur la colonne Classe(s) de l ancien logiciel : la
# direction reconstruisant ses classes, ce critere ne veut plus rien dire, et
# scinder sur lui aurait partage les familles selon une donnee qu on jette.
lignes, exclusions, fusions, adultes, medical, quasi, douteux = [], [], [], [], [], [], []
commentaire_de = {}

# Un commentaire qui dit « rien a signaler » n est pas une information : seuls
# les autres sont conserves, sinon la feuille medicale noierait deux allergies
# reelles sous quarante-sept « Non ».
RIEN_A_SIGNALER = {'non', 'ras', 'aucun', 'rien', 'pas d allergie',
                   'pas d’allergie', '0', 'n/a', 'neant', 'néant',
                   # « COURS ADO » n est pas une note medicale mais une
                   # indication de cours, sur un garcon de 16 ans. La laisser
                   # passer abimerait le seul champ ou l on doit pouvoir faire
                   # confiance a une allergie.
                   'cours ado', 'cours ados', 'cours adultes'}

for ids in sorted(groupes.values(), key=lambda g: min(int(x) for x in g)):
    ids = sorted(ids, key=lambda x: -len(enfants[x]))  # le plus fourni d abord
    if len(ids) > 1:
        fusions.append([' + '.join('foyer ' + x for x in ids),
                        foyer[ids[0]][NP] or '', foyer[ids[0]][PP] or '',
                        foyer[ids[0]][NM] or '', foyer[ids[0]][PM] or '',
                        str(sum(len(enfants[x]) for x in ids)) + ' ligne(s) enfant au total'])

    def champ(idx):
        """Premiere valeur non vide parmi les foyers fusionnes."""
        for x in ids:
            v = foyer[x][idx]
            if v and str(v).strip() and str(v).strip() != '0':
                return str(v).strip()
        return ''

    pere = (champ(NP), champ(PP), champ(EP), champ(TP), champ(VP), champ(CPP), champ(VIP))
    mere = (champ(NM), champ(PM), champ(EM), champ(TM), champ(VM), champ(CPM), champ(VIM))
    ident = ' + '.join('foyer ' + x for x in ids)

    # ── NOM et PRENOM saisis a l envers ─────────────────────────────────────
    # Repere a l ecran : « ABDELKADER Benabbou », dont l enfant est « BENABBOU
    # Nodjoud ». Le signal est VERIFIABLE — le prenom du tuteur est le nom de
    # SES PROPRES enfants, et son nom ne l est pas — donc on corrige. Un tuteur
    # qui ne partage simplement pas le nom de l enfant n est PAS touche : c est
    # le cas de 38 meres sous leur nom de jeune fille.
    noms_enfants = set(norm(x[ENOM]) for y in ids for x in enfants[y])

    def redresser(t, qui):
        if not t[0] or norm(t[0]) in noms_enfants or norm(t[1]) not in noms_enfants:
            return t
        fusions.append([ident, '', '', '', '',
                        'INVERSION corrigee (%s) : « %s %s » -> « %s %s »'
                        % (qui, t[0], t[1], t[1].upper(), t[0].capitalize())])
        return (t[1], t[0]) + tuple(t[2:])

    pere = redresser(pere, 'pere')
    mere = redresser(mere, 'mere')
    pere = (sans_mention(pere[0]),) + tuple(pere[1:])
    mere = (sans_mention(mere[0]),) + tuple(mere[1:])

    # ── R4 : le tuteur 1 est celui qui porte NOM + Prenom + Email ────────────
    # L email du tuteur 1 est NOT NULL en base depuis le 13/09 : un foyer dont
    # le pere n a pas d adresse serait refuse. On permute plutot que de perdre
    # la famille. Le pere reste prioritaire quand les deux sont complets.
    if utilisable(*pere[:3]):
        t1, t2, lien1, lien2 = pere, mere, 'Père', 'Mère'
    elif utilisable(*mere[:3]):
        t1, t2, lien1, lien2 = mere, pere, 'Mère', 'Père'
        fusions.append([ident, '', '', '', '', 'PERMUTATION : la mere devient tuteur 1 (email)'])
    else:
        exclusions.append([ident, 'Foyer', (pere[0] or '') + ' ' + (pere[1] or ''),
                           '', 'Aucun tuteur ne reunit NOM + Prenom + Email '
                           '(les trois sont obligatoires)'])
        continue

    v1, c1, vi1, n1 = adresse(t1[4], t1[5], t1[6])
    v2, c2, vi2, n2 = adresse(t2[4], t2[5], t2[6])
    tel1, e1 = tel(t1[3])
    tel2, e2 = tel(t2[3])
    mail1, m1 = mail(t1[2])
    mail2, m2 = mail(t2[2])
    for note in (n1, n2, e1, e2, m1, m2):
        if note:
            exclusions.append([ident, 'Tuteur', (t1[0] or '') + ' ' + (t1[1] or ''),
                               'corrige' if 'retire' in note else 'conserve', note])

    # Le tuteur 2 n existe que s il a un NOM lisible.
    t2_present = not junk(t2[0])
    if t2[0] and junk(t2[0]):
        exclusions.append([ident, 'Tuteur 2', t2[0], 'efface',
                           'Nom de remplissage dans l ancien logiciel'])

    base = [
        t1[0].upper(), t1[1], mail1, tel1, lien1, v1, vi1, c1, '',
        (t2[0].upper() if t2_present else ''), (t2[1] if t2_present else ''),
        (mail2 if t2_present else ''), (tel2 if t2_present else ''),
        (lien2 if t2_present else ''), (v2 if t2_present else ''),
        (vi2 if t2_present else ''), (c2 if t2_present else ''), '',
        '',  # situation familiale : aucune colonne source
    ]

    # ── R5 : dedoublonnage des apprenants ───────────────────────────────────
    #
    # L EGALITE STRICTE NE SUFFIT PAS. Revele a l ecran sur la famille MEHADHBI :
    # 18 lignes source pour 3 enfants, avec deux fautes CUMULEES — la date
    # decalee d un jour ET le prenom transpose (« Zakariya » / « Zakaryia »).
    # Comparer (nom, prenom, date) a l identique ne les rapproche pas, et les
    # gardes en base ne le feront pas davantage : sept fiches auraient ete creees.
    #
    # On ne rapproche QUE DANS UN MEME FOYER. Deux cousins homonymes nes a deux
    # jours d ecart, cela existe ; deux enfants du MEME foyer portant presque le
    # meme prenom et nes presque le meme jour, non.
    lot = [x for y in ids for x in enfants[y]]
    paquets = []

    def meme_enfant(a, b):
        if norm(a[ENOM]) != norm(b[ENOM]):
            return False
        pa, pb = lettres(a[EPRE]), lettres(b[EPRE])
        if not pa or not pb:
            return False
        if not (pa == pb or sorted(pa) == sorted(pb)
                or difflib.SequenceMatcher(None, pa, pb).ratio() >= 0.85):
            return False
        # Une ligne sans date se rattache a son homonyme : c est un exemplaire
        # de plus, pas un enfant dont on ignorerait la naissance.
        if not a[EDN] or not b[EDN]:
            return True
        try:
            d1 = datetime.date.fromisoformat(a[EDN])
            d2 = datetime.date.fromisoformat(b[EDN])
        except Exception:
            return False
        return abs((d1 - d2).days) <= 7

    for r in lot:
        for membres in paquets:
            if any(meme_enfant(m, r) for m in membres):
                membres.append(r)
                break
        else:
            paquets.append([r])

    vus = []
    for membres in paquets:
        # LE REPRESENTANT : la ligne qui porte une CLASSE. C est celle que
        # l ecole a reellement utilisee pour inscrire l enfant, donc le meilleur
        # arbitre disponible sur la date ET sur l orthographe. A defaut, la plus
        # ANCIENNE (plus petit ID) : les exemplaires sont des reinscriptions.
        membres.sort(key=lambda x: (0 if x[ECLA] else 1, 0 if x[EDN] else 1,
                                    int(x[IDE]) if str(x[IDE]).isdigit() else 0))
        chef = membres[0]
        for autre in membres[1:]:
            quoi = []
            if norm(autre[EPRE]) != norm(chef[EPRE]):
                quoi.append('prenom « %s »' % autre[EPRE])
            if (autre[EDN] or '') != (chef[EDN] or ''):
                quoi.append('naissance ' + (autre[EDN] or 'absente'))
            exclusions.append([
                ident, 'Apprenant', (autre[ENOM] or '') + ' ' + (autre[EPRE] or ''), 'doublon',
                'Meme enfant que ID %s%s' % (chef[IDE],
                                             ' — variante : ' + ', '.join(quoi) if quoi else '')])
        # Le commentaire medical peut vivre sur un exemplaire ECARTE : on le
        # reprend sur n importe quel membre du groupe, sinon reunir les doublons
        # ferait disparaitre l allergie qu ils portaient.
        com_groupe = ''
        for m in membres:
            c = (m[ECOM] or '').strip()
            if c and c.lower() not in RIEN_A_SIGNALER:
                # Majuscule initiale, comme la saisie manuelle ailleurs dans
                # l app (referentiel, depenses) : « orthophoniste » et
                # « Orthophoniste » ne doivent pas coexister sur deux fiches.
                com_groupe = c[0].upper() + c[1:]
                break
        commentaire_de[id(chef)] = com_groupe

        if not chef[EDN]:
            exclusions.append([ident, 'Apprenant', (chef[ENOM] or '') + ' ' + (chef[EPRE] or ''),
                               'ecarte', 'Date de naissance absente, or elle est obligatoire'])
            continue
        if len(membres) > 1:
            quasi.append([ident, (chef[ENOM] or '').upper(), chef[EPRE] or '', chef[EDN],
                          '%d lignes source' % len(membres),
                          'la classe' if chef[ECLA] else 'anciennete',
                          ' / '.join(sorted(set((x[EPRE] or '') + ' ' + (x[EDN] or 'sans date')
                                                for x in membres)))])
        vus.append(chef)

    # ── CE QUE JE N AI PAS OSE RECOLLER ─────────────────────────────────────
    # Deux enfants du meme foyer, prenoms ressemblants, SOUS le seuil. Quand la
    # date est IDENTIQUE, c est aussi exactement a quoi ressemblent des JUMEAUX.
    # On ne tranche pas : deux fiches en trop se suppriment, un enfant fondu
    # dans un autre est perdu. Le doute va donc vers la prudence, et il est DIT.
    for i in range(len(vus)):
        for j in range(i + 1, len(vus)):
            a, b = vus[i], vus[j]
            if norm(a[ENOM]) != norm(b[ENOM]):
                continue
            pa, pb = lettres(a[EPRE]), lettres(b[EPRE])
            r_sim = difflib.SequenceMatcher(None, pa, pb).ratio()
            if 0.70 <= r_sim < 0.85 and a[EDN] and b[EDN]:
                ec = abs((datetime.date.fromisoformat(a[EDN])
                          - datetime.date.fromisoformat(b[EDN])).days)
                if ec <= 7:
                    douteux.append([
                        ident, (a[ENOM] or '').upper(),
                        '%s (%s)' % (a[EPRE], a[EDN]), '%s (%s)' % (b[EPRE], b[EDN]),
                        '%.0f%% de ressemblance, %d jour(s) d ecart' % (r_sim * 100, ec),
                        'LAISSES SEPARES : meme date = peut etre des jumeaux. A trancher.'
                        if ec == 0 else 'LAISSES SEPARES. A trancher.'])

    for r in vus:
        a = age(r)
        if a is not None and a >= AGE_ADULTE:
            adultes.append([ident, (r[ENOM] or '').upper(), r[EPRE] or '', r[EDN],
                            '%.0f ans' % a])
            continue

        genre = {'M': 'Masculin', 'F': 'Féminin'}.get((r[ESEX] or '').strip().upper(), '')
        if not genre:
            exclusions.append([ident, 'Apprenant', (r[ENOM] or '') + ' ' + (r[EPRE] or ''),
                               'ecarte', 'Genre illisible : %s' % r[ESEX]])
            continue

        com = commentaire_de.get(id(r), '')
        lignes.append(base + [(r[ENOM] or '').upper(), r[EPRE] or '', r[EDN], genre, com])
        if com:
            medical.append([(r[ENOM] or '').upper(), r[EPRE] or '', r[EDN], com])

# Les foyers sans aucun enfant : hors de portee de cet ecran.
for r in pr:
    if r[IDP] not in enfants:
        exclusions.append(['foyer ' + r[IDP], 'Foyer',
                           (r[NP] or '') + ' ' + (r[PP] or ''), 'non importe',
                           'Aucun enfant dans l export : cet ecran cree un foyer AVEC ses apprenants'])

# ═══ ECRITURE ════════════════════════════════════════════════════════════════
# Les lignes sont triees par NOM de tuteur 1 : a l ecran les 103 foyers
# s accordeonnent dans cet ordre, et on retrouve une famille sans la chercher.
lignes.sort(key=lambda l: (norm(l[0]), norm(l[1]), norm(l[19]), l[21]))
assert all(len(l) == 24 for l in lignes), 'le gabarit compte 24 colonnes'

ecrire_depuis_gabarit('Import_Bilal-Neuville.xlsx', lignes)

ecrire_classeur('Import_Bilal-Neuville_COMPLEMENT.xlsx', [
    ('Informations medicales',
     [['Enfant NOM', 'Prénom', 'Naissance', 'Information']] + sorted(medical)),
    ('Cours adultes',
     [['Foyer', 'NOM', 'Prénom', 'Naissance', 'Âge']] + adultes),
    ('A verifier',
     [['Foyer', 'NOM', 'Apprenant A', 'Apprenant B', 'Ressemblance', 'Decision']] + douteux),
    ('Enfants recolles',
     [['Foyer', 'NOM', 'Prénom retenu', 'Naissance retenue', 'Lignes source',
       'Arbitré par', 'Variantes rencontrées']] + quasi),
    ('Foyers fusionnes',
     [['Foyers', 'NOM père', 'Prénom père', 'NOM mère', 'Prénom mère', 'Détail']] + fusions),
    ('Ecarte',
     [['Foyer', 'Nature', 'Qui', 'Sort', 'Motif']] + exclusions),
])

foyers = len(set(tuple(l[:3]) for l in lignes))
w('FICHIERS PRODUITS')
w('  Import_Bilal-Neuville.xlsx             %4d foyers, %d apprenants' % (foyers, len(lignes)))
w('  Import_Bilal-Neuville_COMPLEMENT.xlsx  medical / adultes / fusions / ecartes')
w('')
w('  foyers fusionnes / permutations         %4d' % len(fusions))
w('  adultes mis de cote                     %4d' % len(adultes))
w('  enfants recolles (quasi-doublons)       %4d' % len(quasi))
w('  paires douteuses laissees separees      %4d' % len(douteux))
w('  informations medicales conservees       %4d' % len(medical))
w('  lignes ecartees                         %4d' % len(exclusions))
print('\n'.join(rapport))
