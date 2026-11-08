# 🛡️ Física de Chokepoints e Colisão Corporal (길막 - Gil-mak)

Especificações balísticas e mecânicas de colisão da Unreal Engine em VAMPIR.

---

## 1. Raio e Dimensões de Colisão

* **Raio da Cápsula de Colisão ($R_{col}$):** $45\text{ cm}$ ($0{,}45\text{m}$) por personagem.
* **Diâmetro Efetivo ($D_{col}$):** $90\text{ cm}$ ($0{,}90\text{m}$).
* **Altura Meia da Cápsula:** $95\text{ cm}$ (altura total $190\text{ cm}$).
* **Margem Efetiva de Bloqueio:** Cada guerreiro **Bloodstained** ocupa de **$0{,}85\text{m}$ a $0{,}95\text{m}$** de área intransponível estática.

---

## 2. Vedação Hermética em Dupla Fileira (Checkerboard Wedge)

Para impedir micro-deslizamentos de colisão (*corner slipping* por dashes de Akasha), a linha não pode ser simples: exige **Fileira Dupla Alternada**.

| Local de Combate | Largura | 1ª Linha (Frente) | 2ª Linha (Apoio) | Contingente Total |
| :--- | :---: | :---: | :---: | :---: |
| **Ponte Estreita (Gehenna)** | $3{,}8\text{m}$ | 4 a 5 | 4 a 5 | **8 a 10 Bloodstaineds** |
| **Portão Secundário / Brecha** | $5{,}0\text{m}$ | 6 | 6 | **12 Bloodstaineds** |
| **Portão Principal de Cerco** | $6{,}0\text{m}$ | 7 a 8 | 7 a 8 | **14 a 16 Bloodstaineds** |
| **Arco Grande de Fortaleza** | $8{,}0\text{m}$ | 9 a 10 | 9 a 10 | **18 a 20 Bloodstaineds** |

---

## 3. Retornos Decrescentes de CC (Diminishing Returns)

Janela de decaimento de **12 segundos** por categoria (Hard CC: Stun/Knockdown; Tactical CC: Silence/Fear):
* 1º CC: **100% de duração** (3.0s).
* 2º CC: **50% de duração** (1.5s).
* 3º CC: **25% de duração** (0.75s).
* 4º CC: **Imunidade Total (Unstoppable)** por 4.0 segundos com aura dourada.
* *Desperdício:* Disparar CCs múltiplos no mesmo tick de 50ms não acumula durações. Aplica o maior e consome a camada de 100%.

---

## 4. Táticas de Ruptura de Gargalos (Siege Break)

1. **Bombardeio de Catapultas de Cerco:** Impacto radial de 8-10m gera Knockback que separa as cápsulas dos defensores por 1.5s a 2.5s, quebrando a vedação e incendiando o solo para impedir que Bloodstaineds drenem vida.
2. **Invasão com o Guardião Cruor (Gárgula Nv 30):** Raio de cápsula colossal de 2.5m a 3.0m com **Super Armor permanente**. Passa por cima empurrando cápsulas (*Trample Physics*), abre 3m de vão, reduz DEF inimiga em 30% e aplica 60% de lentidão.
