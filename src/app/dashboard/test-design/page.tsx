import ModeleClient from './ModeleClient'

/**
 * PAGE MODELE (prototype) — a supprimer une fois les choix faits.
 *
 * Hors menu, aucune lecture ni ecriture en base : donnees fictives. Elle sert a
 * juger, sur un seul ecran, la nouvelle presentation avant de toucher aux vrais
 * composants : en-tete a barres obliques, liste sans cadre avec barre des
 * actifs, fiche a onglets intercalaires, champs « bordure » (fiche et modale).
 */
export default function TestDesignPage() {
  return <ModeleClient />
}
