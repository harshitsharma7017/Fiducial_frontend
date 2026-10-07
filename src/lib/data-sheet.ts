import {
  FIRE_GROUPS,
  FIRE_ITEMS,
  OTHER_SECTIONS,
  RISK_DETAIL_FIELDS,
  type DataSheetFormValues,
  type DataSheetInput,
  type FireGroup,
  type FireItemKey,
  type ProposalRecord,
} from '@/shared';
import type { Rupees } from '@/types/proposal';

// The Data Sheet form: the record as form values, the values as the request, and the same
// arithmetic as the API (Fiducial_backend proposal-calc.ts) so totals update as the user types.
// The API's figures, returned after each save, remain the reference.

export type DataSheetForm = DataSheetFormValues;
export type LocationForm = DataSheetForm['locations'][number];
type FireItemForm = LocationForm['fire'][number];

const WHOLE_RUPEES = /^\d{1,13}$/;
const AREA = /^(\d{1,9})(?:\.(\d{1,2}))?$/;
const ITEM_BY_KEY = new Map(FIRE_ITEMS.map((item) => [item.key, item]));

const text = (value: string | null | undefined) => (value ?? '').trim();

/** Area × rate to the rupee (half up), or null unless both are valid. */
export function measuredSumInsured(sqFt: string, ratePerSqFt: string): Rupees | null {
  const area = AREA.exec(sqFt.trim());
  const rate = ratePerSqFt.trim();
  if (!area || !WHOLE_RUPEES.test(rate)) return null;
  // The area in hundredths of a square foot, so the product stays an integer.
  const hundredths = BigInt(area[1] ?? '0') * 100n + BigInt((area[2] ?? '').padEnd(2, '0'));
  return ((hundredths * BigInt(rate) + 50n) / 100n).toString();
}

/** An item's sum insured: the typed amount, else area × rate for a measured item, else 0. */
export function itemSumInsured(item: {
  key: FireItemKey;
  sqFt: string | null;
  ratePerSqFt: string | null;
  amount: string | null;
}): Rupees {
  const amount = text(item.amount);
  if (amount) return WHOLE_RUPEES.test(amount) ? BigInt(amount).toString() : '0';
  if (ITEM_BY_KEY.get(item.key)?.measured) {
    return measuredSumInsured(text(item.sqFt), text(item.ratePerSqFt)) ?? '0';
  }
  return '0';
}

const add = (values: readonly Rupees[]) =>
  values.reduce((total, value) => total + BigInt(value), 0n).toString();

export function locationTotal(location: Pick<LocationForm, 'fire'>): Rupees {
  return add(location.fire.map(itemSumInsured));
}

/** Option 1 of each Fire line: every location's items in the line. */
export function fireGroupTotals(
  locations: readonly Pick<LocationForm, 'fire'>[],
): Record<FireGroup, Rupees> {
  const totals = Object.fromEntries(FIRE_GROUPS.map((group) => [group, '0'])) as Record<
    FireGroup,
    Rupees
  >;
  for (const group of FIRE_GROUPS) {
    totals[group] = add(
      locations.flatMap((location) =>
        location.fire
          .filter((item) => ITEM_BY_KEY.get(item.key)?.group === group)
          .map(itemSumInsured),
      ),
    );
  }
  return totals;
}

export function sumRupeesOf(values: readonly Rupees[]): Rupees {
  return add(values);
}

const blankRisk = () =>
  Object.fromEntries(RISK_DETAIL_FIELDS.map((field) => [field.key, ''])) as LocationForm['risk'];

/** A location as just added: every Fire item, all blank. */
export function blankLocation(locationId: string): LocationForm {
  return {
    locationId,
    fire: FIRE_ITEMS.map((item) => ({ key: item.key, sqFt: '', ratePerSqFt: '', amount: '' })),
    hypothecation: '',
    openStock: '',
    risk: blankRisk(),
  };
}

/** The saved Data Sheet as form values: every Fire item and section in order, blanks as "". */
export function toDataSheetForm(record: ProposalRecord): DataSheetForm {
  const option2 = new Map(record.fire.groups.map((line) => [line.group, line.proposed2]));
  const sections = new Map(record.sections.map((section) => [section.code, section]));
  return {
    dueDate: record.dueDate,
    policyStart: record.policyStart ?? '',
    locations: record.locations.map((location) => {
      const saved = new Map(location.fire.map((item) => [item.key, item]));
      return {
        locationId: location.locationId,
        fire: FIRE_ITEMS.map((item) => {
          const value = saved.get(item.key);
          return {
            key: item.key,
            sqFt: value?.sqFt ?? '',
            ratePerSqFt: value?.ratePerSqFt ?? '',
            amount: value?.amount ?? '',
          };
        }),
        hypothecation: location.hypothecation ?? '',
        openStock: location.openStock ?? '',
        risk: Object.fromEntries(
          RISK_DETAIL_FIELDS.map((field) => [field.key, location.risk[field.key] ?? '']),
        ) as LocationForm['risk'],
      };
    }),
    fireOption2: FIRE_GROUPS.map((group) => ({ group, amount: option2.get(group) ?? '' })),
    sections: OTHER_SECTIONS.map((code) => {
      const section = sections.get(code);
      return {
        code,
        included: section?.included ?? false,
        proposed1: section?.proposed1 ?? '',
        proposed2: section?.proposed2 ?? '',
      };
    }),
    claims: record.claims.map((claim) => ({
      period: claim.period,
      policyType: claim.policyType ?? '',
      sumInsured: claim.sumInsured ?? '',
      premium: claim.premium ?? '',
      claimedAmount: claim.claimedAmount ?? '',
      remarks: claim.remarks ?? '',
      insurer: claim.insurer ?? '',
    })),
    notes: record.notes ?? '',
  };
}

const isBlankItem = (item: FireItemForm) =>
  !text(item.sqFt) && !text(item.ratePerSqFt) && !text(item.amount);

/** The request body: Fire items left fully blank are not sent. */
export function toDataSheetRequest(values: DataSheetInput): DataSheetInput {
  return {
    ...values,
    locations: values.locations.map((location) => ({
      ...location,
      fire: location.fire.filter((item) => !isBlankItem(item)),
    })),
  };
}
