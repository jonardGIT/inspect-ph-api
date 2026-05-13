import bcrypt from "bcryptjs";

const DEFAULT_BCRYPT_SALT_ROUNDS = 10;

function getSaltRounds(): number {
  const rawValue = process.env.BCRYPT_SALT_ROUNDS?.trim();

  if (!rawValue) {
    return DEFAULT_BCRYPT_SALT_ROUNDS;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("BCRYPT_SALT_ROUNDS must be a positive integer");
  }

  return value;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getSaltRounds());
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
