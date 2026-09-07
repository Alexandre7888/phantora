# Prompt para IA - Bot Shell Script (.sh)

Copie o texto abaixo e cole na Inteligência Artificial que gerará o seu backend em Shell Script.

***

**Crie um sistema completo de Bot de Mensagens feito puramente em Shell Script (.sh), sem usar Node.js ou dependências externas como npm. Use apenas comandos nativos do sistema como `curl`, `jq` e ferramentas de hash como `sha256sum`.**

O bot deve se comunicar com a API REST do Firebase Realtime Database para validar sua identidade, ler mensagens e responder.

**Requisitos e Fluxo de Autenticação:**

1. **Configuração e Endpoints:**
- O script deve conter variáveis no topo para `FIREBASE_URL`, `BOT_ID` (ex: bot_1234), `BOT_TOKEN_PLAIN` (o token puro) e `GROUP_ID` (o ID do grupo que o bot vai escutar).
- O bot NÃO deve usar o token puro para comparação direta, se o banco estiver armazenando o hash.

2. **Validação de Identidade e SHA-256:**
- Ao iniciar, o script deve pegar a variável `BOT_TOKEN_PLAIN` e gerar um hash SHA-256 localmente (usando `echo -n "$BOT_TOKEN_PLAIN" | sha256sum | awk '{print $1}'`).
- Em seguida, fazer uma requisição GET para o endpoint do usuário do bot:
  `${FIREBASE_URL}/users/${BOT_ID}.json`
- O script deve extrair o campo de token salvo lá (usando `jq`) e comparar com o hash gerado, ou validar se o token salvo exige verificação específica. *(Nota: O desenvolvedor fará com que o frontend salve o hash SHA-256 no banco).*
- Se a validação falhar, o script deve abortar a execução. Se passar, o bot entra no loop de escuta.

3. **Status de "Pensando" (Typing Indicator):**
- O script fará polling na rota: `${FIREBASE_URL}/groups/${GROUP_ID}/messages.json?orderBy="timestamp"&limitToLast=1`.
- Quando o bot identificar uma nova mensagem direcionada a ele (ou que precise responder), ele deve IMEDIATAMENTE enviar um `PUT` com o valor `true` para a rota de digitação:
  `${FIREBASE_URL}/groups/${GROUP_ID}/typing/${BOT_ID}.json`
- Isso fará a interface exibir "O bot está digitando...".

4. **Integração com API Externa:**
- Enquanto o "typing" está ativo, o script chama a sua API de inteligência artificial (ex: OpenAI, Gemini, Ollama ou webhook próprio) usando `curl` passando a mensagem do usuário para obter a resposta de texto.

5. **Envio da Resposta:**
- Após obter a resposta da IA, o bot envia a mensagem com um `POST` para o endpoint: 
  `${FIREBASE_URL}/groups/${GROUP_ID}/messages.json`
- O payload JSON da requisição deve ser:
  ```json
  {
    "senderId": "${BOT_ID}",
    "senderName": "Nome do Bot",
    "type": "text",
    "text": "RESPOSTA_AQUI",
    "timestamp": TEMPO_EM_MILISSEGUNDOS
  }
  ```
- Imediatamente após enviar a mensagem, o bot DEVE enviar um comando `DELETE` para a rota `${FIREBASE_URL}/groups/${GROUP_ID}/typing/${BOT_ID}.json` para remover o status de "pensando".

Por favor, gere como resposta APENAS o código final do arquivo `.sh`, bem estruturado e comentado, incluindo a lógica do loop infinito `while true`, as extrações de JSON com `jq`, a geração do hash SHA-256 e as chamadas via `curl` aos endpoints do Firebase e da API de IA descritos.

***