# Firebase + GitHub Pages

Este projeto agora usa Firebase Authentication e Firestore, mas pode continuar hospedado no GitHub Pages.

## No Firebase Console

1. Authentication > Sign-in method > ativar Email/Password.
2. Firestore Database > Create database > Start in test mode.
3. Authentication > Settings > Authorized domains > adicionar o domínio do GitHub Pages:
   - SEU_USUARIO.github.io

## O que o jogo salva no Firestore

Coleção: `players`

Campos:
- nick
- email
- level
- xp
- xpMax
- coins
- points
- strength
- agility
- vitality
- weapon
- class
- updatedAt

## Hospedar no GitHub Pages

Envie os arquivos para um repositório e ative:
Settings > Pages > Deploy from a branch > main > /root.
