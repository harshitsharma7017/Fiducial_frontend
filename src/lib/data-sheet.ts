import {
  BURGLARY_BASIS_PERCENT,
  SECTION_LINES,
  SUM_INSURED_LINES,
  hasBasis,
  hasExistingFigures,
  isAnnexureSection,
  type BurglaryBasis,
  type CoverInput,
  type OtherSection,
  type SectionWithLines,
  FIRE_GROUPS,
  FIRE_ITEMS,
  RISK_DETAIL_FIELDS,
  type DataSheetFormValues,
  type DataSheetInput,
  type FireGroup,
  type FireItemKey,
  type ProposalRecord,
  wholeRupees,
} from '@/shared';
import type { Rupees } from '@/types/proposal';

// The Data Sheet form: the record as form values, the values as the request, and the same
// arithmetic as the API (Fiducial_backend proposal-calc.ts) so totals update as the user types.
// As in the client's Excel, area × rate is exact (in paise here) and totals add the exact amounts;
// only what is shown is rounded to the rupee. The API's figures, returned on save, are the reference.

export type DataSheetForm = DataSheetFormValues;
export type LocationForm = DataSheetForm['locations'][number];
type FireItemForm = LocationForm['fire'][number];
export type BuildingForm = NonNullable<LocationForm['buildings']>[number];
type BuildingValues = Pick<BuildingForm, 'sqFt' | 'ratePerSqFt' | 'amount'>;
export type AnnexureRowForm = DataSheetForm['sections'][number]['annexure'] extends
  (infer R)[] | undefined
  ? R
  : never;
type FireItemValues = Pick<FireItemForm, 'sqFt' | 'ratePerSqFt' | 'amount'> & { key: FireItemKey };

const WHOLE_RUPEES = /^\d{1,13}$/;
const AREA = /^(\d{1,9})(?:\.(\d{1,2}))?$/;
const ITEM_BY_KEY = new Map(FIRE_ITEMS.map((item) => [item.key, item]));

const text = (value: string | null | undefined) => (value ?? '').trim();

/** Paise to whole rupees, half up: what a #,##0 cell in Excel shows. */
export function paiseToRupees(paise: bigint): Rupees {
  return ((paise + 50n) / 100n).toString();
}

/** Area × rate in paise, exactly, or null unless both are valid. */
export function measuredPaise(sqFt: string, ratePerSqFt: string): bigint | null {
  const area = AREA.exec(sqFt.trim());
  const rate = ratePerSqFt.trim();
  if (!area || !WHOLE_RUPEES.test(rate)) return null;
  // Hundredths of a square foot times whole rupees is paise.
  const hundredths = BigInt(area[1] ?? '0') * 100n + BigInt((area[2] ?? '').padEnd(2, '0'));
  return hundredths * BigInt(rate);
}

/** An item's exact sum insured in paise: the typed amount, else area × rate, else 0. */
export function itemPaise(item: FireItemValues): bigint {
  const amount = text(item.amount);
  if (amount) return WHOLE_RUPEES.test(amount) ? BigInt(amount) * 100n : 0n;
  if (ITEM_BY_KEY.get(item.key)?.measured) {
    return measuredPaise(text(item.sqFt), text(item.ratePerSqFt)) ?? 0n;
  }
  return 0n;
}

/** An item's sum insured as shown: to the rupee. */
export function itemSumInsured(item: FireItemValues): Rupees {
  return paiseToRupees(itemPaise(item));
}

/** D1: a building's exact sum insured in paise: the typed amount, else area × rate, else 0. */
export function buildingPaise(building: BuildingValues): bigint {
  const amount = text(building.amount);
  if (amount) return WHOLE_RUPEES.test(amount) ? BigInt(amount) * 100n : 0n;
  return measuredPaise(text(building.sqFt), text(building.ratePerSqFt)) ?? 0n;
}

/** D1: a building's sum insured as shown, to the rupee. */
export function buildingSumInsured(building: BuildingValues): Rupees {
  return paiseToRupees(buildingPaise(building));
}

const buildingsPaise = (buildings: readonly BuildingValues[] | undefined) =>
  (buildings ?? []).reduce((total, building) => total + buildingPaise(building), 0n);

/** D1: the total sum insured of a location's buildings, to the rupee. */
export function buildingsTotal(location: Pick<LocationForm, 'buildings'>): Rupees {
  return paiseToRupees(buildingsPaise(location.buildings));
}

const totalPaise = (items: readonly FireItemValues[]) =>
  items.reduce((total, item) => total + itemPaise(item), 0n);

type LocationFigures = Pick<LocationForm, 'fire' | 'buildings'>;

/** The exact paise of a location: its Fire items plus its buildings (D1). */
const locationPaise = (location: LocationFigures) =>
  totalPaise(location.fire) + buildingsPaise(location.buildings);

/** A location's total sum insured: the exact items and buildings added, then rounded. */
export function locationTotal(location: LocationFigures): Rupees {
  return paiseToRupees(locationPaise(location));
}

/** The items of one Fire line at a location (the subtotal of headings 1 and 5); D1: buildings
 * add to the Building line. */
export function groupTotal(location: LocationFigures, group: FireGroup): Rupees {
  const items = totalPaise(
    location.fire.filter((item) => ITEM_BY_KEY.get(item.key)?.group === group),
  );
  const buildings = group === 'BUILDING' ? buildingsPaise(location.buildings) : 0n;
  return paiseToRupees(items + buildings);
}

/** Option 1 of each Fire line: every location's items (and D1 buildings) in the line. */
export function fireGroupTotals(locations: readonly LocationFigures[]): Record<FireGroup, Rupees> {
  return Object.fromEntries(
    FIRE_GROUPS.map((group) => {
      const items = totalPaise(
        locations.flatMap((location) =>
          location.fire.filter((item) => ITEM_BY_KEY.get(item.key)?.group === group),
        ),
      );
      const buildings =
        group === 'BUILDING'
          ? locations.reduce((total, location) => total + buildingsPaise(location.buildings), 0n)
          : 0n;
      return [group, paiseToRupees(items + buildings)];
    }),
  ) as Record<FireGroup, Rupees>;
}

/**
 * The contents Burglary covers (C-3, D3). Client-confirmed **Option A**:
 *   Burglary Sum Insured = Total Fire Sum Insured − Building Sum Insured
 * where "Building Sum Insured" is the dynamic buildings only (D1). Every Fire item stays in the
 * base — including the Building line's fixed civil-structure items Compound wall, False ceiling and
 * **Plinth & Foundation**; only the buildings are deducted. Mirrors the backend `contentsTotals`.
 */
export function contentsTotal(locations: readonly LocationFigures[]): Rupees {
  // Option A: all Fire items at every location (no group is excluded); buildings are not added.
  return paiseToRupees(totalPaise(locations.flatMap((location) => location.fire)));
}

/**
 * The Fire contents Burglary covers with a basis (C-3, D3 Option A): Option 1 is Total Fire minus
 * buildings (i.e. all Fire items, civil-structure items included). Option 2 adds the Fire lines'
 * second figures when given (null when none is); buildings carry no Option 2.
 */
export function contentsOptions(
  locations: readonly LocationFigures[],
  option2: readonly { group: FireGroup; amount: string | null }[],
): { proposed1: Rupees; proposed2: Rupees | null } {
  // Option 2 is entered per Fire line, not per item: the Building line's Option 2 is one typed
  // figure for the whole building line (buildings included) and cannot be split into a
  // buildings-only part, so it stays out of the Burglary base — the same as before D3. Mirrors the
  // backend `contentsTotals`.
  const seconds = option2
    .filter((line) => line.group !== 'BUILDING')
    .map((line) => text(line.amount))
    .filter((value) => WHOLE_RUPEES.test(value));
  return {
    proposed1: contentsTotal(locations),
    proposed2: seconds.length > 0 ? add(seconds) : null,
  };
}

/** A sum insured on a basis (100% or a first-loss share), to the rupee as shown. */
export function onBasis(value: Rupees | null, basis: BurglaryBasis): Rupees | null {
  if (value === null || !WHOLE_RUPEES.test(value)) return null;
  // Whole rupees × percent is paise × 1: round half up to the rupee.
  return paiseToRupees(BigInt(value) * BigInt(BURGLARY_BASIS_PERCENT[basis]));
}

/** The answers to a section's covers with one changed (C-6): null takes the answer away. */
export function withCover(
  covers: readonly CoverInput[],
  name: string,
  required: boolean | null,
): CoverInput[] {
  const others = covers.filter((cover) => cover.name !== name);
  return required === null ? others : [...others, { name, required }];
}

/** The exact Fire total of all locations, rounded (Option 1); D1: buildings are included. */
export function fireTotal(locations: readonly LocationFigures[]): Rupees {
  return paiseToRupees(locations.reduce((total, location) => total + locationPaise(location), 0n));
}

const add = (values: readonly Rupees[]) =>
  values.reduce((total, value) => total + BigInt(value), 0n).toString();

export function sumRupeesOf(values: readonly Rupees[]): Rupees {
  return add(values);
}

const blankRisk = () =>
  Object.fromEntries(RISK_DETAIL_FIELDS.map((field) => [field.key, ''])) as LocationForm['risk'];

/** A new, empty building (D1). */
export function blankBuilding(): BuildingForm {
  return { name: '', sqFt: '', ratePerSqFt: '', amount: '' };
}

/** A location as just added: no buildings yet, and every Fire item blank. */
export function blankLocation(locationId: string): LocationForm {
  return {
    locationId,
    buildings: [],
    fire: FIRE_ITEMS.map((item) => ({ key: item.key, sqFt: '', ratePerSqFt: '', amount: '' })),
    hypothecation: '',
    openStock: '',
    risk: blankRisk(),
  };
}

const lineValues = (code: OtherSection, values: Record<string, string | null>) =>
  Object.fromEntries(
    (SECTION_LINES[code as SectionWithLines] ?? []).map((line) => [
      line.key,
      values[line.key] ?? '',
    ]),
  );

const answered = (covers: ProposalRecord['fire']['covers']): CoverInput[] =>
  covers.flatMap((cover) =>
    cover.required === null ? [] : [{ name: cover.name, required: cover.required }],
  );

const asRupees = (value: string | null) => (value === null ? '' : wholeRupees(value));

/** The Existing column as form values: what the record shows, typed or (renewals) copied. */
function existingForm(record: ProposalRecord): DataSheetForm['existing'] {
  const anyLine = record.fire.groups.some((line) => line.existing !== null);
  return {
    insurer: record.existing?.insurer ?? '',
    policyNumber: record.existing?.policyNumber ?? '',
    fireLines: record.fire.groups.map((line) => ({
      group: line.group,
      amount: asRupees(line.existing),
    })),
    fireTotal: anyLine ? '' : asRupees(record.fire.existing),
  };
}

/** The saved Data Sheet as form values: every Fire item and section in order, blanks as "". */
export function toDataSheetForm(record: ProposalRecord): DataSheetForm {
  const option2 = new Map(record.fire.groups.map((line) => [line.group, line.proposed2]));
  return {
    dueDate: record.dueDate,
    policyStart: record.policyStart ?? '',
    policyEnd: record.policyEnd ?? '',
    locations: record.locations.map((location) => {
      const saved = new Map(location.fire.map((item) => [item.key, item]));
      return {
        locationId: location.locationId,
        // D1: the location's buildings (the API already folds legacy Building 1/2 into this list).
        buildings: location.buildings.map((building) => ({
          name: building.name ?? '',
          sqFt: building.sqFt ?? '',
          ratePerSqFt: building.ratePerSqFt ?? '',
          amount: building.amount ?? '',
        })),
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
    fireCovers: answered(record.fire.covers),
    // Only a product chosen on the case is a choice; a suggestion is left to follow the Fire total.
    product: {
      code: record.product && record.product.source !== 'SUGGESTED' ? record.product.code : '',
      reason: record.product?.reason ?? '',
    },
    addons: record.addons.map((addon) => ({ list: addon.list, name: addon.name })),
    existing: existingForm(record),
    // In the coverage section master's order; sections switched off there are not offered.
    sections: record.sections.map((section) => ({
      code: section.code,
      included: section.included,
      proposed1: section.proposed1 === null ? '' : wholeRupees(section.proposed1),
      proposed2: section.proposed2 === null ? '' : wholeRupees(section.proposed2),
      existing: asRupees(section.existing),
      // Every line of the section, blank as "", in its three options (D-4, C-2).
      lines: lineValues(section.code, section.lines),
      lines2: lineValues(section.code, section.lines2),
      existingLines: lineValues(section.code, section.existingLines),
      // A Burglary still without a sum insured starts on 100%, worked out from the contents (C-3).
      basis:
        section.basis ??
        (section.code === 'BURGLARY' && section.proposed1 === null ? 'FULL' : null),
      covers: answered(section.covers),
      annexure: section.annexure.map((row) => ({
        description: row.description,
        quantity: row.quantity ?? '',
        dimensions: row.dimensions ?? '',
        makeModel: row.makeModel ?? '',
        serialNo: row.serialNo ?? '',
        year: row.year ?? '',
        sumInsured: wholeRupees(row.sumInsured),
      })),
    })),
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

/** D1: a building with nothing filled in (no name, area, rate or amount) is dropped on save. */
const isBlankBuilding = (building: BuildingForm) =>
  !text(building.name) &&
  !text(building.sqFt) &&
  !text(building.ratePerSqFt) &&
  !text(building.amount);

/** The request body: Fire items left fully blank are not sent. */
/** A new, empty annexure row. */
export function blankAnnexureRow(): AnnexureRowForm {
  return {
    description: '',
    quantity: '',
    dimensions: '',
    makeModel: '',
    serialNo: '',
    year: '',
    sumInsured: '',
  };
}

/** The total of an annexure's rows as typed (rows without a valid amount count as 0). */
export function annexureTotal(rows: readonly { sumInsured: string | null }[]): Rupees {
  return add(
    rows.map((row) => (WHOLE_RUPEES.test(text(row.sumInsured)) ? text(row.sumInsured) : '0')),
  );
}

/**
 * The total of the lines a section's sum insured is made of (SUM_INSURED_LINES: FLOP's gross
 * profit, Money's safe and single carrying, Fidelity's and PL's limits); null when none is entered.
 */
export function sumOfLines(
  code: OtherSection,
  lines: Partial<Record<string, string | null>> | undefined,
): string | null {
  const values = (SUM_INSURED_LINES[code] ?? [])
    .map((key) => text(lines?.[key]))
    .filter((value) => value !== '');
  if (values.length === 0) return null;
  // A line still being typed (not yet whole rupees) is shown as typed, as a single line always was.
  if (values.length === 1) return values[0] ?? null;
  return add(values.map((value) => (WHOLE_RUPEES.test(value) ? value : '0')));
}

/**
 * A section's sum insured as it will be saved (D-5): an annexure's total when it has rows, the
 * total of its sum insured lines when entered, else Proposed 1 as typed. The API does the same.
 */
export function sectionSumInsured(section: {
  code: OtherSection;
  proposed1: string | null;
  lines?: Partial<Record<string, string | null>>;
  annexure?: readonly { sumInsured: string | null }[];
}): string | null {
  if (isAnnexureSection(section.code) && (section.annexure?.length ?? 0) > 0) {
    return annexureTotal(section.annexure ?? []);
  }
  return sumOfLines(section.code, section.lines) ?? section.proposed1;
}

/** Option 2 as it will be saved: with several sum insured lines (Money), their Option 2 total. */
export function sectionOption2(section: {
  code: OtherSection;
  proposed2: string | null;
  lines2?: Partial<Record<string, string | null>>;
}): string | null {
  return (SUM_INSURED_LINES[section.code]?.length ?? 0) > 1
    ? (sumOfLines(section.code, section.lines2) ?? section.proposed2)
    : section.proposed2;
}

/**
 * The request body: Fire items left fully blank are not sent; derived sums insured are set; an
 * Existing column left blank throughout follows the policy software's copy.
 */
export function toDataSheetRequest(values: DataSheetInput): DataSheetInput {
  const existing =
    values.existing && (values.existing.insurer !== null || hasExistingFigures(values))
      ? values.existing
      : null;
  const contents = contentsOptions(values.locations, values.fireOption2);
  return {
    ...values,
    existing,
    locations: values.locations.map((location) => ({
      ...location,
      // D1: drop buildings left entirely blank, as the API does.
      buildings: (location.buildings ?? []).filter((building) => !isBlankBuilding(building)),
      fire: location.fire.filter((item) => !isBlankItem(item)),
    })),
    sections: values.sections.map((section) => {
      // C-3: Burglary on a basis is the Fire contents (the API works it out the same way).
      const fromContents = section.code === 'BURGLARY' && section.basis !== null;
      return {
        ...section,
        proposed1: fromContents ? contents.proposed1 : sectionSumInsured(section),
        proposed2: fromContents ? contents.proposed2 : sectionOption2(section),
        basis: hasBasis(section.code) ? section.basis : null,
        annexure: isAnnexureSection(section.code) ? section.annexure : [],
      };
    }),
  };
}
