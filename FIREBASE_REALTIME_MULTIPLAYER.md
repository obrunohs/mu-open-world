# Multiplayer em tempo real com Firebase

Esta versão já inclui sincronização de jogadores online usando Firebase Realtime Database.

## Ativar no Firebase Console

1. Entre no Firebase Console.
2. Abra o projeto `mu-open-world-93c50`.
3. Vá em **Build > Realtime Database**.
4. Clique em **Create Database**.
5. Escolha uma região próxima.
6. Para testes, use **Start in test mode**.

## Regras temporárias para teste

Use apenas enquanto estiver testando:

```json
{
  "rules": {
    "worlds": {
      "$world": {
        "players": {
          "$uid": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid == $uid"
          }
        }
      }
    }
  }
}
```

## O que sincroniza agora

- Jogadores aparecem no mesmo mundo/servidor.
- Posição.
- Rotação.
- Nome.
- Level.
- HP atual.
- Animação simples de caminhada.
- Jogador some ao sair do mundo/jogo.

## Ainda não sincroniza

- Dano entre jogadores.
- PvP.
- Trocas.
- Monstros compartilhados entre todos.
- Drops compartilhados.

Essas partes precisam de uma próxima etapa para evitar trapaças e conflitos.
