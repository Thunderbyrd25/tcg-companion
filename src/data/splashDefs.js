// Splash card definitions for each format container.
// Each entry: [frontCard, backCard?] where card = { name, setCode?, number? }
// frontCard appears in the foreground of the fan, backCard behind it.
// setCode is the PTCGO code (e.g. 'PAR', 'BRS') used to disambiguate multiple prints.

export const SPLASH_DEFS = {

  // ── Non-era formats ───────────────────────────────────────────────────────
  all: [
    { name: 'Mew', setCode: 'DRX', number: '46' },
    { name: 'Arceus LV.X', setCode: 'AR', number: '95' },
  ],
  standard: [
    { name: 'Mega Zygarde ex', setCode: 'POR'  },
    { name: 'Meowth ex', setCode: 'POR'  },
  ],
  expanded: [
    { name: 'Double Dragon Energy', setCode: 'ROS' },
    { name: 'Dedenne-GX', setCode: 'UNB' },
  ],
  glc: [
    { name: 'Rainbow Energy', setCode: 'SUM' },
    { name: 'Ball Guy', setCode: 'SHF'  },
  ],
  custom: [
    { name: 'Ditto' },
  ],

  // ── Temporal Forces era ───────────────────────────────────────────────────
  'era-TEF-POR': [
    { name: 'Mega Zygarde ex', setCoode: 'POR' },
    { name: 'Raging Bolt ex', setCode: 'TEF' },
  ],

  // ── Scarlet & Violet era ──────────────────────────────────────────────────
  'era-SVI-ASC': [
    { name: 'Mega Dragonite ex', setCode: 'ASC'},
    { name: 'Miraidon ex', setCode: 'SVI' },
  ],
  'era-SVI-PFL': [
    { name: 'Mega Charizard X ex', setCode: 'PFL'},
    { name: 'Miraidon ex', setCode: 'SVI' },
  ],
  'era-SVI-MEG': [
    { name: 'Mega Lucario ex', setCode: 'MEG'},
    { name: 'Miraidon ex', setCode: 'SVI'},
  ],
  'era-SVI-BLK': [
    { name: 'Zekrom ex', setCode: 'BLK'},
    { name: 'Miraidon ex', setCode: 'SVI' },
  ],
  'era-SVI-DRI': [
    { name: "Team Rocket's Mewtwo ex", setCode: 'DRI' },
    { name: 'Miraidon ex', setCode: 'SVI' },
  ],
  'era-SVI-JTG': [
    { name: "N's Zoroark ex", setCode: 'JTG' },
    { name: 'Miraidon ex', setCode: 'SVI' },
  ],

  // ── Brilliant Stars era ───────────────────────────────────────────────────
  'era-BRS-PRE': [
    { name: 'Eevee ex', setCode: 'PRE' },
    { name: 'Arceus VSTAR', setCode: 'BRS' },
  ],
  'era-BRS-SSP': [
    { name: 'Pikachu ex', setCode: 'SSP'},
    { name: 'Arceus VSTAR', setCode: 'BRS'},
  ],
  'era-BRS-SCR': [
    { name: 'Terapagos ex', setCode: 'SCR' },
    { name: 'Arceus VSTAR', setCode: 'BRS' },
  ],
  'era-BRS-SFA': [
    { name: 'Pecharunt ex', setCode: 'SFA' },
    { name: 'Arceus VSTAR', setCode: 'BRS' },
  ],
  'era-BRS-TWM': [
    { name: 'Teal Mask Ogerpon ex', setCode: 'TWM' },
    { name: 'Arceus VSTAR', setCode: 'BRS' },
  ],
  'era-BRS-TEF': [
    { name: 'Raging Bolt ex', setCode: 'TEF' },
    { name: 'Arceus VSTAR', setCode: 'BRS' },
  ],

  // ── Battle Styles era ─────────────────────────────────────────────────────
  'era-BST-PAR': [
    { name: 'Roaring Moon ex', setCode: 'PAR' },
    { name: 'Rapid Strike Urshifu VMAX', setCode: 'BST' },
  ],
  'era-BST-OBF': [
    { name: 'Charizard ex', setCode: 'OBF' },
    { name: 'Rapid Strike Urshifu VMAX', setCode: 'BST' },
  ],
  'era-BST-PAL': [
    { name: 'Chien-Pao ex', setCode: 'PAL' },
    { name: 'Rapid Strike Urshifu VMAX', setCode: 'BST' },
  ],
  'era-BST-SVI': [
    { name: 'Miraidon ex', setCode: 'SVI' },
    { name: 'Rapid Strike Urshifu VMAX', setCode: 'BST' },
  ],

  // ── Sword & Shield era ────────────────────────────────────────────────────
  'era-SSH-SIT': [
    { name: 'Lugia VSTAR', setCode: 'SIT' },
    { name: 'Zacian V', setCode: 'SSH' },
  ],
  'era-SSH-LOR': [
    { name: 'Giratina VSTAR', setCode: 'LOR' },
    { name: 'Zacian V', setCode: 'SSH' },
  ],
  'era-SSH-ASR': [
    { name: 'Origin Forme Palkia VSTAR', setCode: 'ASR' },
    { name: 'Zacian V', setCode: 'SSH' },
  ],
  'era-SSH-BRS': [
    { name: 'Arceus VSTAR', setCode: 'BRS' },
    { name: 'Zacian V', setCode: 'SSH' },
  ],

  // ── Team Up era ───────────────────────────────────────────────────────────
  'era-TEU-CRE': [
    { name: 'Ice Rider Calyrex VMAX', setCode: 'CRE' },
    { name: 'Pikachu & Zekrom-GX', setCode: 'TEU' },
  ],
  'era-TEU-BST': [
    { name: 'Rapid Strike Urshifu VMAX', setCode: 'BST' },
    { name: 'Pikachu & Zekrom-GX', setCode: 'TEU' },
  ],
  'era-TEU-VIV': [
    { name: 'Pikachu VMAX', setCode: 'VIV' },
    { name: 'Pikachu & Zekrom-GX', setCode: 'TEU' },
  ],
  'era-TEU-DAA': [
    { name: 'Charizard VMAX', setCode: 'DAA' },
    { name: 'Pikachu & Zekrom-GX', setCode: 'TEU' },
  ],

  // ── Ultra Prism era ───────────────────────────────────────────────────────
  'era-UPR-DAA': [
    { name: 'Charizard VMAX', setCode: 'DAA' },
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
  ],
  'era-UPR-RCL': [
    { name: 'Toxtricity VMAX', setCode: 'RCL' },
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
  ],
  'era-UPR-SSH': [
    { name: 'Zacian V', setCode: 'SSH' },
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
  ],
  'era-UPR-CEC': [
    { name: 'Arceus & Dialga & Palkia-GX', setCode: 'CEC' },
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
  ],
  'era-UPR-UNM': [
    { name: 'Mewtwo & Mew-GX', setCode: 'UNM' },
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
  ],

  // ── Sun & Moon era ────────────────────────────────────────────────────────
  'era-SUM-UNB': [
    { name: 'Reshiram & Charizard-GX', setCode: 'UNB' },
    { name: 'Solgaleo-GX', setCode: 'SUM' },
  ],
  'era-SUM-TEU': [
    { name: 'Pikachu & Zekrom-GX', setCode: 'TEU' },
    { name: 'Solgaleo-GX', setCode: 'SUM' },
  ],
  'era-SUM-LOT': [
    { name: 'Zeraora-GX', setCode: 'LOT' },
    { name: 'Solgaleo-GX', setCode: 'SUM' },
  ],
  'era-SUM-CES': [
    { name: 'Rayquaza-GX', setCode: 'CES' },
    { name: 'Solgaleo-GX', setCode: 'SUM' },
  ],

  // ── BREAKthrough era ──────────────────────────────────────────────────────
  'era-BKT-CES': [
    { name: 'Rayquaza-GX', setCode: 'CES' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],
  'era-BKT-FLI': [
    { name: 'Ultra Necrozma-GX', setCode: 'FLI' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],
  'era-BKT-UPR': [
    { name: 'Dawn Wings Necrozma-GX', setCode: 'UPR' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],
  'era-BKT-CIN': [
    { name: 'Silvally-GX', setCode: 'CIN' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],
  'era-BKT-BUS': [
    { name: 'Ho-Oh-GX', setCode: 'BUS' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],
  'era-BKT-GRI': [
    { name: 'Tapu Lele-GX', setCode: 'GRI' },
    { name: 'Zoroark-BREAK', setCode: 'BKT' },
  ],

  // ── Primal Clash era ──────────────────────────────────────────────────────
  'era-PRC-BUS': [
    { name: 'Ho-Oh-GX', setCode: 'BUS' },
    { name: 'Primal Groudon-EX', setCode: 'PRC' },
  ],
  'era-PRC-GRI': [
    { name: 'Tapu Lele-GX', setCode: 'GRI' },
    { name: 'Primal Groudon-EX', setCode: 'PRC' },
  ],
  'era-PRC-SUM': [
    { name: 'Solgaleo-GX', setCode: 'SUM' },
    { name: 'Primal Groudon-EX', setCode: 'PRC' },
  ],
  'era-PRC-EVO': [
    { name: 'M Charizard-EX', setCode: 'EVO' },
    { name: 'Primal Groudon-EX', setCode: 'PRC' },
  ],
  'era-PRC-STS': [
    { name: 'Volcanion-EX', setCode: 'STS' },
    { name: 'Primal Groudon-EX', setCode: 'PRC' },
  ],

  // ── XY era ────────────────────────────────────────────────────────────────
  'era-XY-STS': [
    { name: 'Volcanion-EX', setCode: 'STS' },
    { name: 'Yveltal-EX', setCode: 'XY' },
  ],
  'era-XY-FCO': [
    { name: 'Zygarde-EX', setCode: 'FCO' },
    { name: 'Yveltal-EX', setCode: 'XY' },
  ],

  // ── Boundaries Crossed era ────────────────────────────────────────────────
  'era-BCR-ROS': [
    { name: 'Shaymin-EX', setCode: 'ROS' },
    { name: 'Keldeo-EX', setCode: 'BCR' },
  ],
  'era-BCR-ROS-PRE': [
    { name: "Lysandre's Trump Card", setCode: 'PHF' },
    { name: 'Keldeo-EX', setCode: 'BCR' },
  ],
  'era-BCR-PHF': [
    { name: 'M Gengar-EX', setCode: 'PHF' },
    { name: 'Keldeo-EX', setCode: 'BCR' },
  ],
  'era-BCR-FFI': [
    { name: 'M Lucario-EX', setCode: 'FFI' },
    { name: 'Keldeo-EX', setCode: 'BCR' },
  ],
  'era-BCR-FLF': [
    { name: 'M Charizard-EX', setCode: 'FLF' },
    { name: 'Keldeo-EX', setCode: 'BCR' },
  ],

  // ── Next Destinies era ────────────────────────────────────────────────────
  'era-NXD-FLF': [
    { name: 'M Charizard-EX', setCode: 'FLF' },
    { name: 'Mewtwo-EX', setCode: 'NXD' },
  ],
  'era-NXD-XY': [
    { name: 'Yveltal-EX', setCode: 'XY' },
    { name: 'Mewtwo-EX', setCode: 'NXD' },
  ],
  'era-NXD-PLB': [
    { name: 'Dialga-EX', setCode: 'PLB' },
    { name: 'Mewtwo-EX', setCode: 'NXD' },
  ],

  // ── Black & White era ─────────────────────────────────────────────────────
  'era-BLW-PLF': [
    { name: 'Deoxys-EX', setCode: 'PLF' },
    { name: 'Reshiram', setCode: 'BLW' },
  ],
  'era-BLW-BCR': [
    { name: 'Keldeo-EX', setCode: 'BCR' },
    { name: 'Reshiram', setCode: 'BLW' },
  ],
  'era-BLW-DRX': [
    { name: 'Rayquaza-EX', setCode: 'DRX' },
    { name: 'Reshiram', setCode: 'BLW' },
  ],

  // ── HeartGold SoulSilver era ──────────────────────────────────────────────
  'era-HS-DEX': [
    { name: 'Darkrai-EX', setCode: 'DEX' },
    { name: 'Lugia LEGEND', setCode: 'HS', number: '114' },
  ],
  'era-HS-NXD': [
    { name: 'Mewtwo-EX', setCode: 'NXD' },
    { name: 'Lugia LEGEND', setCode: 'HS', number: '114' },
  ],
  'era-HS-NV': [
    { name: 'Victini', setCode: 'NVI', number: '14' },
    { name: 'Lugia LEGEND', setCode: 'HS', number: '114' },
  ],
  'era-HS-BLW': [
    { name: 'Reshiram', setCode: 'BLW' },
    { name: 'Lugia LEGEND', setCode: 'HS', number: '114' },
  ],

  // ── Majestic Dawn era ─────────────────────────────────────────────────────
  'era-MD-BLW': [
    { name: 'Reshiram', setCode: 'BLW' },
    { name: 'Garchomp LV.X', setCode: 'MD' },
  ],
  'era-MD-CL': [
    { name: 'Rayquaza', setCode: 'CL', number: 'SL10' },
    { name: 'Garchomp LV.X', setCode: 'MD' },
  ],

  // ── Diamond & Pearl era ───────────────────────────────────────────────────
  'era-DP-UL': [
    { name: 'Tyranitar', setCode: 'UL', number: '88' },
    { name: 'Infernape LV.X', setCode: 'DP' },
  ],
  'era-DP-AR': [
    { name: 'Arceus LV.X', setCode: 'AR', number: '95' },
    { name: 'Infernape LV.X', setCode: 'DP' },
  ],
  'era-DP-RR': [
    { name: 'Luxray GL LV.X', setCode: 'RR' },
    { name: 'Infernape LV.X', setCode: 'DP' },
  ],
  'era-DP-PL': [
    { name: 'Giratina LV.X', setCode: 'PL' },
    { name: 'Infernape LV.X', setCode: 'DP' },
  ],

  // ── EX Holon Phantoms era ─────────────────────────────────────────────────
  'era-HP-MD': [
    { name: 'Garchomp LV.X', setCode: 'MD' },
    { name: 'Mewtwo', setCode: 'HP', number: '103' },
  ],

  // ── EX Deoxys era ─────────────────────────────────────────────────────────
  'era-DX-DP': [
    { name: 'Infernape LV.X', setCode: 'DP' },
    { name: 'Rayquaza', setCode: 'DX', number: '107' },
  ],

  // ── EX Hidden Legends era ─────────────────────────────────────────────────
  'era-HL-HP': [
    { name: 'Mewtwo', setCode: 'HP', number: '103'},
    { name: 'Metagross ex', setCode: 'HL' },
  ],

  // ── EX Ruby & Sapphire era ────────────────────────────────────────────────
  'era-RS-EM': [
    { name: 'Rayquaza', setCode: 'EM' },
    { name: 'Blaziken', setCode: 'RS' },
  ],

  // ── EX Ruby & Sapphire era ────────────────────────────────────────────────
  'era-RS-PK': [
    { name: 'Rayquaza ex', setCode: 'DF'},
    { name: "Holon's Castform", setCode: 'HP'},
  ],

  // ── Expedition era ────────────────────────────────────────────────────────
  'era-EXP-HL': [
    { name: 'Metagross ex', setCode: 'HL' },
    { name: 'Charizard', setCode: 'EXP' },
  ],
  'era-EXP-SK': [
    { name: 'Charizard', setCode: 'SK' },
    { name: 'Charizard', setCode: 'EXP' },
  ],

  // ── Neo Genesis era ───────────────────────────────────────────────────────
  'era-N1-SK': [
    { name: 'Charizard', setCode: 'SK' },
    { name: 'Lugia', setCode: 'N1' },
  ],
  'era-N1-LC': [
    { name: 'Charizard', setCode: 'LC' },
    { name: 'Lugia', setCode: 'N1' },
  ],

  // ── Team Rocket era ───────────────────────────────────────────────────────
  'era-TR-LC': [
    { name: 'Charizard', setCode: 'LC' },
    { name: 'Dark Dragonite',setCode: 'TR' },
  ],
  'era-TR-NR': [
    { name: 'Shining Gyarados', setCode: 'N3' },
    { name: 'Dark Dragonite',setCode: 'TR' },
  ],
  'era-TR-N1': [
    { name: 'Lugia', setCode: 'N1' },
    { name: 'Dark Dragonite', setCode: 'TR' },
  ],

  // ── Base Set era ──────────────────────────────────────────────────────────
  'era-BS-N4': [
    { name: 'Shining Charizard', setCode: 'N4' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS-G2-PROP': [
    { name: "Blaine's Charizard",setCode: 'G2' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS-G2': [
    { name: "Blaine's Charizard", setCode: 'G2' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS-TR': [
    { name: 'Dark Dragonite', setCode: 'TR' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS-FO': [
    { name: 'Kabutops', setCode: 'FO' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS-JU': [
    { name: 'Snorlax', setCode: 'JU' },
    { name: 'Charizard', setCode: 'BS' },
  ],
  'era-BS': [
    { name: 'Charizard', setCode: 'BS' },
  ],
};
