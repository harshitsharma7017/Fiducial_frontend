'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ROLES, ROLE_LABELS, type Role } from '@/shared';

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: 'Users, master data activation; passes every role check',
  MANAGER: 'Reviews and approves',
  ACCOUNT_MANAGER: 'Owns client relationships',
  PLACEMENT_EXEC: 'Handles insurers and quotes',
  READ_ONLY: 'Can view, cannot change',
};

/** A checkbox group for roles. */
export function RolesFieldset({
  value,
  onChange,
  disabledRoles = [],
  error,
  legend = 'Roles',
}: {
  value: Role[];
  onChange: (roles: Role[]) => void;
  disabledRoles?: Role[];
  error?: string;
  legend?: string;
}) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {ROLES.map((role) => {
        const id = `${baseId}-${role}`;
        const checked = value.includes(role);
        return (
          <div key={role} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabledRoles.includes(role)}
              onCheckedChange={(state) =>
                onChange(
                  state === true ? [...value, role] : value.filter((current) => current !== role),
                )
              }
              className="mt-0.5"
            />
            <Label htmlFor={id} className="grid gap-0.5 font-normal">
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span className="text-xs text-muted-foreground">{ROLE_HINTS[role]}</span>
            </Label>
          </div>
        );
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
