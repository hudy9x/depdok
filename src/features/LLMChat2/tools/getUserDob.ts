import { findUser } from "../data/users";

export interface GetUserDobArgs {
  name: string;
}

export function getUserDob(args: GetUserDobArgs): string {
  const user = findUser(args.name);
  if (!user) {
    throw new Error(`User "${args.name}" not found in database.`);
  }
  return user.dob;
}
