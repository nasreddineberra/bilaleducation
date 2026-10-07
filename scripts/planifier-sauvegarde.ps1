# ---------------------------------------------------------------------------
#  Enregistre (ou met a jour) la tache planifiee de sauvegarde quotidienne.
#
#    powershell -ExecutionPolicy Bypass -File scripts\planifier-sauvegarde.ps1
#    powershell -ExecutionPolicy Bypass -File scripts\planifier-sauvegarde.ps1 -Heure 06:30
#    powershell -ExecutionPolicy Bypass -File scripts\planifier-sauvegarde.ps1 -Retirer
#
#  TROIS REGLAGES QUI NE SONT PAS DES DETAILS, et que les defauts de Windows
#  prendraient a l envers :
#
#   · StartWhenAvailable — un poste eteint a l heure dite RATERAIT la
#     sauvegarde, sans que rien ne le dise. Avec ce reglage, elle se rattrape
#     au prochain demarrage. C est le reglage qui compte le plus sur un portable.
#   · DisallowStartIfOnBatteries — vaut VRAI par defaut : sur batterie, Windows
#     sauterait purement et simplement la tache. Mis a faux.
#   · MultipleInstances = IgnoreNew — si une sauvegarde traine, la suivante ne
#     se lance pas par-dessus : deux `pg_dump` concurrents sur le meme dossier
#     ne produiraient rien de bon.
#
#  La tache tourne SOUS VOTRE COMPTE, sans elevation : elle lit `.env.local`,
#  qui vous appartient. Pas de mot de passe stocke, donc elle ne s execute que
#  lorsque vous etes connecte — ce qui est le bon compromis ici.
# ---------------------------------------------------------------------------

param(
  [string]$Heure = '20:00',
  [switch]$Retirer
)

$ErrorActionPreference = 'Stop'
$nom = 'BILALEDUCATION - Sauvegarde quotidienne'

if ($Retirer) {
  if (Get-ScheduledTask -TaskName $nom -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $nom -Confirm:$false
    Write-Host "Tache retiree : $nom" -ForegroundColor Green
  } else {
    Write-Host "Aucune tache nommee « $nom »." -ForegroundColor Yellow
  }
  exit 0
}

# La racine est deduite de l emplacement de CE fichier, jamais ecrite en dur :
# le chemin du depot contient une espace et un `#`.
$racine = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$enveloppe = Join-Path $racine 'scripts\sauvegarder.cmd'

if (-not (Test-Path $enveloppe)) {
  Write-Host "ABANDON : $enveloppe introuvable." -ForegroundColor Red
  exit 1
}

$action = New-ScheduledTaskAction -Execute $enveloppe -WorkingDirectory $racine
$declencheur = New-ScheduledTaskTrigger -Daily -At $Heure

$reglages = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -AllowStartIfOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$description = @"
Sauvegarde locale de BILAL EDUCATION : base (3 schemas, donnees comprises),
fichiers de Storage, configuration du tableau de bord Supabase, et un manifeste
qui porte le nombre de lignes table par table.

ATTENTION : le dossier produit contient des donnees personnelles de familles
ET des secrets en clair (mot de passe SMTP du projet, cles d API). Ne le
transmettez pas.

Journal : D:\Sauvegardes-BILALEDUCATION\journal.txt
Eprouver une sauvegarde : node scripts\verifier-sauvegarde.mjs
"@

Register-ScheduledTask -TaskName $nom `
  -Action $action -Trigger $declencheur -Settings $reglages -Principal $principal `
  -Description $description -Force | Out-Null

Write-Host ""
Write-Host "Tache enregistree." -ForegroundColor Green
Write-Host "  nom     : $nom"
Write-Host "  heure   : $Heure, chaque jour (rattrapee si le poste etait eteint)"
Write-Host "  lance   : $enveloppe"
Write-Host "  journal : D:\Sauvegardes-BILALEDUCATION\journal.txt"
Write-Host ""
Write-Host "  Essai immediat : Start-ScheduledTask -TaskName '$nom'" -ForegroundColor DarkGray
Write-Host "  Retirer        : ...\planifier-sauvegarde.ps1 -Retirer" -ForegroundColor DarkGray
Write-Host ""
