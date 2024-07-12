const fs = require('fs');
const path = require('path');

// Function to load all Pokemon data from a folder
function loadPokemonData(folderPath) {
    const pokemonData = {};
    const files = fs.readdirSync(folderPath);

    files.forEach(file => {
        if (file.endsWith('.json')) {
            const data = JSON.parse(fs.readFileSync(path.join(folderPath, file), 'utf8'));
            pokemonData[data.name] = data;
        }
    });

    return pokemonData;
}

// Utility function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to select a Pokémon based on weighted probability
function weightedRandomSelect(pokemonNames, weights) {
    const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
    const random = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (random < cumulativeWeight) {
            return pokemonNames[i];
        }
    }

    return null;
}

// Function to calculate weights based on percent and team synergy
function calculateWeights(pokemonData, team) {
    return Object.keys(pokemonData).map(pokemon => {
        let weight = parseFloat(pokemonData[pokemon].percent);

        if (team.length > 0 && pokemonData[pokemon].team) {
            pokemonData[pokemon].team.forEach(teamMember => {
                if (team.includes(teamMember.pokemon)) {
                    weight += parseFloat(teamMember.percent);
                }
            });
        }

        return weight;
    });
}

// List of possible Tera Types
const teraTypes = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying',
    'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy', 'Stellar'
];

// Function to convert team to Packed format
function convertToPackedFormat(team) {
    return team.map(pokemon => {
        const evs = pokemon.evSpread.ev.split('/').map(ev => ev.trim() || '0').join(',');
        return `${pokemon.name}||${pokemon.item}|${pokemon.ability}|${pokemon.moves.join(',')}|${pokemon.evSpread.nature}|${evs}|||||,,,,,${pokemon.teraType}`;
    }).join(']');
}

// Function to randomly select a team of 4 Pokemon
function generateRandomTeam(pokemonData, restrictedList, teamSize = 4) {
    const restrictedPokemon = restrictedList.filter(p => pokemonData[p]);
    const nonRestrictedPokemon = Object.keys(pokemonData).filter(p => !restrictedList.includes(p));

    // Select one restricted Pokemon based on weights
    const restrictedWeights = restrictedPokemon.map(p => parseFloat(pokemonData[p].percent));
    const restrictedChoice = weightedRandomSelect(restrictedPokemon, restrictedWeights);
    const team = [restrictedChoice];

    // Choose the remaining team members ensuring no duplicates in species and items
    while (team.length < teamSize) {
        const weights = calculateWeights(pokemonData, team);
        const choice = weightedRandomSelect(Object.keys(pokemonData), weights);

        if (!restrictedList.includes(choice) && !team.includes(choice) && !team.some(t => t.split('-')[0] === choice.split('-')[0])) {
            team.push(choice);
        }
    }

    // Assign unique items and natures to each Pokemon, excluding "Other"
    const items = new Set();
    const packedTeam = [];

    for (let i = 0; i < team.length; i++) {
        const pokemon = team[i];
        let availableItems = pokemonData[pokemon].items.filter(item => item.item_us !== 'Other' && !items.has(item.item_us)).map(item => item.item_us);

        // Retry mechanism for assigning unique items
        while (availableItems.length === 0) {
            // console.log(`Not enough unique items for ${pokemon}, selecting another Pokemon`);
            const weights = calculateWeights(pokemonData, team);
            const newChoice = weightedRandomSelect(Object.keys(pokemonData), weights);
            if (!restrictedList.includes(newChoice) && !team.includes(newChoice) && !team.some(t => t.split('-')[0] === newChoice.split('-')[0])) {
                team[i] = newChoice;
                availableItems = pokemonData[newChoice].items.filter(item => item.item_us !== 'Other' && !items.has(item.item_us)).map(item => item.item_us);
            }
        }

        const selectedItem = availableItems[Math.floor(Math.random() * availableItems.length)];
        items.add(selectedItem);

        const evSpreads = pokemonData[pokemon].spreads.filter(spread => spread.nature !== 'Other');
        const selectedEvSpread = evSpreads[Math.floor(Math.random() * evSpreads.length)];

        const moves = shuffleArray(pokemonData[pokemon].moves.filter(move => move.move !== 'Other').filter(move => move.move !== 'Imprison').map(move => move.move)).slice(0, 4);

        const ability = pokemonData[pokemon].abilities && pokemonData[pokemon].abilities.length > 0 ? pokemonData[pokemon].abilities[0].ability : 'Unknown';

        const teraType = teraTypes[Math.floor(Math.random() * teraTypes.length)]; // Randomly select a Tera Type

        packedTeam.push({
            name: pokemon,
            item: selectedItem,
            ability: ability,
            evSpread: selectedEvSpread,
            moves: moves,
            teraType: teraType
        });
    }

    return convertToPackedFormat(packedTeam);
}

module.exports = {
    generateRandomTeam
};

// // // Example usage
// const folderPath = './cache';  // Adjust the path to your folder
// const restrictedList = ["Mewtwo", "Lugia", "Ho-Oh", "Kyogre", "Groudon", "Rayquaza", "Dialga", "Dialga-Origin", "Palkia", "Palkia-Origin", "Giratina", "Giratina-Origin", "Reshiram", "Zekrom", "Kyurem", "Kyurem-Black", "Kyurem-White", "Cosmog", "Cosmoem", "Solgaleo", "Lunala", "Necrozma", "Necrozma-Dawn-Wings", "Necrozma-Dusk-Mane", "Zacian", "Zacian-Crowned", "Zamazenta", "Zamazenta-Crowned", "Eternatus", "Calyrex", "Calyrex-Ice", "Calyrex-Shadow", "Koraidon", "Miraidon", "Terapagos"];

// const pokemonData = loadPokemonData(folderPath);
// const team = generateRandomTeam(pokemonData, restrictedList);

// console.log(team);
