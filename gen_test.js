const fs = require('fs');
const path = require('path');

// Utility functions
const randomElement = (array) => array[Math.floor(Math.random() * array.length)];
const removeDuplicates = (array) => Array.from(new Set(array.map(a => JSON.stringify(a)))).map(a => JSON.parse(a));

// List of restricted Pokémon
const restrictedPokemon = [
  "Mewtwo", "Lugia", "Ho-Oh", "Kyogre", "Groudon", "Rayquaza", "Dialga", "Dialga-Origin", "Palkia", "Palkia-Origin",
  "Giratina", "Giratina-Origin", "Reshiram", "Zekrom", "Kyurem", "Kyurem-Black", "Kyurem-White", "Cosmog", "Cosmoem",
  "Solgaleo", "Lunala", "Necrozma", "Necrozma-Dawn-Wings", "Necrozma-Dusk-Mane", "Zacian", "Zacian-Crowned", 
  "Zamazenta", "Zamazenta-Crowned", "Eternatus", "Calyrex", "Calyrex-Ice", "Calyrex-Shadow", "Koraidon", 
  "Miraidon", "Terapagos"
];

// Check if a Pokémon is restricted
const isRestricted = (pokemonName) => restrictedPokemon.includes(pokemonName);

// Parse Packed input
const parsePackedFormat = (packedString) => {
  const lines = packedString.trim().split(']');
  const team = [];

  lines.forEach(line => {
    const [
      species, , item, ability, moves, nature, evs, gender, ivs, shiny, level, extra
    ] = line.split('|');
    
    const extraParts = extra ? extra.split(',') : [];
    const teraType = extraParts[5] || '';

    team.push({
      species,
      item,
      ability,
      moves: moves.split(','),
      nature,
      evs: evStringToObject(evs),
      teraType
    });
  });

  return team;
};

const evStringToObject = (evString) => {
  const evs = {};
  const statNames = ["hp", "atk", "def", "spa", "spd", "spe"];
  const evValues = evString.includes('/') ? evString.split('/') : evString.split(',');

  evValues.forEach((value, index) => {
    evs[statNames[index]] = Math.min(parseInt(value, 10) || 0, 252);
  });

  return evs;
};

// Apply EV movement mutation
const mutateEVs = (evs) => {
  const stats = ["hp", "atk", "def", "spa", "spd", "spe"];
  const nonZeroStats = stats.filter(stat => evs[stat] > 0);

  if (nonZeroStats.length === 0) {
    return evs;
  }

  const fromStat = randomElement(nonZeroStats);
  const moveAmount = (evs[fromStat] === 4) ? 4 : 8;

  let toStatCandidates = stats.filter(stat => stat !== fromStat && evs[stat] < 252);

  if (fromStat === "atk") {
    toStatCandidates = toStatCandidates.filter(stat => stat !== "spa");
  } else if (fromStat === "spa") {
    toStatCandidates = toStatCandidates.filter(stat => stat !== "atk");
  }

  if (toStatCandidates.length === 0) {
    return evs;
  }

  let toStat = randomElement(toStatCandidates);

  if (moveAmount === 8 && evs[toStat] === 0) {
    const otherStatCandidates = toStatCandidates.filter(stat => stat !== toStat && evs[stat] === 0);
    if (otherStatCandidates.length > 0) {
      const anotherStat = randomElement(otherStatCandidates);
      evs[fromStat] -= 8;
      evs[toStat] = 4;
      evs[anotherStat] = 4;
    } else {
      evs[fromStat] -= moveAmount;
      evs[toStat] += moveAmount;
    }
  } else {
    evs[fromStat] -= moveAmount;
    evs[toStat] += moveAmount;
  }

  return evs;
};


// Generate a new Pokémon
const generateNewPokemon = (pokemonData, restricted, existingItems) => {
  let newPokemonName = randomElement(Object.keys(pokemonData).filter(p => restricted ? isRestricted(p) : !isRestricted(p)));
  let newPokemonData = pokemonData[newPokemonName];

  let attempts = 0;
  while (newPokemonData && attempts < 100) {
    const possibleItems = newPokemonData.items.filter(item => item.item !== 'Other' && !existingItems.has(item.item));
    if (possibleItems.length > 0) {
      const newItem = randomElement(possibleItems);
      const spread = randomElement(newPokemonData.spreads);

      if (spread.ev && spread.ev.length > 0) {
        const evs = evStringToObject(spread.ev.includes('/') ? spread.ev : spread.ev.replace(/,/g, '/'));
        return {
          species: newPokemonName,
          item: newItem.item,
          ability: randomElement(newPokemonData.abilities).ability,
          teraType: randomElement(["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy", "Stellar"]),
          evs: evs,
          nature: spread.nature,
          moves: newPokemonData.moves.filter(move => move.move !== 'Other').slice(0, 4).map(move => move.move)
        };
      } else {
        console.warn(`No EVs found for ${newPokemonName}, trying another spread.`);
      }
    } else {
      newPokemonName = randomElement(Object.keys(pokemonData).filter(p => restricted ? isRestricted(p) : !isRestricted(p)));
      newPokemonData = pokemonData[newPokemonName];
    }
    attempts++;
  }
  return null;
};

// Crossover function
const crossover = (parent1Packed, parent2Packed, pokemonData) => {
  const parent1 = parsePackedFormat(parent1Packed);
  const parent2 = parsePackedFormat(parent2Packed);

  const offspring = [];
  const allPokemon = [...parent1, ...parent2];

  const restrictedInParent1 = parent1.find(p => isRestricted(p.species));
  const restrictedInParent2 = parent2.find(p => isRestricted(p.species));
  const restrictedOffspring = restrictedInParent1 || restrictedInParent2;

  if (restrictedOffspring) {
    offspring.push(restrictedOffspring);
  }

  const remainingPokemon = allPokemon.filter(p => !isRestricted(p.species) && p !== restrictedOffspring);
  const selectedItems = new Set(offspring.map(p => p.item));
  const maxAttempts = 100;
  let attempts = 0;
  while (offspring.length < 4 && attempts < maxAttempts) {
    attempts++;
    const candidate = randomElement(remainingPokemon);
    if (!offspring.some(p => p.species.split('-')[0] === candidate.species.split('-')[0]) &&
        !selectedItems.has(candidate.item)) {
      offspring.push(candidate);
      selectedItems.add(candidate.item);
    }
  }

  while (offspring.length < 4) {
    const newPokemon = generateNewPokemon(pokemonData, false, selectedItems);
    if (newPokemon) {
      offspring.push(newPokemon);
      selectedItems.add(newPokemon.item);
    }
  }

  return offspring;
};

// Mutation function
const mutate = (team, annealingFactor, pokemonData) => {
  const mutatedTeam = [...team];

  const mutationType = Math.random();
  if (mutationType < annealingFactor) {
    const nonRestrictedMembers = mutatedTeam.filter(p => !isRestricted(p.species));

    if (nonRestrictedMembers.length > 0) {
      const toReplace = randomElement(nonRestrictedMembers);
      const newPokemon = generateNewPokemon(pokemonData, false, new Set(mutatedTeam.map(p => p.item)));
      if (newPokemon) {
        const index = mutatedTeam.indexOf(toReplace);
        mutatedTeam[index] = newPokemon;
      }
    }
  } else {
    const toMutate = randomElement(mutatedTeam);
    const pokemonInfo = pokemonData[toMutate.species];
    if (pokemonInfo) {
      if (Math.random() < 0.5) {
        const availableMoves = pokemonInfo.moves.filter(move => move.move !== 'Other' && !toMutate.moves.includes(move.move) && move => move.move !== 'Imprison');
        if (availableMoves.length > 4) {
          const newMove = randomElement(availableMoves);
          toMutate.moves[Math.floor(Math.random() * toMutate.moves.length)] = newMove.move;
        }
      } else if (Math.random() < 0.5) {
        const newItem = randomElement(pokemonInfo.items.filter(item => item.item !== 'Other' && !mutatedTeam.some(p => p.item === item.item)));
        if (newItem && newItem.item) {
          toMutate.item = newItem.item;
        }
      } else {
        const newSpread = randomElement(pokemonInfo.spreads);
        const evs = evStringToObject(newSpread.ev.includes('/') ? newSpread.ev : newSpread.ev.replace(/,/g, '/'));
        toMutate.evs = evs;
        toMutate.nature = newSpread.nature;
      }
    }
  }

  if (Math.random() < annealingFactor) {
    mutatedTeam[0].evs = mutateEVs(mutatedTeam[0].evs);
  }

  return mutatedTeam;
};


// Convert Pokémon team to Packed format
const toPackedFormat = (team) => {
  return team.map(pokemon => {
    const evs = ["hp", "atk", "def", "spa", "spd", "spe"].map(stat => pokemon.evs[stat] || 0).join(',');
    return `${pokemon.species}||${pokemon.item}|${pokemon.ability}|${pokemon.moves.join(',')}|${pokemon.nature}|${evs}|||||,,,,,${pokemon.teraType}`;
  }).join(']');
};

// Genetic algorithm function
const geneticAlgorithm = (parent1Packed, parent2Packed, annealingFactor, pokemonData) => {
  let offspring = crossover(parent1Packed, parent2Packed, pokemonData);
  const mutatedOffspring = mutate(offspring, annealingFactor, pokemonData);
  return toPackedFormat(mutatedOffspring);
};

module.exports = {
  geneticAlgorithm
};


// // Example usage with Packed format input
// const parent1Packed = `
// Miraidon||Choice Scarf|Hadron Engine|Volt Switch,Protect,Electro Drift,Parabolic Charge|Modest|0,0,4,252,0,252|||||,,,,,Electric]
// Regidrago||Choice Scarf|Transistor|Dragon Energy,Hyper Beam,Ancient Power,Thunderbolt|Modest|0,0,4,252,0,252|||||,,,,,Dragon]
// Farigiraf||Choice Scarf|Armor Tail|Psychic,Hyper Beam,Thunderbolt,Shadow Ball|Modest|0,0,4,252,0,252|||||,,,,,Psychic]
// Alcremie||Leftovers|Sweet Veil|Dazzling Gleam,Mystical Fire,Energy Ball,Aromatherapy|Calm|252,0,4,252,0,0|||||,,,,,Fairy]
// `;

// const parent2Packed = `
// Kyurem-Black||Choice Band|Teravolt|Icicle Spear,Fusion Bolt,Dragon Claw,Iron Head|Adamant|0,252,4,0,0,252|||||,,,,,Dragon]
// Falinks||Leftovers|Defiant|Close Combat,No Retreat,Iron Defense,Brick Break|Jolly|0,252,4,0,0,252|||||,,,,,Fighting]
// Pikachu||Light Ball|Static|Thunderbolt,Iron Tail,Quick Attack,Electro Ball|Jolly|0,252,4,0,0,252|||||,,,,,Electric]
// Regidrago||Choice Scarf|Transistor|Dragon Energy,Hyper Beam,Ancient Power,Thunderbolt|Modest|0,0,4,252,0,252|||||,,,,,Dragon]
// `;

// // Load Pokémon data from the /cache folder
// const loadPokemonData = (folderPath) => {
//   const files = fs.readdirSync(folderPath);
//   const pokemonData = {};
//   files.forEach(file => {
//     const data = fs.readFileSync(path.join(folderPath, file), 'utf-8');
//     const pokemon = JSON.parse(data);
//     pokemonData[pokemon.name] = pokemon;
//   });
//   return pokemonData;
// };

// const pokemonData = loadPokemonData('./cache');
// const annealingFactor = 0.9;

// const result = geneticAlgorithm(parent1Packed, parent2Packed, annealingFactor, pokemonData);
// console.log(result);
