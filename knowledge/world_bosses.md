# 🐉 VAMPIR — Chefes de Território & World Bosses (Poenari, Kicel e Bezdan)

## 1. Geografia & Lore dos Territórios

### 🩸 Território de Krvna (크르브나 영지 — Níveis 1 ao ~40)
* Berço inicial do jogo sob proteção da profetisa vampírica **Olga**. Aprendizado das mecânicas de drenagem de sangue (*Blood Drain*) e progressão básica.

### 🏰 Território de Poenari (포에나리 영지 — Níveis ~40 ao 75)
* Província medieval gótica inspirada no Castelo de Poenari. O governante original, **Lorde Oscar**, desapareceu durante a invasão dos fanáticos; o **Ancião Straza** comanda os clãs locais e a resistência vampírica.
* **Locais Notáveis:**
  * **Passagem do Alvorecer** (*Seogwang-gado*): Entrada de Poenari e ponto de patrulha.
  * **Planícies Empaladas**: Campos abertos repletos de monumentos de empalamento da guerra santa.
  * **Bosque Umbroso**: Floresta densa com emboscadas constantes.

### 🏜️ Território de Kicel / Tancilla (키첼 영지 — Níveis ~75 ao 110)
* Região árida de cânions e tempestades de poeira de sangue, outrora governada pela facção Tancilla.
* **Locais Notáveis:** Vale Estéril, Dunas de Alabastro e Ruínas Esquecidas.

### ❄️ Território de Bezdan (베즈단 영지 — Níveis 110+ Endgame)
* Região gélida amaldiçoada que abriga o Monastério do Silêncio (*Monastery of Silence*) e as Terras do Espírito Sagrado (*Holy Spirit Lands*).

---

## 2. Roster Completo dos World Bosses de Campo

| Nv. | Chefe | Território | Localização | Corte de Precisão (*Accuracy Cut*) | Drops & Mecânicas Notáveis |
| :---: | :---: | :---: | :--- | :---: | :--- |
| **47** | **Larva** | Poenari | Passagem do Alvorecer | **~200** | Subterrâneo & cuspe corrosivo frontal. Moedas Eternas, Baú Top 70% e Baú Top 100 de Mercado. |
| **63** | **Brachium** | Poenari | Planícies Empaladas | **~440** | Golpes sísmicos com Stun em área e Frenesi a 30% HP. Equipamentos Raros e orbes de criação. |
| **70** | **Clamamus** | Poenari | Bosque Umbroso | **~690** | Rugido ensordecedor com Silêncio e Fear. Libera o slot de **Insígnias** (Nv. 70) e livros de classe. |
| **83** | **Deserti** | Kicel | Vale Estéril | **~780 a 820** | Vórtice de areia movediça e aura de dessecação. Insígnias Raras avançadas e pedras de evolução. |
| **95** | **Exesa** | Kicel | Dunas de Alabastro | **~850+** | Corrosão (-50% DEF) e poças ácidas. Concede **2 Moedas Eternas**, baús de alta raridade e materiais Trinity. |
| **107** | **Usurpator** | Kicel | Ruínas Esquecidas | **~880 a 950** | Roubo de atributos e absorção de almas. **2 Moedas Eternas**, Insígnias Raras Top 70% e Livros Mestre. |
| **115** | **Orseca** | Bezdan | Subterrâneo do Silêncio | **~1.395+** | Chefe endgame gélido em Bezdan com recompensas massivas de subjugação de temporada. |
| **126** | **Infernus** | Bezdan | Profundezas do Silêncio | **Extremo** | Chefe supremo de mapa aberto; exige alianças coordenadas com divisão de esquadrões de aggro e contenção. |

---

## 3. Dinâmica de Spawn & Fórmulas de Respawn

### A. Modelos de Respawn
1. **Horário Fixo Global (Fixed Daily Schedule):**
   * Janelas oficiais como Geena 1⭐ (**15:00, 19:00, 23:00**) e Geena 2⭐ (**15:00, 23:00**), além de World Bosses em horários tabelados (12:00 e 20:00).
2. **Cooldown Base + Janela de Variância:**
   * Para Field Bosses dinâmicos:
     $$T_{spawn} = T_{morte} + Cooldown_{base} + \text{Random}(0, \text{Janela}_{variância})$$
* **Regra de Ouro da Presença:** O jogador precisa estar **fisicamente presente na zona no exato segundo da morte** do boss para receber a premiação. Se estiver morto sem renascer ou em tela de carregamento, perde os drops.

### B. Comandos Operacionais do Bot:
* `/boss-respawn [boss] [horario]` — Agenda horário fixo (`18:30`, `02:15`) ou tempo relativo (`45m`, `1h 20m`, `3h`).
* `/boss-morto [boss] [respawn]` — Marca como 💀 **MORTO** e opcionalmente agenda o próximo ciclo.
* `/boss-vivo [boss]` — Altera status para 🟢 **APARECEU / VIVO**.
* `/boss-painel` — Sincroniza o painel fixo embed interativo em `#boss-timers`.

### C. Sistema de Alertas em `#anúncios`:
1. **Faltando 30 minutos:** Notificação para membros encerrarem masmorras solo/afk e prepararem poções.
2. **Faltando 5 minutos:** Alerta urgente com menção aos membros para deslocamento tático ao ponto de spawn e entrada no canal de Palco/Voz.
3. **No momento exato (00:00 / Spawn):** Anúncio de nascimento do boss para início imediato do combate.
