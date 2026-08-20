import { findUser } from "../data/users";

export interface GetUserNameArgs {
  id: number;
}

export function getUserName(args: GetUserNameArgs): string {
  const user = findUser(args.id);
  if (!user) {
    throw new Error(`User with ID ${args.id} not found.`);
  }
  return user.name;
}
