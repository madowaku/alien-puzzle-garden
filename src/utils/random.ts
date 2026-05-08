export class SeededRandom {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot choose from an empty list.");
    }
    return items[this.integer(0, items.length - 1)];
  }
}

export function buildToken(rng: SeededRandom, alphabet: readonly string[], minLength: number, maxLength: number): string {
  const length = rng.integer(minLength, maxLength);
  let token = "";
  for (let index = 0; index < length; index += 1) {
    token += rng.choice(alphabet);
  }
  return token;
}
