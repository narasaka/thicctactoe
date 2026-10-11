import { customAlphabet } from "nanoid";

/**
 * Lowercase alphanumerics without the easily confused 0, o, 1 and l.
 * Every id shown to users (URLs, file names) is drawn from this alphabet;
 * primary keys stay internal.
 */
export const PUBLIC_ID_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

/** 10 characters = 50 bits: plenty for game links and avatar names. */
export const publicId = customAlphabet(PUBLIC_ID_ALPHABET, 10);
