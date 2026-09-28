// Explicit, source-specific display precedence. These relations describe the
// overlapping muscle regions, not uniform tissue sheets or measured depths.
// Source interpretation and exact catalog membership are tested separately.
export const musclePeelSources = {
  pectoral: "https://www.clinicalanatomy.ca/thorax/thoraxAnteriorPMrefl.html",
  abdomen: "https://booksite.elsevier.com/samplechapters/9780443066122/9780443066122.pdf",
  calf: "https://www.meddean.luc.edu/lumen/meded/grossanatomy/dissector/labs/le/ant_th_leg/tl3.html",
  gluteal: "https://www.lumen.luc.edu/lumen/meded/grossanatomy/dissector/labs/le/glut_post_th/g2.html",
  upperBack: "https://www.meddean.luc.edu/lumen/meded/grossanatomy/2010/dissection%20guide%20509.pdf",
  anteriorThigh: "https://www.clinicalanatomy.ca/labs/421cards.pdf",
  anteriorForearm: "https://teachmeanatomy.info/upper-limb/muscles/anterior-forearm/",
};
export const musclePeelGroups = [
  { sex: "male", side: "right", source: "pectoral", names: ["pectoralis major", "pectoralis minor"], levels: [["FMA34690", "FMA45874", "FMA79979"], ["FMA13375"]] },
  { sex: "male", side: "left", source: "pectoral", names: ["pectoralis major", "pectoralis minor"], levels: [["FMA34691", "FMA45875", "FMA79980"], ["FMA13376"]] },
  { sex: "male", side: "right", source: "abdomen", names: ["external oblique", "internal oblique", "transversus abdominis"], levels: [["FMA13336"], ["FMA13892"], ["FMA22344"]] },
  { sex: "male", side: "left", source: "abdomen", names: ["external oblique", "internal oblique", "transversus abdominis"], levels: [["FMA13337"], ["FMA13893"], ["FMA22345"]] },
  { sex: "male", side: "right", source: "calf", names: ["gastrocnemius", "soleus", "deep posterior leg"], levels: [["FMA45957", "FMA45960"], ["FMA22558"], ["FMA65014", "FMA65016", "FMA65018"]] },
  { sex: "male", side: "left", source: "calf", names: ["gastrocnemius", "soleus", "deep posterior leg"], levels: [["FMA45958", "FMA45961"], ["FMA22559"], ["FMA65015", "FMA65017", "FMA65019"]] },
  { sex: "female", side: "left", source: "calf", names: ["gastrocnemius", "soleus", "deep posterior leg"], levels: [["VHF0005", "VHF0020"], ["VHF0022"], ["VHF0018", "VHF0019", "VHF0024"]] },
  { sex: "female", side: "right", source: "calf", names: ["gastrocnemius", "soleus", "deep posterior leg"], levels: [["VHF0043", "VHF0058"], ["VHF0060"], ["VHF0056", "VHF0057", "VHF0062"]] },
  // Posterior dissection: maximus is reflected first; medius is then
  // reflected to expose minimus. This is not whole-surface containment.
  { sex: "male", side: "right", source: "gluteal", names: ["gluteus maximus", "gluteus medius", "gluteus minimus"], levels: [["FMA22328"], ["FMA22330"], ["FMA22332"]] },
  { sex: "male", side: "left", source: "gluteal", names: ["gluteus maximus", "gluteus medius", "gluteus minimus"], levels: [["FMA22329"], ["FMA22331"], ["FMA22333"]] },
  { sex: "female", side: "left", source: "gluteal", names: ["gluteus maximus", "gluteus medius", "gluteus minimus"], levels: [["VHF0025"], ["VHF0026"], ["VHF0027"]] },
  { sex: "female", side: "right", source: "gluteal", names: ["gluteus maximus", "gluteus medius", "gluteus minimus"], levels: [["VHF0063"], ["VHF0064"], ["VHF0065"]] },
  // Do not order piriformis relative to medius/minimus: the source only
  // supports its exposure after reflecting maximus.
  { sex: "male", side: "right", source: "gluteal", names: ["gluteus maximus", "piriformis"], levels: [["FMA22328"], ["FMA22340"]] },
  { sex: "male", side: "left", source: "gluteal", names: ["gluteus maximus", "piriformis"], levels: [["FMA22329"], ["FMA22341"]] },
  { sex: "female", side: "left", source: "gluteal", names: ["gluteus maximus", "piriformis"], levels: [["VHF0025"], ["VHF0033"]] },
  { sex: "female", side: "right", source: "gluteal", names: ["gluteus maximus", "piriformis"], levels: [["VHF0063"], ["VHF0071"]] },
  // UBC's dissected thigh identifies vastus intermedius deep to rectus
  // femoris. Both the HRA and donor rectus meshes are present in the female
  // atlas, although the donor duplicate is hidden in the default overview.
  { sex: "male", side: "right", source: "anteriorThigh", names: ["rectus femoris", "vastus intermedius"], levels: [["FMA38928"], ["FMA38934"]] },
  { sex: "male", side: "left", source: "anteriorThigh", names: ["rectus femoris", "vastus intermedius"], levels: [["FMA38929"], ["FMA38935"]] },
  { sex: "female", side: "left", source: "anteriorThigh", names: ["rectus femoris", "vastus intermedius"], levels: [["HRAF0394", "VHF0009"], ["VHF0013"]] },
  { sex: "female", side: "right", source: "anteriorThigh", names: ["rectus femoris", "vastus intermedius"], levels: [["HRAF0396", "VHF0047"], ["VHF0051"]] },
  // In the anterior forearm, superficialis lies between the superficial
  // flexor/pronator set and the deep flexors/pronator. This is a regional
  // dissection order, not a claim that every triangle covers every other.
  { sex: "male", side: "right", source: "anteriorForearm", names: [["pronator teres", "flexor carpi radialis", "palmaris longus", "flexor carpi ulnaris"], ["flexor digitorum superficialis"], ["flexor digitorum profundus", "flexor pollicis longus", "pronator quadratus"]], levels: [["FMA38560", "FMA38562", "FMA38460", "FMA38463", "FMA38617", "FMA38619"], ["FMA38638", "FMA38640"], ["FMA38479", "FMA38482", "FMA38454"]] },
  { sex: "male", side: "left", source: "anteriorForearm", names: [["pronator teres", "flexor carpi radialis", "palmaris longus", "flexor carpi ulnaris"], ["flexor digitorum superficialis"], ["flexor digitorum profundus", "flexor pollicis longus", "pronator quadratus"]], levels: [["FMA38561", "FMA38563", "FMA38461", "FMA38464", "FMA38618", "FMA38620"], ["FMA38639", "FMA38641"], ["FMA38480", "FMA38484", "FMA38455"]] },
  // The upper-back dissection reflects trapezius before exposing rhomboids
  // and levator scapulae. This does not order those three deep muscles or
  // assert that every trapezius triangle covers every deeper triangle.
  { sex: "male", side: "right", source: "upperBack", names: ["trapezius", "rhomboid"], levels: [["FMA33581", "FMA33584", "FMA33586"], ["FMA13381", "FMA13383"]] },
  { sex: "male", side: "left", source: "upperBack", names: ["trapezius", "rhomboid"], levels: [["FMA33583", "FMA33585", "FMA33587"], ["FMA13382", "FMA13384"]] },
  { sex: "male", side: "right", source: "upperBack", names: ["trapezius", "levator scapulae"], levels: [["FMA33581", "FMA33584", "FMA33586"], ["FMA32540"]] },
  { sex: "male", side: "left", source: "upperBack", names: ["trapezius", "levator scapulae"], levels: [["FMA33583", "FMA33585", "FMA33587"], ["FMA32541"]] },
] as const;

export const musclePeelRelations: readonly (readonly [string, string])[] = musclePeelGroups.flatMap(group =>
  group.levels.flatMap((level, index) => index === 0 ? [] :
    group.levels[index - 1].flatMap(outer => level.map(inner => [outer, inner] as const))));
