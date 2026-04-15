// Retro format windows.
// worlds: true  = this snapshot was used at the World Championship (year in label)
// notes         = special rules, banned cards, or legal promos

export const ERA_FORMATS = [

  // ── Temporal Forces (Standard) ───────────────────────────────────────────
  { group: 'Temporal Forces', label: 'Temporal Forces – Perfect Order',                           code: 'TEF-POR' },

  // ── Scarlet & Violet ─────────────────────────────────────────────────────
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Ascended Heroes',                       code: 'SVI-ASC' },
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Phantasmal Flames',                     code: 'SVI-PFL' },
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Mega Evolution',                        code: 'SVI-MEG' },
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Black Bolt / White Flare (Worlds 2025)',code: 'SVI-BLK', worlds: true },
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Destined Rivals',                       code: 'SVI-DRI' },
  { group: 'Scarlet & Violet', label: 'Scarlet & Violet – Journey Together',                      code: 'SVI-JTG' },

  // ── Brilliant Stars ───────────────────────────────────────────────────────
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Prismatic Evolutions',                    code: 'BRS-PRE' },
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Surging Sparks',                          code: 'BRS-SSP' },
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Stellar Crown',                           code: 'BRS-SCR' },
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Shrouded Fable (Worlds 2024)',            code: 'BRS-SFA', worlds: true },
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Twilight Masquerade',                     code: 'BRS-TWM' },
  { group: 'Brilliant Stars', label: 'Brilliant Stars – Temporal Forces',                         code: 'BRS-TEF' },

  // ── Battle Styles ─────────────────────────────────────────────────────────
  { group: 'Battle Styles', label: 'Battle Styles – Paradox Rift',                                code: 'BST-PAR' },
  { group: 'Battle Styles', label: 'Battle Styles – Obsidian Flames',                             code: 'BST-OBF' },
  { group: 'Battle Styles', label: 'Battle Styles – Paldea Evolved (Worlds 2023)',                code: 'BST-PAL', worlds: true },
  { group: 'Battle Styles', label: 'Battle Styles – Scarlet & Violet',                            code: 'BST-SVI' },

  // ── Sword & Shield ────────────────────────────────────────────────────────
  { group: 'Sword & Shield', label: 'Sword & Shield – Silver Tempest',                            code: 'SSH-SIT' },
  { group: 'Sword & Shield', label: 'Sword & Shield – Lost Origin',                               code: 'SSH-LOR' },
  { group: 'Sword & Shield', label: 'Sword & Shield – Astral Radiance (Worlds 2022)',             code: 'SSH-ASR', worlds: true },
  { group: 'Sword & Shield', label: 'Sword & Shield – Brilliant Stars',                           code: 'SSH-BRS' },

  // ── Team Up ───────────────────────────────────────────────────────────────
  { group: 'Team Up', label: 'Team Up – Chilling Reign',                                          code: 'TEU-CRE' },
  { group: 'Team Up', label: 'Team Up – Battle Styles',                                           code: 'TEU-BST' },
  { group: 'Team Up', label: 'Team Up – Vivid Voltage',                                           code: 'TEU-VIV' },
  { group: 'Team Up', label: 'Team Up – Darkness Ablaze',                                         code: 'TEU-DAA' },

  // ── Ultra Prism ───────────────────────────────────────────────────────────
  { group: 'Ultra Prism', label: 'Ultra Prism – Darkness Ablaze',                                 code: 'UPR-DAA' },
  { group: 'Ultra Prism', label: 'Ultra Prism – Rebel Clash',                                     code: 'UPR-RCL' },
  { group: 'Ultra Prism', label: 'Ultra Prism – Sword & Shield',                                  code: 'UPR-SSH' },
  { group: 'Ultra Prism', label: 'Ultra Prism – Cosmic Eclipse',                                  code: 'UPR-CEC' },
  { group: 'Ultra Prism', label: 'Ultra Prism – Unified Minds (Worlds 2019)',                     code: 'UPR-UNM', worlds: true },

  // ── Sun & Moon ────────────────────────────────────────────────────────────
  { group: 'Sun & Moon', label: 'Sun & Moon – Unbroken Bonds',                                    code: 'SUM-UNB' },
  { group: 'Sun & Moon', label: 'Sun & Moon – Team Up',                                           code: 'SUM-TEU' },
  { group: 'Sun & Moon', label: 'Sun & Moon – Lost Thunder',                                      code: 'SUM-LOT', notes: 'SM Promos 1–157, 166, 171–176 legal' },
  { group: 'Sun & Moon', label: 'Sun & Moon – Celestial Storm',                                   code: 'SUM-CES' },

  // ── BREAKthrough ─────────────────────────────────────────────────────────
  { group: 'BREAKthrough', label: 'BREAKthrough – Celestial Storm (Worlds 2018)',                 code: 'BKT-CES', worlds: true, notes: 'XY Promos 67–211, SM Promos 1–102, 105–134, 148 legal' },
  { group: 'BREAKthrough', label: 'BREAKthrough – Forbidden Light',                               code: 'BKT-FLI' },
  { group: 'BREAKthrough', label: 'BREAKthrough – Ultra Prism',                                   code: 'BKT-UPR' },
  { group: 'BREAKthrough', label: 'BREAKthrough – Crimson Invasion',                              code: 'BKT-CIN' },
  { group: 'BREAKthrough', label: 'BREAKthrough – Burning Shadows',                               code: 'BKT-BUS' },
  { group: 'BREAKthrough', label: 'BREAKthrough – Guardians Rising',                              code: 'BKT-GRI' },

  // ── Primal Clash ─────────────────────────────────────────────────────────
  { group: 'Primal Clash', label: 'Primal Clash – Burning Shadows (Worlds 2017)',                 code: 'PRC-BUS', worlds: true, notes: 'XY Promos 36–211, SM Promos 1–44, 46–51, 78 legal' },
  { group: 'Primal Clash', label: 'Primal Clash – Guardians Rising',                              code: 'PRC-GRI' },
  { group: 'Primal Clash', label: 'Primal Clash – Sun & Moon',                                    code: 'PRC-SUM' },
  { group: 'Primal Clash', label: 'Primal Clash – Evolutions',                                    code: 'PRC-EVO' },
  { group: 'Primal Clash', label: 'Primal Clash – Steam Siege',                                   code: 'PRC-STS' },

  // ── XY ───────────────────────────────────────────────────────────────────
  { group: 'XY', label: 'XY – Steam Siege (Worlds 2016)',                                         code: 'XY-STS', worlds: true, notes: "Lysandre's Trump Card banned; XY Promos 1–116, 121–123, 127–156, 176 legal" },
  { group: 'XY', label: 'XY – Fates Collide',                                                     code: 'XY-FCO', notes: "Lysandre's Trump Card banned" },

  // ── Boundaries Crossed ───────────────────────────────────────────────────
  { group: 'Boundaries Crossed', label: 'Boundaries Crossed – Roaring Skies (Worlds 2015)',       code: 'BCR-ROS', worlds: true, notes: "Lysandre's Trump Card banned; BW Promos 51–101, XY Promos 1–55, 91 legal" },
  { group: 'Boundaries Crossed', label: 'Boundaries Crossed – Roaring Skies (Pre-Ban)',           code: 'BCR-ROS-PRE', notes: "Lysandre's Trump Card NOT yet banned" },
  { group: 'Boundaries Crossed', label: 'Boundaries Crossed – Phantom Forces',                    code: 'BCR-PHF' },
  { group: 'Boundaries Crossed', label: 'Boundaries Crossed – Furious Fists',                     code: 'BCR-FFI' },
  { group: 'Boundaries Crossed', label: 'Boundaries Crossed – Flashfire',                         code: 'BCR-FLF' },

  // ── Next Destinies ────────────────────────────────────────────────────────
  { group: 'Next Destinies', label: 'Next Destinies – Flashfire (Worlds 2014)',                   code: 'NXD-FLF', worlds: true, notes: 'BW Promos 33–101, XY Promos 1–27 legal' },
  { group: 'Next Destinies', label: 'Next Destinies – XY',                                        code: 'NXD-XY' },
  { group: 'Next Destinies', label: 'Next Destinies – Plasma Blast',                              code: 'NXD-PLB' },

  // ── Black & White ─────────────────────────────────────────────────────────
  { group: 'Black & White', label: 'Black & White – Plasma Freeze (Worlds 2013)',                 code: 'BLW-PLF', worlds: true, notes: 'BW Promos 1–95 legal' },
  { group: 'Black & White', label: 'Black & White – Boundaries Crossed',                          code: 'BLW-BCR' },
  { group: 'Black & White', label: 'Black & White – Dragons Exalted',                             code: 'BLW-DRX' },

  // ── HeartGold SoulSilver ──────────────────────────────────────────────────
  { group: 'HeartGold SoulSilver', label: 'HeartGold SoulSilver – Dark Explorers (Worlds 2012)', code: 'HS-DEX', worlds: true, notes: 'HGSS Promos 1–25, BW Promos 1–50 legal' },
  { group: 'HeartGold SoulSilver', label: 'HeartGold SoulSilver – Next Destinies',               code: 'HS-NXD' },
  { group: 'HeartGold SoulSilver', label: 'HeartGold SoulSilver – Noble Victories',              code: 'HS-NV' },
  { group: 'HeartGold SoulSilver', label: 'HeartGold SoulSilver – Black & White (Worlds 2011)', code: 'HS-BLW', worlds: true, notes: 'HGSS Promos 1–25, BW Promos 1–28 legal' },

  // ── Majestic Dawn ─────────────────────────────────────────────────────────
  { group: 'Majestic Dawn', label: 'Majestic Dawn – Black & White',                               code: 'MD-BLW' },
  { group: 'Majestic Dawn', label: 'Majestic Dawn – Call of Legends',                             code: 'MD-CL' },

  // ── Diamond & Pearl ───────────────────────────────────────────────────────
  { group: 'Diamond & Pearl', label: 'Diamond & Pearl – Unleashed (Worlds 2010)',                 code: 'DP-UL', worlds: true, notes: 'DP Promos 1–56, HGSS Promos 1–18 legal' },
  { group: 'Diamond & Pearl', label: 'Diamond & Pearl – Arceus',                                  code: 'DP-AR', notes: 'DP Promos 1–56 legal' },
  { group: 'Diamond & Pearl', label: 'Diamond & Pearl – Rising Rivals (Worlds 2009)',             code: 'DP-RR', worlds: true, notes: 'DP Promos 1–44, 48 legal' },
  { group: 'Diamond & Pearl', label: 'Diamond & Pearl – Platinum',                                code: 'DP-PL', notes: 'DP Promos 1–40 legal' },

  // ── EX Holon Phantoms ────────────────────────────────────────────────────
  { group: 'EX Holon Phantoms', label: 'EX Holon Phantoms – Majestic Dawn (Worlds 2008)',         code: 'HP-MD', worlds: true, notes: 'Nintendo Promos 37–40, DP Promos 1–25 legal' },

  // ── EX Deoxys ────────────────────────────────────────────────────────────
  { group: 'EX Deoxys', label: 'EX Deoxys – Diamond & Pearl (Worlds 2007)',                       code: 'DX-DP', worlds: true, notes: 'Nintendo Promos 29–40, DP Promos 1–5 legal' },

  // ── EX Hidden Legends ────────────────────────────────────────────────────
  { group: 'EX Hidden Legends', label: 'EX Hidden Legends – EX Holon Phantoms (Worlds 2006)',     code: 'HL-HP', worlds: true, notes: 'Nintendo Promos 27–33, 35–36 legal' },

  // ── EX Ruby & Sapphire ───────────────────────────────────────────────────
  { group: 'EX Ruby & Sapphire', label: 'EX Ruby & Sapphire – Power Keepers (Full EX Era)',       code: 'RS-PK' },
  { group: 'EX Ruby & Sapphire', label: 'EX Ruby & Sapphire – EX Emerald (Worlds 2005)',          code: 'RS-EM', worlds: true, notes: 'Nintendo Promos 1–27 legal' },

  // ── Expedition ───────────────────────────────────────────────────────────
  { group: 'Expedition', label: 'Expedition – Hidden Legends (Worlds 2004)',                      code: 'EXP-HL', worlds: true, notes: 'Nintendo Promos 1–26 legal' },
  { group: 'Expedition', label: 'Expedition – Skyridge',                                          code: 'EXP-SK', notes: 'WotC Promos 50–53 legal' },

  // ── Neo Genesis ───────────────────────────────────────────────────────────
  { group: 'Neo Genesis', label: 'Neo Genesis – Skyridge',                                        code: 'N1-SK', notes: 'Sneasel #25 & Slowking #14 banned' },
  { group: 'Neo Genesis', label: 'Neo Genesis – Legendary Collection (Worlds 2002)',              code: 'N1-LC', worlds: true, notes: 'Sneasel #25 banned' },

  // ── Team Rocket ───────────────────────────────────────────────────────────
  { group: 'Team Rocket', label: 'Team Rocket – Legendary Collection',                            code: 'TR-LC', notes: 'Sneasel #25 banned' },
  { group: 'Team Rocket', label: 'Team Rocket – Neo Revelation',                                  code: 'TR-NR', notes: 'Sneasel #25 banned' },
  { group: 'Team Rocket', label: 'Team Rocket – Neo Genesis',                                     code: 'TR-N1', notes: 'Sneasel #25 banned' },

  // ── Base Set ──────────────────────────────────────────────────────────────
  { group: 'Base Set', label: 'Base Set – Neo Destiny',                                           code: 'BS-N4' },
  { group: 'Base Set', label: 'Base Set – Gym Challenge (Prop 15/3)',                             code: 'BS-G2-PROP', notes: 'Max 15 Trainer cards; max 3 copies of any non-Energy card' },
  { group: 'Base Set', label: 'Base Set – Gym Challenge',                                         code: 'BS-G2' },
  { group: 'Base Set', label: 'Base Set – Team Rocket',                                           code: 'BS-TR' },
  { group: 'Base Set', label: 'Base Set – Fossil',                                                code: 'BS-FO' },
  { group: 'Base Set', label: 'Base Set – Jungle',                                                code: 'BS-JU' },
  { group: 'Base Set', label: 'Base Set',                                                         code: 'BS' },

];

export const ERA_GROUPS = ERA_FORMATS.reduce((acc, f) => {
  (acc[f.group] = acc[f.group] || []).push(f);
  return acc;
}, {});
