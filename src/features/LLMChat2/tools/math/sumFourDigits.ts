export interface SumFourDigitsArgs {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function sumFourDigits(args: SumFourDigitsArgs): number {
  return args.a + args.b + args.c + args.d;
}
