@echo off
rem ---------------------------------------------------------------------------
rem  Enveloppe de la sauvegarde, pour le Planificateur de taches Windows.
rem
rem  POURQUOI UNE ENVELOPPE ET NON L APPEL DIRECT :
rem   1. le Planificateur ne positionne PAS le dossier courant, et le script
rem      lit `.env.local` depuis la racine du projet ;
rem   2. une tache planifiee n a aucune sortie visible — une sauvegarde qui
rem      echoue chaque nuit sans que personne ne le voie est pire que pas de
rem      sauvegarde. Tout part donc dans un journal, avec son horodatage et son
rem      code de sortie.
rem
rem  `%~dp0..` : la racine est deduite de l emplacement de CE fichier, jamais
rem  ecrite en dur — le chemin du depot contient une espace et un `#`.
rem ---------------------------------------------------------------------------

cd /d "%~dp0.."

rem Le journal vit AVEC les sauvegardes, hors du depot.
set "JOURNAL=D:\Sauvegardes-BILALEDUCATION\journal.txt"
if not exist "D:\Sauvegardes-BILALEDUCATION" mkdir "D:\Sauvegardes-BILALEDUCATION"

echo. >> "%JOURNAL%"
echo ===== %DATE% %TIME% ===== >> "%JOURNAL%"

node scripts\sauvegarder.mjs >> "%JOURNAL%" 2>&1
set CODE=%ERRORLEVEL%

echo --- code de sortie : %CODE% >> "%JOURNAL%"
exit /b %CODE%
