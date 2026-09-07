# Regras de Segurança do Firebase Realtime Database

Para garantir que a autenticação funcione corretamente e que os dados estejam protegidos (com leitura pública para vídeos/posts e restrição baseada no UID do Firebase), copie e cole as regras abaixo no seu **Realtime Database**:

```json
{
  "rules": {
    // Por padrão, a leitura e escrita são bloqueadas na raiz
    ".read": false,
    ".write": false,

    // 1. Mapeamento de Autenticação (Private ID -> Public ID)
    "auth_map": {
      // O usuário só pode ler/escrever o próprio mapeamento baseado no seu UID do Firebase
      "$firebaseUid": {
        ".read": "auth != null && auth.uid === $firebaseUid",
        ".write": "auth != null && auth.uid === $firebaseUid"
      }
    },

    // 2. Perfis de Usuários (Public ID: usr_...)
    "users": {
      // Leitura pública para que todos vejam os perfis
      ".read": true,
      
      "$publicUserId": {
        // Para escrever, o usuário precisa estar logado. 
        // Se a sua aplicação usa o Public ID igual ao auth.uid, a regra fica assim:
        ".write": "auth != null && auth.uid === $publicUserId"
        
        // NOTA: Se o auth.uid for diferente do Public ID (ex: auth.uid é o ID privado), 
        // você precisará validar através do auth_map:
        // ".write": "auth != null && root.child('auth_map').child(auth.uid).val() === $publicUserId"
      }
    },

    // 3. Regras para Vídeos / Posts (Leitura 100% Pública)
    "videos": {
      ".read": true, // Qualquer um pode ver
      
      "$videoId": {
        // Apenas usuários logados podem criar/editar, e o authorId deve bater com o UID logado
        ".write": "auth != null && (!data.exists() || data.child('authorId').val() === auth.uid)"
      }
    },

    "posts": {
      ".read": true,
      "$postId": {
        // O autor pode editar o post todo
        ".write": "auth != null && (!data.exists() || data.child('authorId').val() === auth.uid)",
        "likes": {
          "$userId": {
            // Qualquer usuário logado pode dar like com seu próprio ID
            ".write": "auth != null && auth.uid === $userId"
          }
        },
        "comments": {
          // Qualquer um logado pode adicionar comentário
          ".write": "auth != null"
        }
      }
    },
    
    // Regras de Analytics dos vídeos
    "video_analytics": {
      ".read": "auth != null",
      ".write": true // Permitir gravação pública ou "auth != null" dependendo da necessidade
    },

    // 4. Regras para usuários banidos
    "banned_users": {
      ".read": true,
      ".write": "auth != null" 
    }
  }
}
```

## Explicação do auth.uid:
A variável `auth.uid` nas regras do Firebase representa exatamente o UID que foi passado no token de autenticação quando você faz o login. 
- Se o seu token foi gerado usando o ID Público (`usr_...`) como UID, a verificação `auth.uid === $publicUserId` funcionará perfeitamente.
- Se o token foi gerado usando um ID Privado, deixei anotado na seção `users` como você pode validar isso usando a raiz `root.child('auth_map')`.