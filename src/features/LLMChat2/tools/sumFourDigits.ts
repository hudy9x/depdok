export interface SumFourDigitsArgs {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function sumFourDigits(args: SumFourDigitsArgs): number {
  return Number(args.a) + Number(args.b) + Number(args.c) + Number(args.d);
}
