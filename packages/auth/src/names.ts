const ADJECTIVES = [
  "Thicc",
  "Sneaky",
  "Chonky",
  "Sleepy",
  "Spicy",
  "Wobbly",
  "Grumpy",
  "Fluffy",
  "Zesty",
  "Bouncy",
  "Cosmic",
  "Soggy",
  "Swift",
  "Lucky",
  "Fancy",
  "Dizzy",
  "Brave",
  "Crispy",
  "Mighty",
  "Shy",
];
const ANIMALS = [
  "Otter",
  "Panda",
  "Capybara",
  "Raccoon",
  "Penguin",
  "Axolotl",
  "Goose",
  "Hedgehog",
  "Llama",
  "Walrus",
  "Frog",
  "Koala",
  "Badger",
  "Narwhal",
  "Pigeon",
  "Quokka",
  "Sloth",
  "Yak",
  "Moose",
  "Crab",
];

const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;

/** A friendly display name for a guest, e.g. "Chonky Capybara". */
export function guestName() {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}
