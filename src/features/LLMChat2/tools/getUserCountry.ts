import { findUser } from "../data/users";

export interface GetUserCountryArgs {
  name: string;
}

export function getUserCountry(args: GetUserCountryArgs): string {
  const user = findUser(args.name);
  if (!user) {
    throw new Error(`User "${args.name}" not found in database.`);
  }
  return user.country;
}
