// Import necessary functions and libraries
const { generateRandomTeam } = require('./gen_team_random');
const { simulateBattle } = require('./battle');
const { geneticAlgorithm } = require('./gen_test');
const fs = require('fs');
const path = require('path');

// Input variables
const populationSize = 100;
const numGenerations = 50;
const annealingFactor = 0.95;
const numBattles = 200;
const startTime = Date.now();

const restrictedList = [
    "Mewtwo", "Lugia", "Ho-Oh", "Kyogre", "Groudon", "Rayquaza", "Dialga", "Dialga-Origin",
    "Palkia", "Palkia-Origin", "Giratina", "Giratina-Origin", "Reshiram", "Zekrom", "Kyurem",
    "Kyurem-Black", "Kyurem-White", "Cosmog", "Cosmoem", "Solgaleo", "Lunala", "Necrozma",
    "Necrozma-Dawn-Wings", "Necrozma-Dusk-Mane", "Zacian", "Zacian-Crowned", "Zamazenta",
    "Zamazenta-Crowned", "Eternatus", "Calyrex", "Calyrex-Ice", "Calyrex-Shadow", "Koraidon",
    "Miraidon", "Terapagos"
];

// Load Pokémon data from the /cache folder
const loadPokemonData = (folderPath) => {
    const files = fs.readdirSync(folderPath);
    const pokemonData = {};
    files.forEach(file => {
        const data = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        const pokemon = JSON.parse(data);
        pokemonData[pokemon.name] = pokemon;
    });
    return pokemonData;
};

// Load Pokémon data
const pokemonData = loadPokemonData('./cache');

// Simulate battles and return the number of wins
const simulateBattles = async (team, numBattles = 100) => {
    let wins = 0;
    for (let i = 0; i < numBattles; i++) {
        const opponentTeam = generateRandomTeam(pokemonData, restrictedList);
        const result = await simulateBattle(team, opponentTeam);
        if (result === "Player 1") {
            wins++;
        }
    }
    return wins;
};

// Genetic algorithm to evolve Pokémon teams
const evolveTeams = async (numGenerations, populationSize, annealingFactor, numBattles) => {
    let population = Array.from({ length: populationSize }, () => generateRandomTeam(pokemonData, restrictedList));
    let topTeams = [];
    let currentAnnealingFactor = annealingFactor; // Initialize the current annealing factor

    for (let generation = 0; generation < numGenerations; generation++) {
        const generationStartTime = Date.now();
        const scores = await Promise.all(population.map(async team => ({
            team,
            wins: await simulateBattles(team, numBattles)
        })));

        scores.sort((a, b) => b.wins - a.wins);
        topTeams = scores.slice(0, 38);
        const newPopulation = topTeams.map(score => score.team);

        while (newPopulation.length < populationSize) {
            const parent1 = topTeams[Math.floor(Math.random() * topTeams.length)].team;
            const parent2 = topTeams[Math.floor(Math.random() * topTeams.length)].team;
            const offspring = geneticAlgorithm(parent1, parent2, currentAnnealingFactor, pokemonData);
            newPopulation.push(offspring);
        }
        const generationEndTime = Date.now();
        const generationTime = (generationEndTime - generationStartTime) / 1000;
        console.log(`Generation ${generation + 1} took ${generationTime} seconds`);
        population = newPopulation;

        // Decrement the annealing factor
        currentAnnealingFactor *= annealingFactor;
    }

    return topTeams;
};

// Main function to run the evolution process
const main = async () => {
    const topTeams = await evolveTeams(numGenerations, populationSize, annealingFactor, numBattles);
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    console.log(`Total time for ${numGenerations} generations: ${totalTime} seconds`);
    const outputData = topTeams.map(score => `Team: ${score.team}, Wins: ${score.wins}`).join('\n');
    fs.writeFileSync('gen_output.txt', outputData, 'utf-8');
    console.log('Top teams saved to gen_output.txt');
};

// Run the main function
main();
