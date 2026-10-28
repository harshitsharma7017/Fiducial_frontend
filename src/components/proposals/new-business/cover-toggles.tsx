'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withCover, type DataSheetForm } from '@/lib/data-sheet';
import type { Cover } from '@/shared';

const MAX_COVER_NAME = 300;

/** Cover names compare without case and repeated spaces, as the API matches them. */
const coverKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The add-on covers of a section (C-6: earthquake, STFI, terrorism, floater...), each asked for
 * or not. Pressing the answer given again takes it back: the RFQ then leaves the cover blank. A
 * cover the coverage section master does not list can be added on the case (client review, 27
 * Oct 2026); it is asked for, and printed with the others once the Data Sheet is saved.
 */
export function CoverToggles({
  path,
  covers,
  name,
  readOnly,
}: {
  path: 'fireCovers' | `sections.${number}.covers`;
  covers: readonly Cover[];
  name: string;
  readOnly: boolean;
}) {
  const form = useFormContext<DataSheetForm>();
  const answers = useWatch({ control: form.control, name: path }) ?? [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  const known = new Set(covers.map((cover) => coverKey(cover.name)));
  // Covers added here and not saved yet follow the master's (and those saved before).
  const added = answers.filter((answer) => !known.has(coverKey(answer.name)));
  const listed = [
    ...covers.map((cover) => ({ name: cover.name, added: false })),
    ...added.map((answer) => ({ name: answer.name, added: true })),
  ];
  if (listed.length === 0 && readOnly) return null;

  const set = (next: ReturnType<typeof withCover>) =>
    form.setValue(path, next, { shouldDirty: true });
  const add = () => {
    const value = draft.trim().replace(/\s+/g, ' ');
    if (!value) return setError('Name the cover to add');
    if (value.length > MAX_COVER_NAME) return setError('This name is too long');
    if (listed.some((item) => coverKey(item.name) === coverKey(value))) {
      return setError(`${value} is already listed`);
    }
    set(withCover(answers, value, true));
    setDraft('');
    setError(null);
  };

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Add-on covers</legend>
      {listed.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {listed.map((cover) => {
            const answer = answers.find((item) => item.name === cover.name)?.required ?? null;
            const choose = (required: boolean) =>
              set(withCover(answers, cover.name, answer === required ? null : required));
            return (
              <li
                key={cover.name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5"
              >
                <span className="text-sm">{cover.name}</span>
                <span className="flex items-center gap-1">
                  <span role="group" aria-label={`${name}: ${cover.name}`} className="flex gap-1">
                    {([true, false] as const).map((required) => (
                      <Button
                        key={String(required)}
                        type="button"
                        size="sm"
                        variant={answer === required ? 'default' : 'outline'}
                        aria-pressed={answer === required}
                        disabled={readOnly}
                        className="h-7 px-2 text-xs"
                        onClick={() => choose(required)}
                      >
                        {required ? 'Required' : 'Not required'}
                      </Button>
                    ))}
                  </span>
                  {cover.added && !readOnly ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Remove ${cover.name}`}
                      onClick={() => set(withCover(answers, cover.name, null))}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {readOnly ? null : (
        <div className="grid gap-1">
          <Label htmlFor={inputId} className="text-xs font-normal text-muted-foreground">
            Another add-on cover for {name}
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={inputId}
              value={draft}
              maxLength={MAX_COVER_NAME}
              placeholder="For example, Terrorism on stocks"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="max-w-sm"
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                // Enter adds the cover; it does not save the Data Sheet.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus aria-hidden="true" />
              Add cover
            </Button>
          </div>
          {error ? (
            <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
