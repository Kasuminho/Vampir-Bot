# 🩸 Vampir Bot — Sistema de Gestão de Guilds & Acesso Zero-Trust

Bot oficial do servidor **Vampir**, projetado para gerenciar servidores com múltiplas legiões/guilds parceiras através de um sistema de 3 níveis de permissões, formulários de aplicação nativos (modais) e container Docker leve.

---

## 🔒 Arquitetura de Permissões (3 Níveis)

1. **Visitante (`@everyone`)**:
   - Confinado exclusivamente na categoria `🚪 │ RECEPÇÃO & ENTRADA`.
   - Pode apenas ler as regras e ver os cards de recrutamento das guilds parceiras.
2. **Player Validado (`[⚔️] Player Validado`)**:
   - Recebido automaticamente assim que for aceito pelo líder de uma guild.
   - Desbloqueia a categoria `🌐 │ COMUNIDADE GERAL` (World Bosses, Timers, Estratégias, Chat Geral e Voz).
3. **Líder de Guild (`[👑] Líder de Guild` + Cargo da Guild)**:
   - Acesso à categoria `👑 │ CÚPULA DE LÍDERES` (reuniões estratégicas e diplomacia).
   - Acesso e gestão do canal secreto `#📋-aprovacoes` da sua própria legião para aceitar/recusar candidatos.

---

## 🚀 Como Rodar em Produção (Linux com Docker)

### 1. Clonar ou Enviar os arquivos para o servidor Linux:
```bash
git clone <seu-repo> /opt/vampir-bot
cd /opt/vampir-bot
```

### 2. Configurar o `.env`:
Crie o arquivo `.env` na raiz do projeto:
```env
DISCORD_TOKEN=seu_bot_token_aqui
CLIENT_ID=seu_client_id_aqui
PUBLIC_KEY=sua_public_key_aqui
CLIENT_SECRET=seu_client_secret_aqui
GUILD_ID=id_do_seu_servidor_discord
```

### 3. Subir o container no Docker:
```bash
docker compose up -d --build
```

Para checar os logs em tempo real:
```bash
docker compose logs -f
```

---

## 🛠️ Comandos Slash Disponíveis

| Comando | Permissão | Descrição |
| :--- | :--- | :--- |
| `/criar-guild [nome] [tag] [lider] [descricao] [cor] [icone]` | Administrador | Cria o cargo da legião, a categoria com os canais internos, o canal privado de aprovação do líder e publica o card interativo no canal de recrutamento. |
| `/editar-guild [tag] [cor] [descricao] [icone_url]` | Líder de Guild / Staff | Permite ao líder de cada clã alterar a cor do cargo no Discord, a descrição e o brasão/ícone em tempo real, atualizando o painel de recrutamento. |
| `/guild-staff [acao] [usuario] [tag]` | Líder de Guild / Staff | Gerencia a equipe da guild: adiciona/remove oficiais e vice-líderes com acesso ao canal de aprovações ou transfere a liderança principal. |
| `/boss-respawn [boss] [horario]` | Todos | Registra o horário exato (ex: `18:30`, `21:46`) ou tempo restante (ex: `45m`, `1h 30m`) para o próximo spawn de um Boss de Mapa. |
| `/boss-morto [boss] [respawn]` | Todos | Marca um Boss de Mapa como morto e opcionalmente já define o próximo horário de respawn. |
| `/boss-vivo [boss]` | Todos | Marca um Boss de Mapa como vivo/apareceu no mapa. |
| `/boss-painel` | Todos | Atualiza ou re-sincroniza o painel fixo de cronograma no canal `#boss-timers`. |
| `/painel-recrutamento` | Administrador | Atualiza ou re-renderiza o painel com todas as guilds cadastradas no canal de recrutamento. |
| `/listar-guilds` | Administrador | Lista todas as guilds cadastradas, líderes e cargos. |
| `/ajuda` | Todos | Exibe o guia rápido do sistema. |

---

## 📩 Fluxo de Candidatura e Recrutamento

1. O membro clica no botão **`✉️ Aplicar para [TAG]`** no canal `#🏰-recrutamento-guilds`.
2. Um formulário pop-up nativo (Modal) solicita:
   - Nick oficial in-game.
   - Classe / Build pretendida.
   - Level atual e horários habituais de jogo.
   - Breve experiência em jogos/MMOs.
3. A ficha é formatada em Embed e entregue no canal exclusivo `#📋-aprovacoes` da guild correspondente.
4. O Líder recebe notificação com menção e clica em **`[✅ Aprovar Membro]`** ou **`[❌ Recusar Membro]`**.
5. Ao ser aprovado:
   - O bot entrega o cargo da Guild + o cargo `Player Validado`.
   - O membro recebe mensagem de boas-vindas na DM.
   - Toda a comunidade do servidor é desbloqueada para o membro.
