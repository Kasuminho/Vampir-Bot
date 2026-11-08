# 🚀 Propostas de Features Especializadas para o Discord (Vampir - Rust 2)

Com base em todo o estudo aprofundado da mecânica real do jogo **VAMPIR** (Netmarble Neo) e na rotina das principais legiões do servidor **Rust 2**, desenhamos um roadmap de implementações táticas de altíssimo valor agregado para o bot do Discord:

---

## 1. ⚔️ Construtor de Esquadrões de Gehenna (`/gehenna-squad`)
* **Contexto no Jogo:** As batalhas de Gehenna 1⭐ (15h/19h/23h) e 2⭐ (15h/23h) exigem formação tática estrita no meta **All-DPS sem Healer**:
  * *Slot 1:* Bloodstained (segura aggro e body blocking nas portas de Gehenna).
  * *Slot 2:* Viper (debuff de quebra de defesa, veneno em área e anti-heal).
  * *Slot 3:* Grim Reaper ou Akasha (caçador de alvos frágeis na retaguarda e disrupção).
  * *Slot 4 e 5:* Carnage (DPS à distância contínuo e marcação de alvos).
* **No Discord:**
  * Comando `/gehenna-squad horario:[15:00|19:00|23:00] alvo:[Geena 1⭐|Geena 2⭐] limite:[20]`.
  * Cria um painel interativo no canal de anúncios com 5 botões de classe: `[🛡️ Bloodstained]`, `[🎯 Carnage]`, `[🔮 Viper]`, `[🗡️ Grim Reaper]`, `[🥊 Akasha]`.
  * Botão de 1 clique para a liderança: **`[🎲 Auto-Balancear Grupos]`**, que divide os inscritos automaticamente em parties de 4 a 5 jogadores com a composição perfeita.
  * Integração direta com link do canal de Palco (`Stage`) criado para a batalha.

---

## 2. 💰 Calculadora de Rateio de Drops e Trinity (`/loot-dividir`)
* **Contexto no Jogo:** Quando a guild abate um chefe de Gehenna ou World Boss, o item vai para o *Clan Vault* e é vendido no mercado por Diamantes ou leiloado internamente. A casa de leilão retém imposto (10%), a guilda retém o fundo de guerra (ex: 5%) e o restante líquido deve ser repartido entre quem compareceu à raid.
* **No Discord:**
  * Comando `/loot-dividir item:[Nome] valor:[10000] moeda:[Diamantes|Trinity] taxa:[10] fundo_guild:[5] canal_voz:[#auditório]`.
  * **Cálculo instantâneo:**
    * Bruto: 10.000 💎
    * Taxa do Mercado (10%): -1.000 💎
    * Fundo de Guerra da Guild (5%): -450 💎
    * Líquido para rateio: 8.550 💎
    * Dividendo Individual: **950 💎** por jogador.
  * Captura automaticamente quem estava no canal de voz no momento do boss!
  * Gera lista de pagamento com botão `[✅ Marcar Pago]` para o líder dar baixa à medida que envia o correio in-game.

---

## 3. ⏱️ Painel Rápido de Boss com Modal de 1 Clique
* **Contexto no Jogo:** No meio do combate intenso ou fuga de PK em Kicel, abrir o chat do Discord e digitar comandos como `/boss-respawn larva 45m` é lento e perigoso.
* **No Discord:**
  * No canal fixo `#boss-timers`, inserimos 2 botões rápidos:
    * `[⏱️ Registrar Respawn]` ➔ Abre um formulário **Modal Pop-up nativo do Discord**: o líder apenas seleciona o boss no menu e digita `45m` ou `18:30`.
    * `[🟢 Boss Nasceu Agora!]` ➔ Marca o boss como vivo com apenas 1 clique instantâneo sem digitar nada!

---

## 4. 📇 Ficha de Personagem & Build (`/perfil` e `/builds`)
* **Contexto no Jogo:** Não há poções de MP em Vampir. O sucesso no farm depende de atingir o breakpoint de **MP Regen (엠틱)** de 60 a 120+ e calibrar os tempos de intervalo de habilidades ativas.
* **No Discord:**
  * `/perfil`: Exibe Nick in-game, Classe, Nível, Gear Score (CP), Guilda e função na raid.
  * `/builds [classe]`: Menus interativos detalhando:
    * Setup ótimo de auto-combat para farm AFK (quais skills desativar para não secar mana).
    * Rotina de PvP com timings de drenagem de sangue e quebra de CC.
    * Prioridades de atributos e breakpoints de Precisão (*Accuracy / 명중*).

---

## 5. ☠️ Blacklist de PK & Rastreador KOS (`/kos-adicionar` e `/kos-avistado`)
* **Contexto no Jogo:** Em zonas de PK livre e Gehenna, clãs rivais de outros servidores atacam mineradores de Trinity e tentam roubar o último golpe (*Mak-ta*) de chefes.
* **No Discord:**
  * `/kos-adicionar nick:[Inimigo] clã:[Rival] ameaca:[Alta] motivo:[Ladrão de Boss]`.
  * `/kos-avistado nick:[Inimigo] mapa:[Kicel - Poço de Piche] qtd:[3]`.
  * Dispara alerta sonoro e embed vermelho de emergência:
    * `🚨 [INIMIGO DETECTADO] — Rust 2`
    * Botão: `[📍 Solicitar Reforço Imediato]` que notifica a tropa de choque PvP da aliança.

---

## 6. 🎙️ Registro de Presença & DKP em Raids (`/chamada-iniciar`)
* **Contexto no Jogo:** Recompensar a pontualidade nas janelas fixas de Gehenna (15h, 19h e 23h) para decidir quem tem prioridade na compra de armas míticas e livros lendários do baú da guilda.
* **No Discord:**
  * O oficial usa `/chamada-iniciar evento:[Gehenna 23:00] canal_voz:[#Palco-Gehenna] pontos:[10]`.
  * O bot faz um snapshot em tempo real de todos os membros presentes na call de voz.
  * Adiciona os pontos DKP automaticamente na conta de cada jogador e calcula a taxa de assiduidade mensal (Attendance Rate).
