# Phantora (anteriormente CodeHUB App Integrado)

Um projeto (Phantora) integrando autenticação pela plataforma CodeHUB e armazenamento de dados de usuário e foto de perfil no Firebase Realtime Database.

## Nova Estrutura de Autenticação e IDs
- **ID Privado:** Usado apenas para autenticação com o CodeHUB. Fica armazenado no nó `/auth_map` (Mapeia Private ID -> Public ID).
- **ID Público:** Gerado aleatoriamente durante o registro (`usr_...`). Fica no nó `/users` e é usado em todo o aplicativo (chats, compartilhamentos, perfis).

## Recursos
- **Rede Social Principal (`index.html`)**: O aplicativo agora funciona exclusivamente como uma rede social de vídeos e posts. Sistemas de chat, chamadas e bots foram removidos para focar na experiência social.
- **Sistema Admin Restrito (`admin.html`)**:
  - Acesso bloqueado exclusivamente para o IP `200.193.63.92`.
  - Exigência de geolocalização exata (Itajaí, Santa Catarina).
  - Trava de Dispositivo Permanente.
  - Monitoramento de usuários, com opção de **Banimento de Usuários**.
  - Zona Perigosa: Backup e Wipe completo.
- **Sistema de Apelação (`appeal.html`)**: Restauração via base64 local.
- **Sistema de Créditos e Loja (`credits.html`)**
- **Dispositivos Conectados**: Login simultâneo em computadores, celulares e TVs via leitura de QR Code ou inserção de ID nas configurações.

## Regras de Manutenção
Sempre que atualizar features, verifique se a lógica de arquivos (máx. 5MB) ou WebRTC sofreu modificações que exijam atualizar as documentações.
Ao lidar com recargas e pagamentos (InfinitePay), sempre consulte as regras de segurança em `trickle/rules/rule_for_infinitepay_payments.md`.
