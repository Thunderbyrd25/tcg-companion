// Recommended decks shown inside each format container.
// Each entry: { name, notes, raw, splash? }
//   name   — display name shown on the card
//   notes  — strategy/description (shown on card preview + detail modal)
//   raw    — full deck list string (same format as DeckModal paste box)
//   splash — optional card image: { name, setCode?, number? }
//
// Keys match the format container keys from Library.jsx:
//   'standard', 'expanded', 'glc', 'custom'
//   'era-TEF-POR', 'era-SVI-ASC', 'era-BST-PAR', etc.
//
// Example entry:
// {
//   name: '',
//   notes: '',
//   splash: { name: '', setCode: '' },
//   raw: 
// }

export const RECOMMENDED_DECKS = {

  standard: [
    // paste Standard recommended decks here
  ],

  expanded: [
    // paste Expanded recommended decks here
  ],

  glc: [
    // paste GLC recommended decks here
  ],

  custom: [
    // paste Custom recommended decks here
  ],

  // ── Temporal Forces era ───────────────────────────────────────────────────
  'era-TEF-POR': [],

  // ── Scarlet & Violet era ──────────────────────────────────────────────────
  'era-SVI-ASC': [
    {
      name: 'Noah Sakadjian\'s N\'s Zoroark ex',
      notes: 'Aggressive version of N\'s Zoroark ex Noah Sakadjian used to win the 2026 Orlando Regional.\nDeck list: https://limitlesstcg.com/decks/list/25610 \nVOD: https://www.youtube.com/watch?v=ZFQ3_HWszs4 \n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: { name: "N's Zoroark ex", setCode: 'JTG'},
      raw: `Pokémon: 17
4 N's Zorua JTG 97
4 N's Zoroark ex JTG 98
2 N's Zekrom ASC 155
1 N's Darumaka JTG 26
1 N's Darmanitan JTG 27
1 Fezandipiti ex ASC 142
1 Pecharunt ex SFA 39
1 Munkidori TWM 95
1 Budew ASC 16
1 Tatsugiri TWM 131

Trainer: 35
4 Lillie's Determination MEG 119
3 Boss's Orders MEG 114
3 Iono PAL 185
2 Professor Turo's Scenario PAR 171
2 Cyrano SSP 170
1 Black Belt's Training JTG 143
4 Buddy-Buddy Poffin TEF 144
3 N's PP Up JTG 153
2 Night Stretcher ASC 196
2 Counter Catcher PAR 160
1 Ultra Ball MEG 131
1 Nest Ball SVI 181
1 Poké Pad POR 81
1 Pal Pad SVI 182
1 Secret Box TWM 163
2 Binding Mochi PRE 95
2 N's Castle JTG 152

Energy: 8
8 Darkness Energy MEE 7`,
    },
    {
  name: 'Cerys Jones\' Marnie\'s Grimmsnarl ex',
  notes: 'Arven focused version of Marnie\'s Grimmsnarl ex Cerys Jones piloted to a 3rd place finish at the 2026 Orlando Regional.\nDeck list: https://limitlesstcg.com/decks/list/25611 \nVOD: https://www.youtube.com/watch?v=ZmTY1BmhSKg \n(Credit to Limitlesstcg.com for archiving the list.)',
  splash: [{name: "Froslass", setCode: 'TWM'}, { name: "Marnie's Grimmsnarl ex", setCode: 'DRI' }],
  raw: `Pokémon: 20
4 Munkidori TWM 95
3 Marnie's Impidimp DRI 134
2 Marnie's Morgrem DRI 135
2 Marnie's Grimmsnarl ex DRI 136
3 Snorunt ASC 46
2 Froslass TWM 53
2 Budew ASC 16
1 Tatsugiri TWM 131
1 Iron Bundle PAR 56

Trainer: 32
4 Lillie's Determination MEG 119
4 Arven OBF 186
3 Iono PAL 185
3 Boss's Orders MEG 114
3 Poké Pad POR 81
2 Night Stretcher ASC 196
1 Buddy-Buddy Poffin TEF 144
1 Rare Candy MEG 125
1 Super Rod PAL 188
1 Counter Catcher PAR 160
1 Secret Box TWM 163
1 Technical Machine: Evolution PAR 178
1 Technical Machine: Devolution PAR 177
1 Air Balloon ASC 181
1 Bravery Charm PAL 173
3 Spikemuth Gym DRI 169
1 Artazon PAL 171

Energy: 8
8 Darkness Energy MEE 7`
    },
    {
      name: 'Yoshiyuki Yamaguchi\'s Mega Absol Box',
      notes: 'Yoshiyuki took this version of Mega Absol Box all the way to victory at the 2026 Houston Regional.\nDeck list: https://limitlesstcg.com/decks/list/21752\nVOD: https://www.youtube.com/watch?v=99vCHDiSfWU\n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: [{ name: 'Mega Kangaskhan ex', setCode: 'MEG'}, { name: 'Mega Absol ex', setCode: 'MEG' }],
      raw: `Pokémon: 15
3 Munkidori TWM 95
2 Mega Kangaskhan ex MEG 104
2 Mega Absol ex MEG 86
2 Cornerstone Mask Ogerpon ex TWM 112
1 Yveltal MEG 88
1 Psyduck ASC 39
1 Fezandipiti ex SFA 38
1 Latias ex SSP 76
1 Bloodmoon Ursaluna ex TWM 141
1 Pecharunt ex SFA 39

Trainer: 35
4 Arven OBF 186
4 Boss's Orders MEG 114
3 Lillie's Determination MEG 119
3 Penny SVI 183
2 Iono PAL 185
2 Nest Ball SVI 181
2 Earthen Vessel PAR 163
2 Night Stretcher SFA 61
2 Energy Switch MEG 115
2 Pokégear 3.0 SVI 186
2 Counter Catcher PAR 160
1 Precious Trolley SSP 185
2 Technical Machine: Turbo Energize PAR 179
2 Bravery Charm PAL 173
2 Lively Stadium SSP 180

Energy: 10
6 Darkness Energy MEE 7
2 Fighting Energy MEE 6
2 Mist Energy TEF 161`
    },
    {
      name: 'Alex Schemanske\'s Froslass Munkidori',
      notes: 'An up and comer in the Ascended Heroes format, Alex Schemanske piloted this version of Froslass Munkidori all the way to a top 4 finish at the 2026 Houston Regional.\nDeck list: https://limitlesstcg.com/decks/list/25048\nVOD: https://www.youtube.com/watch?v=RCGmgHCAcpo\n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: [{ name: 'Munkidori', setCode: 'TWM' },{ name: 'Froslass', setCode: 'TWM'}],
      raw: `Pokémon: 18
4 Snorunt ASC 46
3 Froslass TWM 53
1 Mega Froslass ex ASC 47
4 Munkidori TWM 95
3 Budew ASC 16
1 Ethan's Sudowoodo DRI 93
1 Ting-Lu TWM 110
1 Shaymin DRI 10

Trainer: 34
4 Lillie's Determination MEG 119
4 Iono PAL 185
3 Arven OBF 186
1 Hilda WHT 84
3 Poké Pad ASC 198
2 Pokégear 3.0 SVI 186
2 Counter Catcher PAR 160
1 Buddy-Buddy Poffin TEF 144
1 Ultra Ball MEG 131
1 Energy Search SVI 172
1 Super Rod PAL 188
1 Night Stretcher ASC 196
1 Secret Box TWM 163
3 Bravery Charm PAL 173
2 Technical Machine: Devolution PAR 177
1 Air Balloon ASC 181
3 Artazon PAL 171

Energy: 8
4 Luminous Energy PAL 191
2 Prism Energy ASC 216
2 Darkness Energy MEE 7`
    },
    {
      name: 'Matias Matricardi\'s Gholdengo ex',
      notes: 'This Legacy Energy version of Gholdengo ex was popularized by Japanese players, and with the release of the Ascended Heroes format Matias Matricardi piloted his own version to victory at the 2026 Curitiba Regional.\nDeck list: https://limitlesstcg.com/decks/list/24816\n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: [{ name: 'Lunatone', setCode: 'MEG'}, { name: 'Gholdengo ex', setCode: 'PAR' } ],
      raw: `Pokémon: 16
4 Gimmighoul SSP 97
4 Gholdengo ex PAR 139
3 Solrock MEG 75
2 Lunatone MEG 74
1 Buneary PFL 83
1 Mega Lopunny ex PFL 84
1 Fezandipiti ex ASC 142

Trainer: 33
4 Boss's Orders MEG 114
2 Ciphermaniac's Codebreaking TEF 145
2 Professor Turo's Scenario PAR 171
2 Lillie's Determination MEG 119
1 Hilda WHT 84
1 Lana's Aid TWM 155
4 Fighting Gong MEG 116
4 Nest Ball SVI 181
4 Superior Energy Retrieval PAL 189
3 Earthen Vessel PAR 163
2 Poké Pad ASC 198
1 Picnic Basket SVI 184
1 Air Balloon ASC 181
2 Artazon PAL 171

Energy: 11
8 Fighting Energy MEE 6
2 Metal Energy MEE 8
1 Legacy Energy TWM 167`
    },
    {
      name: 'Henry Chao\'s Final Gardevoir ex',
      notes: 'Legendary player Henry Chao, known for revolutionizing Gardevoir ex took this Gardevoir ex list to the 2026 Orlando Regional, his final run with Gardi before it rotated out of the standard format.\nDeck list: https://limitlesstcg.com/decks/list/25655\nVOD: www.youtube.com/watch?v=8zD0FbC5a90&t=196m54s\n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: { name: 'Gardevoir ex', setCode: 'SVI' },
      raw: `Pokémon: 16
3 Ralts MEG 58
2 Kirlia MEG 59
2 Gardevoir ex SVI 86
3 Munkidori TWM 95
1 Frillish WHT 44
1 Scream Tail PAR 86
1 Mew ex MEW 151
1 Lillie's Clefairy ex JTG 56
1 Fezandipiti ex ASC 142
1 Mega Diancie ex PFL 41

Trainer: 34
4 Iono PAL 185
4 Lillie's Determination MEG 119
2 Arven OBF 186
1 Professor Turo's Scenario PAR 171
4 Ultra Ball MEG 131
3 Earthen Vessel PAR 163
2 Nest Ball SVI 181
2 Rare Candy MEG 125
2 Night Stretcher ASC 196
1 Counter Catcher PAR 160
1 Super Rod PAL 188
1 Secret Box TWM 163
2 Technical Machine: Evolution PAR 178
1 Technical Machine: Devolution PAR 177
1 Technical Machine: Turbo Energize PAR 179
1 Bravery Charm PAL 173
2 Artazon PAL 171

Energy: 10
7 Psychic Energy MEE 5
3 Darkness Energy MEE 7`
    },
    {
      name: 'Ascended Heroes Dragapult ex with Dusknoir',
      notes: 'This Dragapult ex with Dusknoir list has too many names attached to it to attribute it to any one person. Dragapult ex had been largely dominant the entire rotation, and with the release of Pokepad in Ascended Heroes it got even stronger.\nDeck list: https://limitlesstcg.com/decks/list/24769\n(Credit to Limitlesstcg.com for archiving the list.)',
      splash: [{ name: 'Dusknoir', setCode: 'SFA' }, { name: 'Dragapult ex', setCode: 'TWM'}],
      raw: `Pokémon: 23
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
2 Duskull PRE 35
2 Dusclops PRE 36
1 Dusknoir PRE 37
2 Budew ASC 16
1 Bloodmoon Ursaluna ex TWM 141
1 Fezandipiti ex ASC 142
1 Latias ex SSP 76
1 Munkidori TWM 95
1 Hawlucha SVI 118

Trainer: 30
4 Lillie's Determination MEG 119
4 Iono PAL 185
3 Boss's Orders MEG 114
1 Hilda WHT 84
4 Buddy-Buddy Poffin TEF 144
4 Poké Pad ASC 198
3 Counter Catcher PAR 160
3 Ultra Ball MEG 131
2 Night Stretcher ASC 196
2 Jamming Tower TWM 153

Energy: 7
3 Luminous Energy PAL 191
2 Psychic Energy MEE 5
1 Fire Energy MEE 2
1 Neo Upper Energy TEF 162`
    },
  ],
  'era-SVI-PFL': [],
  'era-SVI-BLK': [],
  'era-SVI-DRI': [],
  'era-SVI-JTG': [],

  // ── Brilliant Stars era ───────────────────────────────────────────────────
  'era-BRS-PRE': [],
  'era-BRS-SSP': [],
  'era-BRS-SCR': [],
  'era-BRS-SFA': [],
  'era-BRS-TWM': [],
  'era-BRS-TEF': [],

  // ── Battle Styles era ─────────────────────────────────────────────────────
  'era-BST-PAR': [],
  'era-BST-OBF': [],
  'era-BST-PAL': [],
  'era-BST-SVI': [],

  // ── Sword & Shield era ────────────────────────────────────────────────────
  'era-SSH-SIT': [],
  'era-SSH-LOR': [],
  'era-SSH-ASR': [],
  'era-SSH-BRS': [],

  // ── Team Up era ───────────────────────────────────────────────────────────
  'era-TEU-CRE': [],
  'era-TEU-BST': [],
  'era-TEU-VIV': [],
  'era-TEU-DAA': [],

  // ── Ultra Prism era ───────────────────────────────────────────────────────
  'era-UPR-DAA': [],
  'era-UPR-RCL': [],
  'era-UPR-SSH': [],
  'era-UPR-CEC': [],
  'era-UPR-UNM': [],

  // ── Sun & Moon era ────────────────────────────────────────────────────────
  'era-SUM-UNB': [],
  'era-SUM-TEU': [],
  'era-SUM-LOT': [],
  'era-SUM-CES': [],

  // ── BREAKthrough era ──────────────────────────────────────────────────────
  'era-BKT-CES': [],
  'era-BKT-FLI': [],
  'era-BKT-UPR': [],
  'era-BKT-CIN': [],
  'era-BKT-BUS': [],
  'era-BKT-GRI': [],

  // ── Primal Clash era ──────────────────────────────────────────────────────
  'era-PRC-BUS': [],
  'era-PRC-GRI': [],
  'era-PRC-SUM': [],
  'era-PRC-EVO': [],
  'era-PRC-STS': [],

  // ── XY era ────────────────────────────────────────────────────────────────
  'era-XY-STS': [],
  'era-XY-FCO': [],

  // ── Boundaries Crossed era ────────────────────────────────────────────────
  'era-BCR-ROS': [],
  'era-BCR-ROS-PRE': [],
  'era-BCR-PHF': [],
  'era-BCR-FFI': [],
  'era-BCR-FLF': [],

  // ── Next Destinies era ────────────────────────────────────────────────────
  'era-NXD-FLF': [],
  'era-NXD-XY': [],
  'era-NXD-PLB': [],

  // ── Black & White era ─────────────────────────────────────────────────────
  'era-BLW-PLF': [],
  'era-BLW-BCR': [],
  'era-BLW-DRX': [],

  // ── HeartGold SoulSilver era ──────────────────────────────────────────────
  'era-HS-DEX': [],
  'era-HS-NXD': [],
  'era-HS-NV':  [],
  'era-HS-BLW': [],

  // ── Majestic Dawn era ─────────────────────────────────────────────────────
  'era-MD-BLW': [],
  'era-MD-CL':  [],

  // ── Diamond & Pearl era ───────────────────────────────────────────────────
  'era-DP-UL': [],
  'era-DP-AR': [],
  'era-DP-RR': [],
  'era-DP-PL': [],

  // ── EX eras ───────────────────────────────────────────────────────────────
  'era-HP-MD': [],
  'era-DX-DP': [],
  'era-HL-HP': [],
  'era-RS-EM': [],

  // ── Expedition era ────────────────────────────────────────────────────────
  'era-EXP-HL': [],
  'era-EXP-SK': [],

  // ── Neo eras ──────────────────────────────────────────────────────────────
  'era-N1-SK': [],
  'era-N1-LC': [],

  // ── Team Rocket era ───────────────────────────────────────────────────────
  'era-TR-LC': [],
  'era-TR-NR': [],
  'era-TR-N1': [],

  // ── Base Set era ──────────────────────────────────────────────────────────
  'era-BS-N4':      [],
  'era-BS-G2-PROP': [],
  'era-BS-G2':      [],
  'era-BS-TR':      [],
  'era-BS-FO':      [],
  'era-BS-JU':      [],
  'era-BS':         [],
};
