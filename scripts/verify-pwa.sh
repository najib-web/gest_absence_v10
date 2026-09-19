#!/bin/bash
# Vérification E2E PWA : serveur + manifest + SW + bouton install + dialogue + captures
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 2
rm -f dev.log
nohup bun run dev > /dev/null 2>&1 &

for i in $(seq 1 20); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/me 2>/dev/null)
  [ "$code" = "401" ] && { echo "Serveur prêt après $((i*3))s"; break; }
done

echo "=== 1. Ouverture page de connexion ==="
agent-browser set viewport 1280 900
agent-browser open http://localhost:3000 2>&1 | tail -1
agent-browser wait --load networkidle
sleep 2

echo "=== 2. Lien manifest + SW + thème ==="
agent-browser eval "document.querySelector('link[rel=manifest]')?.href || 'PAS DE LINK'"
agent-browser eval "document.querySelector('meta[name=theme-color]')?.content || 'PAS DE THEME'"
agent-browser eval "navigator.serviceWorker.getRegistration().then(r => r ? 'SW ACTIF scope=' + r.scope : 'SW NON ENREGISTRE')"

echo "=== 3. Bouton Installer visible ? ==="
agent-browser snapshot -i -c | rg -i "installer|install" | head -3

echo "=== 4. Capture page login FR ==="
agent-browser screenshot download/verif-pwa-login-fr.png

echo "=== 5. Clic bouton Installer → dialogue guide ==="
agent-browser eval "window.dispatchEvent(new Event('pwa-install-request')); 'event envoyé'"
sleep 1.5
agent-browser snapshot -i -c | rg -i "install|étape|menu|navigateur|dial" | head -8
agent-browser screenshot download/verif-pwa-dialogue.png

echo "=== 6. Fermer dialogue, test iOS simulé (UA iPhone) ==="
agent-browser eval "document.querySelector('[role=dialog] button, [role=dialog]') ? 'dialogue présent' : 'absent'"
agent-browser press Escape 2>/dev/null
agent-browser eval "
  // Simule iOS : supprime PwaInstall en recalculant via reload avec UA impossible à changer ici.
  // Alternative : vérifier la logique iOS par la bannière affichée manuellement.
  'ok'"

echo "=== 7. Bannière (forcer affichage via beforeinstallprompt simulé) ==="
agent-browser eval "
  const ev = new Event('beforeinstallprompt');
  ev.prompt = () => Promise.resolve();
  ev.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(ev);
  'bip simulé'"
sleep 3.5
agent-browser snapshot -i -c | rg -i "accès rapide|écran d'accueil|installer" | head -4
agent-browser screenshot download/verif-pwa-banniere.png

echo "=== 8. Version arabe ==="
agent-browser eval "localStorage.setItem('abs_locale','ar'); location.reload(); 'reload AR'"
sleep 4
agent-browser eval "document.documentElement.dir + ' / ' + document.querySelector('button[type=button].w-full.mt-3')?.textContent"
agent-browser screenshot download/verif-pwa-login-ar.png

echo "=== 9. Page hors ligne ==="
agent-browser open http://localhost:3000/offline 2>&1 | tail -1
agent-browser wait --load networkidle
agent-browser eval "document.body.innerText.slice(0, 120)"
agent-browser screenshot download/verif-pwa-offline.png

echo "=== 10. Erreurs console ==="
agent-browser errors 2>&1 | head -5
agent-browser close 2>/dev/null
echo "TERMINÉ"
