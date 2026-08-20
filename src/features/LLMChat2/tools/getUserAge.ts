import { findUser } from "../data/users";

export interface GetUserAgeArgs {
  name: string;
}

export function getUserAge(args: GetUserAgeArgs): number {
  const user = findUser(args.name);
  if (!user) {
    throw new Error(`User "${args.name}" not found in database.`);
  }
  return user.age;
}
