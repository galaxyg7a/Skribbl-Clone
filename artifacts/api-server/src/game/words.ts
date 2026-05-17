export const WORD_LIST: string[] = [
  'apple', 'banana', 'guitar', 'elephant', 'rainbow', 'volcano', 'sandwich',
  'bicycle', 'umbrella', 'lighthouse', 'jellyfish', 'cactus', 'tornado',
  'penguin', 'diamond', 'spaceship', 'waterfall', 'scorpion', 'telescope',
  'caterpillar', 'snowflake', 'hamburger', 'submarine', 'firework', 'hedgehog',
  'avalanche', 'compass', 'lantern', 'porcupine', 'trapeze', 'piranha',
  'ghost', 'robot', 'wizard', 'dragon', 'mermaid', 'vampire', 'zombie',
  'pirate', 'knight', 'ninja', 'astronaut', 'caveman', 'witch', 'clown',
  'pizza', 'sushi', 'taco', 'waffle', 'doughnut', 'pretzel', 'cupcake',
  'lasagna', 'burrito', 'spaghetti', 'popcorn', 'brownie', 'pancake',
  'football', 'basketball', 'baseball', 'tennis', 'volleyball', 'surfboard',
  'skateboard', 'boomerang', 'trampoline', 'archery', 'bowling', 'kayak',
  'scissors', 'thermometer', 'microscope', 'hourglass', 'calculator', 'magnet',
  'satellite', 'parachute', 'helicopter', 'submarine', 'elevator', 'escalator',
  'earthquake', 'thunderstorm', 'hurricane', 'blizzard', 'tsunami', 'drought',
  'ocean', 'mountain', 'desert', 'jungle', 'glacier', 'canyon', 'swamp',
  'forest', 'meadow', 'island', 'peninsula', 'cliff', 'waterfall', 'lagoon',
  'lion', 'tiger', 'bear', 'wolf', 'giraffe', 'zebra', 'gorilla', 'cheetah',
  'hippo', 'rhino', 'crocodile', 'iguana', 'flamingo', 'peacock', 'parrot',
  'octopus', 'shark', 'dolphin', 'whale', 'crab', 'lobster', 'seahorse',
  'butterfly', 'dragonfly', 'ladybug', 'spider', 'scorpion', 'beetle', 'ant',
  'castle', 'pyramid', 'skyscraper', 'mansion', 'igloo', 'windmill', 'bridge',
  'tunnel', 'lighthouse', 'stadium', 'cathedral', 'temple', 'pagoda',
  'violin', 'trumpet', 'saxophone', 'accordion', 'harp', 'trombone', 'drums',
  'xylophone', 'banjo', 'ukulele', 'clarinet', 'flute', 'oboe', 'tuba',
  'crown', 'anchor', 'trophy', 'medal', 'lantern', 'candle', 'torch',
  'compass', 'map', 'treasure', 'key', 'lock', 'chain', 'scroll',
  'sunflower', 'mushroom', 'cactus', 'tulip', 'daisy', 'rose', 'bamboo',
  'oak tree', 'palm tree', 'bonsai', 'Venus flytrap', 'seaweed', 'fern',
  'ice cream', 'cotton candy', 'lollipop', 'gummy bear', 'marshmallow',
  'hot dog', 'french fries', 'nacho', 'smore', 'pretzel', 'churro',
  'birthday cake', 'fortune cookie', 'ramen', 'dumpling', 'croissant',
  'rocket ship', 'black hole', 'comet', 'asteroid', 'nebula', 'galaxy',
  'moon', 'sun', 'Saturn', 'Mars', 'Jupiter', 'shooting star', 'meteor',
  'surfing', 'rock climbing', 'snowboarding', 'parachuting', 'bungee jumping',
  'scuba diving', 'marathon', 'fencing', 'wrestling', 'polo', 'curling',
  'Pac-Man', 'tetris', 'chess', 'checkers', 'domino', 'dart board',
  'jigsaw puzzle', 'rubik cube', 'yo-yo', 'frisbee', 'kite', 'slingshot',
  'roller coaster', 'Ferris wheel', 'carousel', 'haunted house', 'bumper car',
  'diving board', 'zip line', 'hot air balloon', 'gondola', 'cable car',
  'magician', 'juggler', 'acrobat', 'tightrope walker', 'fire breather',
  'jack-o-lantern', 'snowman', 'scarecrow', 'puppet', 'marionette',
  'smoke signal', 'campfire', 'bonfire', 'fireworks', 'sparkler',
  'bowling pin', 'billiard ball', 'dartboard', 'pinball machine',
  'cloud', 'lightning bolt', 'rainbow', 'snowflake', 'raindrop', 'fog',
  'whirlpool', 'quicksand', 'mud puddle', 'tide pool', 'coral reef',
];

export function getRandomWords(count: number): string[] {
  const shuffled = [...WORD_LIST].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
