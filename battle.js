const { BattleStream, getPlayerStreams } = require('./sim');
const fs = require('fs');

async function simulateBattle(team1, team2) {
  const streams = getPlayerStreams(new BattleStream());
  const spec = { formatid: 'gen9vgc2024regg' };

  const battle = streams.omniscient;
  // const logStream = fs.createWriteStream('battle_log.txt', { flags: 'a' });

  // logStream.write(`Battle started with players: Player 1 and Player 2\n`);

  if (team1.endsWith("]")) {
    team1 = team1.slice(0, -1);
  }
  if (team2.endsWith("]")) {
    team2 = team2.slice(0, -1);
  }

  battle.write(`>start ${JSON.stringify(spec)}\n`);
  battle.write(`>player p1 {"name":"Player 1", "team": "${team1}"}\n`);
  battle.write(`>player p2 {"name":"Player 2", "team": "${team2}"}\n`);

  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function getRandomPermutation() {
    const numbers = [1, 2, 3, 4];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = getRandomInt(i + 1);
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    return numbers.join('');
  }

  const p1TeamOrder = getRandomPermutation();
  const p2TeamOrder = getRandomPermutation();

  battle.write(`>p1 team ${p1TeamOrder}\n`);
  battle.write(`>p2 team ${p2TeamOrder}\n`);

  let turnNumber = 0;
  const maxRetries = 5;
  const retryCounts = { p1: 0, p2: 0 };

  async function handleRequest(request, player) {
    //logStream.write(`${player} request: ${JSON.stringify(request)}\n`);
    if (request.forceSwitch) {
      const reviving = request.side.pokemon.some(pokemon => pokemon.active && pokemon.reviving);
      const switchChoices = reviving
        ? request.side.pokemon.map((pokemon, i) => (pokemon.condition === '0 fnt' ? i + 1 : null)).filter(choice => choice !== null)
        : request.side.pokemon.map((pokemon, i) => (pokemon.condition !== '0 fnt' && !pokemon.active ? i + 1 : null)).filter(choice => choice !== null);

      const trueCount = request.forceSwitch.filter(Boolean).length;

      let command;
      if (trueCount === 1) {
        if (switchChoices.length > 0) {
          const switchChoice = switchChoices[0];
          command = `>${player} switch ${switchChoice}\n`;
        } else {
          command = `>${player} switch\n`;
        }
      } else if (trueCount === 2) {
        if (switchChoices.length > 1) {
          const switchChoice1 = switchChoices[0];
          const switchChoice2 = switchChoices[1];
          command = `>${player} switch ${switchChoice1}, switch ${switchChoice2}\n`;
        } else if (switchChoices.length === 1) {
          const switchChoice = switchChoices[0];
          command = `>${player} switch ${switchChoice}, switch\n`;
        } else {
          command = `>${player} switch, switch\n`;
        }
      }

      // logStream.write(`Writing command: ${command}`);
      battle.write(command);
    } else if (request.active) {
      const actions = [];
      const activePokemon = request.active.filter(a => a);

      for (let i = 0; i < activePokemon.length; i++) {
        const active = activePokemon[i];
        const pokemon = request.side.pokemon[i];

        if (active.moves && pokemon.condition !== '0 fnt') {
          const moveChoices = active.moves
            .map((move, i) => ({ ...move, index: i + 1 }))
            .filter(move => move.move !== 'nothing' && move.move !== 'Imprison' && move.pp !== 0 && !move.disabled)
            .map(move => move.index);
          const moveChoice = moveChoices[getRandomInt(moveChoices.length)];

          // Log the target type for debugging
          const targetType = active.moves[moveChoice - 1].target;
          // logStream.write(`${player} move choice: move ${moveChoice} targetType ${targetType}\n`);

          // Reset the needsTarget and targetChoices for each move
          let targetChoices = [];
          let needsTarget = true;

          switch (targetType) {
            case 'normal':
            case 'adjacentFoe':
            case 'any':
              targetChoices = [1, 2];
              break;
            case 'adjacentAlly':
              targetChoices = [i === 0 ? -2 : -1];
              break;
            case 'adjacentAllyOrSelf':
              targetChoices = [i === 0 ? -1 : -2];
              break;
            case 'allAdjacent':
            case 'allAdjacentFoes':
            case 'all':
            case 'allySide':
            case 'foeSide':
            case 'self':
              needsTarget = false;
              break;
          }

          // Correctly handle target choice and avoid undefined
          const targetChoice = needsTarget && targetChoices.length > 0 ? targetChoices[getRandomInt(targetChoices.length)] : '';
          actions.push(`move ${moveChoice}${targetChoice !== '' ? ` ${targetChoice}` : ''}`);
          // logStream.write(`${player} move choice: move ${moveChoice}${targetChoice !== '' ? ` target ${targetChoice}` : ''}\n`);
        }
      }

      turnNumber++;
      let command = `>${player} ${actions.join(', ')}\n`;
      if (turnNumber === 1) {
        command = command.trim() + ' terastallize\n';
      }
      // logStream.write(`Writing command: ${command}`);
      battle.write(command);
    } else {
      // logStream.write(`${player} request not handled: ${JSON.stringify(request)}\n`);
      return;
    }
  }

  async function processStream(stream, player) {
    for await (const chunk of stream) {
      // logStream.write(`${player} received chunk: ${chunk}\n`);
      // console.log(`${player} received chunk: ${chunk}\n`);

      if (chunk.includes('|request|')) {
        const requestString = chunk.split('|request|')[1];
        if (requestString) {
          try {
            const request = JSON.parse(requestString);
            await handleRequest(request, player);
          } catch (err) {
            // logStream.write(`Failed to parse request JSON: ${requestString}\n`);
            console.error(`Failed to parse request JSON: ${requestString}\n`);
          }
        }
      }
      if (chunk.includes('|win|')) {
        const winner = chunk.match(/\|win\|(.*)/)[1];
        // logStream.write(`Winner: ${winner}\n`);
        return winner;
      }
      if (chunk.includes('|error|')) {
        const errorMessage = chunk.split('|error|')[1];
        // logStream.write(`Error: ${errorMessage}\n`);
        console.log(`Error: ${errorMessage}\n Chunk was: ${chunk}\n`);

        if (retryCounts[player] < maxRetries) {
          retryCounts[player]++;
          // logStream.write(`${player} retrying command (attempt ${retryCounts[player]})\n`);
          // console.log(`${player} retrying command (attempt ${retryCounts[player]})\n`);

          const requestString = chunk.split('|request|')[1];
          if (requestString) {
            try {
              const request = JSON.parse(requestString);

              if (errorMessage.includes("Can't move")) {
                const moveName = errorMessage.match(/Can't move: .*'s (.+) is disabled/)[1];
                for (const active of request.active) {
                  if (active) {
                    for (const move of active.moves) {
                      if (move.move === moveName) {
                        move.disabled = true;
                      }
                    }
                  }
                }
              }

              await handleRequest({ ...request, error: true }, player);
            } catch (err) {
              //logStream.write(`Failed to parse request JSON: ${requestString}\n`);
              console.error(`Failed to parse request JSON: ${requestString}\n`);
            }
          }
        } else {
          // logStream.write(`${player} max retries reached. Setting result as inconclusive.\n`);
          // console.log(`${player} max retries reached. Setting result as inconclusive.\n`);
          return 'inconclusive';
        }
      }
    }
  }

  const winner = await Promise.race([
    processStream(streams.p1, 'p1'),
    processStream(streams.p2, 'p2'),
    processStream(streams.omniscient, 'omniscient')
  ]);

  // logStream.write('Battle finished.\n');
  // logStream.end();

  return winner;
}

module.exports = {
    simulateBattle
};



// // // Example of calling the function and logging the result
// async function main() {
//   // Replace with actual Pokepaste format teams
//   const team1 = "Kyurem-White||Life_Orb|Turboblaze|Freeze-Dry,Icy Wind,Protect,Fusion Flare|Timid|0,0,0,252,4,252|||||,,,,,Fire]Tornadus||Covert_Cloak|Prankster|Rain Dance,Protect,Icy Wind,Taunt|Timid|244,0,4,4,68,188|||||,,,,,Water]Iron Hands||Sitrus_Berry|Quark Drive|Swords Dance,Protect,Close Combat,Drain Punch|Brave|164,252,0,0,92,0|||||,,,,,Ghost]Charizard||Flame_Plate|Solar Power|Scorching Sands,Focus Blast,Weather Ball,Ancient Power|Jolly|252,4,0,0,0,252|||||,,,,,Poison"
//   const team2 = "Kyogre||Choice_Scarf|Drizzle|Calm Mind,Hydro Pump,Thunder,Protect|Bold|212,0,140,156,0,0|||||,,,,,Fighting]Tsareena||Wide_Lens|Queenly Majesty|Triple Axel,Protect,Helping Hand,Power Whip|Adamant|252,92,0,0,0,164|||||,,,,,Ground]Enamorus-Therian||Aguav_Berry|Overcoat|Tera Blast,Psychic,Springtide Storm,Calm Mind|Bold|132,0,0,252,124,0|||||,,,,,Psychic]Golduck||Covert_Cloak|Cloud Nine|Encore,Muddy Water,Protect,Taunt|Timid|220,0,28,0,4,252|||||,,,,,Psychic"
//   const winner = await simulateBattle(team1, team2);
//   console.log(`The winner is: ${winner}`);
// }

// main();
