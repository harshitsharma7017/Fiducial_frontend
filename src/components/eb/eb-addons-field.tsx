'use client';

import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { catalogQuery } from '@/lib/api/catalog';
import { EB_ADDON_LIST } from '@/shared';

const key = (name: string) => name.trim().toLowerCase();

/**
 * The add-on covers of an Employee Benefits case (GMC, GPA, GTLI), ticked from the Employee
 * Benefits list of the add-on master. A cover the case already has stays listed after the master
 * switches it off, so it can still be unticked.
 */
export function EbAddonsField({
  value,
  onChange,
  disabled,
}: {
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
}) {
  const addons = useQuery(catalogQuery('addons'));
  if (addons.isPending) {
    return <p className="text-sm text-muted-foreground">Loading the add-on covers…</p>;
  }
  if (addons.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        The add-on covers could not be loaded.
      </p>
    );
  }
  const chosen = new Set(value.map(key));
  const listed = addons.data
    .filter((item) => item.list === EB_ADDON_LIST && (item.active || chosen.has(key(item.name))))
    .map((item) => item.name);
  // A cover saved on the case that the master no longer has at all.
  const orphans = value.filter((name) => !listed.some((item) => key(item) === key(name)));
  const names = [...listed, ...orphans];
  if (names.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Employee Benefits add-on covers yet. An Admin adds them under Masters, Add-on Covers.
      </p>
    );
  }
  const toggle = (name: string, on: boolean) =>
    onChange(on ? [...value, name] : value.filter((item) => key(item) !== key(name)));
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Add-on covers">
      {names.map((name) => {
        const id = `eb-addon-${key(name).replace(/[^a-z0-9]+/g, '-')}`;
        return (
          <li key={name} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={chosen.has(key(name))}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(name, checked === true)}
            />
            <Label htmlFor={id} className="font-normal">
              {name}
            </Label>
          </li>
        );
      })}
    </ul>
  );
}
