export interface UserRecord {
  id: number;
  name: string;
  age: number;
  country: string;
  dob: string;
}

export const USERS_DATABASE: UserRecord[] = [
  { id: 1, name: "Alice Smith", age: 28, country: "United States", dob: "1998-04-12" },
  { id: 2, name: "Bob Johnson", age: 34, country: "Canada", dob: "1992-09-23" },
  { id: 3, name: "Carlos Rossi", age: 41, country: "Italy", dob: "1985-01-15" },
  { id: 4, name: "Diana Prince", age: 30, country: "United Kingdom", dob: "1996-03-22" },
  { id: 5, name: "Ethan Hunt", age: 45, country: "United States", dob: "1981-08-18" },
  { id: 6, name: "Fiona Gallagher", age: 26, country: "Ireland", dob: "2000-02-14" },
  { id: 7, name: "George Clark", age: 52, country: "Australia", dob: "1974-11-05" },
  { id: 8, name: "Hannah Abbott", age: 23, country: "New Zealand", dob: "2003-07-09" },
  { id: 9, name: "Ian Malcolm", age: 48, country: "United States", dob: "1978-06-01" },
  { id: 10, name: "Julia Roberts", age: 39, country: "France", dob: "1987-10-28" },
  { id: 11, name: "Kenji Sato", age: 31, country: "Japan", dob: "1995-05-19" },
  { id: 12, name: "Laura Croft", age: 33, country: "United Kingdom", dob: "1993-02-14" },
  { id: 13, name: "Michael Chang", age: 29, country: "Singapore", dob: "1997-12-03" },
  { id: 14, name: "Nina Patel", age: 36, country: "India", dob: "1990-04-25" },
  { id: 15, name: "Oscar Wilde", age: 42, country: "Ireland", dob: "1984-10-16" },
  { id: 16, name: "Paula Deen", age: 60, country: "United States", dob: "1966-01-19" },
  { id: 17, name: "Quinn Fabray", age: 24, country: "United States", dob: "2002-09-30" },
  { id: 18, name: "Rafael Nadal", age: 38, country: "Spain", dob: "1986-06-03" },
  { id: 19, name: "Sarah Connor", age: 35, country: "United States", dob: "1991-05-13" },
  { id: 20, name: "Thomas Anderson", age: 37, country: "Australia", dob: "1989-03-11" },
  { id: 21, name: "Uma Thurman", age: 50, country: "United States", dob: "1976-04-29" },
  { id: 22, name: "Victor Hugo", age: 58, country: "France", dob: "1968-02-26" },
  { id: 23, name: "Wendy Darling", age: 22, country: "United Kingdom", dob: "2004-08-14" },
  { id: 24, name: "Xavier Woods", age: 32, country: "United States", dob: "1994-09-04" },
  { id: 25, name: "Yuki Tanaka", age: 27, country: "Japan", dob: "1999-07-07" },
  { id: 26, name: "Zack Snyder", age: 55, country: "United States", dob: "1971-03-01" },
  { id: 27, name: "Amelie Poulain", age: 25, country: "France", dob: "2001-06-18" },
  { id: 28, name: "Bruce Wayne", age: 40, country: "United States", dob: "1986-02-19" },
  { id: 29, name: "Clara Oswald", age: 31, country: "United Kingdom", dob: "1995-11-23" },
  { id: 30, name: "David Kim", age: 28, country: "South Korea", dob: "1998-08-15" },
  { id: 31, name: "Elena Rostova", age: 34, country: "Germany", dob: "1992-12-01" },
  { id: 32, name: "Fernando Alonso", age: 43, country: "Spain", dob: "1983-07-29" },
  { id: 33, name: "Grace Hopper", age: 65, country: "United States", dob: "1961-12-09" },
  { id: 34, name: "Harry Dresden", age: 39, country: "United States", dob: "1987-10-31" },
  { id: 35, name: "Isla Fisher", age: 44, country: "Australia", dob: "1982-02-03" },
  { id: 36, name: "Jack Sparrow", age: 46, country: "United Kingdom", dob: "1980-04-01" },
  { id: 37, name: "Katniss Everdeen", age: 21, country: "United States", dob: "2005-05-08" },
  { id: 38, name: "Luke Skywalker", age: 29, country: "United States", dob: "1997-05-25" },
  { id: 39, name: "Mia Wallace", age: 33, country: "United States", dob: "1993-01-20" },
  { id: 40, name: "Noah Bennett", age: 47, country: "Canada", dob: "1979-09-14" },
  { id: 41, name: "Olivia Benson", age: 51, country: "United States", dob: "1975-01-23" },
  { id: 42, name: "Peter Parker", age: 22, country: "United States", dob: "2004-08-10" },
  { id: 43, name: "Qiang Liu", age: 36, country: "China", dob: "1990-09-18" },
  { id: 44, name: "Rachel Green", age: 35, country: "United States", dob: "1991-05-05" },
  { id: 45, name: "Samwise Gamgee", age: 38, country: "United Kingdom", dob: "1988-04-06" },
  { id: 46, name: "Tina Fey", age: 53, country: "United States", dob: "1973-05-18" },
  { id: 47, name: "Ulrich Nielsen", age: 49, country: "Germany", dob: "1977-11-12" },
  { id: 48, name: "Veda Hille", age: 27, country: "Canada", dob: "1999-06-11" },
  { id: 49, name: "Walter White", age: 52, country: "United States", dob: "1974-09-07" },
  { id: 50, name: "Zoey Deschanel", age: 41, country: "United States", dob: "1985-01-17" },
];

export function findUser(query: string | number): UserRecord | undefined {
  if (typeof query === "number" || !isNaN(Number(query))) {
    return USERS_DATABASE.find((u) => u.id === Number(query));
  }
  const q = String(query).trim().toLowerCase();
  return USERS_DATABASE.find((u) => u.name.toLowerCase().includes(q));
}
