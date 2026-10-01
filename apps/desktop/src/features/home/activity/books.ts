// Yardsticks for "You've used ~N× more tokens than …", the same phrasing as Claude Code's stats.
// The Lord of the Rings matches Claude Code (25.4B tokens ≈ 44014×, so ≈ 577K tokens); the
// others are English word counts × ~1.33 tokens per word, rounded.
export const BOOKS: Array<{ title: string; tokens: number }> = [
  { title: "The Lord of the Rings", tokens: 577_000 },
  { title: "the Harry Potter series", tokens: 1_450_000 },
  { title: "the Three-Body trilogy", tokens: 520_000 },
  { title: "War and Peace", tokens: 780_000 },
  { title: "Moby-Dick", tokens: 275_000 },
  { title: "Dune", tokens: 250_000 },
];

export function randomBook() {
  return BOOKS[Math.floor(Math.random() * BOOKS.length)];
}
