import Decimal from "decimal.js";
import { AppError } from "../errors";

export const COST_CATEGORIES = ["MATERIAL", "LABOR", "SUBCONTRACT", "EQUIPMENT", "OTHER"] as const;
export function invalid(): never { throw new AppError("Invalid construction input", "C_VALIDATION", 400); }
export function quantity(value: string, allowZero = false): string {
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(value)) invalid();
  const q = new Decimal(value);
  if (allowZero ? q.lt(0) : q.lte(0)) invalid();
  return q.toFixed();
}
export function minor(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value)) invalid();
  return integer(new Decimal(value).times(100));
}
export function integer(value: Decimal.Value): number {
  const rounded = new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (!rounded.isFinite() || rounded.lt(0) || rounded.gt(2147483647)) invalid();
  return rounded.toNumber();
}
export function basisPoints(value: string): number {
  const bps = minor(value);
  if (bps > 10000) invalid();
  return bps;
}
export function lineAmount(qty: string, unitMinor: number): number { return integer(new Decimal(quantity(qty)).times(unitMinor)); }
export function tax(netMinor: number, bps: number): number { return integer(new Decimal(netMinor).times(bps).div(10000)); }
export function estimateTotals(lines: { quantity: string; materialUnitMinor: number; laborUnitMinor: number; otherUnitMinor: number; subcontractUnitMinor?: number; equipmentUnitMinor?: number }[], extraMinor: number, markupBps: number, vatBps: number) {
  const material = integer(Decimal.sum(0, ...lines.map((l) => lineAmount(l.quantity, l.materialUnitMinor))));
  const labor = integer(Decimal.sum(0, ...lines.map((l) => lineAmount(l.quantity, l.laborUnitMinor))));
  const other = integer(Decimal.sum(extraMinor, ...lines.map((l) => lineAmount(l.quantity, l.otherUnitMinor))));
  const subcontract = integer(Decimal.sum(0, ...lines.map((l) => lineAmount(l.quantity, l.subcontractUnitMinor ?? 0))));
  const equipment = integer(Decimal.sum(0, ...lines.map((l) => lineAmount(l.quantity, l.equipmentUnitMinor ?? 0))));
  const cost = integer(new Decimal(material).plus(labor).plus(other).plus(subcontract).plus(equipment));
  const markup = tax(cost, markupBps);
  const net = integer(new Decimal(cost).plus(markup));
  const vat = tax(net, vatBps);
  return { material, labor, other, subcontract, equipment, cost, markup, net, vat, total: integer(new Decimal(net).plus(vat)) };
}
