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

export const DISPLAY_NAME_MAX = 24;

/**
 * Cleans up a name a player picked for themselves: invisible characters are
 * dropped and runs of whitespace become one space. Returns null if what is
 * left is empty or longer than `DISPLAY_NAME_MAX` characters.
 */
export function displayName(raw: string) {
  const name = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const length = [...name].length;
  return length > 0 && length <= DISPLAY_NAME_MAX ? name : null;
}
